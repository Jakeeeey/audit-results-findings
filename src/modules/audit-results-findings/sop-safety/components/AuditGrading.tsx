'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Info, Loader2, MessageSquare, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { SopError } from './SopShared';
import { GradeControl } from './GradeControl';
import { SopSectionHeading } from './SopUi';
import { auditQuestions, gradePayload, type AuditAnswer } from '../utils/auditUtils';
import { sopRequest } from '../services/sopClient';
import type { SopAuditDetail } from '../schemas/response.schema';
import { useSopAccess } from './SopAccessProvider';

export function AuditGrading({ detail, onSaved, onDirty }: { detail: SopAuditDetail; onSaved: () => void; onDirty: (value: boolean) => void }) {
    const access = useSopAccess();
    const questions = auditQuestions(detail);
    const initial = Object.fromEntries(questions.filter(item => item.saved).map(item => [item.itemId, { itemId: item.itemId, grade: item.grade!, remarks: item.remarks }]));
    const [answers, setAnswers] = useState<Record<number, AuditAnswer>>(initial);
    const [remarkDrafts, setRemarkDrafts] = useState<Record<number, string>>(Object.fromEntries(questions.map(item => [item.itemId, item.remarks])));
    const [remarksOpen, setRemarksOpen] = useState<Record<number, boolean>>({});
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const [error, setError] = useState<unknown>();
    const [blocked, setBlocked] = useState(false);
    const dirty = JSON.stringify(answers) !== JSON.stringify(initial);
    const editable = access.inspect && detail.audit.status === 'Draft';
    useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);
    const sections = Array.from(new Set(questions.map(item => item.section)));
    const savedCount = Math.max(0, questions.length - detail.itemsToGrade.length);
    const progress = questions.length ? savedCount / questions.length * 100 : 0;
    return <section className="space-y-3" aria-label="Audit checklist">
        <div className="rounded-xl border bg-background p-4 shadow-xs">
            <SopSectionHeading title="Checklist grades" description={`${savedCount} of ${questions.length} items addressed and saved`} actions={<span className="text-xs text-muted-foreground">{detail.itemsToGrade.length} remaining</span>} />
            <Progress className="mt-3 h-1.5" value={progress} aria-label="Saved checklist completion" aria-valuenow={progress} />
            <details className="mt-3 text-xs text-muted-foreground"><summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 font-medium text-foreground"><Info className="size-3.5" />Scoring guide<ChevronDown className="size-3" /></summary>
                <div className="mt-2 space-y-1 rounded-lg bg-muted/40 p-3"><p>Choose a grade from 0 to {detail.audit.maxGrade}, following your checklist&apos;s approved scoring guidance.</p><p><strong>0</strong> counts as zero points. <strong>N/A</strong> means not applicable and is excluded from scoring. Unanswered items are not saved.</p><p>Item weights affect the final percentage. Completion updates after saving; your official score is recorded on submission.</p></div>
            </details>
        </div>
        {sections.map(section => <section key={section} className="overflow-hidden rounded-xl border bg-background shadow-xs" aria-label={`${section} criteria`}>
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5"><h4 className="text-sm font-semibold">{section}</h4><span className="text-xs text-muted-foreground">{questions.filter(item => item.section === section).length} items</span></div>
            <div className="divide-y">{questions.filter(item => item.section === section).map(item => {
                const answer = answers[item.itemId];
                const unchanged = item.saved && JSON.stringify(answer) === JSON.stringify(initial[item.itemId]);
                const showRemark = remarksOpen[item.itemId] ?? !!remarkDrafts[item.itemId];
                return <div key={item.itemId} className="px-4 py-3">
                    <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
                        <div className="min-w-0 flex-1"><p className="text-sm font-medium leading-5">{item.description}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>Weight {item.weight}</span><span aria-hidden="true">·</span><span className={answer && !unchanged ? 'text-amber-700 dark:text-amber-400' : ''}>{unchanged ? 'Saved' : answer ? 'Unsaved' : 'Unanswered'}</span></div></div>
                        {editable ? <div className="shrink-0"><GradeControl label={`Grade: ${item.description}`} maximum={detail.audit.maxGrade} value={answer?.grade} disabled={busy || blocked} canClear={!item.saved} onChange={value => setAnswers(current => {
                            const next = { ...current };
                            if (value === undefined) delete next[item.itemId];
                            else next[item.itemId] = { itemId: item.itemId, grade: value, remarks: remarkDrafts[item.itemId] ?? item.remarks };
                            return next;
                        })} /></div> : <span className="w-fit rounded-md border bg-muted/30 px-2.5 py-1 text-sm font-semibold tabular-nums">{item.grade === null ? 'N/A' : item.grade === undefined ? 'Not saved' : `${item.grade} / ${detail.audit.maxGrade}`}</span>}
                    </div>
                    {editable ? <div className="mt-2"><Button type="button" size="sm" variant="ghost" className="h-7 px-0 text-xs text-muted-foreground" disabled={busy || blocked || !answer} aria-expanded={showRemark} aria-controls={`sop-remark-panel-${item.itemId}`} onClick={() => setRemarksOpen(current => ({ ...current, [item.itemId]: !showRemark }))}><MessageSquare className="mr-1.5 size-3.5" />{showRemark ? 'Hide remark' : remarkDrafts[item.itemId] ? 'Show remark' : 'Add remark'}</Button>
                        <div id={`sop-remark-panel-${item.itemId}`} hidden={!showRemark} className="mt-1"><Label htmlFor={`sop-grade-remarks-${item.itemId}`} className="sr-only">Remark for {item.description}</Label><Textarea id={`sop-grade-remarks-${item.itemId}`} rows={2} className="min-h-16 resize-y text-sm" placeholder="Add context or describe the finding…" disabled={busy || blocked || !answer} value={remarkDrafts[item.itemId] ?? ''} onChange={event => {
                            const remarks = event.target.value;
                            setRemarkDrafts(current => ({ ...current, [item.itemId]: remarks }));
                            setAnswers(current => ({ ...current, [item.itemId]: { ...current[item.itemId], remarks } }));
                        }} /></div>
                    </div> : item.remarks && <p className="mt-2 border-l-2 pl-3 text-xs text-muted-foreground">{item.remarks}</p>}
                </div>;
            })}</div>
        </section>)}
        {!questions.length && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No checklist items are available for this audit.</p>}
        <SopError error={error} />
        {editable && <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 px-4 py-3 shadow-sm backdrop-blur-sm">
            <div role="status" className="text-xs"><p className="flex items-center gap-1.5 font-medium">{dirty ? <><span className="size-1.5 rounded-full bg-amber-500" />Unsaved changes</> : <><Check className="size-3.5 text-emerald-600" />No unsaved changes</>}</p><p className="mt-1 text-muted-foreground">{blocked ? 'Reload the audit to confirm saved grades before continuing.' : detail.itemsToGrade.length ? `${detail.itemsToGrade.length} items remaining before submission.` : 'All required items are saved.'}</p></div>
            <Button disabled={busy || blocked || !dirty || !Object.keys(answers).length} onClick={async () => {
                if (lock.current) return;
                lock.current = true; setBusy(true); setError(undefined);
                try { await sopRequest(`audits/${detail.audit.id}/grades`, { method: 'PUT', body: gradePayload(Object.values(answers), detail.audit.maxGrade) }); toast.success('Draft grades saved.'); onSaved(); }
                catch (cause) { setError(cause); setBlocked(true); }
                finally { lock.current = false; setBusy(false); }
            }}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}{busy ? 'Saving…' : 'Save draft'}</Button>
        </div>}
    </section>;
}
