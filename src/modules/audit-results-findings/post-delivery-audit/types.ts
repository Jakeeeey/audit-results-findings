export interface PostDispatchPlan {
  id: number;
  doc_no: string;
  driver_id: number | Employee;
  vehicle_id: number;
  encoder_id: number;
  starting_point: number;
  total_distance: number;
  status: string;
  amount: number;
  estimated_time_of_dispatch: string;
  estimated_time_of_arrival: string;
  time_of_dispatch: string | null;
  time_of_arrival: string | null;
  date_encoded: string;
  remarks: string;
}

export interface Employee {
  id: number;
  first_name?: string;
  last_name?: string;
  name?: string; // Directus sometimes returns a concatenated name or we can use first + last
}

export interface PostDispatchInvoice {
  id: number;
  post_dispatch_plan_id: number;
  invoice_id: number;
  distance: number | null;
  status: string; // "Fulfilled", "Not Fulfilled", etc.
  sequence: number | null;
  invoiceAt: number | null;
  isCleared: number | null;
}

export interface SalesInvoice {
  invoice_id: number;
  invoice_no: string;
  order_id: string;
  customer_code: string;
  total_amount: number;
  net_amount: number;
}

export interface UnfulfilledSalesTransaction {
  id: number;
  sales_invoice_id: number;
  nte: string;
  isCleared: number;
  date_created: string;
}

export interface SalesReturn {
  return_id: number;
  return_number: string;
  invoice_no: string;
  remarks: string;
  status: string;
}

export interface PostDeliveryAuditRecord {
  id: number;
  tod: string | null;
  toa: string | null;
  driver: string;
  dispatchNo: string;
  remarks: string;
  logisticsStatus: {
    fulfilled: number;
    notFulfilled: number;
    withReturns: number;
    withConcerns: number;
  };
  totalInvoices: number;
  percentage: number;
}

export interface PostDeliveryAuditFilters {
  dateFrom?: string;
  dateTo?: string;
  driverId?: string;
  dispatchNo?: string;
  page?: number;
  pageSize?: number;
}

export interface ChartOfAccount {
  coa_id: number;
  gl_code: string;
  account_title: string;
}

export interface Supplier {
  id: number;
  supplier_name: string;
}

export interface SalesReturnRecord {
  return_id: number;
  return_number: string;
  total_amount: number;
  invoice_no: string;
}

export interface AuditDetailRecord {
  id: number;
  status: string;
  isAudited: boolean;
  isReceived: boolean;
  concernId?: number;
  amount: number;
  payableAmount?: number;
  returnedAmount?: number;
  discrepancyAmount?: number;
  rejectedAmount?: number;
  receiptNo: string;
  invoiceId: number;
  warehouseRemarks?: string;
  ntes?: { fileId: string; no: string }[];
  linkedReturns?: { no: string; amount?: number }[];
  concern?: { remarks: string };
}

export interface AuditPlanInfo {
  driver: string;
  driverId: number;
  toa: string;
  docNo: string;
  driverDepartment: string;
  helpers: string[];
}
