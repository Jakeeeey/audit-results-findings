// ─── Domain Types ──────────────────────────────────────────────────────────────
// Mirrors the Spring Boot response shape from:
// GET /api/view-customer-discount-log/filter

/**
 * A single row returned by the customer-discount log filter API.
 * All fields are typed as optional strings so the module
 * gracefully handles missing data from the upstream service.
 */
export interface CustomerDiscountRow {
    /** Row identifier (may be synthesized client-side) */
    id: number | string;
    /** Sequential display number (assigned client-side) */
    no?: number;

    // Audit action
    action: string | null;

    // Customer
    customerCode: string | null;
    customerName: string | null;

    // Store
    storeName: string | null;

    // Supplier / category
    supplierName: string | null;
    categoryName: string | null;

    // Discount
    discountType: string | null;

    // Audit metadata
    changedBy: string | null;
    date: string | null;
}

// ─── Filter DTO ────────────────────────────────────────────────────────────────
export interface CustomerDiscountFilters {
    /** ISO date string: "YYYY-MM-DD" */
    startDate: string;
    /** ISO date string: "YYYY-MM-DD" */
    endDate: string;
    /** Free-text search (maps to changedByName on the API) */
    search: string;
}
