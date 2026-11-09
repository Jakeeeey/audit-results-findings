'use client';
import Link from 'next/link';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { actionSchema, pageSchema, type SopAction } from '../schemas/response.schema';
import { readSop, sopRequest } from '../services/sopClient';
import { useSopResource } from '../hooks/useSopResource';
import { useSopLookups } from '../hooks/useSopLookups';
import { SopFormDialog, type SopField, type SopForm } from './SopFormDialog';
import { SopError, SopLoading, SopPager, SopSelect, SopStatus, todayManila, type LookupOption } from './SopShared';
import { useSopAccess } from './SopAccessProvider';
import { SopEmptyState, SopFilterToolbar, SopSectionHeading } from './SopUi';
import { Plus, RefreshCw } from 'lucide-react';

export function actionFields(users: LookupOption[], grades?: LookupOption[]): SopField[] {
    return [{ name: 'description', label: 'Corrective action', type: 'textarea', required: true },
        { name: 'assignedTo', label: 'Assignee', type: 'select', options: [{ value: 'NONE', label: 'Unassigned' }, ...users] },
        { name: 'dueDate', label: 'Due date', type: 'date' },
        ...(grades ? [{ name: 'gradeId', label: 'Related requirement', type: 'select' as const, options: [{ value: 'NONE', label: 'No linked requirement' }, ...grades] }] : [])];
}
export const actionBody = (values: Record<string, string>) => ({ description: values.description, assignedTo: values.assignedTo && values.assignedTo !== 'NONE' ? Number(values.assignedTo) : null, dueDate: values.dueDate || null, ...(values.gradeId ? { gradeId: values.gradeId === 'NONE' ? null : Number(values.gradeId) } : {}) });

