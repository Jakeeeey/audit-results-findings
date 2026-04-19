// src/modules/audit-results-findings/traceability-compliance/product-tracing/service.ts
import { directusFetch, getDirectusBase } from "../../../../app/api/arf/traceability-compliance/directus";
const DIRECTUS_URL = getDirectusBase();

export interface FamilyUnit {
    shortcut: string;
    name: string;
    count: number;
}

export interface ConsolidationItem {
    sales_invoice: string;
    product_name: string;
    customer_name: string;
    quantity: number;
    uom: string;
    unit_of_measurement_count: number;
    order_status: string;
    remarks: string | null;
}

interface DirectusUOM {
    unit_shortcut?: string;
    unit_name?: string;
}

interface DirectusProduct {
    product_id: number;
    parent_id: number | null;
    product_name?: string;
    unit_of_measurement?: DirectusUOM;
    unit_of_measurement_count?: number;
}

interface DirectusCustomer {
    customer_code: string;
    customer_name: string;
}

interface DirectusInvoice {
    order_id: string | number;
    invoice_no?: string;
    isReceipt?: boolean | number | string;
    isPosted?: boolean | number | string;
    isDispatched?: boolean | number | string;
    isRemitted?: boolean | number | string;
}

interface DirectusPIDetail {
    ph_id?: {
        id: number;
        ph_no: string;
        date_encoded: string;
    };
    product_id?: {
        product_id: number;
        parent_id: number | null;
        unit_of_measurement?: DirectusUOM;
        unit_of_measurement_count?: number;
    };
    system_count?: number;
    physical_count?: number;
}

interface ConsolidationGroup extends Omit<ConsolidationItem, "sales_invoice"> {
    sales_invoice_set: Set<string>;
}

/**
 * Normalizes Bit/Buffer/Boolean statuses from Directus
 */
export const isTrueStatus = (val: unknown): boolean => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === 1;
    if (typeof val === 'string') return val === '1' || val.toLowerCase() === 'true';
    if (typeof val === 'object' && 'type' in val && (val as { type: string }).type === 'Buffer' && 'data' in val && Array.isArray((val as { data: unknown[] }).data)) {
        return (val as { data: number[] }).data[0] === 1;
    }
    return !!val;
};

/**
 * Resolves the primary unit for a product family
 */
export async function getFamilyUnit(productId: number | string): Promise<FamilyUnit> {
    const defaultUnit = { shortcut: "PCS", name: "Pieces", count: 1 };
    try {
        const productRes = await directusFetch<{ data: DirectusProduct[] }>(`${DIRECTUS_URL}/items/products?fields=product_id,parent_id&filter[product_id][_eq]=${productId}`);
        const mainProduct = productRes.data?.[0];
        if (!mainProduct) return defaultUnit;

        const familyRootId = mainProduct.parent_id || mainProduct.product_id;

        // Fetch ALL products in the family (root + children) to find the one with the largest unit
        const familyRes = await directusFetch<{ data: DirectusProduct[] }>(`${DIRECTUS_URL}/items/products?fields=unit_of_measurement.unit_shortcut,unit_of_measurement.unit_name,unit_of_measurement_count&filter[_or][0][product_id][_eq]=${familyRootId}&filter[_or][1][parent_id][_eq]=${familyRootId}&sort=-unit_of_measurement_count`);
        const familyProducts = familyRes.data || [];

        // Pick the product with the highest unit_of_measurement_count (e.g., BOX with 200 instead of PCS with 1)
        let bestProduct = familyProducts[0];
        let maxCount = 1;
        for (const p of familyProducts) {
            const count = p.unit_of_measurement_count || 1;
            if (count > maxCount) {
                maxCount = count;
                bestProduct = p;
            }
        }

        if (bestProduct) {
            return {
                shortcut: bestProduct.unit_of_measurement?.unit_shortcut || "PCS",
                name: bestProduct.unit_of_measurement?.unit_name || "Pieces",
                count: bestProduct.unit_of_measurement_count || 1
            };
        }
    } catch (err) {
        console.error("[Product Tracing Service] Failed to get family unit:", err);
    }
    return defaultUnit;
}

/**
 * Performs a deep trace for consolidation dispatches
 */
