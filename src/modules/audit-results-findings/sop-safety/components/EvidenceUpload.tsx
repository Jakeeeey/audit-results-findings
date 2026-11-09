'use client';
import { useRef, useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function EvidenceUpload({ disabled, uploading, onFile }: { disabled: boolean; uploading: boolean; onFile: (file: File) => Promise<void> }) {
    const input = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    return <div role="region" aria-label="Upload evidence" className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-5 text-center transition-colors', dragging && !disabled && 'border-primary bg-primary/5', disabled && 'opacity-60')} onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => {
        event.preventDefault(); event.stopPropagation(); setDragging(false);
        const file = event.dataTransfer.files[0]; if (file && !disabled) void onFile(file);
    }}>
        {uploading ? <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" /> : <UploadCloud className="size-6 text-muted-foreground" aria-hidden="true" />}
        <p className="text-sm font-medium">{uploading ? 'Uploading evidence…' : 'Drop an image here or choose a file'}</p>
        <p className="text-xs text-muted-foreground">JPEG, PNG or WebP · Up to 8 MB</p>
        <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Evidence image" disabled={disabled} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void onFile(file); }} />
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}>Choose file</Button>
        {uploading && <span role="status" className="sr-only">Uploading evidence. Please wait for confirmation.</span>}
    </div>;
}
