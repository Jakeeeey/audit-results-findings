'use client';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { readSpringHousekeeping, writeSpringHousekeeping } from './service';
import { actionRow, attachmentRow, gradeRow, parseContract, type Audit } from './workflow';
import { WorkflowForm, type FormField } from './WorkflowForm';
import { SpringStatusBadge } from './StatusBadge';

export function AuditSupport({ audit, grades, refreshKey, onChanged, disabled = false }: { audit: Audit; grades: z.infer<typeof gradeRow>[]; refreshKey: number; onChanged: () => void; disabled?: boolean }) {
    const [actions, setActions] = useState<z.infer<typeof actionRow>[]>([]);
    const [files, setFiles] = useState<z.infer<typeof attachmentRow>[]>([]);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [busy, setBusy] = useState(false);
    const [kind, setKind] = useState('Evidence');
    const input = useRef<HTMLInputElement>(null);
    const [form, setForm] = useState<{ title: string; fields: FormField[]; initial?: Record<string, string>; save: (v: Record<string, string>) => Promise<void> }>();
    useEffect(() => {
        const controller = new AbortController();
        Promise.all([readSpringHousekeeping(`audits/${audit.id}/corrective-actions`, new URLSearchParams(), controller.signal), readSpringHousekeeping(`audits/${audit.id}/attachments`, new URLSearchParams(), controller.signal)]).then(([a, f]) => {
            const parsedActions = parseContract(z.array(actionRow), a), parsedFiles = parseContract(z.array(attachmentRow), f);
            if (!controller.signal.aborted) { setActions(parsedActions); setFiles(parsedFiles); setError(''); }
        }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load supporting records'); });
        return () => controller.abort();
    }, [audit.id, refreshKey]);
    const blocked = disabled || busy;
    const actionFields: FormField[] = [
        { name: 'description', label: 'Corrective action', type: 'textarea', required: true },
        { name: 'gradeId', label: 'Related criterion', type: 'select', options: [{ value: 'none', label: 'No linked criterion' }, ...grades.map(g => ({ value: String(g.id), label: g.description }))] },
        { name: 'assignedTo', label: 'Assigned user ID (optional)', type: 'number', min: 1 },
        { name: 'dueDate', label: 'Due date (optional)', type: 'date' },
    ];
    const actionBody = (v: Record<string, string>) => ({ description: v.description, assignedTo: v.assignedTo ? Number(v.assignedTo) : null, dueDate: v.dueDate || null, gradeId: v.gradeId && v.gradeId !== 'none' ? Number(v.gradeId) : null });
    return <div className="space-y-4">{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <section className="space-y-2 border-t pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Corrective actions <span className="text-muted-foreground">({actions.length})</span></h3>{audit.status !== 'Cancelled' && <Button size="sm" variant="outline" disabled={blocked} onClick={() => setForm({ title: 'Add corrective action', fields: actionFields, initial: { gradeId: 'none' }, save: async v => { await writeSpringHousekeeping(`audits/${audit.id}/corrective-actions`, 'POST', actionBody(v)); onChanged(); } })}>Add corrective action</Button>}</div>
            {!actions.length && !error && <p className="py-1 text-xs text-muted-foreground">No corrective actions recorded.</p>}
            {actions.map(action => <div key={action.id} className="space-y-1.5 rounded-md border p-2.5 text-sm"><div className="flex items-start justify-between gap-2"><p className="font-medium">{action.description}</p><SpringStatusBadge status={action.status} /></div><p className="text-xs text-muted-foreground">{action.gradeId ? grades.find(g => g.id === action.gradeId)?.description || 'Linked criterion' : 'No linked criterion'} · {action.assignedToName || (action.assignedTo ? `User #${action.assignedTo}` : 'Unassigned')} · Due {action.dueDate || 'not set'}</p>
                {action.status === 'Open' && audit.status !== 'Cancelled' && <div className="flex flex-wrap gap-1.5"><Button size="sm" variant="ghost" disabled={blocked} onClick={() => setForm({ title: 'Edit corrective action', fields: actionFields, initial: { description: action.description, assignedTo: action.assignedTo ? String(action.assignedTo) : '', dueDate: action.dueDate ?? '', gradeId: action.gradeId ? String(action.gradeId) : 'none' }, save: async v => { await writeSpringHousekeeping(`corrective-actions/${action.id}`, 'PUT', actionBody(v)); onChanged(); } })}>Edit</Button>{(['done', 'cancel'] as const).map(step => <Button key={step} size="sm" variant="ghost" disabled={blocked} onClick={() => setForm({ title: step === 'done' ? 'Mark action done?' : 'Cancel action?', fields: [], save: async () => { await writeSpringHousekeeping(`corrective-actions/${action.id}/${step}`, 'POST', {}); onChanged(); } })}>{step === 'done' ? 'Mark done' : 'Cancel'}</Button>)}</div>}
            </div>)}
        </section>
        <section className="space-y-2 border-t pt-3"><h3 className="text-sm font-semibold">Photos and attachments <span className="text-muted-foreground">({files.length})</span></h3><p className="text-xs text-muted-foreground">Upload photos or attach a signature image for this audit. JPEG, PNG or WebP, up to 8 MB and 20 megapixels.</p>
            {audit.status !== 'Cancelled' && <div className="flex flex-wrap items-end gap-2"><div className="w-40"><Label htmlFor={`attachment-kind-${audit.id}`} className="text-xs">Attachment kind</Label><Select value={kind} onValueChange={setKind} disabled={blocked}><SelectTrigger id={`attachment-kind-${audit.id}`} className="h-8 w-full"><SelectValue /></SelectTrigger><SelectContent>{['Evidence', 'Before', 'After', 'Signature'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><Button variant="outline" size="sm" disabled={blocked} onClick={() => input.current?.click()}><Upload className="mr-1 size-3" />{busy ? 'Uploading…' : kind === 'Signature' ? 'Upload signature image' : 'Upload evidence'}</Button>
                <input ref={input} type="file" className="sr-only" aria-label="Choose evidence photo" accept="image/jpeg,image/png,image/webp" disabled={blocked} onChange={async event => {
                    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
                    if (file.size > 8 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPEG, PNG or WebP up to 8 MB.'); return; }
                    setBusy(true); setError(''); setFeedback('');
                    try { const form = new FormData(); form.set('file', file); form.set('kind', kind); const response = await fetch(`/api/arf/housekeeping/files/${audit.id}/upload`, { method: 'POST', body: form }); const body = await response.json(); if (!response.ok) throw new Error(body.message ?? 'Photo upload failed'); setFeedback(`${file.name} uploaded and saved.`); onChanged(); }
                    catch (e) { setError(e instanceof Error ? e.message : 'Upload failed. Reload before retrying.'); } finally { setBusy(false); }
                }} />{kind === 'Signature' && <p className="text-xs text-muted-foreground">Choose an image of the signature. This does not capture or certify an electronic signature.</p>}
            </div>}
            {feedback && <p role="status" className="text-xs text-muted-foreground">{feedback}</p>}
            {!files.length && !error && <p className="py-1 text-xs text-muted-foreground">No saved attachments.</p>}
            <div className="grid gap-2 sm:grid-cols-2">{files.map(file => { const href = `/api/arf/housekeeping/files/${audit.id}/${file.id}`; return <div key={file.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                {file.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimeType) && <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Preview ${file.fileName || 'attachment'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={href} alt={file.fileName || 'Audit evidence'} loading="lazy" className="size-16 rounded object-cover" />
                </a>}
                <div className="min-w-0 flex-1"><p className="break-all font-medium">{file.fileName || `Attachment #${file.id}`}</p><p className="text-xs text-muted-foreground">{file.kind} · {file.mimeType || 'Unknown type'} · {file.fileSize == null ? 'Size unavailable' : `${(file.fileSize / 1024).toFixed(1)} KB`}</p>{(file.uploadedAt || file.createdAt) && <p className="text-xs text-muted-foreground">Uploaded {file.uploadedAt || file.createdAt}</p>}<div className="mt-1 flex gap-1"><Button asChild size="sm" variant="ghost"><a target="_blank" rel="noopener noreferrer" href={href}>View</a></Button>{(audit.status === 'Draft' || actions.some(action => action.id === file.correctiveActionId && action.status === 'Open')) && audit.status !== 'Cancelled' && <Button size="sm" variant="ghost" disabled={blocked} onClick={() => setForm({ title: 'Remove attachment?', fields: [], save: async () => { await writeSpringHousekeeping(`attachments/${file.id}`, 'DELETE'); onChanged(); } })}>Remove</Button>}</div></div>
            </div>; })}</div>
        </section>{disabled && <p className="text-xs text-muted-foreground">Save ratings before changing supporting records.</p>}
        {form && <WorkflowForm title={form.title} description="Changes follow the audit’s access and lifecycle rules." fields={form.fields} initial={form.initial} onSave={form.save} onClose={() => setForm(undefined)} />}
    </div>;
}
