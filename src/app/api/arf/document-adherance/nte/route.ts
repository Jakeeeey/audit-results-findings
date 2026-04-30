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

export async function POST(request: NextRequest) {
  const cookieStore   = await cookies();
  const token         = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const currentUserId = decodeJwtUserId(token);
  if (!currentUserId) {
    return NextResponse.json({ ok: false, message: "Invalid session token." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { details, remarks } = body as {
      details: Array<{ doc_type: string; doc_number: string; days_elapsed: number; category?: string; prepared_by: string }>;
      remarks?: string;
    };

    if (!details || details.length === 0) {
      return NextResponse.json({ ok: false, message: "NTE details are required." }, { status: 400 });
    }

    const uniquePreparedBy = new Set(details.map(d => d.prepared_by));
    if (uniquePreparedBy.size > 1) {
      return NextResponse.json({ ok: false, message: "All selected documents must belong to the same person." }, { status: 400 });
    }

    // 1. Create NTE Header
    const nte_no = `NTE-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const headerRes = await fetch(`${DIRECTUS_URL}/items/adherence_nte_header`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body:    JSON.stringify({
        nte_no,
        recipient_id: currentUserId,
        created_by: currentUserId,
        status: "Pending",
        remarks: remarks || null
      }),
      cache: "no-store",
    });

    const headerJson = await headerRes.json() as { data: { id: string | number } };
    if (!headerRes.ok) {
      return NextResponse.json({ ok: false, message: "Failed to create NTE header." }, { status: headerRes.status });
    }

    const nteId = headerJson.data.id;

    // 2. Create NTE Details
    const detailsPayload = details.map((d) => ({
      nte_id: nteId,
      doc_type: d.doc_type,
      doc_number: d.doc_number,
      days_elapsed: d.days_elapsed,
      category: d.category || null
    }));

    const detailsRes = await fetch(`${DIRECTUS_URL}/items/adherence_nte_details`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body:    JSON.stringify(detailsPayload),
      cache: "no-store",
    });

    const detailsJson = await detailsRes.json() as { data: Record<string, unknown>[] };
    if (!detailsRes.ok) {
      return NextResponse.json({ ok: false, message: "Failed to create NTE details." }, { status: detailsRes.status });
    }

    return NextResponse.json({ ok: true, data: { header: headerJson.data, details: detailsJson.data }, message: "NTE created successfully." });
  } catch (err) {
    console.error("[NTE POST]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: "Gateway Error" }, { status: 502 });
  }
}
