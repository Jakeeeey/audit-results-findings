import { PhysicalInventoryDetail, InventoryAuditFinding, Branch } from '../types';

const API_BASE = "/api/arf/inventory-audit";

export const inventoryAuditService = {
    async getBranches(): Promise<Branch[]> {
        const res = await fetch(`${API_BASE}?action=branches`);
        if (!res.ok) return [];
        const result = await res.json();
        return result.data || [];
    },

    async getFindings(
        page: number,
        search: string,
        status?: string,
        branchId?: string
    ): Promise<{ data: InventoryAuditFinding[]; total: number }> {
        let url = `${API_BASE}?action=list&page=${page}&limit=20&search=${encodeURIComponent(search)}`;
        if (branchId && branchId !== "ALL") url += `&branch_id=${encodeURIComponent(branchId)}`;

        const res = await fetch(url);
        if (!res.ok) return { data: [], total: 0 };
        const result = await res.json();

        let data = result.data || [];

        // Apply status filter locally if status is provided, 
        // since status is dynamically calculated
        if (status && status !== "ALL") {
            data = data.filter((item: { status?: string }) => item.status === status);
        }

        const findings: InventoryAuditFinding[] = data.map((item: {
            id: number;
            ph_no: string;
            date_encoded: string;
            branch_id: unknown; 
            supplier_id: unknown;
            encoder_id: unknown;
            total_shortage?: number;
            status?: string;
            remarks?: string;
        }) => ({
            id: item.id,
            doc_no: item.ph_no,
            date_created: item.date_encoded,
            branch: item.branch_id,
            supplier: item.supplier_id,
            auditor_id: item.encoder_id,
            total_shortage: item.total_shortage || 0,
            status: (item.status as InventoryAuditFinding['status']) || 'ADJUSTED',
            remarks: item.remarks
        }));

        return {
            data: findings,
            total: result.meta?.total_count || 0
        };
    },

    async getInventoryDetails(ph_id: number): Promise<PhysicalInventoryDetail[]> {
        const res = await fetch(`${API_BASE}?action=details&id=${ph_id}`);
        if (!res.ok) return [];
        const result = await res.json();
        const details = result.data || [];
        return details.filter((d: { difference_cost: string | number }) => Number(d.difference_cost) !== 0);
    },

    async updateFindingStatus(id: number, status: InventoryAuditFinding['status'], remarks: string): Promise<boolean> {
        const res = await fetch(`${API_BASE}?id=${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, remarks })
        });
        
        return res.ok;
    }
};
