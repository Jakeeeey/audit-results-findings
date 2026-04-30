import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL   = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const COOKIE_NAME    = "vos_access_token";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore   = await cookies();
  const token         = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const { id }        = await params;

  try {
    const body = await request.json() as { remark?: string };
    const { remark } = body;

    if (!remark) {
      return NextResponse.json({ ok: false, message: "remark is required." }, { status: 400 });
    }

    const res = await fetch(`${DIRECTUS_URL}/items/adherence_remarks/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body:    JSON.stringify({
        remark
      }),
      cache: "no-store",
    });

    const json = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      const errors = json?.errors as Record<string, unknown>[] | undefined;
      const msg    = errors?.[0]?.message ? String(errors[0].message) : "Failed to update.";
      return NextResponse.json({ ok: false, message: msg }, { status: res.status });
    }

    return NextResponse.json({ ok: true, data: json.data, message: "Remark updated successfully." });
  } catch (err) {
    console.error("[REMARKS PATCH]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: "Gateway Error" }, { status: 502 });
  }
}