export async function fetchConsolidationItems(
    docNo: string,
    productId: number | string,
    protocolNo?: string | null,
    orderNo?: string | null,
    token?: string | null,
    inProductName?: string | null
): Promise<ConsolidationItem[]> {
    const SPRING_API = process.env.SPRING_API_BASE_URL;

    // 1. Optimized Path: Spring Boot (Fastest)
    if (SPRING_API && token) {
        try {
            let finalProductName = inProductName;

            // Resolve productName from productId if it's missing (needed for the Spring Boot filter)
            if (!finalProductName) {
                const productRes = await directusFetch<{ data: DirectusProduct[] }>(`${DIRECTUS_URL}/items/products?fields=product_name&filter[product_id][_eq]=${productId}`);
                finalProductName = productRes.data?.[0]?.product_name;
            }

            if (finalProductName) {
                const url = new URL(`${SPRING_API.replace(/\/$/, "")}/api/view-product-ledger-consolidator/filter`);
                url.searchParams.set("productName", finalProductName);
                url.searchParams.set("consolidatorNo", docNo);
                if (protocolNo) url.searchParams.set("dispatchNo", protocolNo);

                const response = await fetch(url.toString(), {
                    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" },
                    cache: "no-store",
                });

                if (response.ok) {
                    const data = await response.json();
                    const list = Array.isArray(data) ? data : (data ? [data] : []);

                    // Map Spring Boot camelCase to the ConsolidationItem interface
                    return list.map((item: {
                        salesInvoice?: string;
                        productName?: string;
                        customerName?: string;
                        quantity?: number;
                        uom?: string;
                        unitOfMeasurementCount?: number;
                        orderStatus?: string;
                        remarks?: string;
                    }) => ({
                        sales_invoice: String(item.salesInvoice || "No Invoice"),
                        product_name: String(item.productName || finalProductName),
                        customer_name: String(item.customerName || "N/A"),
                        quantity: Number(item.quantity || 0),
                        uom: String(item.uom || "PCS"),
                        unit_of_measurement_count: Number(item.unitOfMeasurementCount || 1),
                        order_status: String(item.orderStatus || "N/A"),
                        remarks: item.remarks || null
                    }));
                }
            }
        } catch (springErr) {
            console.error("[Product Tracing Service] Optimized Spring Path failed, falling back:", springErr);
        }
    }

    // 2. Legacy Path: Directus Deep Trace (Slower Fallback)
    try {
        // Resolve product family context
        let targetProductIds = [Number(productId)];
        const familyRes = await directusFetch<{ data: DirectusProduct[] }>(`${DIRECTUS_URL}/items/products?fields=product_id,parent_id&filter[product_id][_eq]=${productId}`);
        const mainProduct = familyRes.data?.[0];
        if (mainProduct) {
            const familyRootId = mainProduct.parent_id || mainProduct.product_id;
            const allVariantsRes = await directusFetch<{ data: DirectusProduct[] }>(`${DIRECTUS_URL}/items/products?fields=product_id&filter[_or][0][product_id][_eq]=${familyRootId}&filter[_or][1][parent_id][_eq]=${familyRootId}`);
            if (allVariantsRes.data) {
                targetProductIds = allVariantsRes.data.map((p) => p.product_id).filter(Boolean);
            }
        }

        const familyUnit = await getFamilyUnit(productId);
        const baseProductFilter = { product_id: { _in: targetProductIds } };

        // ... [Rest of legacy logic continues below]
        // [Stage 1, Stage 2, Enrich sections remain as-is for fallback safety]
        // NOTE: For brevity in this replacement I'm keeping the original logic below it 
        // but it will only be reached if Spring path fails or is unavailable.

        let initialResults: { 
            order_id?: { order_no?: string; customer_code?: string; remarks?: string | null };
            product_id?: { product_id?: number; product_name?: string; unit_of_measurement?: { unit_shortcut?: string }; unit_of_measurement_count?: number };
            ordered_quantity?: number;
        }[] = [];

        if (protocolNo) {
            const dpRes = await directusFetch<{ data: { dispatch_id: string | number }[] }>(`${DIRECTUS_URL}/items/dispatch_plan?fields=dispatch_id&filter[dispatch_no][_eq]=${protocolNo}`);
            const dispatchId = dpRes.data?.[0]?.dispatch_id;
            if (dispatchId) {
                const dpdRes = await directusFetch<{ data: { sales_order_id: string | number }[] }>(`${DIRECTUS_URL}/items/dispatch_plan_details?fields=sales_order_id&filter[dispatch_id][_eq]=${dispatchId}`);
                const soIds = (dpdRes.data || []).map((d: { sales_order_id: string | number }) => d.sales_order_id).filter(Boolean);
                if (soIds.length > 0) {
                    const filter: { _and: (Record<string, unknown>)[] } = { 
                        _and: [
                            { order_id: { _in: soIds } }, 
                            baseProductFilter
                        ] 
                    };
                    if (orderNo) filter._and.push({ order_id: { order_no: { _eq: orderNo } } });
                    const res = await directusFetch<{ data: typeof initialResults }>(`${DIRECTUS_URL}/items/sales_order_details?fields=order_id.order_no,order_id.customer_code,order_id.remarks,product_id.product_id,product_id.product_name,product_id.unit_of_measurement.unit_shortcut,product_id.unit_of_measurement_count,ordered_quantity&filter=${encodeURIComponent(JSON.stringify(filter))}`);
                    initialResults = res.data || [];
                }
            }
        }

        if (initialResults.length === 0) {
            const consolidatorRes = await directusFetch<{ data: { id: number }[] }>(`${DIRECTUS_URL}/items/consolidator?fields=id&filter[consolidator_no][_eq]=${docNo}`);
            const consolidatorId = consolidatorRes.data?.[0]?.id;
            if (consolidatorId) {
                const cdpRes = await directusFetch<{ data: { dispatch_no: string }[] }>(`${DIRECTUS_URL}/items/consolidator_dispatches?fields=dispatch_no&filter[consolidator_id][_eq]=${consolidatorId}`);
                const protocolNos = (cdpRes.data || []).map((d: { dispatch_no: string }) => d.dispatch_no).filter(Boolean);
                if (protocolNos.length > 0) {
                    const dpRes = await directusFetch<{ data: { dispatch_id: string | number }[] }>(`${DIRECTUS_URL}/items/dispatch_plan?fields=dispatch_id&filter[dispatch_no][_in]=${protocolNos.join(",")}`);
                    const dispatchIds = (dpRes.data || []).map((d: { dispatch_id: string | number }) => d.dispatch_id).filter(Boolean);
                    if (dispatchIds.length > 0) {
                        const dpdRes = await directusFetch<{ data: { sales_order_id: string | number }[] }>(`${DIRECTUS_URL}/items/dispatch_plan_details?fields=sales_order_id&filter[dispatch_id][_in]=${dispatchIds.join(",")}`);
                        const soIds = (dpdRes.data || []).map((d: { sales_order_id: string | number }) => d.sales_order_id).filter(Boolean);
                        if (soIds.length > 0) {
                            const filter: { _and: (Record<string, unknown>)[] } = { 
                                _and: [
                                    { order_id: { _in: soIds } }, 
                                    baseProductFilter
                                ] 
                            };
                            if (orderNo) filter._and.push({ order_id: { order_no: { _eq: orderNo } } });
                            const res = await directusFetch<{ data: typeof initialResults }>(`${DIRECTUS_URL}/items/sales_order_details?fields=order_id.order_no,order_id.customer_code,order_id.remarks,product_id.product_id,product_id.product_name,product_id.unit_of_measurement.unit_shortcut,product_id.unit_of_measurement_count,ordered_quantity&filter=${encodeURIComponent(JSON.stringify(filter))}`);
                            initialResults = res.data || [];
                        }
                    }
                }
            }
        }

        if (initialResults.length === 0) return [];

        const uniqueCustomerCodes = Array.from(new Set(initialResults.map(r => r.order_id?.customer_code).filter(Boolean)));
        const uniqueOrderNos = Array.from(new Set(initialResults.map(r => r.order_id?.order_no).filter(Boolean)));
        const uniqueProductIds = Array.from(new Set(initialResults.map(r => r.product_id?.product_id).filter(Boolean)));

        const [custRes, invoiceRes, invDetailRes, productUomRes] = await Promise.all([
            directusFetch<{ data: DirectusCustomer[] }>(`${DIRECTUS_URL}/items/customer?fields=customer_code,customer_name&filter[customer_code][_in]=${encodeURIComponent(uniqueCustomerCodes.join(","))}`),
            directusFetch<{ data: DirectusInvoice[] }>(`${DIRECTUS_URL}/items/sales_invoice?fields=order_id,invoice_no,isReceipt,isPosted,isDispatched,isRemitted&filter[order_id][_in]=${encodeURIComponent(uniqueOrderNos.join(","))}`),
            directusFetch<{ data: { order_id?: string | number; product_id?: number | { product_id?: number }; quantity?: number; unit?: string }[] }>(`${DIRECTUS_URL}/items/sales_invoice_details?fields=order_id,product_id,quantity,unit&filter[_and][0][order_id][_in]=${encodeURIComponent(uniqueOrderNos.join(","))}&filter[_and][1][product_id][_in]=${encodeURIComponent(uniqueProductIds.join(","))}`),
            directusFetch<{ data: DirectusProduct[] }>(`${DIRECTUS_URL}/items/products?fields=product_id,unit_of_measurement.unit_shortcut,unit_of_measurement_count&filter[product_id][_in]=${encodeURIComponent(uniqueProductIds.join(","))}`)
        ]);

        const customerMap = new Map<string, string>();
        custRes.data?.forEach((c) => customerMap.set(String(c.customer_code), String(c.customer_name)));

        const invoiceMap = new Map<string, { numbers: string[], status: { isReceipt: boolean, isPosted: boolean, isDispatched: boolean, isRemitted: boolean } }>();
        invoiceRes.data?.forEach((inv) => {
            const key = String(inv.order_id);
            if (!invoiceMap.has(key)) invoiceMap.set(key, { numbers: [], status: { isReceipt: false, isPosted: false, isDispatched: false, isRemitted: false } });
            const entry = invoiceMap.get(key)!;
            if (inv.invoice_no) entry.numbers.push(inv.invoice_no);
            if (isTrueStatus(inv.isRemitted)) entry.status.isRemitted = true;
            if (isTrueStatus(inv.isDispatched)) entry.status.isDispatched = true;
            if (isTrueStatus(inv.isPosted)) entry.status.isPosted = true;
            if (isTrueStatus(inv.isReceipt)) entry.status.isReceipt = true;
        });

        const productUomMap = new Map<number, { shortcut: string; count: number }>();
        productUomRes.data?.forEach((p) => {
            if (p.unit_of_measurement?.unit_shortcut) {
                productUomMap.set(Number(p.product_id), {
                    shortcut: p.unit_of_measurement.unit_shortcut,
                    count: p.unit_of_measurement_count || 1
                });
            }
        });

        const invQtyMap = new Map<string, number>();
        invDetailRes.data?.forEach((det: { order_id?: string | number; product_id?: number | { product_id?: number }; quantity?: number }) => {
            const productId = typeof det.product_id === 'object' ? det.product_id?.product_id : det.product_id;
            const key = `${det.order_id}-${productId}`;
            invQtyMap.set(key, (invQtyMap.get(key) || 0) + (Number(det.quantity) || 0));
        });

        const finalMap = new Map<string, ConsolidationGroup>();
        initialResults.forEach(item => {
            const orderNo = String(item.order_id?.order_no || "N/A");
            const productId = Number(item.product_id?.product_id);
            const customerName = customerMap.get(String(item.order_id?.customer_code)) || "N/A";
            const remarks = item.order_id?.remarks || null;
            const invEntry = invoiceMap.get(orderNo);
            const invKey = `${orderNo}-${productId}`;
            const quantity = (invQtyMap.get(invKey) ?? Number(item.ordered_quantity ?? 0)) || 0;

            const productUom = productUomMap.get(productId);
            const resolvedUom = productUom?.shortcut || familyUnit.shortcut;
            const resolvedCount = productUom?.count || familyUnit.count;

            let orderStatus = "No Invoice";
            if (invEntry) {
                if (invEntry.status.isRemitted) orderStatus = "Remitted";
                else if (invEntry.status.isDispatched) orderStatus = "Dispatched";
                else if (invEntry.status.isPosted) orderStatus = "Posted";
                else if (invEntry.status.isReceipt) orderStatus = "Receipt";
            }

            const groupKey = `${customerName}-${orderStatus}-${remarks}`;
            if (!finalMap.has(groupKey)) {
                finalMap.set(groupKey, {
                    sales_invoice_set: new Set<string>(),
                    product_name: item.product_id?.product_name || "Unknown",
                    customer_name: customerName,
                    quantity: 0,
                    uom: resolvedUom,
                    unit_of_measurement_count: resolvedCount,
                    order_status: orderStatus,
                    remarks: remarks
                });
            }
            const group = finalMap.get(groupKey)!;
            group.quantity += quantity;
            invEntry?.numbers.forEach(n => group.sales_invoice_set.add(n));
        });

        return Array.from(finalMap.values()).map(g => {
            const { sales_invoice_set, ...rest } = g;
            return {
                ...rest,
                sales_invoice: sales_invoice_set.size > 0 ? Array.from(sales_invoice_set).sort().join(", ") : "No Invoice"
            };
        });
    } catch (err) {
        console.error("[Product Tracing Service] Deep Trace failed:", err);
        throw err;
    }
}

