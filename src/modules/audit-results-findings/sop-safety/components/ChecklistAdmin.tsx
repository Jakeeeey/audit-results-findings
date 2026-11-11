'use client';
import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sopRequest } from '../services/sopClient';
import { useSopLookups } from '../hooks/useSopLookups';
import { SopFormDialog, type SopField, type SopForm } from './SopFormDialog';
import type { SopChecklist, SopChecklistDetail } from '../types';
import { useSopAccess } from './SopAccessProvider';

export function checklistItemForm(detail: SopChecklistDetail, item?: SopChecklistDetail['items'][number]): SopForm {
    const fields: SopField[] = [{ name: 'section', label: 'Section', required: true, suggestions: Array.from(new Set(detail.items.map(row => row.section))) }, { name: 'description', label: 'Requirement', type: 'textarea', required: true }, { name: 'weight', label: 'Weight', type: 'number', min: 0, required: true }, { name: 'sortOrder', label: 'Sort order', type: 'number', required: true }, { name: 'active', label: 'Status', type: 'select', required: true, options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }];
    return {
        title: item ? 'Edit checklist item' : 'Add checklist item',
        description: 'Choose an existing section or enter a new one. Saved audit results keep their original requirements and weights.',
        fields,
        initial: item ? { section: item.section, description: item.description, weight: String(item.weight), sortOrder: String(item.sortOrder), active: String(item.active) } : { weight: '1', sortOrder: String(Math.max(0, ...detail.items.map(row => row.sortOrder)) + 10), active: 'true' },
        save: async values => { await sopRequest(item ? `items/${item.id}` : `checklists/${detail.checklist.id}/items`, { method: item ? 'PUT' : 'POST', body: { section: values.section, description: values.description, weight: Number(values.weight), sortOrder: Number(values.sortOrder), active: values.active === 'true' } }); },
    };
}

export function ChecklistAdmin({ checklist, detail, onChanged }: { checklist?: SopChecklist; detail?: SopChecklistDetail; onChanged: () => void }) {
    const [form, setForm] = useState<SopForm>();
    const lookup = useSopLookups();
    const access = useSopAccess();
    if (!access.managePlanning) return null;
    const fields: SopField[] = [
        { name: 'name', label: 'Checklist name', required: true }, { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'branchId', label: 'Warehouse applicability', type: 'select', required: true, options: [{ value: 'GLOBAL', label: 'All warehouses' }, ...lookup.branches] },
        { name: 'frequency', label: 'Frequency', type: 'select', required: true, options: ['Daily', 'Weekly', 'Monthly'].map(value => ({ value, label: value })) },
        { name: 'maxGrade', label: 'Maximum grade', type: 'number', min: 0, required: true },
        { name: 'active', label: 'Status', type: 'select', required: true, options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
    ];
    return <div className="flex flex-wrap items-center gap-2">
        <Button variant={checklist ? 'outline' : 'default'} size="sm" onClick={() => setForm({ title: checklist ? 'Edit checklist' : 'Create checklist', description: 'Set the checklist scope and grading scale. Previous submitted audits stay unchanged.', fields, initial: checklist ? { name: checklist.name, description: checklist.description ?? '', branchId: checklist.branchId === null ? 'GLOBAL' : String(checklist.branchId), frequency: checklist.frequency, maxGrade: String(checklist.maxGrade), active: String(checklist.active) } : { branchId: 'GLOBAL', frequency: 'Weekly', maxGrade: '5', active: 'true' }, save: async values => { await sopRequest(checklist ? `checklists/${checklist.id}` : 'checklists', { method: checklist ? 'PUT' : 'POST', body: { name: values.name, description: values.description || null, branchId: values.branchId === 'GLOBAL' ? null : Number(values.branchId), frequency: values.frequency, maxGrade: Number(values.maxGrade), active: values.active === 'true' } }); } })}>{checklist ? <Pencil className="mr-1.5 size-3.5" /> : <Plus className="mr-1.5 size-3.5" />}{checklist ? 'Edit checklist' : 'Create checklist'}</Button>
        {detail && <Button size="sm" onClick={() => setForm(checklistItemForm(detail))}><Plus className="mr-1.5 size-3.5" />Add item</Button>}
        {form && <SopFormDialog form={form} onClose={() => setForm(undefined)} onChanged={onChanged} />}
    </div>;
}
