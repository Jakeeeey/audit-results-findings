"use client";

import { useState, useCallback } from "react";
import { RemittanceAuditFinding, AuditDetailRow, Salesman } from "../types";
import { remittanceAuditService } from "../services/remittance-audit-service";
import { toast } from "sonner";

export function useRemittanceAudit() {
    const [audits, setAudits] = useState<RemittanceAuditFinding[]>([]);
    const [loading, setLoading] = useState(true);

    const [details, setDetails] = useState<AuditDetailRow[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const [salesmen, setSalesmen] = useState<Salesman[]>([]);

    // 🚀 NEW: Dedicated KPI State
    const [kpis, setKpis] = useState({ pendingCount: 0, totalShortage: 0, resolvedCount: 0 });
    const [loadingKpis, setLoadingKpis] = useState(true);

    const fetchSalesmenList = useCallback(async () => {
        try {
            const data = await remittanceAuditService.getSalesmen();
            setSalesmen(data);
        } catch {
            console.error("Failed to fetch salesmen for filter");
        }
    }, []);

    // 🚀 NEW: Unfiltered KPI Fetcher (Respects Salesman, ignores Search/Tabs)
    const fetchKpis = useCallback(async (salesmanId: string) => {
        setLoadingKpis(true);
        try {
            // Using limit=-1 to pull all records to calculate global totals
            const res = await remittanceAuditService.getAudits(1, -1, "", "", salesmanId);
            const allAudits = res.data;

            const pending = allAudits.filter(a => a.status === "PENDING_REVIEW");
            const totalShortage = pending.reduce((sum, a) => sum + a.amount, 0);
            const resolved = allAudits.filter(a => a.status.includes("SETTLED") || a.status === "APPROVED_FOR_DEDUCTION" || a.status === "DEDUCTED_PAYROLL");

            setKpis({ pendingCount: pending.length, totalShortage, resolvedCount: resolved.length });
        } catch {
            console.error("Failed to fetch KPIs.");
        } finally {
            setLoadingKpis(false);
        }
    }, []);

    const fetchAudits = useCallback(async (page: number, search: string, status: string, salesmanId: string) => {
        setLoading(true);
        try {
            const res = await remittanceAuditService.getAudits(page, 50, search, status, salesmanId);
            setAudits(res.data);
        } catch {
            toast.error("Failed to load audit ledger.");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchDetails = useCallback(async (auditId: number) => {
        setLoadingDetails(true);
        try {
            const res = await remittanceAuditService.getAuditDetails(auditId);
            setDetails(res);
        } catch {
            toast.error("Failed to load audit details.");
        } finally {
            setLoadingDetails(false);
        }
    }, []);

    const updateStatus = async (id: number, payload: Partial<RemittanceAuditFinding>) => {
        const res = await remittanceAuditService.updateAuditStatus(id, payload);
        if (res.success) {
            toast.success("Resolution saved successfully.");
            return true;
        } else {
            toast.error(res.error || "Failed to save resolution.");
            return false;
        }
    };

    return {
        audits, loading, fetchAudits,
        details, loadingDetails, fetchDetails,
        updateStatus,
        salesmen, fetchSalesmenList,
        kpis, loadingKpis, fetchKpis // 🚀 Exported!
    };
}