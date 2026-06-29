/* eslint-disable */
export interface ConsolidatorRecord {
  id: number;
  consolidator_no: string;
  status: string;
  branch_id?: number;
  created_by?: number | string;
  creatorName?: string;
  checked_by?: number | string;
  checkerName?: string;
  created_at?: string;
  updated_at?: string;
  totalProducts?: number;
  totalOrderedQuantity?: number;
  totalPickedQuantity?: number;
  totalAppliedQuantity?: number;
  hasVariance?: boolean;
  hasPDP?: boolean;
}

export interface ConsolidatorDetailRecord {
  id: number;
  consolidator_id: number;
  product_id?: number | string;
  ordered_quantity?: number;
  picked_quantity?: number;
  applied_quantity?: number;
  picked_at?: string;
  picked_by?: number | string;
  pickerName?: string;
  product?: {
    product_name: string;
    product_code: string;
    barcode: string;
  };
}

export interface ConsolidatorDispatchRecord {
  id: number;
  consolidator_id: number;
  dispatch_id: number | string | any;
  dispatch_no?: string;
  created_at?: string;
  dispatch_plan_details?: Array<{
    sales_order_id: number | string;
    order_no: string;
    status: string;
    details?: Array<{
      product_name: string;
      product_code: string;
      ordered_quantity: number | string;
      allocated_quantity: number | string;
      served_quantity: number | string;
    }>;
    invoices?: Array<{
      invoice_no: string;
      pdf_file?: string;
      total_amount?: number;
    }>;
  }>;
}

export interface CLDTOFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

