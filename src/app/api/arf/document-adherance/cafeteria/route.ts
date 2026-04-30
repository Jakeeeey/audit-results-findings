// src/app/api/arf/document-adherance/cafeteria/route.ts

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

  const res = await fetch(externalUrl, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie:        `${COOKIE_NAME}=${token}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json(
      { ok: false, status: res.status, error: errText },
      { status: res.status }
    );
  }

  const json = await res.json() as { data?: Record<string, unknown>[]; total?: number };

  // Filter to only Cafeteria subsystem records since backend doesn't support subsystem param
  const allData = json.data ?? [];
  const cafeteriaData = allData.filter(
    (record) => typeof record.subsystem === 'string' && record.subsystem.toLowerCase() === 'cafeteria'
  );

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
    console.error('[CAFETERIA API] Failed to fetch NTEs:', err);
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
    console.error('[CAFETERIA API] Failed to fetch Remarks:', err);
  }

  // 3. Merge
  const mergedData = cafeteriaData.map(record => {
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