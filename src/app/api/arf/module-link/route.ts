// src/app/api/arf/module-link/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTUS_URL   = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const docType = searchParams.get('docType') ?? '';

  const filter = docType
    ? `&filter[doc_type][_eq]=${encodeURIComponent(docType)}`
    : '';

  const url = `${DIRECTUS_URL}/items/module_link?fields=*&limit=-1${filter}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[MODULE-LINK API] Directus error:', res.status, text);
      return NextResponse.json({ 
        ok: false, 
        error: `Directus error ${res.status}: ${text}`,
        data: [] 
      }, { status: res.status });
    }

    const json = await res.json();
    console.log('[MODULE-LINK API] Records found:', json.data?.length);
    if (json.data?.length > 0) {
      console.log('[MODULE-LINK API] Sample record:', json.data[0]);
    }
    return NextResponse.json({ ok: true, data: json.data ?? [] });
  } catch (err) {
    console.error('[MODULE-LINK API]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