/**
 * Fetches original system and physical counts for a Physical Inventory document from Directus.
 * This is used to patch movement rows where the Spring Boot view is missing these columns.
 */
export async function fetchPHCountsForTracing(phNo: string) {
    if (!DIRECTUS_URL) return null;
    try {
        const cleanPhNo = phNo.trim();
        // 1. Resolve ph_no to ph_id
        const phRes = await directusFetch<{ data: { id: number }[] }>(`${DIRECTUS_URL}/items/physical_inventory?filter[ph_no][_eq]=${encodeURIComponent(cleanPhNo)}&fields=id`);
        const phId = phRes.data?.[0]?.id;
        if (!phId) return null;

        // 2. Fetch all details (counts) for this PH, including UOM info and family tagging for synthetic row patching
        const detailsRes = await directusFetch<{ data: DirectusPIDetail[] }>(`${DIRECTUS_URL}/items/physical_inventory_details?filter[ph_id][_eq]=${phId}&fields=product_id.product_id,product_id.parent_id,product_id.unit_of_measurement.unit_name,product_id.unit_of_measurement_count,system_count,physical_count`);
        return detailsRes.data || [];
    } catch (err) {
        console.error("[Product Tracing Service] Failed to fetch PH counts:", err);
        return null;
    }
}

/**
 * Proactively fetches ALL Physical Inventory records (headers + details) for a specific product family and branch.
 * This ensures the tracing ledger captures PH documents even if they are omitted by the Spring Boot movement view.
 */
