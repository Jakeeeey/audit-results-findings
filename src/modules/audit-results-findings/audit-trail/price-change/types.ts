// ─── Domain Types ──────────────────────────────────────────────────────────────
// Mirrors the Spring Boot response shape from:
// GET /api/view-price-change-requests/filter

export type PriceChangeStatus =
    | "APPROVED"
    | "PENDING"
    | "REJECTED"
    | "FOR_APPROVAL";

/**
 * A single row returned by the price-change filter API.
 * All fields are typed as optional strings/numbers so the module
 * gracefully handles missing data from the upstream service.
 */
export interface PriceChangeRow {
    /** Row identifier */
    id: number | string;
    /** Sequential display number (may be assigned client-side) */
    no?: number;

    // Product / catalogue
    brand: string | null;
    category: string | null;
    productName: string | null;
    supplierName: string | null;

    // Price
    priceType: string | null;
    previousPrice: number | null;
    proposedPrice: number | null;

    // Workflow
    status: PriceChangeStatus | string | null;
    requestedBy: string | null;
    requestedAt: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
    rejectedBy: string | null;
    rejectedAt: string | null;
}

// ─── Filter DTO ────────────────────────────────────────────────────────────────
export interface PriceChangeFilters {
    /** ISO date string: "YYYY-MM-DD" */
    startDate: string;
    /** ISO date string: "YYYY-MM-DD" */
    endDate: string;
    status: PriceChangeStatus | "";
    priceTypeName: string;
    search: string; // maps to requestedBy on the API
}
