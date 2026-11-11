'use client';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SopApiError, SopContractError } from '../services/sopClient';
import { SopError, SopSelect, type LookupOption } from './SopShared';

export type SopField = { name: string; label: string; type?: 'text' | 'number' | 'date' | 'textarea' | 'select'; required?: boolean; min?: number; max?: number; options?: LookupOption[]; suggestions?: string[]; when?: { name: string; value: string } };
export type SopForm = { title: string; description?: string; fields: SopField[]; initial?: Record<string, string>; save: (values: Record<string, string>) => Promise<void> };

export function SopFormDialog({ form, onClose, onChanged }: { form: SopForm; onClose: () => void; onChanged: () => void }) {
    const [values, setValues] = useState(form.initial ?? {});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<unknown>();
    const [uncertain, setUncertain] = useState(false);
    const lock = useRef(false);
    const visible = form.fields.filter(field => !field.when || values[field.when.name] === field.when.value);
    return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl" onInteractOutside={event => { if (busy) event.preventDefault(); }} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12"><DialogTitle className="text-base">{form.title}</DialogTitle><DialogDescription className="text-xs leading-5">{form.description ?? 'Complete the details below, then confirm your changes.'}</DialogDescription></DialogHeader>
        <form className="flex min-h-0 flex-col" onSubmit={async event => {
            event.preventDefault(); if (lock.current || uncertain) return;
            if (visible.some(field => field.required && !values[field.name]?.trim())) { setError(new Error('Complete all required fields.')); return; }
            lock.current = true; setBusy(true); setError(undefined);
            try { await form.save(values); toast.success('Operation confirmed.'); onChanged(); onClose(); }
            catch (cause) { setError(cause); setUncertain(cause instanceof SopApiError && cause.uncertain || cause instanceof SopContractError); }
            finally { lock.current = false; setBusy(false); }
        }}>
            <fieldset className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto px-5 py-4 sm:grid-cols-2" disabled={busy || uncertain}>{visible.map(field => <div key={field.name} className={`min-w-0 space-y-1.5 ${field.type === 'textarea' || ['name', 'section', 'directusFileId'].includes(field.name) ? 'sm:col-span-2' : ''}`}><Label className="text-xs" htmlFor={`sop-field-${field.name}`}>{field.label}{field.required ? ' *' : ''}</Label>
                {field.type === 'select' ? <SopSelect id={`sop-field-${field.name}`} label={field.label} value={values[field.name] ?? ''} disabled={busy || uncertain} options={field.options ?? []} onChange={value => setValues(current => ({ ...current, [field.name]: value }))} /> : field.type === 'textarea' ? <Textarea id={`sop-field-${field.name}`} rows={2} className="min-h-16 text-sm" required={field.required} value={values[field.name] ?? ''} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))} /> : <Input id={`sop-field-${field.name}`} className="h-9 text-sm" type={field.type ?? 'text'} step={field.type === 'number' ? 'any' : undefined} min={field.min} max={field.max} required={field.required} list={field.suggestions ? `sop-suggestions-${field.name}` : undefined} value={values[field.name] ?? ''} onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))} />}
                {field.suggestions && <datalist id={`sop-suggestions-${field.name}`}>{field.suggestions.map(value => <option key={value} value={value} />)}</datalist>}
            </div>)}</fieldset>
            {error != null && <div className="px-5 pb-3"><SopError error={error} /></div>}
            {uncertain && <p role="alert" className="px-5 pb-3 text-xs text-muted-foreground">Refresh and check the record before trying again; your changes may already have been saved.</p>}
            <DialogFooter className="shrink-0 border-t bg-muted/20 px-5 py-3"><Button size="sm" variant="outline" type="button" disabled={busy} onClick={onClose}>Close</Button><Button size="sm" type="submit" disabled={busy || uncertain}>{busy ? 'Saving…' : 'Confirm'}</Button></DialogFooter>
        </form>
    </DialogContent></Dialog>;
}
