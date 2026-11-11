'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { readSpringHousekeeping, writeSpringHousekeeping, springGradePayload } from './service';
import { auditDetail, editableItems, parseContract, type AuditDetail } from './workflow';
import { dummyWarehouses, springSections } from './contracts';
import { SpringStatusBadge } from './StatusBadge';
import { WorkflowForm } from './WorkflowForm';
import { AuditSupport } from './AuditSupport';
import { RatingCriterion } from './RatingCriterion';
import { ScoringLegend } from './ScoringLegend';

export function AuditDialog({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
    const [detail, setDetail] = useState<AuditDetail>();
    const [answers, setAnswers] = useState<ReturnType<typeof editableItems>>([]);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [terminal, setTerminal] = useState<'submit' | 'cancel' | 'delete' | null>(null);
    const [refresh, setRefresh] = useState(0);
    const [loadedRefresh, setLoadedRefresh] = useState(-1);
    const [editing, setEditing] = useState(false);
    const [showMissing, setShowMissing] = useState(false);
    const loading = loadedRefresh !== refresh;
    useEffect(() => {
        const controller = new AbortController();
        readSpringHousekeeping(`audits/${id}`, new URLSearchParams(), controller.signal).then(body => {
            const value = parseContract(auditDetail, body);
            if (value.audit.id !== id) throw new Error('Audit identifier mismatch');
            if (!controller.signal.aborted) { setDetail(value); setAnswers(editableItems(value)); setDirty(false); setError(''); setLoadedRefresh(refresh); }
        }).catch(e => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Could not load audit'); setLoadedRefresh(refresh); } });
        return () => controller.abort();
    }, [id, refresh]);
    const draft = detail?.audit.status === 'Draft';
    const blocked = busy || loading;
    const answered = answers.filter(a => a.answered).length;
    const complete = answers.length > 0 && answered === answers.length;
    const reload = () => { setRefresh(v => v + 1); onChanged(); };
    const close = () => { if (!blocked && (!dirty || window.confirm('Discard unsaved ratings?'))) onClose(); };
    async function save() {
        if (!detail || blocked) return;
        setBusy(true); setError('');
        try {
            const payload = springGradePayload(answers.filter(a => a.answered).map(a => ({ itemId: a.itemId, grade: a.grade, remarks: a.remarks })), detail.audit.maxGrade);
            if (!payload.length) throw new Error('Select at least one score or N/A before saving.');
            await writeSpringHousekeeping(`audits/${id}/grades`, 'PUT', payload); reload();
        } catch (e) { setError(e instanceof Error ? e.message : 'Draft save failed'); } finally { setBusy(false); }
    }
    function requestSubmit() {
        if (!complete) {
            setShowMissing(true); setError('Answer every criterion with a score or N/A before submitting.');
            const first = answers.find(a => !a.answered);
            if (first) document.getElementById(`criterion-row-${first.itemId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            return;
        }
        if (dirty) { setError('Save your draft before final submission.'); return; }
        setTerminal('submit');
    }
    const warehouse = detail?.audit.branchName || dummyWarehouses.find(w => w.id === detail?.audit.branchId)?.name || (detail ? `Warehouse #${detail.audit.branchId}` : '');
    return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="flex max-h-[94dvh] w-[calc(100%-1rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-4xl sm:p-6">
        <DialogHeader className="shrink-0 border-b pb-3 pr-7"><div className="flex flex-wrap items-center gap-2"><DialogTitle>Housekeeping Audit {detail?.audit.auditNo}</DialogTitle>{detail && <SpringStatusBadge status={detail.audit.status} />}</div><DialogDescription>Warehouse housekeeping evaluation{detail ? ` · ${warehouse} · ${detail.audit.auditDate}` : ''}</DialogDescription></DialogHeader>
        {detail && <div className="shrink-0 space-y-2"><div className="flex justify-between text-xs"><span>{answered} of {answers.length} criteria answered</span><span>{dirty ? 'Unsaved changes' : loading ? 'Refreshing…' : 'Saved record'}</span></div><Progress value={answers.length ? answered / answers.length * 100 : 0} aria-label="Audit completion" /><ScoringLegend maximum={detail.audit.maxGrade} /></div>}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{!detail && loading && <Skeleton className="h-48 w-full" />}
            {detail && <>
                {detail.audit.status === 'Submitted' && <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2"><p className="text-sm text-muted-foreground">Final persisted score</p><p className="text-xl font-semibold">{detail.audit.scorePercent == null ? 'No score' : `${detail.audit.scorePercent.toFixed(2)}%`}</p><p className="text-xs">{detail.audit.pointsEarned ?? '—'} / {detail.audit.pointsPossible ?? '—'} points</p></div>}
                {springSections.map(section => <section key={section}><h3 className="border-b pb-1 text-sm font-semibold">{section}</h3>{answers.filter(a => a.section === section).map(answer => <RatingCriterion key={`${id}:${answer.itemId}`} answer={answer} maximum={detail.audit.maxGrade} editable={draft} disabled={blocked} missing={showMissing && !answer.answered} onChange={patch => { setAnswers(previous => previous.map(a => a.itemId === answer.itemId ? { ...a, ...patch } : a)); setDirty(true); setError(''); }} />)}</section>)}
                <section className="space-y-2 rounded-lg border bg-muted/20 p-3"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Additional information</h3>{draft && <Button size="sm" variant="ghost" disabled={dirty || blocked} onClick={() => setEditing(true)}><Pencil className="mr-1 size-3" />Edit details</Button>}</div><dl className="grid gap-2 text-xs sm:grid-cols-3"><div><dt className="text-muted-foreground">Audit date</dt><dd>{detail.audit.auditDate}</dd></div><div><dt className="text-muted-foreground">Area</dt><dd>{detail.audit.area || 'Not specified'}</dd></div><div><dt className="text-muted-foreground">Auditor</dt><dd>{detail.audit.checkedByName || (detail.audit.checkedBy ? `User ${detail.audit.checkedBy}` : 'Not available')}</dd></div></dl><p className="whitespace-pre-wrap text-sm text-muted-foreground">{detail.audit.remarks || 'No additional remarks provided.'}</p></section>
                <AuditSupport audit={detail.audit} grades={detail.grades} refreshKey={refresh} onChanged={reload} disabled={dirty || blocked} />
            </>}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t pt-3">{draft && <><Button variant="ghost" className="text-destructive hover:text-destructive" disabled={blocked} onClick={() => setTerminal('delete')}>Delete draft</Button><div className="hidden flex-1 sm:block" /><Button variant="outline" disabled={blocked || !dirty} onClick={save}>{busy ? 'Saving…' : 'Save draft'}</Button><Button disabled={blocked} onClick={requestSubmit}>Submit final audit</Button></>}{detail?.audit.status === 'Submitted' && <Button variant="outline" disabled={blocked} onClick={() => setTerminal('cancel')}>Cancel audit (reason required)</Button>}<Button variant="secondary" disabled={blocked} onClick={close}>Close</Button>{error && <Button variant="outline" disabled={dirty || busy} onClick={() => setRefresh(v => v + 1)}>Reload</Button>}</footer>
        {editing && detail && <WorkflowForm title="Edit audit details" description="Save criterion ratings separately first." fields={[{ name: 'auditDate', label: 'Audit date', type: 'date', required: true }, { name: 'area', label: 'Area / zone' }, { name: 'remarks', label: 'General remarks', type: 'textarea' }]} initial={{ auditDate: detail.audit.auditDate, area: detail.audit.area ?? '', remarks: detail.audit.remarks ?? '' }} onClose={() => setEditing(false)} onSave={async v => { await writeSpringHousekeeping(`audits/${id}`, 'PUT', { auditDate: v.auditDate, area: v.area || '', remarks: v.remarks || '' }); reload(); }} />}
        {terminal && <WorkflowForm title={terminal === 'submit' ? 'Submit final audit?' : terminal === 'cancel' ? 'Cancel submitted audit?' : 'Delete draft?'} description={terminal === 'submit' ? 'Saved scores will become final. The audit automatically fulfils an eligible planned date on or before its audit date.' : 'This action cannot be undone. Cancelling a submitted audit releases its planned-date link.'} fields={terminal === 'cancel' ? [{ name: 'reason', label: 'Cancellation reason', type: 'textarea', required: true }] : []} onClose={() => setTerminal(null)} onSave={async values => {
            if (terminal === 'delete') { await writeSpringHousekeeping(`audits/${id}`, 'DELETE'); onChanged(); onClose(); }
            else { await writeSpringHousekeeping(`audits/${id}/${terminal}`, 'POST', terminal === 'cancel' ? { reason: values.reason } : {}); reload(); }
        }} />}
    </DialogContent></Dialog>;
}
export function createdAuditId(body: unknown): number {
    const direct = z.object({ id: z.number().int().positive() }).safeParse(body);
    if (direct.success) return direct.data.id;
    const nested = z.object({ audit: z.object({ id: z.number().int().positive() }) }).safeParse(body);
    if (nested.success) return nested.data.audit.id;
    throw new Error('Audit creation was not fully confirmed. Refresh the audit list before retrying.');
}
