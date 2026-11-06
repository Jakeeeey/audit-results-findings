'use client';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { evaluationService } from '../services/evaluationService';
import type { InspectionDetail } from '../contracts';
import { CHECKLIST } from '../checklist';
import { requestId } from '../request-id';
import { draftSubmissionState } from '../submission-state';

export function DraftChecklistEditor({ detail, onSaved }: { detail: InspectionDetail; onSaved: (value: InspectionDetail) => void }) {
    const evaluation = detail.evaluation!;
    const [answers, setAnswers] = useState(() => evaluation.snapshot.criteria.map(c => evaluation.responses.find(r => r.criterionCode === c.code)
        ?? { criterionCode: c.code, rating: null as number | null, remarks: null as string | null }));
    const [remarks, setRemarks] = useState(evaluation.remarks ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const pending = useRef<{ requestId: string; fingerprint: string } | null>(null);
    const submitRequest = useRef<string | null>(null);
    const submission = draftSubmissionState(detail, answers, remarks, saving);
    async function submit() {
        if (!submission.canSubmit || !window.confirm('Submit this evaluation permanently? You will not be able to edit it afterward. Photos are optional.')) return;
        setSaving(true); setError('');
        try {
            submitRequest.current ??= requestId();
            const result = await evaluationService.submit(detail.schedule.id, { requestId: submitRequest.current, expectedRevision: evaluation.revision });
            onSaved(result); toast.success('Evaluation submitted. The final score is saved.');
        } catch (e) { setError(e instanceof Error ? e.message : 'Submission could not be confirmed. Retry or reload to check its state.'); }
        finally { setSaving(false); }
    }
    async function save() {
        if (saving) return;
        const patch = { remarks: remarks || null, responses: answers };
        const fingerprint = JSON.stringify(patch);
        setSaving(true); setError('');
        try {
            if (!pending.current || pending.current.fingerprint !== fingerprint) {
                pending.current = { requestId: requestId(), fingerprint };
            }
            const result = await evaluationService.saveDraft(detail.schedule.id, { requestId: pending.current.requestId, expectedRevision: evaluation.revision, patch });
            pending.current = null;
            onSaved(result); toast.success('Draft saved. Ratings and remarks persist after reload.');
        } catch (e) { setError(e instanceof Error ? e.message : 'Draft could not be saved'); }
        finally { setSaving(false); }
    }
    return <section className="space-y-4 rounded-lg border p-4">
        <h3 className="font-semibold">Edit inspection draft</h3>
        <p className="text-sm text-muted-foreground">Rate each criterion from 1–10. Remarks and images are optional. Unanswered criteria are allowed in drafts. Saving is not submission.</p>
        <p className="rounded-md bg-muted p-3 text-xs" id="rating-legend">Rating guide: 1–2 Poor · 3–4 Needs improvement · 5–6 Fair · 7–8 Good · 9–10 Excellent</p>
        <fieldset disabled={saving} className="space-y-4">
            {[...new Set(evaluation.snapshot.criteria.map(c => c.pillar))].map(pillar => <section key={pillar} className="space-y-4 rounded-lg border p-4">
                <h3 className="text-lg font-semibold">{CHECKLIST.find(c => c.pillar === pillar)?.pillarTitle ?? pillar}</h3>
                {evaluation.snapshot.criteria.map((criterion, index) => criterion.pillar !== pillar ? null : <div key={criterion.code} id={`question-${criterion.code}`} className="space-y-2 border-b pb-3">
                <p id={`rating-${criterion.code}`} className="text-sm font-medium">{criterion.position}. {criterion.label}</p>
                <div role="group" aria-labelledby={`rating-${criterion.code}`} aria-describedby="rating-legend" className="flex flex-wrap gap-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(value => <Button key={value} type="button" size="sm" variant={answers[index].rating === value ? 'default' : 'outline'} aria-pressed={answers[index].rating === value}
                        aria-label={`${value} out of 10`} onClick={() => setAnswers(previous => previous.map((answer, i) => i === index ? { ...answer, rating: value } : answer))}>{value}</Button>)}
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAnswers(previous => previous.map((answer, i) => i === index ? { ...answer, rating: null } : answer))}>Clear</Button>
                </div>
                <Label htmlFor={`remarks-${criterion.code}`} className="text-xs">Remarks (optional)</Label>
                <Textarea id={`remarks-${criterion.code}`} maxLength={4000} value={answers[index].remarks ?? ''}
                    onChange={event => setAnswers(previous => previous.map((answer, i) => i === index ? { ...answer, remarks: event.target.value || null } : answer))} />
            </div>)}</section>)}
            <Label htmlFor="draft-general-remarks">General remarks (optional)</Label>
            <Textarea id="draft-general-remarks" maxLength={2000} value={remarks} onChange={event => setRemarks(event.target.value)} />
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error} Your edits are retained here. For a stale revision, reload the inspection before editing again.</p>}
        <div className="flex flex-wrap gap-3"><Button disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save checklist draft'}</Button>
            <Button disabled={!submission.canSubmit} aria-describedby="evaluation-submit-readiness" onClick={submit}>Submit evaluation</Button></div>
        <p id="evaluation-submit-readiness" role="status" className="text-sm text-muted-foreground">{submission.reason}</p>
        {submission.missing.length > 0 && <div className="space-y-1 text-sm"><p className="font-medium">Questions still needing a rating:</p><ul className="list-inside list-disc">{submission.missing.map(c => <li key={c.code}><a className="underline" href={`#question-${c.code}`}>{CHECKLIST.find(item => item.code === c.code)?.pillarTitle} · {c.position}. {c.label}</a></li>)}</ul></div>}
    </section>;
}
