/* eslint-disable */
import { ConsolidatorRecord, ConsolidatorDetailRecord, ConsolidatorDispatchRecord, CLDTOFilters } from "../types";

const BASE_URL = "/api/arf/cldto-auditing";

export const fetchProvider = {
  getConsolidators: async (filters: CLDTOFilters): Promise<{ 
    data: ConsolidatorRecord[], 
    meta?: { total: number; page: number; pageSize: number; hasMore: boolean } 
  }> => {
    const params = new URLSearchParams();
    params.append("action", "list");
    if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.append("dateTo", filters.dateTo);
    if (filters.status) params.append("status", filters.status);
    if (filters.page) params.append("page", String(filters.page));
    if (filters.pageSize) params.append("pageSize", String(filters.pageSize));

    const res = await fetch(`${BASE_URL}?${params.toString()}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  },

  getConsolidatorDetails: async (id: number): Promise<{ 
    consolidator: ConsolidatorRecord;
    details: ConsolidatorDetailRecord[];
    dispatches: ConsolidatorDispatchRecord[];
    postDispatchPlans: any[];
  }> => {
    const res = await fetch(`${BASE_URL}?action=details&id=${id}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.data;
  }
};

