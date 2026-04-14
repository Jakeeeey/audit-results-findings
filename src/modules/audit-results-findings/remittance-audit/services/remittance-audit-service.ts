"use client";

import { RemittanceAuditFinding, AuditDetailRow, Salesman } from "../types";

const API_BASE = "/api/arf/remittance-audit";

export const remittanceAuditService = {
    // 🚀 NEW: Fetch Salesmen List
    getSalesmen: async (): Promise<Salesman[]> => {
        const res = await fetch(`${API_BASE}?action=salesmen`);
        if (!res.ok) return [];
        const result = await res.json();
        return result.data || [];
    },

    // 🚀 NEW: Added salesmanId param
    getAudits: async (page: number = 1, limit: number = 20, search: string = "", status?: string, salesmanId?: string): Promise<{ data: RemittanceAuditFinding[], total: number }> => {
        let url = `${API_BASE}?action=list&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
        if (status && status !== "ALL") url += `&status=${encodeURIComponent(status)}`;
        if (salesmanId && salesmanId !== "ALL") url += `&salesman_id=${encodeURIComponent(salesmanId)}`;

        const res = await fetch(url);
        if (!res.ok) return { data: [], total: 0 };
        const result = await res.json();
        return {
            data: result.data || [],
            total: result.meta?.total_count || 0
        };
    },

    getAuditDetails: async (auditId: number): Promise<AuditDetailRow[]> => {
        const res = await fetch(`${API_BASE}?action=details&id=${auditId}`);
        const result = await res.json();
        return result.data || [];
    },

    updateAuditStatus: async (id: number, payload: Partial<RemittanceAuditFinding>): Promise<{ success: boolean; error?: string }> => {
        const res = await fetch(`${API_BASE}?id=${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return res.json();
    },
};