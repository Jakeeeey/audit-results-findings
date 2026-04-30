import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL   = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const COOKIE_NAME    = "vos_access_token";

// ─── Decode JWT payload to get current user_id ────────────────────────────────
function decodeJwtUserId(token: string): number | null {
  try {
    const parts   = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded  = payload + "=".repeat((4 - payload.length % 4) % 4);
    const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf-8")) as Record<string, unknown>;
    const sub = decoded.sub ?? decoded.user_id ?? decoded.userId ?? decoded.id;
    const id  = Number(sub);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const docType = searchParams.get("docType");
  const docNumber = searchParams.get("docNumber");

  if (!docType || !docNumber) {
    return NextResponse.json({ ok: false, message: "docType and docNumber are required." }, { status: 400 });
  }

  try {
    const filter = {
      _and: [
        { doc_type: { _eq: docType } },
        { doc_number: { _eq: docNumber } }
      ]
    };

    const res = await fetch(`${DIRECTUS_URL}/items/adherence_remarks?filter=${encodeURIComponent(JSON.stringify(filter))}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });

    const json = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      const errors = json?.errors as Record<string, unknown>[] | undefined;
      const msg    = errors?.[0]?.message ? String(errors[0].message) : "Failed to fetch.";
      return NextResponse.json({ ok: false, message: msg }, { status: res.status });
    }

    const data = json.data as Record<string, unknown>[];
    if (data && data.length > 0) {
      return NextResponse.json({ ok: true, data: data[0] });
    } else {
      return NextResponse.json({ ok: true, data: null });
    }

  } catch (err) {
    console.error("[REMARKS GET]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: "Gateway Error" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const currentUserId = decodeJwtUserId(token);

  try {
    const body = await request.json() as { doc_type?: string; doc_number?: string; remark?: string };
    const { doc_type, doc_number, remark } = body;

    if (!doc_type || !doc_number || !remark) {
      return NextResponse.json(
        { ok: false, message: "doc_type, doc_number, and remark are required." },
        { status: 400 }
      );
    }

    const res  = await fetch(`${DIRECTUS_URL}/items/adherence_remarks`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body:    JSON.stringify({
        doc_type,
        doc_number,
        remark,
        created_by: currentUserId,
      }),
      cache:   "no-store",
    });

    const json = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      const errors = json?.errors as Record<string, unknown>[] | undefined;
      const msg    = errors?.[0]?.message ? String(errors[0].message) : "Failed to create.";
      return NextResponse.json({ ok: false, message: msg }, { status: res.status });
    }

    return NextResponse.json(
      { ok: true, data: json.data, message: "Remark created successfully." },
      { status: 201 }
    );
  } catch (err) {
    console.error("[REMARKS POST]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: "Gateway Error" }, { status: 502 });
  }
}
