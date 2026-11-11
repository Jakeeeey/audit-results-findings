'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export type FormField = { name: string; label: string; type?: 'text' | 'number' | 'date' | 'textarea' | 'select'; required?: boolean; min?: number | string; max?: number | string; options?: { value: string; label: string }[]; showWhen?: { field: string; value: string } };
export function WorkflowForm({ title, description, fields, initial = {}, onSave, onClose }: { title: string; description: string; fields: FormField[]; initial?: Record<string, string>; onSave: (values: Record<string, string>) => Promise<void>; onClose: () => void }) {
    const [values, setValues] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <form className="flex min-h-0 flex-col gap-4" onSubmit={async event => { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await onSave(values); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); } finally { setBusy(false); } }}>
            <div className="min-h-0 space-y-3 overflow-y-auto">{fields.filter(field => !field.showWhen || values[field.showWhen.field] === field.showWhen.value).map(field => <div key={field.name} className="space-y-1"><Label htmlFor={`workflow-${field.name}`}>{field.label}{field.required ? ' *' : ''}</Label>{field.type === 'select' ? <Select value={values[field.name] ?? ''} required={field.required} disabled={busy} onValueChange={value => setValues(previous => ({ ...previous, [field.name]: value }))}><SelectTrigger id={`workflow-${field.name}`} className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger><SelectContent>{field.options?.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select> : field.type === 'textarea' ? <Textarea id={`workflow-${field.name}`} required={field.required} maxLength={4000} disabled={busy} value={values[field.name] ?? ''} onChange={e => setValues(previous => ({ ...previous, [field.name]: e.target.value }))} /> : <Input id={`workflow-${field.name}`} type={field.type ?? 'text'} required={field.required} min={field.min} max={field.max} step={field.type === 'number' ? 'any' : undefined} disabled={busy} value={values[field.name] ?? ''} onChange={e => setValues(previous => ({ ...previous, [field.name]: e.target.value }))} />}</div>)}</div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter className="shrink-0 border-t pt-3"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</Button></DialogFooter>
        </form></DialogContent></Dialog>;
}
