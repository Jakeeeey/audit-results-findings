/**
 * priceChangeUtils.ts
 * ───────────────────
 * Pure, side-effect-free business-logic helpers.
 * No JSX. No React imports. Safe to unit-test in isolation.
 */

import type { PriceChangeRow, PriceChangeStatus } from "../types";

// ─── Status helpers ───────────────────────────────────────────────────────────
export interface StatusMeta {
    label: string;
    /** Tailwind classes for badge background + text */
    className: string;
}

export function getStatusMeta(status: string | null): StatusMeta {
    switch ((status ?? "").toUpperCase()) {
        case "APPROVED":
            return {
                label: "Approved",
                className:
                    "bg-emerald-100 text-emerald-700 border-emerald-200",
            };
        case "PENDING":
            return {
                label: "Pending",
                className:
                    "bg-amber-100 text-amber-700 border-amber-200",
            };
        case "FOR_APPROVAL":
            return {
                label: "For Approval",
                className:
                    "bg-blue-100 text-blue-700 border-blue-200",
            };
        case "REJECTED":
            return {
                label: "Rejected",
                className:
                    "bg-red-100 text-red-700 border-red-200",
            };
        default:
            return {
                label: status ?? "—",
                className: "bg-muted text-muted-foreground border-border",
            };
    }
}

/** Canonical list of statuses for the dropdown filter */
export const PRICE_CHANGE_STATUSES: Array<{
    value: PriceChangeStatus | "";
    label: string;
}> = [
    { value: "", label: "All Statuses" },
    { value: "PENDING", label: "Pending" },
    { value: "FOR_APPROVAL", label: "For Approval" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
];

/** Canonical list of price types for the dropdown filter */
export const PRICE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "", label: "All Price Types" },
    { value: "A", label: "Price Type A" },
    { value: "B", label: "Price Type B" },
    { value: "C", label: "Price Type C" },
    { value: "D", label: "Price Type D" },
    { value: "E", label: "Price Type E" },
];

// ─── Price formatting ─────────────────────────────────────────────────────────
export function formatPrice(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
    }).format(value);
}

// ─── Date formatting ──────────────────────────────────────────────────────────
export function formatDateDisplay(
    value: string | null | undefined,
): string {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

// ─── Price delta helper ───────────────────────────────────────────────────────
/**
 * Returns the percentage difference between proposed and previous price.
 * Returns null when either value is missing or previous is 0.
 */
export function computePriceDelta(
    previousPrice: number | null,
    proposedPrice: number | null,
): number | null {
    if (
        previousPrice == null ||
        proposedPrice == null ||
        previousPrice === 0
    )
        return null;
    return ((proposedPrice - previousPrice) / previousPrice) * 100;
}

// ─── Default filters factory ──────────────────────────────────────────────────
export function buildDefaultFilters() {
    // Default date range: first day of current year → today
    const now = new Date();
    const firstOfYear = new Date(now.getFullYear(), 0, 1);

    const pad = (n: number) => String(n).padStart(2, "0");
    const toISO = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    return {
        startDate: toISO(firstOfYear),
        endDate: toISO(now),
        status: "" as PriceChangeStatus | "",
        priceTypeName: "",
        search: "",
    };
}

// ─── Client-side filter predicate (for instant search refinement) ─────────────
/**
 * If you want to further refine already-fetched rows on the client
 * (e.g., while debouncing a network call), use this pure predicate.
 */
export function rowMatchesSearch(row: PriceChangeRow, term: string): boolean {
    if (!term.trim()) return true;
    const q = term.toLowerCase();
    return [
        row.brand,
        row.category,
        row.productName,
        row.supplierName,
        row.requestedBy,
        row.priceType,
    ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q));
}
