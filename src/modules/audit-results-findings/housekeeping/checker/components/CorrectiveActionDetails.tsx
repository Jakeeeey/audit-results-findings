'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { checkerService, completeCheckerAction } from '../service';
import { overdue, type CheckerAction } from '../contracts';
import { CheckerActionStatus } from './CheckerStatus';

export function CorrectiveActionDetails({ action, branchId, warehouse, today, canComplete, userId, onClose, onChanged }: { action: CheckerAction; branchId: number; warehouse: string; today: string; canComplete: boolean; userId: number; onClose: () => void; onChanged: () => void }) {
    const [current, setCurrent] = useState<CheckerAction>();
    const [criterion, setCriterion] = useState('Not returned');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(false);
    useEffect(() => {
        if (!action.auditId) return;
        const controller = new AbortController();
        Promise.all([checkerService.audit(action.auditId, branchId, controller.signal), checkerService.auditActions(action.auditId, branchId, controller.signal)]).then(([detail, actions]) => {
            if (controller.signal.aborted) return;
            const found = actions.find(row => row.id === action.id);
            if (!found) throw new Error('Action no longer belongs to this audit.');
            setCurrent(found); setCriterion(detail.grades.find(g => g.id === found.gradeId)?.description || 'No linked criterion');
        }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Action unavailable.'); });
        return () => controller.abort();
    }, [action.id, action.auditId, branchId]);
    const row = current ?? action;
    const assignedElsewhere = row.assignedTo != null && String(row.assignedTo) !== String(userId);
    async function done() {
        if (!action.auditId || !canComplete || !current || busy) return;
        setBusy(true); setError('');
        try { const result = await completeCheckerAction(action.id, action.auditId, branchId); setCurrent(result.action); setConfirm(false); onChanged(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Completion was not confirmed.'); }
        finally { setBusy(false); }
    }
    return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Corrective action</DialogTitle><DialogDescription>{warehouse} · {action.auditNo || `Audit #${action.auditId ?? 'unavailable'}`}</DialogDescription></DialogHeader>
        <p className="whitespace-pre-wrap">{row.description}</p><CheckerActionStatus status={row.status} isOverdue={overdue(row, today)} />
        <dl className="space-y-2 text-sm"><div><dt>Assigned person</dt><dd>{row.assignedToName || (row.assignedTo ? `User #${row.assignedTo}` : 'Unassigned')}</dd></div><div><dt>Due date</dt><dd>{row.dueDate || 'Not set'}</dd></div><div><dt>Inspector criterion</dt><dd>{criterion}</dd></div></dl>
        <p className="text-sm text-muted-foreground">The Inspector’s finding, criterion, assignment and deadline are read-only. Progress remarks/history and resolution uploads are pending verified backend support; remarks never replace the finding description.</p>
        {!canComplete && <p className="text-sm">Status updates require Checker resolution permissions.</p>}
        {assignedElsewhere && <p className="text-sm">Assigned to another user — read-only.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {confirm && <p>Confirm the corrective work is complete? The inspection score will not change.</p>}
        <div className="flex justify-end gap-2">{canComplete && !assignedElsewhere && row.status === 'Open' && <Button disabled={!current || busy} onClick={() => { if (confirm) void done(); else setConfirm(true); }}>{busy ? 'Saving…' : confirm ? 'Confirm Done' : 'Mark Done'}</Button>}<Button variant="outline" disabled={busy} onClick={onClose}>Close</Button></div>
    </DialogContent></Dialog>;
}
