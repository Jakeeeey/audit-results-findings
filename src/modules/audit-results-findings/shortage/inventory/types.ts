export interface User {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_email?: string;
}

export interface InventoryShortage {
    id: number;
    receiver_id: number | User;
    amount: number;
    date_from: string | null;
    date_to: string | null;
    nte_number: string | null;
    issuer_id: number | User | null;
    manager_id: number | User | null;
    nod_date: string | null;
    explanation_received_at: string | null;
    hearing_date: string | null;
    cash_payment_amount: number;
    salary_deduction_amount: number;
    payroll_run_employee_id: number | null;
    status: string;
    created_at: string;
    updated_at: string;
}

export type InventoryShortageFormData = Omit<InventoryShortage, 'id' | 'created_at' | 'updated_at'>;