export function CorrectiveActions({ branch = 'ALL', onBranch, branchOptions, auditId, cancelled = false, disabled = false, grades, onChanged }: { branch?: string; onBranch?: (value: string) => void; branchOptions?: LookupOption[]; auditId?: number; cancelled?: boolean; disabled?: boolean; grades?: LookupOption[]; onChanged?: () => void }) {
    const access = useSopAccess();
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState('ALL');
    const [assignedTo, setAssignedTo] = useState('ALL');
    const [form, setForm] = useState<SopForm>();
    const lookup = useSopLookups();
    const query = new URLSearchParams({ page: String(page), pageSize: '25', ...(branch !== 'ALL' ? { branchId: branch } : {}), ...(status !== 'ALL' ? { status } : {}), ...(assignedTo !== 'ALL' ? { assignedTo } : {}) });
    const resource = useSopResource(`actions:${auditId ?? ''}:${query}`, async signal => {
        if (auditId) return { rows: await readSop(`audits/${auditId}/corrective-actions`, z.array(actionSchema), undefined, signal), total: 0 };
        const result = await readSop('corrective-actions', pageSchema('actions', actionSchema), query, signal);
        return { rows: result.actions, total: result.total };
    });
    const edit = (action: SopAction) => setForm({ title: 'Edit corrective action', fields: actionFields([...lookup.users, ...(action.assignedTo && !lookup.users.some(user => Number(user.value) === action.assignedTo) ? [{ value: String(action.assignedTo), label: `User #${action.assignedTo}` }] : [])], grades), initial: { description: action.description, assignedTo: action.assignedTo ? String(action.assignedTo) : 'NONE', dueDate: action.dueDate ?? '', gradeId: action.gradeId ? String(action.gradeId) : 'NONE' }, save: async values => { await sopRequest(`corrective-actions/${action.id}`, { method: 'PUT', body: actionBody(values) }); } });
    return <section className="space-y-3">
        <SopSectionHeading title="Corrective actions" count={resource.data ? auditId ? resource.data.rows.length : resource.data.total : undefined} actions={<><Button size="sm" variant="outline" className="h-8 text-xs" disabled={disabled} onClick={resource.reload}><RefreshCw className="mr-1.5 size-3" />Refresh</Button>{access.inspect && auditId && !cancelled && <Button size="sm" className="h-8 text-xs" disabled={disabled} onClick={() => setForm({ title: 'Add corrective action', fields: actionFields(lookup.users, grades), initial: { assignedTo: 'NONE', gradeId: 'NONE' }, save: async values => { await sopRequest(`audits/${auditId}/corrective-actions`, { method: 'POST', body: actionBody(values) }); } })}><Plus className="mr-1.5 size-3.5" />Add action</Button>}</>} />
        {!auditId && <SopFilterToolbar><div className="w-full sm:w-56"><SopSelect label="Warehouse" value={branch} options={branchOptions ?? []} onChange={value => { onBranch?.(value); setPage(1); }} /></div><div className="w-full sm:w-40"><SopSelect label="Action status" value={status} options={['ALL', 'Open', 'Done', 'Cancelled'].map(value => ({ value, label: value === 'ALL' ? 'All statuses' : value }))} onChange={value => { setStatus(value); setPage(1); }} /></div><div className="w-full sm:w-52"><SopSelect label="Assignee filter" value={assignedTo} options={[{ value: 'ALL', label: 'All assignees' }, ...lookup.users]} onChange={value => { setAssignedTo(value); setPage(1); }} /></div></SopFilterToolbar>}
        <SopError error={resource.error} retry={resource.reload} />
        {resource.loading ? <SopLoading /> : resource.data && <>{resource.data.rows.length ? <Table><TableHeader><TableRow className="bg-muted/30 text-xs">{['Issue / audit', 'Assignee', 'Due', 'Status', 'Actions'].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{resource.data.rows.map(action => <TableRow key={action.id} className="text-xs [&>td]:py-2.5">
            <TableCell className="min-w-56"><p>{action.description}</p>{action.auditId && <Link className="text-xs underline" href={`/arf/sop-safety/${access.roles.includes('INSPECTOR') ? 'inspector' : 'planner'}/audits/${action.auditId}`}>{action.auditNo ?? `Audit #${action.auditId}`}</Link>}<p className="text-xs text-muted-foreground">{action.branchName}{action.gradeId ? ` · ${grades?.find(grade => Number(grade.value) === action.gradeId)?.label ?? `Grade #${action.gradeId}`}` : ''}</p></TableCell>
            <TableCell>{lookup.users.find(user => Number(user.value) === action.assignedTo)?.label ?? (action.assignedTo ? `User #${action.assignedTo}` : 'Unassigned')}</TableCell>
            <TableCell>{action.dueDate || '—'}{action.status === 'Open' && action.dueDate && action.dueDate < todayManila() && <p className="text-xs text-destructive">Overdue</p>}</TableCell><TableCell><SopStatus value={action.status} /></TableCell>
            <TableCell>{access.inspect && action.status === 'Open' && <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" disabled={disabled} onClick={() => edit(action)}>Edit</Button>{['done', 'cancel'].map(step => <Button key={step} size="sm" variant="outline" disabled={disabled} onClick={() => setForm({ title: step === 'done' ? 'Complete action?' : 'Cancel action?', fields: [], save: async () => { await sopRequest(`corrective-actions/${action.id}/${step}`, { method: 'POST' }); } })}>{step === 'done' ? 'Done' : 'Cancel'}</Button>)}</div>}</TableCell>
        </TableRow>)}</TableBody></Table> : <SopEmptyState title={auditId ? 'No corrective actions recorded for this audit.' : 'No corrective actions match these filters.'} description={auditId && access.inspect && !cancelled ? 'Add an action to assign and track any issues found.' : 'Recorded findings and their resolution status will appear here.'} />}{!auditId && resource.data.total > 0 && <SopPager page={page} total={resource.data.total} onPage={setPage} />}</>}
        {access.inspect && form && <SopFormDialog form={form} onClose={() => setForm(undefined)} onChanged={() => { resource.reload(); onChanged?.(); }} />}
    </section>;
}
