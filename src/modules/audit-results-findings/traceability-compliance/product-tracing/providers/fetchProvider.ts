import { ProductMovementRow, ProductTracingFiltersType, ProductFamilyRow, ConsolidationDispatchTraceRow, PhysicalInventoryRow } from "../types";

export async function fetchBranches(): Promise<Array<{ id: number; branch_name: string }>> {
    const res = await fetch("/api/arf/inventory-management/physical-inventory/directus/branches?fields=id,branch_name&sort=branch_name&limit=-1");
    const json = await res.json();
    return json.data || [];
}

interface DirectusProduct {
    product_id: number;
    parent_id: number | null;
    product_name: string;
    product_code: string | null;
    short_description: string | null;
    product_category?: { category_name: string };
    product_brand?: { brand_name: string };
    cost_per_unit: number | string | null;
    unit_of_measurement_count?: number;
    unit_of_measurement?: { unit_name: string };
}

/**
 * Fetches product families. 
 * A family is defined by products where parent_id is null/0 or by grouping by parent_id.
 */
export async function fetchProductFamilies(): Promise<ProductFamilyRow[]> {
    // We fetch all active products to determine both parent info and the associated largest UOM (Box) cost
    const timestamp = Date.now();
    const res = await fetch(`/api/arf/inventory-management/physical-inventory/directus/products?fields=product_id,parent_id,product_name,product_code,short_description,product_category.category_name,product_brand.brand_name,cost_per_unit,unit_of_measurement_count,unit_of_measurement.unit_name&filter[isActive][_eq]=1&sort=product_name&limit=-1&_t=${timestamp}`, { cache: "no-store" });
    const json = await res.json();
    const allProducts: DirectusProduct[] = json.data || [];

    const familiesMap = new Map<number, DirectusProduct[]>();

    allProducts.forEach((p) => {
        const familyId = (p.parent_id == null || p.parent_id === 0) ? p.product_id : p.parent_id;
        if (!familiesMap.has(familyId)) {
            familiesMap.set(familyId, []);
        }
        familiesMap.get(familyId)!.push(p);
    });

    const results: ProductFamilyRow[] = [];

    for (const [familyId, group] of familiesMap.entries()) {
        const parent = group.find(p => p.product_id === familyId) || group[0];
        if (!parent) continue;

        // Find the product with the largest unit_of_measurement_count for the "box_cost"
        let boxProduct = group[0];
        let maxCount = 1;

        for (const p of group) {
            const count = p.unit_of_measurement_count || 1;
            if (count > maxCount) {
                maxCount = count;
                boxProduct = p;
            } else if (count === maxCount && p.unit_of_measurement?.unit_name?.toLowerCase().includes('box')) {
                boxProduct = p;
            }
        }

        let finalCost = 0;
        if (boxProduct && boxProduct.cost_per_unit != null && maxCount > 1) {
            // Explicitly set by the box product
            finalCost = Number(boxProduct.cost_per_unit);
        } else if (parent && parent.cost_per_unit != null) {
            // Fallback: Use the parent (pieces) cost_per_unit and multiply it by the largest count (box count)
            finalCost = Number(parent.cost_per_unit) * maxCount;
        }

        results.push({
            parent_id: familyId,
            product_name: parent.product_name,
            product_code: parent.product_code,
            category_name: parent.product_category?.category_name,
            brand_name: parent.product_brand?.brand_name,
            short_description: parent.short_description ?? undefined,
            cost_per_unit: finalCost > 0 ? finalCost : null
        });
    }

    return results.sort((a, b) => (a.product_name || "").localeCompare(b.product_name || ""));
}



export async function fetchMovements(filters: ProductTracingFiltersType): Promise<ProductMovementRow[]> {
    const params = new URLSearchParams();
    if (filters.branch_id) params.set("branchId", String(filters.branch_id));
    if (filters.parent_id) params.set("parentId", String(filters.parent_id));
    if (filters.branchName) params.set("branchName", String(filters.branchName));
    if (filters.productName) params.set("productName", String(filters.productName));
    if (filters.startDate) params.set("startDate", String(filters.startDate));
    if (filters.endDate) params.set("endDate", String(filters.endDate));

    const res = await fetch(`/api/arf/traceability-compliance/product-tracing?${params.toString()}`);
    if (!res.ok) {
        throw new Error("Failed to fetch movements");
    }
    return res.json();
}

