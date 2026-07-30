export interface PostDeliveryAuditPlan {
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

export interface PostDeliveryAuditListResponse {
  data: PostDeliveryAuditPlan[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

// Spring Boot API types based on PDF layout
export interface PodInvoice {
  invoices: string;
  storeName: string;
  status: string;
  isInvoiceReceived: string | boolean;
  remarks: string;
}

export interface ReturnedItem {
  customerName: string;
  product: string;
  qty: number;
  unit: string;
  amount: number;
  receivedByWarehouse: string | boolean;
}

export interface RejectedItem {
  customerName: string;
  product: string;
  qty: number;
  unit: string;
  amount: number;
  receivedByWarehouse: string | boolean;
}

export interface PostDispatchAuditReportData {
  driver: string;
  dp: string; // docNo
  delDate: string;
  etod: string;
  atod: string;
  etoa: string;
  atoa: string;
  podInvoices: PodInvoice[];
  returnedToVendor: ReturnedItem[];
  rejectedUponDelivery: RejectedItem[];
}
