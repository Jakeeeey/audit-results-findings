import { useState, useCallback } from 'react';
import { InventoryAuditFinding, Branch } from '../types';
import { inventoryAuditService } from '../services/inventoryAuditService';

export function useInventoryAudit() {
    const [audits, setAudits] = useState<InventoryAuditFinding[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);

    const [branches, setBranches] = useState<Branch[]>([]);
    
    // KPIs
    const [kpis, setKpis] = useState({
        pendingCount: 0,
        totalShortage: 0,
        resolvedCount: 0,
    });
    const [loadingKpis, setLoadingKpis] = useState(false);

    const fetchAudits = useCallback(async (
        page: number,
        search: string,
        status?: string,
        branchId?: string
    ) => {
        setLoading(true);
        try {
            const { data, total } = await inventoryAuditService.getFindings(page, search, status, branchId);
            setAudits(data);
            setTotal(total);
        } catch (error) {
            console.error("Failed to fetch inventory audits:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchBranchesList = useCallback(async () => {
        try {
            const data = await inventoryAuditService.getBranches();
            setBranches(data);
        } catch (error) {
            console.error("Failed to fetch branches:", error);
        }
    }, []);

    const fetchKpis = useCallback(async (branchId?: string) => {
        setLoadingKpis(true);
        try {
            // For now, calculate KPIs based on fetched audits if we fetched everything, 
            // or fetch all relevant and calculate. In a real app, this would be a separate API endpoint.
            const { data } = await inventoryAuditService.getFindings(1, "", "", branchId);
            
            const pendingCount = data.filter(a => a.status === 'PENDING_REVIEW').length;
            const resolvedCount = data.filter(a => a.status !== 'PENDING_REVIEW' && a.status !== 'APPROVED_FOR_DEDUCTION').length;
            
            // Only sum shortages from pending/approved that haven't been settled
            const activeShortages = data.filter(a => a.status === 'PENDING_REVIEW' || a.status === 'APPROVED_FOR_DEDUCTION');
            const totalShortage = activeShortages.reduce((sum, item) => sum + item.total_shortage, 0);

            setKpis({
                pendingCount,
                resolvedCount,
                totalShortage
            });
        } catch (error) {
            console.error("Failed to fetch KPIs:", error);
        } finally {
            setLoadingKpis(false);
        }
    }, []);

    return {
        audits,
        loading,
        total,
        fetchAudits,
        branches,
        fetchBranchesList,
        kpis,
        loadingKpis,
        fetchKpis
    };
}
