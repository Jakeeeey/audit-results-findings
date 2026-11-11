'use client';
/* eslint-disable @next/next/no-img-element -- Private same-origin evidence must bypass public image optimization. */
import { useState } from 'react';
import { Download, FileImage, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SopAttachment, SopAction } from '../schemas/response.schema';
import type { LookupOption } from './SopShared';
import { fileSizeLabel } from '../utils/presentation';

export function AttachmentGallery({ files, auditId, actions, grades, disabled, canRemove, onRemove }: { files: SopAttachment[]; auditId: number; actions: SopAction[]; grades: LookupOption[]; disabled: boolean; canRemove: (file: SopAttachment) => boolean; onRemove: (file: SopAttachment) => void }) {
    const [failed, setFailed] = useState<Record<number, boolean>>({});
    return <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{files.map(file => {
        const url = `/api/arf/sop-safety/files/${auditId}/${file.id}`;
        const name = file.fileName || `${file.kind} file`;
        const preview = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimeType ?? '') && !failed[file.id];
        return <div key={file.id} className="min-w-0 rounded-lg border bg-background p-3 shadow-xs">
            <div className="flex items-start gap-3"><a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Preview ${name}`} className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">{preview ? <img src={url} alt={name} loading="lazy" className="size-full object-cover" onError={() => setFailed(current => ({ ...current, [file.id]: true }))} /> : <FileImage className="size-6 text-muted-foreground" aria-hidden="true" />}</a><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium leading-5">{name}</p><div className="mt-1 flex flex-wrap items-center gap-1.5"><Badge variant="outline" className="px-1.5 py-0 text-[10px]">{file.kind}</Badge><span className="text-[11px] text-muted-foreground">{fileSizeLabel(file.fileSize)}</span></div></div></div>
            {(file.gradeId || file.correctiveActionId) && <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{file.gradeId && (grades.find(grade => Number(grade.value) === file.gradeId)?.label ?? 'Linked requirement')}{file.gradeId && file.correctiveActionId ? ' · ' : ''}{file.correctiveActionId && (actions.find(action => action.id === file.correctiveActionId)?.description ?? 'Linked corrective action')}</p>}
            <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2"><Button asChild size="sm" variant="ghost" className="h-7 px-1.5 text-xs"><a href={url} target="_blank" rel="noopener noreferrer"><Download className="mr-1.5 size-3.5" />View / download</a></Button>{canRemove(file) && <Button size="sm" variant="ghost" className="h-7 px-1.5 text-xs text-muted-foreground hover:text-destructive" disabled={disabled} onClick={() => onRemove(file)}><Trash2 className="mr-1 size-3.5" />Remove</Button>}</div>
        </div>;
    })}</div>;
}
