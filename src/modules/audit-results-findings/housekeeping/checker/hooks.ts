'use client';
import { useEffect, useState } from 'react';
import type { z } from 'zod';
import { monthRange } from '../shared/contracts';
import { checkerService } from './service';
import type { CheckerAccess, checkerAuditPage, checkerActionPage, checkerSummarySchema } from './contracts';

export function useCheckerAccess(revision: number) {
    const [result, setResult] = useState<{ revision: number; data?: CheckerAccess; error?: string }>();
    useEffect(() => { const controller = new AbortController(); checkerService.access(controller.signal).then(data => { if (!controller.signal.aborted) setResult({ revision, data }); }).catch(e => { if (!controller.signal.aborted) setResult({ revision, error: e instanceof Error ? e.message : 'Access could not load' }); }); return () => controller.abort(); }, [revision]);
    return result?.revision === revision ? { ...result, loading: false } : { loading: true, data: undefined, error: undefined };
}
type Results = { summary: z.infer<typeof checkerSummarySchema>; audits: z.infer<typeof checkerAuditPage>; actions: z.infer<typeof checkerActionPage> };
export function useCheckerResults(branchId: string, userId: number | undefined, month: string, auditPage: number, actionPage: number, status: string, assignedTo: string, revision: number) {
    const key = JSON.stringify([branchId, userId, month, auditPage, actionPage, status, assignedTo, revision]);
    const [result, setResult] = useState<{ key: string; data?: Results; error?: string }>();
    useEffect(() => {
        if (!branchId || !userId) return;
        const controller = new AbortController();
        async function load() {
            const { from, through } = monthRange(month);
            const query = new URLSearchParams({ branchId, from, to: through });
            if (assignedTo && (!/^[1-9]\d*$/.test(assignedTo) || !Number.isSafeInteger(Number(assignedTo)))) throw new Error('Assigned user ID must be a positive integer.');
            const [summary, audits, actions] = await Promise.all([
                checkerService.summary(query, controller.signal),
                checkerService.audits(new URLSearchParams({ branchId, from, to: through, page: String(auditPage), pageSize: '25' }), controller.signal),
                checkerService.actions(new URLSearchParams({ branchId, page: String(actionPage), pageSize: '25', ...(status === 'ALL' ? {} : { status }), ...(assignedTo ? { assignedTo } : {}) }), controller.signal),
            ]);
            if (!controller.signal.aborted) setResult({ key, data: { summary, audits, actions } });
        }
        load().catch(e => { if (!controller.signal.aborted) setResult({ key, error: e instanceof Error ? e.message : 'Checker results could not load' }); });
        return () => controller.abort();
    }, [branchId, userId, month, auditPage, actionPage, status, assignedTo, revision, key]);
    return result?.key === key ? { ...result, loading: false } : { loading: !!branchId && !!userId, data: undefined, error: undefined };
}
