import type {
    BranchRow,
    CategoryRow,
    PhysicalInventoryHeaderRow,
    PriceTypeRow,
    SupplierRow,
} from "@/modules/audit-results-findings/inventory-management/physical-inventory-manual-management-v2";
import {
    derivePhysicalInventoryStatus,
    fetchBranches,
    fetchCategories,
    fetchPhysicalInventoryList,
    fetchPriceTypes,
    fetchSuppliers,
    normalizeFlagValue,
} from "@/modules/audit-results-findings/inventory-management/physical-inventory-manual-management-v2";

import type { PhysicalInventoryListRow } from "../types";

export async function fetchPhysicalInventoryListRows(): Promise<{
    rows: PhysicalInventoryListRow[];
    branches: BranchRow[];
    suppliers: SupplierRow[];
}> {
    const [headers, branches, suppliers, categories, priceTypes] = await Promise.all([
        fetchPhysicalInventoryList(),
        fetchBranches(),
        fetchSuppliers(),
        fetchCategories(),
        fetchPriceTypes(),
    ]);

    const branchMap = new Map<number, BranchRow>(
        branches.map((row) => [row.id, row]),
    );

    const supplierMap = new Map<number, SupplierRow>(
        suppliers.map((row) => [row.id, row]),
    );

    const categoryMap = new Map<number, CategoryRow>(
        categories.map((row) => [row.category_id, row]),
    );

    const priceTypeMap = new Map<number, PriceTypeRow>(
        priceTypes.map((row) => [row.price_type_id, row]),
    );

    const rows: PhysicalInventoryListRow[] = headers.map(
        (header: PhysicalInventoryHeaderRow): PhysicalInventoryListRow => {
            const normalizedIsCancelled = normalizeFlagValue(
                header.isCancelled as number | null | undefined,
            );
            const normalizedIsComitted = normalizeFlagValue(
                header.isComitted as number | null | undefined,
            );

            const status = derivePhysicalInventoryStatus({
                isCancelled: normalizedIsCancelled,
                isComitted: normalizedIsComitted,
            });

            const branchIdNum = header.branch_id ? Number(header.branch_id) : null;
            const supplierIdNum = header.supplier_id ? Number(header.supplier_id) : null;
            const categoryIdNum = header.category_id ? Number(header.category_id) : null;
            const priceTypeNum = header.price_type ? Number(header.price_type) : null;

            return {
                id: header.id,
                ph_no: header.ph_no,
                date_encoded: header.date_encoded,
                cutOff_date: header.cutOff_date,
                starting_date: header.starting_date,
                price_type: priceTypeNum,
                stock_type: header.stock_type,
                branch_id: branchIdNum,
                remarks: header.remarks,
                isComitted: normalizedIsComitted,
                isCancelled: normalizedIsCancelled,
                total_amount: header.total_amount,
                supplier_id: supplierIdNum,
                category_id: categoryIdNum,
                encoder_id:
                    typeof header.encoder_id === "object" && header.encoder_id !== null
                        ? header.encoder_id.user_id
                        : header.encoder_id,

                branch_name: branchIdNum
                    ? branchMap.get(branchIdNum)?.branch_name ?? null
                    : null,
                supplier_name: supplierIdNum
                    ? supplierMap.get(supplierIdNum)?.supplier_name ?? null
                    : null,
                category_name: categoryIdNum
                    ? categoryMap.get(categoryIdNum)?.category_name ?? null
                    : null,
                price_type_name: priceTypeNum
                    ? priceTypeMap.get(priceTypeNum)?.price_type_name ?? null
                    : null,
                status,
            };
        },
    );

    return {
        rows,
        branches,
        suppliers,
    };
}