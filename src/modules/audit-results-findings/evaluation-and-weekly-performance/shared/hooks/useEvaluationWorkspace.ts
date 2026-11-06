'use client';
import { useCallback, useEffect, useState } from 'react';
import type { z } from 'zod';
import { evaluationService } from '../services/evaluationService';
import { manilaToday, monthRange, type AccessInfo, type ScheduleList, type warehouseListSchema } from '../contracts';

export function useEvaluationWorkspace(mode: 'scheduler' | 'viewer') {
    const [context, setContext] = useState<{ access: AccessInfo; warehouses: z.infer<typeof warehouseListSchema> }>();
    const [branchId, setBranchId] = useState('');
    const [month, setMonth] = useState(() => manilaToday().slice(0, 7));
    const [data, setData] = useState<ScheduleList>();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [revision, setRevision] = useState(0);
    const reload = useCallback(() => setRevision(n => n + 1), []);
    useEffect(() => {
        const controller = new AbortController();
        Promise.all([evaluationService.me(controller.signal), evaluationService.warehouses(controller.signal)])
            .then(([access, warehouses]) => {
                if (controller.signal.aborted) return;
                const grants = access.grants.filter(g => warehouses.some(w => w.id === g.branchId) && (mode !== 'scheduler' || g.roles.includes('PLANNER')));
                if (!grants.length && warehouses.length) throw new Error('You do not have permission to use this evaluation module');
                setContext({ access, warehouses });
                let remembered = '';
                try { remembered = sessionStorage.getItem(`arf-evaluation-branch:${access.userId}`) || ''; } catch { /* Storage may be disabled. */ }
                setBranchId(previous => grants.some(g => String(g.branchId) === previous) ? previous
                    : grants.some(g => String(g.branchId) === remembered) ? remembered : '');
                setLoading(false);
                setError('');
            }).catch(e => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Unable to load evaluation access'); setLoading(false); setContext(undefined); } });
        return () => controller.abort();
    }, [mode, revision]);
    useEffect(() => {
        if (!context || !branchId) return;
        const controller = new AbortController();
        let range: ReturnType<typeof monthRange>;
        try { range = monthRange(month); } catch { return () => controller.abort(); }
        evaluationService.schedules(Number(branchId), range.from, range.through, mode, controller.signal)
            .then(result => { if (!controller.signal.aborted) { setData(result); setError(''); setLoading(false); } })
            .catch(e => { if (!controller.signal.aborted) { setData(undefined); setError(e instanceof Error ? e.message : 'Unable to load schedules'); setLoading(false); } });
        return () => controller.abort();
    }, [branchId, month, mode, context, revision]);
    const changeBranch = (value: string) => {
        if (value === branchId) return;
        if (context) {
            try { sessionStorage.setItem(`arf-evaluation-branch:${context.access.userId}`, value); } catch { /* Selection still works without storage. */ }
        }
        setLoading(true); setData(undefined); setBranchId(value);
    };
    const changeMonth = (value: string) => {
        if (value === month) return;
        try { monthRange(value); setLoading(!!branchId); setData(undefined); setMonth(value); }
        catch { setError('Choose a valid reporting month'); }
    };
    return { context, data, error, loading, branchId, month, changeBranch, changeMonth,
        reload: () => { setLoading(true); setData(undefined); reload(); } };
}
