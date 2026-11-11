'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { inventoryAuditService } from '../../inventory-audit/services/inventoryAuditService';
import type { Branch } from '../../inventory-audit/types';
import { createSopAuditSchema, type CreateSopAuditInput } from '../schemas/audit.schema';
import { useCreateSopAudit } from '../hooks/useCreateSopAudit';
import type { SopChecklist } from '../types';
import { todayManila } from './SopShared';

export function CreateAuditDialog({ checklists, onClose, onReviewAudits }: { checklists: SopChecklist[]; onClose: () => void; onReviewAudits: () => void }) {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(true);
    const { create, saving, error, uncertain, result } = useCreateSopAudit();
    const form = useForm<CreateSopAuditInput>({
        resolver: zodResolver(createSopAuditSchema),
        defaultValues: { auditDate: todayManila(), area: '', remarks: '' },
    });
    const checklistId = useWatch({ control: form.control, name: 'checklistId' });
    const branchId = useWatch({ control: form.control, name: 'branchId' });
    const selected = checklists.find(checklist => checklist.id === checklistId);
    const options = branches.filter(branch => selected?.branchId == null || branch.id === selected.branchId);
    const completed = result !== undefined;

    useEffect(() => {
        let active = true;
        // Reuse ARF's existing branch lookup. Options do not confer audit permissions.
        inventoryAuditService.getBranches().then(rows => { if (active) setBranches(rows); })
            .catch(() => { if (active) setBranches([]); })
            .finally(() => { if (active) setLoadingBranches(false); });
        return () => { active = false; };
    }, []);

    return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl" onInteractOutside={event => { if (saving) event.preventDefault(); }} onEscapeKeyDown={event => { if (saving) event.preventDefault(); }}>
            <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12"><DialogTitle className="text-base">Create SOP audit</DialogTitle><DialogDescription className="text-xs">Start a warehouse compliance audit. You will be recorded as the inspector.</DialogDescription></DialogHeader>
            {completed && result ? <div className="space-y-3 p-5">
                <p role="status" className="text-sm">Created {result.audit.auditNo} · {result.audit.branchName} · {result.audit.auditDate}</p>
                <Button asChild><Link href={`/arf/sop-safety/inspector/audits/${result.audit.id}`} onClick={onClose}>Open grading workspace</Link></Button>
                <Button variant="outline" onClick={onReviewAudits}>View compliance audits</Button>
            </div> : <form className="flex min-h-0 flex-col" onSubmit={form.handleSubmit(create)}>
                <fieldset disabled={saving || uncertain} className="grid min-h-0 gap-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2"><Label className="text-xs" htmlFor="sop-checklist">Checklist *</Label>
                        <Select value={checklistId ? String(checklistId) : ''} onValueChange={value => {
                            // These Select controls use setValue, not native registered inputs.
                            // Reset explicitly so an old warehouse cannot survive a scope change.
                            form.reset({ ...form.getValues(), checklistId: Number(value), branchId: undefined });
                        }}><SelectTrigger id="sop-checklist" className="h-9 w-full" aria-invalid={!!form.formState.errors.checklistId} aria-describedby={form.formState.errors.checklistId ? 'sop-checklist-error' : undefined}><SelectValue placeholder="Select an active checklist" /></SelectTrigger>
                            <SelectContent>{checklists.filter(checklist => checklist.active).map(checklist => <SelectItem key={checklist.id} value={String(checklist.id)}>{checklist.name}</SelectItem>)}</SelectContent>
                        </Select>
                        {form.formState.errors.checklistId && <p id="sop-checklist-error" role="alert" className="text-xs text-destructive">Select a checklist.</p>}
                    </div>
                    <div className="space-y-1 sm:col-span-2"><Label className="text-xs" htmlFor="sop-warehouse">Warehouse *</Label>
                        <Select disabled={loadingBranches || !selected} value={branchId ? String(branchId) : ''} onValueChange={value => form.setValue('branchId', Number(value), { shouldValidate: true })}>
                            <SelectTrigger id="sop-warehouse" className="h-9 w-full" aria-invalid={!!form.formState.errors.branchId} aria-describedby={form.formState.errors.branchId ? 'sop-warehouse-error' : undefined}><SelectValue placeholder={loadingBranches ? 'Loading warehouses…' : 'Select warehouse'} /></SelectTrigger>
                            <SelectContent>{options.map(branch => <SelectItem key={branch.id} value={String(branch.id)}>{branch.branch_name}</SelectItem>)}</SelectContent>
                        </Select>
                        {!loadingBranches && branches.length === 0 && <p role="alert" className="text-xs text-destructive">Warehouses are unavailable. Close and reopen to try again.</p>}
                        {form.formState.errors.branchId && <p id="sop-warehouse-error" role="alert" className="text-xs text-destructive">Select a warehouse.</p>}
                    </div>
                    <div className="min-w-0 space-y-1"><Label className="text-xs" htmlFor="sop-audit-date">Audit date *</Label><Input className="h-9 min-w-0 text-sm" id="sop-audit-date" type="date" aria-invalid={!!form.formState.errors.auditDate} aria-describedby={form.formState.errors.auditDate ? 'sop-date-error' : undefined} {...form.register('auditDate')} />{form.formState.errors.auditDate && <p id="sop-date-error" role="alert" className="text-xs text-destructive">Enter a valid audit date.</p>}</div>
                    <div className="space-y-1"><Label className="text-xs" htmlFor="sop-area">Area</Label><Input className="h-9 text-sm" id="sop-area" {...form.register('area')} /></div>
                    <div className="space-y-1 sm:col-span-2"><Label className="text-xs" htmlFor="sop-remarks">Remarks</Label><Textarea className="min-h-16 text-sm" rows={2} id="sop-remarks" {...form.register('remarks')} /></div>
                </fieldset>
                {error && <p role="alert" className="px-5 pb-3 text-xs text-destructive">{error}</p>}
                {uncertain && <div className="px-5 pb-3"><Button size="sm" type="button" variant="outline" onClick={onReviewAudits}>Check audit list before retrying</Button></div>}
                <DialogFooter className="shrink-0 border-t bg-muted/20 px-5 py-3"><Button size="sm" type="button" variant="outline" disabled={saving} onClick={onClose}>Close</Button><Button size="sm" type="submit" disabled={saving || uncertain || loadingBranches || branches.length === 0}>{saving ? 'Creating…' : 'Create draft'}</Button></DialogFooter>
            </form>}
        </DialogContent>
    </Dialog>;
}
