'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { checkerService } from '../service';
import type { CheckerAction } from '../contracts';
import type { attachmentRow, AuditDetail } from '../../spring/workflow';
import { CheckerActionStatus } from './CheckerStatus';

export function EvidenceList({ files, auditId }: { files: z.infer<typeof attachmentRow>[]; auditId: number }) {
    return <div className="space-y-2">{files.map(f => <div key={f.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-muted/50"><a className="text-sm underline" href={`/api/arf/housekeeping/files/${auditId}/${f.id}`} target="_blank" rel="noopener noreferrer">{f.fileName || 'View evidence'}</a><span className="text-xs text-muted-foreground">{f.mimeType}</span></div>)}</div>;
}

export function CheckerResultDetails({ auditId, branchId, onClose, onAction }: { auditId: number; branchId: number; onClose: () => void; onAction: (action: CheckerAction) => void }) {
    const [data, setData] = useState<{ detail: AuditDetail; actions: CheckerAction[]; files: z.infer<typeof attachmentRow>[] }>();
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        Promise.all([checkerService.audit(auditId, branchId, controller.signal), checkerService.auditActions(auditId, branchId, controller.signal), checkerService.attachments(auditId, branchId, controller.signal)]).then(([detail, actions, files]) => { if (!controller.signal.aborted) setData({ detail, actions, files }); }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Audit unavailable.'); });
        return () => controller.abort();
    }, [auditId, branchId]);
    return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Audit result {data?.detail.audit.auditNo}</DialogTitle><DialogDescription>Read-only submitted inspection</DialogDescription></DialogHeader>
        {error && <p role="alert">{error}</p>}{!data && !error && <p role="status">Loading result…</p>}
        {data && <><p>{data.detail.audit.auditDate} · {data.detail.audit.branchName || `Warehouse #${branchId}`}</p><p>Official score: {data.detail.audit.scorePercent == null ? 'No applicable score' : `${data.detail.audit.scorePercent}%`}</p>
            {data.detail.grades.map(grade => <div key={grade.id} className="border-b py-2 text-sm"><p className="font-medium">{grade.section} · {grade.description}</p><p>Grade: {grade.grade === null ? 'N/A' : `${grade.grade}/${data.detail.audit.maxGrade}`} · Weight: {grade.weight}</p>{grade.remarks && <p>{grade.remarks}</p>}</div>)}
            <h3 className="font-semibold">Evidence</h3><EvidenceList files={data.files} auditId={auditId} />
            <h3 className="font-semibold">Corrective actions</h3>{data.actions.map(action => <div key={action.id} className="space-y-2 rounded border p-2"><p>{action.description}</p><CheckerActionStatus status={action.status} /><Button variant="outline" onClick={() => onAction({ ...action, auditId, branchId })}>View action</Button></div>)}
        </>}<Button variant="outline" onClick={onClose}>Close</Button>
    </DialogContent></Dialog>;
}
