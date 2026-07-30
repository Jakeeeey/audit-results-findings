import { PostDeliveryAuditListResponse, PostDispatchAuditReportData } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getValue(obj: any, keys: string[]) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFlatArrayToPdfData(rows: any[]): PostDispatchAuditReportData {
  if (!rows || rows.length === 0) {
    return { driver: '', dp: '', delDate: '', etod: '', atod: '', etoa: '', atoa: '', podInvoices: [], returnedToVendor: [], rejectedUponDelivery: [] };
  }

  const first = rows[0];
  const driver = getValue(first, ['Driver_Name', 'driver_Name', 'driver_name', 'driverName']);
  const dp = getValue(first, ['DP_Number', 'dp_Number', 'dp_number', 'dpNumber']);
  const delDate = getValue(first, ['DelDate', 'delDate', 'del_date']);
  const etod = getValue(first, ['ETOD', 'etod']);
  const atod = getValue(first, ['ATOD', 'atod']);
  const etoa = getValue(first, ['ETOA', 'etoa']);
  const atoa = getValue(first, ['ATOA', 'atoa']);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const podInvoices: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const returnedToVendor: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rejectedUponDelivery: any[] = [];

  for (const row of rows) {
    const category = String(getValue(row, ['Category', 'category']) || '').toLowerCase();
    
    if (category === 'invoice') {
      podInvoices.push({
        invoices: getValue(row, ['Invoice_No', 'invoice_no', 'invoiceNo']),
        storeName: getValue(row, ['StoreName', 'storeName', 'store_name']),
        status: getValue(row, ['Status', 'status']),
        isInvoiceReceived: getValue(row, ['isInvoiceReceived', 'isinvoicereceived', 'is_invoice_received']),
        remarks: getValue(row, ['Remarks', 'remarks'])
      });
    } else if (category === 'rtv') {
      returnedToVendor.push({
        customerName: getValue(row, ['CustomerName', 'customerName', 'customer_name']),
        product: getValue(row, ['Product', 'product']),
        qty: getValue(row, ['QTY', 'qty']),
        unit: getValue(row, ['Unit', 'unit']),
        amount: getValue(row, ['Amount', 'amount']),
        receivedByWarehouse: getValue(row, ['ReceivedByWarehouse', 'receivedByWarehouse', 'received_by_warehouse'])
      });
    } else if (category === 'rud') {
      rejectedUponDelivery.push({
        customerName: getValue(row, ['CustomerName', 'customerName', 'customer_name']),
        product: getValue(row, ['Product', 'product']),
        qty: getValue(row, ['QTY', 'qty']),
        unit: getValue(row, ['Unit', 'unit']),
        amount: getValue(row, ['Amount', 'amount']),
        receivedByWarehouse: getValue(row, ['ReceivedByWarehouse', 'receivedByWarehouse', 'received_by_warehouse'])
      });
    }
  }

  return { driver, dp, delDate, etod, atod, etoa, atoa, podInvoices, returnedToVendor, rejectedUponDelivery };
}

export const postDeliveryAuditReportService = {
  fetchDispatchPlans: async (page = 1, pageSize = 20, searchParams?: URLSearchParams): Promise<PostDeliveryAuditListResponse> => {
    try {
      const urlParams = new URLSearchParams();
      urlParams.append("action", "list");
      urlParams.append("page", "1");
      urlParams.append("pageSize", "9999"); // Fetch all for local sorting

      let sortBy = "percentage_desc";

      if (searchParams) {
        if (searchParams.has("dispatchNo")) urlParams.append("dispatchNo", searchParams.get("dispatchNo") as string);
        if (searchParams.has("driverId")) urlParams.append("driverId", searchParams.get("driverId") as string);
        if (searchParams.has("dateFrom")) urlParams.append("dateFrom", searchParams.get("dateFrom") as string);
        if (searchParams.has("dateTo")) urlParams.append("dateTo", searchParams.get("dateTo") as string);
        if (searchParams.has("sortBy")) sortBy = searchParams.get("sortBy") as string;
      }

      const response = await fetch(`/api/arf/post-delivery-audit?${urlParams.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch dispatch plans");
      }

      const json = await response.json();
      const allData = json.data || [];

      const sortedData = allData.sort((a: { percentage?: number, tod?: string }, b: { percentage?: number, tod?: string }) => {
        if (sortBy === "percentage_desc") return (b.percentage || 0) - (a.percentage || 0);
        if (sortBy === "percentage_asc") return (a.percentage || 0) - (b.percentage || 0);
        if (sortBy === "tod_desc") return new Date(b.tod || 0).getTime() - new Date(a.tod || 0).getTime();
        if (sortBy === "tod_asc") return new Date(a.tod || 0).getTime() - new Date(b.tod || 0).getTime();
        return (b.percentage || 0) - (a.percentage || 0);
      });

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paginatedData = sortedData.slice(start, end);

      return {
        data: paginatedData,
        meta: {
          total: sortedData.length,
          page,
          pageSize,
          hasMore: end < sortedData.length
        }
      };
    } catch (error) {
      console.error("Error fetching dispatch plans:", error);
      throw error;
    }
  },

  fetchPdfData: async (docNo: string): Promise<PostDispatchAuditReportData> => {
    try {
      const response = await fetch(`/api/arf/post-delivery-audit-report?docNo=${docNo}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch report data");
      }

      const rawData = await response.json();
      
      const rows = Array.isArray(rawData) ? rawData : (rawData.data || []);
      
      if (Array.isArray(rows)) {
        return mapFlatArrayToPdfData(rows);
      }

      return rawData;
    } catch (error) {
      console.error(`Error fetching PDF data for ${docNo}:`, error);
      throw error;
    }
  }
};
