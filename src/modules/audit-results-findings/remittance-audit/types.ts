export interface User {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_position?: string;
}

export interface Salesman {
    id: number;
    salesman_name: string;
    salesman_code: string;
}

export interface GeneralFinding {
    id: number;
    finding_name: string;
    description?: string;
}

export interface Customer {
    customer_code: string;
    customer_name: string;
    store_name: string;
}

export interface SalesInvoice {
    invoice_id: number;
    invoice_no: string;
    customer_code?: string | Customer;
}

// 🚀 OPTIONAL BUT RECOMMENDED: Simple interfaces for Bank/Method if you deep fetch them later
export interface BankName {
    id: number;
    bank_name: string;
}

export interface PaymentMethod {
    method_id: number;
    method_name: string;
}

export interface CollectionDetail {
    id: number;
    collection_id: number;
    amount: number;
    check_no?: string;
    chequeDate?: string; // 🚀 Added from your schema

    // 🚀 Added from your schema (useful for knowing if it was Cash vs Check vs EWT)
    payment_method?: number | PaymentMethod;
    bank?: number | BankName;

    customer_code?: string | Customer;
    invoice_id?: number | SalesInvoice;
    remarks?: string;
    finding?: number | GeneralFinding;
    is_cleared: boolean | number;
}

export interface RemittanceAuditFinding {
    id: number;
    doc_no: string;
    date_audited: string;
    date_from: string;
    date_to: string;
    date_created: string;
    auditee_id: number | Salesman;
    auditor_id: number | User;
    amount: number;
    amount_settled: number;
    remarks?: string;
    status: 'PENDING_REVIEW' | 'APPROVED_FOR_DEDUCTION' | 'SETTLED_CASH' | 'DEDUCTED_PAYROLL';
    settlement_method?: 'CASH' | 'PAYROLL_DEDUCTION' | null;
    acknowledged_by_employee: boolean | number;
    date_acknowledged?: string;
}

export interface AuditDetailRow {
    id: number;
    collection_detail_id: CollectionDetail;
}