'use client';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { auditDetailSchema } from '../schemas/response.schema';
import { useSopResource } from '../hooks/useSopResource';
import { readSop, sopRequest } from '../services/sopClient';
import { AuditGrading } from './AuditGrading';
import { SopError, SopLoading, SopStatus } from './SopShared';
import { SopFormDialog, type SopForm } from './SopFormDialog';
import { AuditSupport } from './AuditSupport';
import { useSopAccess } from './SopAccessProvider';
import { CalendarDays, CheckCircle2, MapPin, RefreshCw, UserRound } from 'lucide-react';
import { auditQuestions } from '../utils/auditUtils';
import { useSopLookups } from '../hooks/useSopLookups';

export function AuditWorkspace({ id, onDeleted, onDirtyChange }: { id: number; onDeleted?: () => void; onDirtyChange?: (value: boolean) => void }) {
    const access = useSopAccess();
    const lookup = useSopLookups();
    const resource = useSopResource(`audit:${id}`, signal => readSop(`audits/${id}`, auditDetailSchema, undefined, signal).then(detail => {
        if (detail.audit.id !== id) throw new Error('Backend returned a different audit.');
        return detail;
    }));
    const [dirty, setDirty] = useState(false);
    const [version, setVersion] = useState(0);
    const [form, setForm] = useState<SopForm>();
    const [operationError, setOperationError] = useState<unknown>();
    const [notice, setNotice] = useState('');
    const onDirty = useCallback((value: boolean) => { setDirty(value); onDirtyChange?.(value); }, [onDirtyChange]);
    const reload = () => { setNotice(''); setOperationError(undefined); setDirty(false); setVersion(value => value + 1); resource.reload(); };
    const detail = resource.data;
    if (resource.loading) return <SopLoading />;
    if (!detail) return <SopError error={resource.error} retry={resource.reload} />;
    const audit = detail.audit;
    const totalItems = auditQuestions(detail).length;
    const savedItems = Math.max(0, totalItems - detail.itemsToGrade.length);
    const inspectorName = lookup.users.find(user => Number(user.value) === audit.checkedBy)?.label ?? `Inspector #${audit.checkedBy}`;
    const refresh = () => { if (!dirty || window.confirm('Discard unsaved grades and reload this audit?')) reload(); };
    return <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="text-xl font-semibold tracking-tight">{audit.auditNo}</h2><SopStatus value={audit.status} /></div><p className="mt-1 text-sm font-medium text-muted-foreground">{audit.checklistName}</p><div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{audit.branchName}</span><span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /><time dateTime={audit.auditDate}>{audit.auditDate}</time></span><span className="flex items-center gap-1.5"><UserRound className="size-3.5" />{inspectorName}</span></div></div><Button size="sm" variant="outline" onClick={refresh}><RefreshCw className="mr-2 size-3.5" />Refresh audit</Button></div>
        <Card className="gap-0 rounded-xl py-0 shadow-xs"><CardContent className="grid divide-y p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="p-4"><p className="text-xs text-muted-foreground">Official compliance</p><p className="mt-1 text-2xl font-semibold tracking-tight text-primary">{audit.status === 'Draft' ? <span className="text-lg text-foreground">Not yet submitted</span> : audit.scorePercent === null ? <span className="text-lg text-foreground">No scored result</span> : `${audit.scorePercent.toFixed(2)}%`}</p></div>
            <div className="p-4"><p className="text-xs text-muted-foreground">Points earned / possible</p><p className="mt-1 text-lg font-semibold tabular-nums">{audit.status === 'Draft' ? '—' : `${audit.pointsEarned ?? '—'} / ${audit.pointsPossible ?? '—'}`}</p><p className="mt-1 text-[11px] text-muted-foreground">{audit.status === 'Draft' ? 'Recorded on submission' : 'Official saved result'}</p></div>
            <div className="p-4"><p className="text-xs text-muted-foreground">Saved checklist progress</p><p className="mt-1 text-lg font-semibold tabular-nums">{savedItems} <span className="text-sm font-normal text-muted-foreground">of {totalItems} items</span></p><p className="mt-1 text-[11px] text-muted-foreground">{detail.itemsToGrade.length ? `${detail.itemsToGrade.length} still to address` : 'All returned items addressed'}</p></div>
        </CardContent></Card>
        <details className="rounded-lg border bg-background px-4 py-3 text-sm"><summary className="cursor-pointer text-xs font-medium">Additional information</summary><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><p><span className="text-muted-foreground">Area:</span> {audit.area || 'Not specified'}</p><p><span className="text-muted-foreground">Remarks:</span> {audit.remarks || 'None'}</p></div></details>
        {audit.cancelReason && <p className="rounded-lg border bg-muted/30 px-4 py-2.5 text-xs">Cancellation: {audit.cancelReason}</p>}
        {audit.status === 'Submitted' && <p className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-4" />Audit submitted. Grades and the official score are locked.</p>}
        {notice && <p role="status" className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-4" />{notice}</p>}
        <SopError error={operationError} />
        {!access.inspect && <p className="text-sm text-muted-foreground">Read-only view. Inspector access is required to change audit records.</p>}
        <div className="flex flex-wrap gap-2">
            {access.inspect && audit.status === 'Draft' && <>
                <Button disabled={dirty || detail.itemsToGrade.length > 0} onClick={() => setForm({ title: 'Submit audit?', description: 'Save every required item before submitting. Submission records the official score and locks the grades.', fields: [], save: async () => {
                    try { await sopRequest(`audits/${id}/submit`, { method: 'POST' }); }
                    catch (cause) { setOperationError(cause); resource.reload(); throw cause; }
                } })}>Submit audit</Button>
                <Button variant="outline" disabled={dirty} onClick={() => setForm({ title: 'Edit draft audit', fields: [{ name: 'auditDate', label: 'Audit date', type: 'date', required: true }, { name: 'area', label: 'Area' }, { name: 'remarks', label: 'Remarks', type: 'textarea' }], initial: { auditDate: audit.auditDate, area: audit.area ?? '', remarks: audit.remarks ?? '' }, save: async values => { await sopRequest(`audits/${id}`, { method: 'PUT', body: values }); } })}>Edit draft</Button>
                <Button variant="outline" disabled={dirty} onClick={() => setForm({ title: 'Delete draft audit?', description: 'This permanently removes the Draft audit. Submitted audits cannot be deleted.', fields: [], save: async () => { await sopRequest(`audits/${id}`, { method: 'DELETE' }); onDeleted?.(); } })}>Delete draft</Button>
            </>}
            {access.inspect && audit.status !== 'Cancelled' && <Button variant="outline" disabled={dirty} onClick={() => setForm({ title: 'Cancel audit', description: 'Provide a reason for cancelling. Any linked inspection will no longer be marked fulfilled by this audit.', fields: [{ name: 'reason', label: 'Reason', type: 'textarea', required: true }], save: async values => { await sopRequest(`audits/${id}/cancel`, { method: 'POST', body: { reason: values.reason } }); } })}>Cancel audit</Button>}
        </div>
        {dirty && <p role="status" className="text-sm text-amber-700">Unsaved grades. Save before submitting or changing supporting records.</p>}
        <AuditGrading key={version} detail={detail} onSaved={() => { reload(); setNotice('Draft grades saved.'); }} onDirty={onDirty} />
        <AuditSupport audit={audit} grades={detail.grades} version={version} disabled={dirty} onChanged={reload} />
        {access.inspect && form && <SopFormDialog form={form} onClose={() => setForm(undefined)} onChanged={reload} />}
    </div>;
}
