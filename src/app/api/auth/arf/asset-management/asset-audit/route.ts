import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS  = 15_000;
const COOKIE_NAME = "vos_access_token";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  return url.replace(/\/$/, "");
}

function staticToken(): string {
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (!token) throw new Error("DIRECTUS_STATIC_TOKEN is not configured.");
  return token;
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${staticToken()}`,
  };
}

async function proxyFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function pickStr(obj: Record<string, unknown> | null, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function currentUserFromToken(token: string) {
  const payload = decodeJwtPayload(token);
  const rawId   = payload?.sub ?? payload?.userId ?? payload?.id;
  const first   = pickStr(payload, ["Firstname", "FirstName", "firstName", "first_name"]);
  const last    = pickStr(payload, ["Lastname",  "LastName",  "lastName",  "last_name"]);
  const email   = pickStr(payload, ["email", "Email"]);
  return {
    id:   typeof rawId === "string" ? parseInt(rawId, 10) : typeof rawId === "number" ? rawId : 0,
    name: [first, last].filter(Boolean).join(" ") || email || "Unknown",
    email,
  };
}

// ─── Normalize a raw Directus assets_and_equipment row with pre-joined lookup maps ──
// Joins are done in code so data shows regardless of whether Directus relations
// are configured. item_id is kept as-is (integer FK from Directus).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeAsset(raw: any, itemsMap: Map<number, any>, typesMap: Map<number, any>, classMap: Map<number, any>, usersMap: Map<number, any>): any {
  // item_id is the FK integer; look it up in the pre-fetched items map
  const itemFk  = typeof raw.item_id === "number" ? raw.item_id : null;
  const itemRow = itemFk !== null ? (itemsMap.get(itemFk) ?? null) : null;

  const typeFk  = itemRow !== null && typeof itemRow.item_type === "number" ? itemRow.item_type : null;
  const typeRow = typeFk !== null ? (typesMap.get(typeFk) ?? null) : null;

  const classFk  = itemRow !== null && typeof itemRow.item_classification === "number" ? itemRow.item_classification : null;
  const classRow = classFk !== null ? (classMap.get(classFk) ?? null) : null;

  const employeeFk  = typeof raw.employee === "number" ? raw.employee : null;
  // Only keep the employee FK if that user_id actually exists in the user table.
  // If the FK points to a deleted/non-existent user we must use null so that
  // asset_missing_audits.accountable_user_id FK constraint is not violated.
  const userRow      = employeeFk !== null ? (usersMap.get(employeeFk) ?? null) : null;
  const resolvedEmpId = userRow !== null ? employeeFk : null;
  const firstName    = userRow?.first_name  ?? "";
  const lastName     = userRow?.last_name   ?? "";
  const employeeName = resolvedEmpId !== null
    ? ([firstName, lastName].filter(Boolean).join(" ") || userRow?.email || null)
    : null;

  return {
    id:                  raw.id,
    rfid_code:           raw.rfid_code        ?? null,
    barcode:             raw.barcode          ?? null,
    serial:              raw.serial           ?? null,
    quantity:            raw.quantity         ?? null,
    cost_per_item:       raw.cost_per_item    ?? null,
    total:               raw.total            ?? null,
    condition:           raw.condition        ?? null,
    date_acquired:       raw.date_acquired    ?? null,
    is_active_warning:   raw.is_active_warning ?? 0,
    item_name:           itemRow?.item_name            ?? null,
    classification_name: classRow?.classification_name ?? null,
    type_name:           typeRow?.type_name            ?? null,
    employee_id:         resolvedEmpId,
    employee_name:       employeeName,
  };
}

// ─── GET – list all assets for audit ──────────────────────────────────────────
//
//  Fetches assets_and_equipment, items, item_type, and item_classification in
//  parallel then joins them in code. This works even when Directus does not have
//  the relations registered (nested-field expansion would silently return null).

export async function GET() {
  const cookieStore  = await cookies();
  const jwtToken     = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const current_user = jwtToken ? currentUserFromToken(jwtToken) : null;

  if (!jwtToken) {
    return NextResponse.json({ ok: false, message: "Not authenticated" }, { status: 401 });
  }

  try {
    // Fetch all needed collections in parallel
    const [assetsRes, itemsRes, typesRes, classRes, usersRes] = await Promise.all([
      proxyFetch(
        `${baseUrl()}/items/assets_and_equipment?fields=id,rfid_code,barcode,serial,quantity,cost_per_item,total,condition,date_acquired,is_active_warning,item_id,employee&limit=-1`,
        { method: "GET", headers: authHeaders() }
      ),
      proxyFetch(
        `${baseUrl()}/items/items?fields=id,item_name,item_type,item_classification&limit=-1`,
        { method: "GET", headers: authHeaders() }
      ),
      proxyFetch(
        `${baseUrl()}/items/item_type?fields=id,type_name&limit=-1`,
        { method: "GET", headers: authHeaders() }
      ),
      proxyFetch(
        `${baseUrl()}/items/item_classification?fields=id,classification_name&limit=-1`,
        { method: "GET", headers: authHeaders() }
      ),
      proxyFetch(
        `${baseUrl()}/items/user?fields=user_id,first_name,last_name,email&limit=-1`,
        { method: "GET", headers: authHeaders() }
      ),
    ]);

    const [assetsData, itemsData, typesData, classData, usersData] = await Promise.all([
      parseJson(assetsRes),
      parseJson(itemsRes),
      parseJson(typesRes),
      parseJson(classRes),
      parseJson(usersRes),
    ]);

    if (!assetsRes.ok) {
      console.error("[asset-audit GET] assets_and_equipment error", assetsRes.status, assetsData);
      return NextResponse.json(
        {
          ok: false,
          current_user,
          message:
            assetsData?.errors?.[0]?.message ??
            assetsData?.message ??
            `Upstream error (HTTP ${assetsRes.status})`,
        },
        { status: assetsRes.status }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawAssets:  any[] = Array.isArray(assetsData) ? assetsData : (assetsData?.data  ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawItems:   any[] = Array.isArray(itemsData)  ? itemsData  : (itemsData?.data   ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawTypes:   any[] = Array.isArray(typesData)  ? typesData  : (typesData?.data   ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawClasses: any[] = Array.isArray(classData)  ? classData  : (classData?.data   ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawUsers:   any[] = Array.isArray(usersData)  ? usersData  : (usersData?.data   ?? []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsMap = new Map<number, any>(rawItems.map((r: any)   => [Number(r.id), r]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typesMap = new Map<number, any>(rawTypes.map((r: any)   => [Number(r.id), r]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const classMap = new Map<number, any>(rawClasses.map((r: any) => [Number(r.id), r]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usersMap = new Map<number, any>(rawUsers.map((r: any)   => [Number(r.user_id), r]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assets = rawAssets.map((raw: any) => normalizeAsset(raw, itemsMap, typesMap, classMap, usersMap));

    console.log(
      `[asset-audit GET] assets=${assets.length} items=${rawItems.length} types=${rawTypes.length} classes=${rawClasses.length} users=${rawUsers.length}`
    );

    return NextResponse.json(
      { ok: true, assets, current_user },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("[asset-audit GET]", msg);
    return NextResponse.json(
      { ok: false, message: "Server error. Please contact Administrator.", current_user },
      { status: 500 }
    );
  }
}

// ─── POST – record missing assets into asset_missing_audits ───────────────────
//
//  POST /api/auth/arf/asset-management/asset-audit
//  Body: { records: Array<{ asset_id, accountable_user_id, reported_by }> }
//    → Directus batch-create: POST {base}/items/asset_missing_audits  (array body)

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const jwtToken    = cookieStore.get(COOKIE_NAME)?.value ?? null;

  if (!jwtToken) {
    return NextResponse.json({ ok: false, message: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.records)) {
    return NextResponse.json(
      { ok: false, message: 'Invalid request body. Expected { records: [...] }' },
      { status: 400 }
    );
  }

  if (body.records.length === 0) {
    return NextResponse.json({ ok: true, message: "No missing assets to report." });
  }

  try {
    // Collect ALL unique user IDs referenced in the records (both accountable_user_id and
    // reported_by) and validate them against the user table in a single request.
    // Any ID that doesn't exist must be sent as null to avoid FK constraint violations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidateIds: number[] = [...new Set<number>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (body.records as any[])
        .flatMap((r) => [r.accountable_user_id, r.reported_by])
        .filter((id): id is number => typeof id === "number")
    )];

    let validUserIds = new Set<number>();
    if (candidateIds.length > 0) {
      const usersRes  = await proxyFetch(
        `${baseUrl()}/items/user?fields=user_id&filter[user_id][_in]=${candidateIds.join(",")}&limit=-1`,
        { method: "GET", headers: authHeaders() }
      );
      const usersData = await parseJson(usersRes);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const users: any[] = Array.isArray(usersData) ? usersData : (usersData?.data ?? []);
      validUserIds = new Set(users.map((u) => Number(u.user_id)));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitizedRecords = (body.records as any[]).map((r) => ({
      ...r,
      accountable_user_id:
        typeof r.accountable_user_id === "number" && validUserIds.has(r.accountable_user_id)
          ? r.accountable_user_id
          : null,
      reported_by:
        typeof r.reported_by === "number" && validUserIds.has(r.reported_by)
          ? r.reported_by
          : null,
    }));

    // Directus batch-create accepts a JSON array in the body
    const upstream = await proxyFetch(
      `${baseUrl()}/items/asset_missing_audits`,
      { method: "POST", headers: authHeaders(), body: JSON.stringify(sanitizedRecords) }
    );
    const data = await parseJson(upstream);

    if (!upstream.ok) {
      console.error("[asset-audit POST] Upstream error", upstream.status, data);
      return NextResponse.json(
        {
          ok: false,
          message:
            data?.errors?.[0]?.message ??
            data?.message ??
            `Upstream error (HTTP ${upstream.status})`,
        },
        { status: upstream.status }
      );
    }

    return NextResponse.json(
      { ok: true, ...(data && typeof data === "object" ? data : {}) },
      { status: upstream.status }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error";
    console.error("[asset-audit POST]", msg);
    return NextResponse.json(
      { ok: false, message: "Server error. Please contact Administrator." },
      { status: 500 }
    );
  }
}
