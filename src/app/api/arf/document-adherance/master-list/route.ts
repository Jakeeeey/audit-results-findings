//master-list/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME  = 'vos_access_token';
const EXTERNAL_API = `${process.env.SPRING_API_BASE_URL}/api/view-adherence-open-non-compliant-documents`;
const DIRECTUS_URL   = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized — no session token found' },
      { status: 401 }
    );
  }

  // Log token type to confirm JWT vs session ID
  console.log('[MASTER-LIST API] Token starts with:', token.slice(0, 10));

  const params = new URLSearchParams();
  const docType    = searchParams.get('docType')    ?? '';
  const preparedBy = searchParams.get('preparedBy') ?? '';
  const startDate  = searchParams.get('startDate')  ?? '';
  const endDate    = searchParams.get('endDate')    ?? '';

  if (docType)    params.set('docType',    docType);
  if (preparedBy) params.set('preparedBy', preparedBy);
  if (startDate)  params.set('startDate',  startDate);
  if (endDate)    params.set('endDate',    endDate);

  const externalUrl = `${EXTERNAL_API}?${params}`;
  console.log('[MASTER-LIST API] Fetching:', externalUrl);

  const res = await fetch(externalUrl, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie:        `${COOKIE_NAME}=${token}`,
    },
  });

  console.log('[MASTER-LIST API] External response status:', res.status);

  if (!res.ok) {
    const errText = await res.text();
    console.error('[MASTER-LIST API] Error:', errText);
    return NextResponse.json(
      { ok: false, status: res.status, error: errText },
      { status: res.status }
    );
  }

  const json = await res.json();

  // Handle multiple response structures:
  // 1. { data: [...], total: N }
  // 2. Direct array [...]
  // 3. { content: [...] }  (Spring Page)
  // 4. { records: [...] }
  let records: Record<string, unknown>[] = [];

  if (Array.isArray(json)) {
    records = json;
  } else if (Array.isArray(json?.data)) {
    records = json.data;
  } else if (Array.isArray(json?.content)) {
    records = json.content;
  } else if (Array.isArray(json?.records)) {
    records = json.records;
  }

  console.log('[MASTER-LIST API] Response keys:', Object.keys(json ?? {}));
  console.log('[MASTER-LIST API] Records found:', records.length);
  if (records.length > 0) {
    console.log('[MASTER-LIST API] Sample record keys:', Object.keys(records[0] as object));
  }

  // 1. Fetch NTE mapping from Directus
  const nteMap = new Map<string, string>();
  try {
    const nteRes = await fetch(`${DIRECTUS_URL}/items/adherence_nte_details?fields=doc_number,nte_id.nte_no&limit=-1`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: 'no-store'
    });
    if (nteRes.ok) {
      const nteJson = await nteRes.json();
      const nteData = nteJson.data || [];
      const grouped = new Map<string, string[]>();
      
      nteData.forEach((item: { doc_number: string; nte_id?: { nte_no?: string } }) => {
        const docNo = item.doc_number;
        const nteNo = item.nte_id?.nte_no;
        if (docNo && nteNo) {
          const list = grouped.get(docNo) || [];
          if (!list.includes(nteNo)) list.push(nteNo);
          grouped.set(docNo, list);
        }
      });
      
      grouped.forEach((list, docNo) => {
        nteMap.set(docNo, list.join(', '));
      });
    }
  } catch (err) {
    console.error('[MASTER-LIST API] Failed to fetch NTEs:', err);
  }

  // 2. Fetch Remarks status from Directus
  const remarksSet = new Set<string>();
  try {
    const remRes = await fetch(`${DIRECTUS_URL}/items/adherence_remarks?fields=doc_number&limit=-1`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: 'no-store'
    });
    if (remRes.ok) {
      const remJson = await remRes.json();
      const remData = remJson.data || [];
      remData.forEach((item: { doc_number: string }) => {
        if (item.doc_number) remarksSet.add(String(item.doc_number));
      });
    }
  } catch (err) {
    console.error('[MASTER-LIST API] Failed to fetch Remarks:', err);
  }

  // 3. Merge
  const mergedData = records.map(record => {
    const docNoStr = String(record.docNumber);
    return {
      ...record,
      nteNo: nteMap.get(docNoStr) || null,
      hasRemarks: remarksSet.has(docNoStr)
    };
  });

  return NextResponse.json({
    data:  mergedData,
    total: mergedData.length,
  });
}