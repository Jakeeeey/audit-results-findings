'use client';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { InspectionDetail } from '../contracts';
import { evaluationService } from '../services/evaluationService';
import { requestId } from '../request-id';

export function EvaluationPhotos({ detail, onSaved }: { detail: InspectionDetail; onSaved: (value: InspectionDetail) => void }) {
    const [file, setFile] = useState<File>();
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const pending = useRef<string | null>(null);
    const input = useRef<HTMLInputElement>(null);
    async function upload() {
        if (!file || busy) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { setError('Choose a JPEG, PNG or WebP up to 8 MB.'); return; }
        setBusy(true); setError('');
        try {
            pending.current ??= requestId();
            const result = await evaluationService.uploadPhoto(detail.schedule.id, file, pending.current, description);
            onSaved(result); setFile(undefined); setDescription(''); pending.current = null;
            if (input.current) input.current.value = '';
            toast.success('Photo uploaded and saved.');
        } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed. Retry the same photo.'); }
        finally { setBusy(false); }
    }
    if (!detail.evaluation) return null;
    return <section className="space-y-4 rounded-lg border p-4"><h3 className="font-semibold">Photos (optional)</h3>
        <p className="text-sm text-muted-foreground">JPEG, PNG or WebP, up to 8 MB and 20 megapixels each. Maximum 20 photos. Photos are saved separately from checklist drafts.</p>
        <div className="grid gap-4 sm:grid-cols-2">{detail.evaluation.evidence.filter(e => e.status === 'ACTIVE').map(photo => <figure key={photo.id} className="space-y-2 rounded border p-2">
            {/* Authenticated same-origin endpoint, not a public Directus asset. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" className="max-h-64 w-full object-contain" src={`/api/arf/evaluation-and-weekly-performance/schedules/${detail.schedule.id}/evidence/${photo.id}`} alt={photo.description || `Evaluation photo ${photo.id}`} />
            <figcaption className="text-sm">{photo.description || `Saved photo #${photo.id}`}</figcaption></figure>)}</div>
        {detail.capabilities.upload && <fieldset disabled={busy} className="space-y-3"><Label htmlFor="evaluation-photo">Choose photo</Label>
            <Input ref={input} id="evaluation-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { setFile(e.target.files?.[0]); pending.current = null; setError(''); }} />
            <Label htmlFor="evaluation-photo-description">Description (optional)</Label><Textarea id="evaluation-photo-description" maxLength={2000} value={description} onChange={e => { setDescription(e.target.value); pending.current = null; }} />
            <Button disabled={!file || busy} onClick={upload}>{busy ? 'Uploading…' : 'Upload and save photo'}</Button></fieldset>}
        {!detail.capabilities.upload && detail.capabilities.save && <p className="text-sm text-muted-foreground">Uploads need the submission database migration. Photos are not required to submit.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>;
}
