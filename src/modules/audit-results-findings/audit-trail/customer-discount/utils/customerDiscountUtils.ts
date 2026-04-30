/**
 * customerDiscountUtils.ts
 * ────────────────────────
 * Pure, side-effect-free business-logic helpers.
 * No JSX. No React imports. Safe to unit-test in isolation.
 */

import type { CustomerDiscountRow } from "../types";

// ─── Action badge helpers ─────────────────────────────────────────────────────
export interface ActionMeta {
    label: string;
    /** Tailwind classes for badge background + text */
    className: string;
}

export function getActionMeta(action: string | null): ActionMeta {
    switch ((action ?? "").toUpperCase()) {
        case "CREATE":
        case "CREATED":
            return {
                label: "Create",
                className: "bg-emerald-100 text-emerald-700 border-emerald-200",
            };
        case "UPDATE":
        case "UPDATED":
        case "EDIT":
        case "EDITED":
            return {
                label: "Update",
                className: "bg-blue-100 text-blue-700 border-blue-200",
            };
        case "DELETE":
        case "DELETED":
            return {
                label: "Delete",
                className: "bg-red-100 text-red-700 border-red-200",
            };
        case "APPROVE":
        case "APPROVED":
            return {
                label: "Approve",
                className: "bg-violet-100 text-violet-700 border-violet-200",
            };
        case "REJECT":
        case "REJECTED":
            return {
                label: "Reject",
                className: "bg-orange-100 text-orange-700 border-orange-200",
            };
        default:
            return {
                label: action ?? "—",
                className: "bg-muted text-muted-foreground border-border",
            };
    }
}

// ─── Date formatting ──────────────────────────────────────────────────────────
export function formatDateDisplay(value: string | null | undefined): string {
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
        search: "",
    };
}

// ─── Client-side filter predicate (for instant search refinement) ─────────────
/**
 * If you want to further refine already-fetched rows on the client
 * (e.g., while debouncing a network call), use this pure predicate.
 */
export function rowMatchesSearch(
    row: CustomerDiscountRow,
    term: string,
): boolean {
    if (!term.trim()) return true;
    const q = term.toLowerCase();
    return [
        row.action,
        row.customerCode,
        row.customerName,
        row.storeName,
        row.supplierName,
        row.categoryName,
        row.discountType,
        row.changedBy,
    ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q));
}
