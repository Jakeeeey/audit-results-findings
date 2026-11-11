'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { readSpringHousekeeping, writeSpringHousekeeping } from './service';
import { dummyWarehouses, springChecklistListSchema, springChecklistDetailSchema, springSections, type SpringChecklist, type SpringChecklistDetail } from './contracts';
import { parseContract } from './workflow';
import { WorkflowForm, type FormField } from './WorkflowForm';

const checklistFields: FormField[] = [{ name: 'name', label: 'Checklist name', required: true }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'branchId', label: 'Warehouse', type: 'select', options: [{ value: 'all', label: 'All warehouses' }, ...dummyWarehouses.map(w => ({ value: String(w.id), label: w.name }))] }, { name: 'frequency', label: 'Frequency', type: 'select', required: true, options: ['Daily', 'Weekly', 'Monthly'].map(value => ({ value, label: value })) }, { name: 'maxGrade', label: 'Maximum grade', type: 'number', min: 1, max: 100, required: true }];
const itemFields: FormField[] = [{ name: 'section', label: '5S section', type: 'select', required: true, options: springSections.map(value => ({ value, label: value })) }, { name: 'description', label: 'Criterion', type: 'textarea', required: true }, { name: 'weight', label: 'Weight', type: 'number', min: 0.01, required: true }, { name: 'sortOrder', label: 'Display order', type: 'number', required: true }];
export function ChecklistManager({ onClose }: { onClose: () => void }) {
    const [list, setList] = useState<SpringChecklist[]>([]);
    const [id, setId] = useState('');
    const [detail, setDetail] = useState<SpringChecklistDetail>();
    const [version, setVersion] = useState(0);
    const [error, setError] = useState('');
    const [settledKey, setSettledKey] = useState('');
    const requestKey = `${id}:${version}`;
    const loading = settledKey !== requestKey;
    const [form, setForm] = useState<{ title: string; fields: FormField[]; initial?: Record<string, string>; save: (v: Record<string, string>) => Promise<void> }>();
    const reload = () => setVersion(v => v + 1);
    useEffect(() => { const controller = new AbortController();
        Promise.all([readSpringHousekeeping('checklists', new URLSearchParams(), controller.signal), id ? readSpringHousekeeping(`checklists/${Number(id)}`, new URLSearchParams(), controller.signal) : Promise.resolve(null)]).then(([rows, d]) => {
            const parsed = parseContract(springChecklistListSchema, rows); const value = d === null ? undefined : parseContract(springChecklistDetailSchema, d);
            if (!controller.signal.aborted) { setList(parsed); setDetail(value); setError(''); setSettledKey(requestKey); }
        }).catch(e => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Checklist load failed'); setSettledKey(requestKey); } });
        return () => controller.abort();
    }, [id, version, requestKey]);
    const editChecklist = (current?: SpringChecklist) => setForm({ title: current ? 'Edit checklist' : 'Create checklist', fields: checklistFields, initial: current ? { name: current.name, description: current.description ?? '', branchId: current.branchId === null ? 'all' : String(current.branchId), frequency: current.frequency, maxGrade: String(current.maxGrade) } : { frequency: 'Weekly', maxGrade: '5', branchId: 'all' }, save: async v => {
        await writeSpringHousekeeping(current ? `checklists/${current.id}` : 'checklists', current ? 'PUT' : 'POST', { name: v.name, description: v.description || '', branchId: !v.branchId || v.branchId === 'all' ? null : Number(v.branchId), frequency: v.frequency, maxGrade: Number(v.maxGrade), active: current?.active ?? true }); reload();
    } });
    return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl"><DialogHeader><DialogTitle>Housekeeping checklists</DialogTitle><DialogDescription>Configure future audits. Saved scores are preserved. Disable items instead of deleting history.</DialogDescription></DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Select value={id} onValueChange={value => { setId(value); setDetail(undefined); }} disabled={loading}><SelectTrigger className="w-full" aria-label="Checklist to manage"><SelectValue placeholder="Select a checklist" /></SelectTrigger><SelectContent>{list.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name} · {c.active ? 'Active' : 'Disabled'}</SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={loading} onClick={() => editChecklist()}>Create checklist</Button>
            {!loading && detail && <><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => editChecklist(detail.checklist)}>Edit checklist</Button><Button variant="outline" onClick={() => setForm({ title: detail.checklist.active ? 'Disable checklist?' : 'Enable checklist?', fields: [], save: async () => { const c = detail.checklist; await writeSpringHousekeeping(`checklists/${c.id}`, 'PUT', { name: c.name, description: c.description, branchId: c.branchId, frequency: c.frequency, maxGrade: c.maxGrade, active: !c.active }); reload(); } })}>{detail.checklist.active ? 'Disable' : 'Enable'}</Button><Button onClick={() => setForm({ title: 'Add checklist item', fields: itemFields, initial: { section: 'Sort', weight: '1', sortOrder: String(Math.max(0, ...detail.items.map(i => i.sortOrder)) + 10) }, save: async v => { await writeSpringHousekeeping(`checklists/${detail.checklist.id}/items`, 'POST', { section: v.section, description: v.description, weight: Number(v.weight), sortOrder: Number(v.sortOrder), active: true }); reload(); } })}>Add item</Button></div>
            {[...detail.items].sort((a, b) => a.sortOrder - b.sortOrder).map(item => <div key={item.id} className="space-y-2 rounded-lg border p-3 text-sm"><p className="font-medium">{item.section} · {item.description}</p><p className="text-muted-foreground">Weight {item.weight} · Order {item.sortOrder} · {item.active ? 'Active' : 'Disabled'}</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setForm({ title: 'Edit checklist item', fields: itemFields, initial: { section: item.section, description: item.description, weight: String(item.weight), sortOrder: String(item.sortOrder) }, save: async v => { await writeSpringHousekeeping(`items/${item.id}`, 'PUT', { section: v.section, description: v.description, weight: Number(v.weight), sortOrder: Number(v.sortOrder), active: item.active }); reload(); } })}>Edit</Button><Button size="sm" variant="outline" onClick={() => setForm({ title: item.active ? 'Disable item?' : 'Enable item?', fields: [], save: async () => { await writeSpringHousekeeping(`items/${item.id}`, 'PUT', { section: item.section, description: item.description, weight: item.weight, sortOrder: item.sortOrder, active: !item.active }); reload(); } })}>{item.active ? 'Disable' : 'Enable'}</Button></div></div>)}</>}
        </div><div className="flex shrink-0 justify-end gap-2 border-t pt-3"><Button variant="outline" disabled={loading} onClick={reload}>Refresh</Button><Button variant="secondary" onClick={onClose}>Close</Button></div>
        {form && <WorkflowForm title={form.title} description="Your account must have permission to change this checklist." fields={form.fields} initial={form.initial} onSave={form.save} onClose={() => setForm(undefined)} />}
    </DialogContent></Dialog>;
}
