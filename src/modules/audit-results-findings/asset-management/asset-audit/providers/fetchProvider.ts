import type { AssetAuditItem, SubmitAuditPayload } from "../types";

const DIRECTUS_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN    = process.env.DIRECTUS_STATIC_TOKEN;

// Raw Directus row shape before mapping
interface DirectusRow {
    id: number;
    rfid_code?: string | null;
    barcode?: string | null;
    serial?: string | null;
    quantity?: number | null;
    cost_per_item?: number | null;
    total?: number | null;
    condition?: "Good" | "Bad" | "Under Maintenance" | "Discontinued" | null;
    date_acquired?: string | null;
    is_active_warning?: number;
    // FK relation field name in Directus is `item_id` (links to `items` collection)
    item_id?: {
        item_name?: string | null;
        item_type?: { type_name?: string | null } | null;
        item_classification?: { classification_name?: string | null } | null;
    } | null;
    employee?: {
        user_id?: number | null;
        first_name?: string | null;
        last_name?: string | null;
    } | number | null;
}

function str(v: unknown): string | null {
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function fetchAssetsForAudit(_token: string): Promise<AssetAuditItem[]> {
    if (!DIRECTUS_BASE_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL not set");
    if (!DIRECTUS_TOKEN)    throw new Error("DIRECTUS_STATIC_TOKEN not set");

    const fields = [
        "id",
        "rfid_code",
        "barcode",
        "serial",
        "quantity",
        "cost_per_item",
        "total",
        "condition",
        "date_acquired",
        "is_active_warning",
        "item_id.item_name",
        "item_id.item_type.type_name",
        "item_id.item_classification.classification_name",
        "employee.user_id",
        "employee.first_name",
        "employee.last_name",
    ].join(",");

    const url = `${DIRECTUS_BASE_URL}/items/assets_and_equipment?fields=${encodeURIComponent(fields)}&limit=-1`;

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            "Content-Type": "application/json",
        },
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upstream error (HTTP ${res.status})${text ? `: ${text}` : ""}`);
    }

    const json = await res.json();
    const rows: DirectusRow[] = json.data ?? [];

    return rows.map((row): AssetAuditItem => {
        const emp = typeof row.employee === "object" && row.employee !== null ? row.employee : null;
        const empId   = emp ? (emp.user_id ?? null) : (typeof row.employee === "number" ? row.employee : null);
        const empName = emp
            ? [str(emp.first_name), str(emp.last_name)].filter(Boolean).join(" ") || null
            : null;

        return {
            id:                  row.id,
            rfid_code:           row.rfid_code           ?? null,
            barcode:             row.barcode             ?? null,
            serial:              row.serial              ?? null,
            quantity:            row.quantity            ?? null,
            cost_per_item:       row.cost_per_item       ?? null,
            total:               row.total               ?? null,
            condition:           row.condition           ?? null,
            date_acquired:       row.date_acquired       ?? null,
            is_active_warning:   row.is_active_warning   ?? 0,
            item_name:           str(row.item_id?.item_name),
            classification_name: str(row.item_id?.item_classification?.classification_name),
            type_name:           str(row.item_id?.item_type?.type_name),
            employee_id:         empId,
            employee_name:       empName,
        };
    });
}

export async function submitAuditMissing(
    _token: string,
    payload: SubmitAuditPayload
) {
    if (!DIRECTUS_BASE_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL not set");
    if (!DIRECTUS_TOKEN)    throw new Error("DIRECTUS_STATIC_TOKEN not set");

    if (!payload.records || payload.records.length === 0) {
        return { ok: true };
    }

    // Directus batch-create: POST an array to /items/<collection>
    const res = await fetch(`${DIRECTUS_BASE_URL}/items/assets_missing_audits`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload.records),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upstream error (HTTP ${res.status})${text ? `: ${text}` : ""}`);
    }

    return res.json();
}
