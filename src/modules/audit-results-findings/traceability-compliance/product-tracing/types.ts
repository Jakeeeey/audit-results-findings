//src/modules/supply-chain-management/traceability-compliance/product-tracing/types.ts

export type ProductMovementRow = {
    ts: string;
    productId: number;
    parentId: number | null;
    productName: string;
    unit: string;
    unitCount: number;
    brand: string | null;
    category: string | null;
    branchId: number;
    branchName: string;
    docNo: string;
    docType: string;
    inBase: number;
    outBase: number;
    descr: string | null;
    supplierId: number | null;
    supplierName: string | null;
    familyUnit: string | null;
    familyUnitCount: number | null;
    variance: number | null;
    physicalCount?: number | null;
    systemCount?: number | null;
    physical_count?: number | null;
    system_count?: number | null;
    // Client-side computed
    balance?: number;
};

export type ConsolidationDispatchTraceRow = {
    sales_invoice: string;
    product_name: string;
    customer_name: string;
    quantity: number;
    uom: string;
    unit_of_measurement_count: number;
    order_status: string;
    remarks: string | null;
};

export type ProductTracingFiltersType = {
    branch_id: number | null;
    parent_id: number | null;
    ph_id?: number | null;
    startDate: string | null;
    endDate: string | null;
    branchName?: string | null;
    productName?: string | null;
    dateRangeMode?: 'manual' | 'ph';
};

export type PhysicalInventoryRow = {
    id: number;
    ph_no: string;
    date_encoded: string;
    cutOff_date: string;
    starting_date: string;
    branch_id: number;
};

export type ProductFamilyRow = {
    parent_id: number;
    product_name: string; // The base name for the family
    product_code: string | null;
    category_name?: string;
    brand_name?: string;
    short_description?: string;
    cost_per_unit?: number | null;
};
