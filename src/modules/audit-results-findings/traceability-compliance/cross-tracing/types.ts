import { ProductMovementRow, ProductFamilyRow } from "../product-tracing/types";

export type CrossTracingFiltersType = {
    primary_branch_id: number | null;
    secondary_branch_ids: number[];
    parent_id: number | null;
    ph_id: number | null;
    uom: string | null;
    startDate: string | null;
    endDate: string | null;
    dateRangeMode?: 'manual' | 'ph';
};

export type BranchMovementData = {
    branchId: number;
    branchName: string;
    movements: ProductMovementRow[];
};

export { type ProductMovementRow, type ProductFamilyRow };
