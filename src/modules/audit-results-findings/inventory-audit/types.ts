export interface Supplier {
    supplier_id: number;
    supplier_code: string;
    supplier_name: string;
}

export interface User {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_position?: string;
}

export interface Branch {
    id: number;
    branch_name: string;
    branch_head?: number | User;
}

export interface Product {
    product_id: number;
    product_code: string;
    description: string;
}

export interface PhysicalInventoryDetail {
    id: number;
    ph_id: number;
    date_encoded?: string;
    product_id: number | Product;
    unit_price: number;
    system_count: number;
    physical_count: number;
    variance: number;
    difference_cost: number;
    amount: number;
    offset_match?: number;
}

export interface PhysicalInventory {
    id: number;
    ph_no: string;
    date_encoded: string;
    cutOff_date: string;
    starting_date: string;
    price_type: string;
    stock_type: string;
    branch_id: number | Branch;
    remarks: string;
    isComitted: boolean;
    committed_at?: string;
    isCancelled: boolean;
    cancelled_at?: string;
    total_amount: number; // This might represent the total inventory value or total variance
    supplier_id: number | Supplier;
    category_id: number;
    encoder_id: number | User;
}

// Model for the finding shown in the module table, which acts as a wrapper
export interface InventoryAuditFinding {
    id: number; // ph_id
    doc_no: string; // ph_no
    date_created: string; // date_encoded
    branch: number | Branch;
    supplier: number | Supplier;
    auditor_id: number | User;
    total_shortage: number; // calculated from negative variances * unit price
    status: 'PENDING_REVIEW' | 'APPROVED_FOR_DEDUCTION' | 'SETTLED_CASH' | 'DEDUCTED_PAYROLL' | 'ADJUSTED';
    remarks?: string;
}
