/**
 * fetchProviders.ts
 * ─────────────────
 * Responsibility:
 *  • Build URLs for the Next.js API proxy
 *  • Make fetch calls and map raw responses to PriceChangeRow[]
 *  • Normalize API errors into user-friendly strings
 *
 * Never import React or use JSX here.
 */

import type { PriceChangeFilters, PriceChangeRow } from "../types";

/** Internal Next.js proxy endpoint */
const API_ENDPOINT = "/api/arf/audit-trail/price-change";

// ─── URL Builder ──────────────────────────────────────────────────────────────
function buildFilterUrl(filters: PriceChangeFilters): string {
    const params = new URLSearchParams();

    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.status) params.set("status", filters.status);
    if (filters.priceTypeName) params.set("priceTypeName", filters.priceTypeName);
    // The API param is "requestedBy"; we map our generic "search" to it
    if (filters.search.trim()) params.set("requestedBy", filters.search.trim());

    const qs = params.toString();
    return qs ? `${API_ENDPOINT}?${qs}` : API_ENDPOINT;
}

// ─── Response Mapper ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(raw: any, index: number): PriceChangeRow {
    return {
        id: raw.requestId ?? raw.id ?? raw.priceChangeRequestId ?? index,
        no: index + 1,

        brand: raw.brandName ?? raw.brand ?? null,
        category: raw.categoryName ?? raw.category ?? null,
        productName: raw.productName ?? raw.product_name ?? null,
        supplierName: raw.supplierName ?? raw.supplier_name ?? null,

        priceType: raw.priceTypeName ?? raw.priceType ?? raw.price_type ?? null,
        previousPrice:
            raw.previousPrice != null ? Number(raw.previousPrice) : null,
        proposedPrice:
            raw.proposedPrice != null ? Number(raw.proposedPrice) : null,

        status: raw.status ?? null,
        requestedBy: raw.requestedByName ?? raw.requestedBy ?? raw.requested_by ?? null,
        requestedAt: raw.requestedAt ?? raw.requested_at ?? null,
        approvedBy: raw.approvedByName ?? raw.approvedBy ?? raw.approved_by ?? null,
        approvedAt: raw.approvedAt ?? raw.approved_at ?? null,
        rejectedBy: raw.rejectedByName ?? raw.rejectedBy ?? raw.rejected_by ?? null,
        rejectedAt: raw.rejectedAt ?? raw.rejected_at ?? null,
    };
}

// ─── Public Intent Functions ──────────────────────────────────────────────────
/**
 * Fetch price-change requests from the proxied Spring Boot endpoint.
 * Returns an empty array on network/API errors (caller decides how to toast).
 */
export async function fetchPriceChangeRequests(
    filters: PriceChangeFilters,
): Promise<{ rows: PriceChangeRow[]; error?: string }> {
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
