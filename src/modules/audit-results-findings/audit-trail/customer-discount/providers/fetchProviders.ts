/**
 * fetchProviders.ts
 * ─────────────────
 * Responsibility:
 *  • Build URLs for the Next.js API proxy
 *  • Make fetch calls and map raw responses to CustomerDiscountRow[]
 *  • Normalize API errors into user-friendly strings
 *
 * Never import React or use JSX here.
 */

import type { CustomerDiscountFilters, CustomerDiscountRow } from "../types";

/** Internal Next.js proxy endpoint */
const API_ENDPOINT = "/api/arf/audit-trail/customer-discount";

// ─── URL Builder ──────────────────────────────────────────────────────────────
function buildFilterUrl(filters: CustomerDiscountFilters): string {
    const params = new URLSearchParams();

    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    // The API param is "changedByName"; we map our generic "search" to it
    if (filters.search.trim()) params.set("changedByName", filters.search.trim());

    const qs = params.toString();
    return qs ? `${API_ENDPOINT}?${qs}` : API_ENDPOINT;
}

// ─── Response Mapper ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(raw: any, index: number): CustomerDiscountRow {
    return {
        id: raw.id ?? raw.logId ?? raw.discountLogId ?? index,
        no: index + 1,

        action: raw.action ?? raw.actionType ?? null,

        customerCode: raw.customerCode ?? raw.customer_code ?? null,
        customerName: raw.customerName ?? raw.customer_name ?? null,

        storeName: raw.storeName ?? raw.store_name ?? null,

        supplierName: raw.supplierName ?? raw.supplier_name ?? null,
        categoryName: raw.categoryName ?? raw.category_name ?? null,

        discountType: raw.discountType ?? raw.discount_type ?? null,

        changedBy: raw.changedByName ?? raw.changedBy ?? raw.changed_by ?? null,
        date: raw.date ?? raw.changedAt ?? raw.changed_at ?? raw.createdAt ?? null,
    };
}

// ─── Public Intent Functions ──────────────────────────────────────────────────
/**
 * Fetch customer-discount audit logs from the proxied Spring Boot endpoint.
 * Returns an empty array on network/API errors (caller decides how to toast).
 */
export async function fetchCustomerDiscountLogs(
    filters: CustomerDiscountFilters,
): Promise<{ rows: CustomerDiscountRow[]; error?: string }> {
    try {
        const url = buildFilterUrl(filters);
        const res = await fetch(url, { cache: "no-store" });

        if (!res.ok) {
            const text = await res.text();
            return {
                rows: [],
                error: `Server returned ${res.status}: ${text || "Unknown error"}`,
            };
        }

        const data = await res.json();

        // The Spring Boot API may return an array directly or wrap it
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.content)
                ? data.content
                : [];

        return { rows: raw.map(mapRow) };
    } catch (e: unknown) {
        const err = e as Error;
        return { rows: [], error: err.message ?? "Unexpected network error" };
    }
}
