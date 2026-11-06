'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { evaluationService } from '../services/evaluationService';
import { displayTime, displayTimestamp, type InspectionDetail } from '../contracts';
import { formatLocalDate } from '../scheduling';
import { scoreChecklist } from '../checklist';
import { EvaluationStatusBadge } from './EvaluationStatusBadge';
import { DraftChecklistEditor } from './DraftChecklistEditor';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { EvaluationPhotos } from './EvaluationPhotos';

export function InspectionDetailDialog({ id, onClose, embedded = false }: { id: number | null; onClose: () => void; embedded?: boolean }) {
    const router = useRouter();
    const [result, setResult] = useState<{ id: number; data?: InspectionDetail; error?: string }>();
    const [starting, setStarting] = useState(false);
    const [actionError, setActionError] = useState('');
    const [cancelling, setCancelling] = useState(false);
    async function cancel() {
        if (id === null || cancelling || !window.confirm('Cancel this dated evaluation? This cannot be undone. The record is preserved. The weekly template is not disabled.')) return;
        setCancelling(true); setActionError('');
        try {
            const data = await evaluationService.cancel(id);
            setResult({ id, data }); toast.success('Evaluation cancelled. Its dated slot has been released.');
        } catch (e) { setActionError(e instanceof Error ? e.message : 'Evaluation could not be cancelled'); }
        finally { setCancelling(false); }
    }
    async function start() {
        if (id === null || starting) return;
        setStarting(true); setActionError('');
        try {
            await evaluationService.start(id);
            const data = await evaluationService.detail(id);
            setResult({ id, data }); toast.success('Inspection started');
            if (!embedded) router.push(`/arf/evaluation-and-weekly-performance/evaluate/${id}`);
        } catch (e) { setActionError(e instanceof Error ? e.message : 'Inspection could not be started'); }
        finally { setStarting(false); }
    }
    useEffect(() => {
        if (id === null) return;
        const controller = new AbortController();
        evaluationService.detail(id, controller.signal).then(data => { if (!controller.signal.aborted) setResult({ id, data }); })
            .catch(e => { if (!controller.signal.aborted) setResult({ id, error: e instanceof Error ? e.message : 'Inspection could not be loaded' }); });
        return () => controller.abort();
    }, [id]);
    const data = result?.id === id ? result.data : undefined;
    const error = result?.id === id ? result.error : undefined;
    const evaluation = data?.evaluation;
    const score = evaluation ? scoreChecklist(evaluation.snapshot, evaluation.snapshot.version, evaluation.responses) : null;
    const content = <>
        {embedded ? <header><h1 className="text-2xl font-semibold">Make evaluation</h1><p className="text-sm text-muted-foreground">Saved inspection data · all times Asia/Manila</p></header> : <DialogHeader><DialogTitle>Inspection details</DialogTitle><DialogDescription>Saved inspection data · all times Asia/Manila</DialogDescription></DialogHeader>}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {!data && !error && <div className="space-y-3" role="status" aria-label="Loading inspection"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-32 w-full" /></div>}
        {data && <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{data.schedule.warehouse}</h2><EvaluationStatusBadge status={data.schedule.status} /></div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Reference</dt><dd className="break-all">{data.schedule.reference}</dd></div><div><dt className="text-muted-foreground">Evaluator</dt><dd>{data.schedule.inspectorId ? `VOS user #${data.schedule.inspectorId}` : 'Not started — open to module users'}</dd></div>
                <div><dt className="text-muted-foreground">Scheduled date and time</dt><dd>{formatLocalDate(data.schedule.localDate)} · {displayTime(data.schedule.startsAt)}–{displayTime(data.schedule.endsAt)}</dd></div>
                <div><dt className="text-muted-foreground">Submission cutoff</dt><dd>{displayTimestamp(data.schedule.deadline)}</dd></div>
                <div><dt className="text-muted-foreground">Start / submitted</dt><dd>{data.schedule.startedAt ? displayTimestamp(data.schedule.startedAt) : 'Not started'} / {data.schedule.submittedAt ? displayTimestamp(data.schedule.submittedAt) : 'Not submitted'}</dd></div>
                <div><dt className="text-muted-foreground">Area / notes</dt><dd>{data.schedule.area || 'No area specified'} · {data.schedule.notes || 'No notes'}</dd></div>
            </dl>
            <Alert><AlertDescription>{data.capabilities.reason}</AlertDescription></Alert>
            {data.capabilities.cancel && <Button variant="destructive" disabled={cancelling || starting} onClick={cancel}>{cancelling ? 'Cancelling…' : 'Cancel evaluation'}</Button>}
            {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
            {embedded && data.capabilities.save && evaluation && <DraftChecklistEditor key={`${evaluation.id}:${evaluation.revision}`} detail={data} onSaved={value => setResult({ id: value.schedule.id, data: value })} />}
            {evaluation && <EvaluationPhotos key={evaluation.id} detail={data} onSaved={value => setResult({ id: value.schedule.id, data: value })} />}
            {evaluation && score && !(embedded && data.capabilities.save) ? <>
                <section className="space-y-2"><div className="flex justify-between text-sm"><span>{score.answered} of 20 criteria answered</span><span>Revision {evaluation.revision}</span></div><Progress value={score.answered * 5} aria-label="Saved checklist progress" /></section>
                {data.schedule.status === 'COMPLETED' && <div className="rounded-lg border bg-muted/40 p-4"><p className="text-sm text-muted-foreground">Final persisted score</p><p className="text-2xl font-semibold">{data.schedule.percentage?.toFixed(2)}%</p><p>{score.earned} / 200 points · historical checklist version {evaluation.snapshot.version}</p></div>}
                {score.pillars.map(pillar => <section key={pillar.code} className="space-y-3"><h3 className="font-semibold">{pillar.title} <span className="text-sm font-normal text-muted-foreground">{pillar.earned}/40 saved points</span></h3>
                    {evaluation.snapshot.criteria.filter(c => c.pillar === pillar.code).map(c => {
                        const response = evaluation.responses.find(r => r.criterionCode === c.code);
                        return <div key={c.code} className="rounded-lg border p-3 text-sm"><div className="flex justify-between gap-4"><p>{c.label}</p><span className="shrink-0 font-medium">{response?.rating == null ? 'Unanswered' : `${response.rating}/10`}</span></div>{response?.remarks && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{response.remarks}</p>}</div>;
                    })}</section>)}
                <section><h3 className="font-semibold">General remarks</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{evaluation.remarks || 'No remarks'}</p></section>
            </> : !evaluation && <p className="text-sm text-muted-foreground">This schedule has not been started. Start it to create the evaluation checklist.</p>}
            {!data.capabilities.start && !evaluation && <p className="text-sm text-muted-foreground">Module users can start from the beginning of the reporting week until the scheduled session ends, when write setup is ready. The first starter becomes the only editor.</p>}
            <div className="flex flex-wrap gap-2">{!evaluation && <Button disabled={!data.capabilities.start || starting} onClick={start}>{starting ? 'Starting…' : 'Start evaluation'}</Button>}{!embedded && evaluation && <Button onClick={() => router.push(`/arf/evaluation-and-weekly-performance/evaluate/${id}`)}>{data.capabilities.save ? 'Continue evaluation' : 'View evaluation'}</Button>}<Button variant="secondary" onClick={onClose}>{embedded ? 'Back to Viewer' : 'Close'}</Button></div>
        </div>}
    </>;
    return embedded ? <div className="mx-auto max-w-4xl space-y-5">{content}</div> : <Dialog open={id !== null} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">{content}</DialogContent></Dialog>;
}
