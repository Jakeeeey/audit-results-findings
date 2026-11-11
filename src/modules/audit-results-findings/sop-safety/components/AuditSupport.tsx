'use client';
import { z } from 'zod';
import { useRef, useState } from 'react';
import { Link2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { actionSchema, attachmentSchema, type SopAudit, type SopAuditDetail } from '../schemas/response.schema';
import { readSop, sopRequest, SopApiError } from '../services/sopClient';
import { useSopResource } from '../hooks/useSopResource';
import { CorrectiveActions } from './CorrectiveActions';
import { SopFormDialog, type SopForm } from './SopFormDialog';
import { SopError, SopLoading, SopSelect } from './SopShared';
import { SopEmptyState, SopSectionHeading } from './SopUi';
import { useSopAccess } from './SopAccessProvider';
import { EvidenceUpload } from './EvidenceUpload';
import { AttachmentGallery } from './AttachmentGallery';

export function AuditSupport({ audit, grades, version, disabled, onChanged }: { audit: SopAudit; grades: SopAuditDetail['grades']; version: number; disabled: boolean; onChanged: () => void }) {
    const access = useSopAccess();
    const [form, setForm] = useState<SopForm>();
    const [kind, setKind] = useState('Evidence');
    const [gradeId, setGradeId] = useState('NONE');
    const [actionId, setActionId] = useState('NONE');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<unknown>();
    const [uncertain, setUncertain] = useState(false);
    const uploadLock = useRef(false);
    const resource = useSopResource(`support:${audit.id}:${version}`, async signal => {
        const [files, actions] = await Promise.all([readSop(`audits/${audit.id}/attachments`, z.array(attachmentSchema), undefined, signal), readSop(`audits/${audit.id}/corrective-actions`, z.array(actionSchema), undefined, signal)]);
        return { files, actions };
    });
    const gradeOptions = grades.map(grade => ({ value: String(grade.id), label: `${grade.section}: ${grade.description}` }));
    const blocked = disabled || uploading || uncertain;
    async function upload(file: File) {
        if (blocked || resource.loading || resource.error || uploadLock.current) return;
        if (file.size > 8 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setUploadError(new Error('Choose a JPEG, PNG or WebP up to 8 MB.')); return; }
        uploadLock.current = true; setUploading(true); setUploadError(undefined);
        try {
            const data = new FormData(); data.set('file', file); data.set('kind', kind); if (gradeId !== 'NONE') data.set('gradeId', gradeId); if (actionId !== 'NONE') data.set('correctiveActionId', actionId);
            const response = await fetch(`/api/arf/sop-safety/files/${audit.id}/upload`, { method: 'POST', body: data });
            const body = await response.json(); if (!response.ok) throw new SopApiError(body.message ?? 'Upload failed. Refresh before trying again.', response.status, response.status >= 500);
            onChanged();
        } catch (cause) { setUploadError(cause); setUncertain(true); }
        finally { uploadLock.current = false; setUploading(false); }
    }
    const linkExisting = () => setForm({ title: 'Link existing file', description: 'Link a file that has already been uploaded. Enter its saved file reference and any available details.', fields: [{ name: 'directusFileId', label: 'File reference', required: true }, { name: 'fileName', label: 'Filename' }, { name: 'mimeType', label: 'File type (MIME)' }, { name: 'fileSize', label: 'File size (bytes)', type: 'number', min: 0 }], save: async values => { await sopRequest(`audits/${audit.id}/attachments`, { method: 'POST', body: { directusFileId: values.directusFileId, kind, ...(gradeId !== 'NONE' ? { gradeId: Number(gradeId) } : {}), ...(actionId !== 'NONE' ? { correctiveActionId: Number(actionId) } : {}), ...(values.fileName ? { fileName: values.fileName } : {}), ...(values.mimeType ? { mimeType: values.mimeType } : {}), ...(values.fileSize ? { fileSize: Number(values.fileSize) } : {}) } }); } });
    return <div className="space-y-4">
        <section className="rounded-xl border bg-background p-4 shadow-xs"><CorrectiveActions key={version} auditId={audit.id} cancelled={audit.status === 'Cancelled'} disabled={disabled} grades={gradeOptions} onChanged={resource.reload} /></section>
        <section className="space-y-4 rounded-xl border bg-background p-4 shadow-xs">
            <SopSectionHeading title="Evidence & Signatures" description="Upload or link supporting evidence for this audit." count={resource.data?.files.length} actions={<Button variant="outline" size="sm" className="h-8 text-xs" disabled={uploading} onClick={() => { resource.reload(); setUncertain(false); setUploadError(undefined); }}><RefreshCw className="mr-1.5 size-3" />Refresh attachments</Button>} />
            <SopError error={resource.error} retry={resource.reload} />
            {resource.loading ? <SopLoading /> : resource.data && (resource.data.files.length ? <AttachmentGallery files={resource.data.files} auditId={audit.id} actions={resource.data.actions} grades={gradeOptions} disabled={blocked} canRemove={file => access.inspect && (audit.status === 'Draft' || !!resource.data?.actions.some(action => action.id === file.correctiveActionId && action.status === 'Open'))} onRemove={file => setForm({ title: 'Remove attachment?', description: 'This removes the file from this audit. The stored original is retained.', fields: [], save: async () => { await sopRequest(`attachments/${file.id}`, { method: 'DELETE' }); } })} /> : <SopEmptyState title="No supporting files yet" description="Evidence and signatures linked to this audit will appear here." />)}
            {access.inspect && audit.status !== 'Cancelled' && <div className="space-y-3 border-t pt-4">
                <div className="grid gap-3 sm:grid-cols-3"><div className="min-w-0 space-y-1"><Label className="text-xs" htmlFor="sop-file-kind">Attachment kind</Label><SopSelect id="sop-file-kind" label="Attachment kind" value={kind} disabled={blocked} onChange={setKind} options={['Before', 'After', 'Evidence', 'Signature'].map(value => ({ value, label: value }))} /></div><div className="min-w-0 space-y-1"><Label className="text-xs" htmlFor="sop-file-grade">Related requirement</Label><SopSelect id="sop-file-grade" label="Related grade" value={gradeId} onChange={setGradeId} disabled={blocked} options={[{ value: 'NONE', label: 'No linked requirement' }, ...gradeOptions]} /></div><div className="min-w-0 space-y-1"><Label className="text-xs" htmlFor="sop-file-action">Corrective action</Label><SopSelect id="sop-file-action" label="Related action" value={actionId} onChange={setActionId} disabled={blocked} options={[{ value: 'NONE', label: 'No linked action' }, ...(resource.data?.actions ?? []).map(action => ({ value: String(action.id), label: action.description }))]} /></div></div>
                <EvidenceUpload disabled={blocked || resource.loading || !!resource.error} uploading={uploading} onFile={upload} />
                <Button variant="ghost" size="sm" className="h-8 px-0 text-xs text-muted-foreground" disabled={blocked} onClick={linkExisting}><Link2 className="mr-1.5 size-3.5" />Link existing file</Button>
            </div>}
            <SopError error={uploadError} />{uncertain && <p className="text-xs text-muted-foreground">Check the saved attachments before trying again. Keep any returned file reference if the upload needs reconciliation.</p>}
        </section>
        {access.inspect && form && <SopFormDialog form={form} onClose={() => setForm(undefined)} onChanged={() => { resource.reload(); onChanged(); }} />}
    </div>;
}