export async function fetchAllFamilyPHs(branchId: number | string, parentId: number | string) {
    if (!DIRECTUS_URL) return null;
    try {
        // 1. Get all product IDs in the family
        const familyRes = await directusFetch<{ data: DirectusProduct[] }>(`${DIRECTUS_URL}/items/products?fields=product_id&filter[_or][0][product_id][_eq]=${parentId}&filter[_or][1][parent_id][_eq]=${parentId}&limit=-1`);
        const productIds = (familyRes.data || []).map((p) => p.product_id);
        if (productIds.length === 0) return null;

        // 2. Fetch all details for these products in this branch (Committed and Not Cancelled)
        const filter = {
            _and: [
                { product_id: { _in: productIds } },
                {
                    ph_id: {
                        branch_id: { _eq: Number(branchId) },
                        isCancelled: { _eq: 0 },
                        isComitted: { _eq: 1 }
                    }
                }
            ]
        };

        const detailsRes = await directusFetch<{ data: DirectusPIDetail[] }>(`${DIRECTUS_URL}/items/physical_inventory_details?filter=${encodeURIComponent(JSON.stringify(filter))}&fields=ph_id.id,ph_id.ph_no,ph_id.date_encoded,product_id.product_id,product_id.parent_id,product_id.unit_of_measurement.unit_name,product_id.unit_of_measurement_count,system_count,physical_count&limit=-1`);

        // Group by ph_no
        const grouped = new Map<string, DirectusPIDetail[]>();
        (detailsRes.data || []).forEach((det) => {
            const phNo = det.ph_id?.ph_no;
            if (!phNo) return;
            if (!grouped.has(phNo)) grouped.set(phNo, []);
            grouped.get(phNo)!.push(det);
        });

        return grouped;
    } catch (err) {
        console.error("[Product Tracing Service] fetchAllFamilyPHs failed:", err);
        return null;
    }
}