export async function fetchConsolidationDispatchTrace(productId: number, docNo: string, protocolNo?: string | null, orderNo?: string | null, productName?: string | null): Promise<ConsolidationDispatchTraceRow[]> {
    let url = `/api/arf/traceability-compliance/product-tracing/consolidation-dispatches?product_id=${productId}&doc_no=${docNo}`;
    if (protocolNo) {
        url += `&protocol_no=${protocolNo}`;
    }
    if (orderNo) {
        url += `&order_no=${orderNo}`;
    }
    if (productName) {
        url += `&product_name=${encodeURIComponent(productName)}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error("Failed to fetch consolidation dispatches tracing data");
    }
    return res.json();
}

/**
 * Fetches running inventory rows from v_running_inventory for a specific branch,
 * then computes the family-consolidated total in base pcs.
 *
 * familyId = COALESCE(NULLIF(parent_id, 0), product_id)
 *
 * Returns the total running_inventory (in base pcs) across all UOM variants
 * for the given family at the given branch.
 */
export async function fetchFamilyRunningInventory(
    branchName: string,
    parentId: number,
): Promise<number> {
    try {
        const timestamp = Date.now();

        // 1. Get all product IDs in the family first
        const prodParams = new URLSearchParams();
        prodParams.set("fields", "product_id");
        prodParams.set("filter", JSON.stringify({
            _or: [
                { product_id: { _eq: parentId } },
                { parent_id: { _eq: parentId } }
            ]
        }));

        const prodRes = await fetch(`/api/arf/inventory-management/physical-inventory/directus/products?${prodParams.toString()}&_t=${timestamp}`);
        if (!prodRes.ok) return 0;

        const prodJson = await prodRes.json();
        const familyProductIds = new Set<number>((prodJson.data || []).map((p: { product_id: number }) => p.product_id));
        familyProductIds.add(parentId); // Always include the parent itself

        // 2. Fetch the current branch inventory
        const params = new URLSearchParams();
        if (branchName) params.set("branchName", branchName);

        const res = await fetch(
            `/api/arf/inventory-management/physical-inventory/running-inventory?${params.toString()}&_t=${timestamp}`,
            { cache: "no-store" },
        );
        if (!res.ok) return 0;

        const data = await res.json();
        interface RunningInventoryRow {
            productId?: number | string;
            product_id?: number | string;
            runningInventoryUnit?: number;
            running_inventory?: number;
            runningInventory?: number;
        }
        const rows: RunningInventoryRow[] = Array.isArray(data) ? data : [];

        // 3. Sum running inventory for rows whose product_id matches our family set
        let familyTotal = 0;
        rows.forEach((row) => {
            const rowProduct = row.productId ?? row.product_id ?? 0;
            const pId = Number(rowProduct);

            if (familyProductIds.has(pId)) {
                // Check multiple possible property names for the balance
                const balance = row.runningInventoryUnit
                    ?? row.running_inventory
                    ?? row.runningInventory
                    ?? 0;
                familyTotal += Number(balance);
            }
        });

        return familyTotal;
    } catch (err) {
        console.error("[fetchFamilyRunningInventory] Failed:", err);
        return 0;
    }
}

export async function fetchPhysicalInventories(branchId: number, parentId: number): Promise<PhysicalInventoryRow[]> {
    // 1. Get all product IDs in the family
    const prodParams = new URLSearchParams();
    prodParams.set("fields", "product_id");
    prodParams.set("filter", JSON.stringify({
        _or: [
            { product_id: { _eq: parentId } },
            { parent_id: { _eq: parentId } }
        ]
    }));
    prodParams.set("limit", "-1");

    const prodRes = await fetch(`/api/arf/inventory-management/physical-inventory/directus/products?${prodParams.toString()}`);
    if (!prodRes.ok) return [];
    const prodJson = await prodRes.json();
    const productIds = (prodJson.data || []).map((p: { product_id: number }) => p.product_id);

    if (productIds.length === 0) return [];

    // 2. Query details and expand the parent PH record
    const detailParams = new URLSearchParams();
    detailParams.set("fields", "ph_id.id,ph_id.ph_no,ph_id.date_encoded,ph_id.cutOff_date,ph_id.starting_date,ph_id.branch_id");

    detailParams.set("filter", JSON.stringify({
        _and: [
            { product_id: { _in: productIds } },
            {
                ph_id: {
                    branch_id: { _eq: branchId },
                    isCancelled: { _eq: 0 },
                    isComitted: { _eq: 1 }
                }
            }
        ]
    }));

    detailParams.set("limit", "-1");

    // Collection: physical_inventory_details
    const res = await fetch(`/api/arf/inventory-management/physical-inventory/directus/physical_inventory_details?${detailParams.toString()}`);
    if (!res.ok) {
        console.error("Failed to fetch physical inventories from details", await res.text());
        return [];
    }
    const json = await res.json();
    const details = json.data || [];

    // Extract unique PH headers
    const phMap = new Map<number, PhysicalInventoryRow>();
    details.forEach((d: { ph_id: PhysicalInventoryRow }) => {
        if (d.ph_id && d.ph_id.id) {
            phMap.set(d.ph_id.id, d.ph_id);
        }
    });

    return Array.from(phMap.values()).sort((a, b) => {
        const dateA = a.date_encoded ? new Date(a.date_encoded).getTime() : 0;
        const dateB = b.date_encoded ? new Date(b.date_encoded).getTime() : 0;
        return dateB - dateA; // Sort descending by date
    });
}
