import { PostDeliveryAuditRecord, PostDeliveryAuditFilters } from "../types";

const BASE_URL = "/api/arf/post-delivery-audit";

export const fetchProvider = {
  getDrivers: async () => {
    const res = await fetch(`${BASE_URL}?action=drivers`);
    const json = await res.json();
    return json.data || [];
  },

  getAuditData: async (filters: PostDeliveryAuditFilters): Promise<{ 
    data: PostDeliveryAuditRecord[], 
    meta?: { total: number; page: number; pageSize: number; hasMore: boolean } 
  }> => {
    const params = new URLSearchParams();
    params.append("action", "list");
    if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.append("dateTo", filters.dateTo);
    if (filters.driverId) params.append("driverId", filters.driverId);
    if (filters.dispatchNo) params.append("dispatchNo", filters.dispatchNo);
    if (filters.page) params.append("page", String(filters.page));
    if (filters.pageSize) params.append("pageSize", String(filters.pageSize));

    const res = await fetch(`${BASE_URL}?${params.toString()}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  },

  updateRemarks: async (planId: number, remarks: string) => {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update-remarks", planId, remarks }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.success;
  },

  getAuditDetails: async (planId: number) => {
    const res = await fetch(`${BASE_URL}?action=details&planId=${planId}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  },

  updateInvoices: async (updates: { id: number; is_audited?: boolean; is_received?: boolean; status?: string; concernId?: number }[], userId?: number | string) => {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "batch-update-invoices", updates, userId }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.success;
  },

  postNTE: async (pdiId: number, fileBase64: string, userId?: number | string) => {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "post-nte", pdiId, fileBase64, userId }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  },
  
  getProfile: async (userId: string | number) => {
    const res = await fetch(`${BASE_URL}?action=get-profile&userId=${userId}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.data;
  }
};
