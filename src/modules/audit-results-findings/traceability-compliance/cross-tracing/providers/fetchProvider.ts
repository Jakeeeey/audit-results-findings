import { BranchMovementData, CrossTracingFiltersType } from "../types";
import {
    fetchBranches as fb,
    fetchProductFamilies as ff,
    fetchPhysicalInventories as fpi,
    fetchFamilyRunningInventory as ffri,
    fetchConsolidationDispatchTrace as fcdt
} from "../../product-tracing/providers/fetchProvider";

export const fetchBranches = fb;
export const fetchProductFamilies = ff;
export const fetchPhysicalInventories = fpi;
export const fetchFamilyRunningInventory = ffri;
export const fetchConsolidationDispatchTrace = fcdt;

/**
 * Fetches available Units of Measure (UOM) for a product family.
 * A family's UOMs are usually the shortcuts (PCS, BOX, etc.) of all children products.
 */
export async function fetchProductUOMs(parentId: number): Promise<string[]> {
    const res = await fetch(`/api/arf/inventory-management/physical-inventory/directus/products?fields=unit_of_measurement.unit_shortcut&filter[_or][0][product_id][_eq]=${parentId}&filter[_or][1][parent_id][_eq]=${parentId}&limit=-1`);
    if (!res.ok) return [];
    const json = await res.json();
    const shortcuts = (json.data || [])
        .map((p: { unit_of_measurement?: { unit_shortcut: string } }) => p.unit_of_measurement?.unit_shortcut)
        .filter(Boolean);

    // Deduplicate and sort
    return Array.from(new Set<string>(shortcuts)).sort();
}

export async function fetchCrossMovements(filters: CrossTracingFiltersType): Promise<BranchMovementData[]> {
    const params = new URLSearchParams();

    // Add primary branch
    if (filters.primary_branch_id) params.append("branchIds", String(filters.primary_branch_id));

    // Add secondary branches
    filters.secondary_branch_ids.forEach(id => {
        params.append("branchIds", String(id));
    });

    if (filters.parent_id) params.set("parentId", String(filters.parent_id));

    // Convert dates to YYYY-MM-DD for the optimized Spring Boot endpoint
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);

    // Note: Backend proxy might need update if we want to filter by UOM server-side
    // but for now we'll pass it anyway
    if (filters.uom) params.set("uom", filters.uom);

    const res = await fetch(`/api/arf/traceability-compliance/cross-tracing?${params.toString()}`);
    if (!res.ok) {
        throw new Error("Failed to fetch cross movements");
    }
    return res.json();
}
