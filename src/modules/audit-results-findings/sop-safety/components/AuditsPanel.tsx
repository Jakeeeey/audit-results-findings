'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { auditSchema, pageSchema } from '../schemas/response.schema';
import { useSopResource } from '../hooks/useSopResource';
import { readSop } from '../services/sopClient';
import { SopError, SopLoading, SopPager, SopSelect, SopStatus, type LookupOption } from './SopShared';
import type { SopChecklist } from '../types';
import { useSopAccess } from './SopAccessProvider';
import { SopFilterToolbar } from './SopUi';
import { Label } from '@/components/ui/label';

export function AuditsPanel({ branch, branches, checklists, onBranch }: { branch: string; branches: LookupOption[]; checklists: SopChecklist[]; onBranch: (value: string) => void }) {
    const access = useSopAccess();
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState('ALL');
    const [checklist, setChecklist] = useState('ALL');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const query = new URLSearchParams({ page: String(page), pageSize: '25', ...(branch !== 'ALL' ? { branchId: branch } : {}), ...(status !== 'ALL' ? { status } : {}), ...(checklist !== 'ALL' ? { checklistId: checklist } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) });
    const resource = useSopResource(`audits:${query}`, signal => readSop('audits', pageSchema('audits', auditSchema), query, signal));
    const rows = resource.data?.audits;
    return <Card className="gap-0 rounded-xl py-0 shadow-xs"><CardContent className="space-y-3 p-4">
        <SopFilterToolbar className="border-0 p-0 shadow-none">
            <div className="w-full sm:w-52"><SopSelect label="Warehouse" value={branch} options={branches} onChange={value => { onBranch(value); setPage(1); }} /></div>
            <div className="w-full sm:w-36"><SopSelect label="Audit status" value={status} options={['ALL', 'Draft', 'Submitted', 'Cancelled'].map(value => ({ value, label: value === 'ALL' ? 'All statuses' : value }))} onChange={value => { setStatus(value); setPage(1); }} /></div>
            <div className="w-full sm:w-52"><SopSelect label="Checklist" value={checklist} options={[{ value: 'ALL', label: 'All checklists' }, ...checklists.map(row => ({ value: String(row.id), label: row.name }))]} onChange={value => { setChecklist(value); setPage(1); }} /></div>
            <div className="grid w-full grid-cols-2 gap-2 sm:w-72"><div className="space-y-1"><Label htmlFor="sop-audits-from" className="text-[11px] text-muted-foreground">From</Label><Input id="sop-audits-from" className="h-9 min-w-0 text-xs" aria-label="From date" type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} /></div><div className="space-y-1"><Label htmlFor="sop-audits-to" className="text-[11px] text-muted-foreground">To</Label><Input id="sop-audits-to" className="h-9 min-w-0 text-xs" aria-label="To date" type="date" value={to} onChange={event => { setTo(event.target.value); setPage(1); }} /></div></div>
            <Button className="h-9" variant="outline" size="sm" onClick={resource.reload}>Refresh audits</Button>
        </SopFilterToolbar><SopError error={resource.error} retry={resource.reload} />
        {resource.loading ? <SopLoading /> : rows && <><Table><TableHeader><TableRow className="bg-muted/30 text-xs">{['Audit', 'Warehouse', 'Checklist', 'Date', 'Inspector', 'Status', 'Score', 'Actions'].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>
            {rows.map(row => <TableRow key={row.id}><TableCell>{row.auditNo}</TableCell><TableCell>{row.branchName}</TableCell><TableCell>{row.checklistName}</TableCell><TableCell>{row.auditDate}</TableCell><TableCell>#{row.checkedBy}</TableCell><TableCell><SopStatus value={row.status} /></TableCell><TableCell>{row.scorePercent === null ? '—' : `${row.scorePercent.toFixed(2)}%`}</TableCell><TableCell><Button asChild size="sm" variant="outline"><Link href={`/arf/sop-safety/${access.roles.includes('INSPECTOR') ? 'inspector' : 'planner'}/audits/${row.id}`}>View audit</Link></Button></TableCell></TableRow>)}
            {!rows.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No audits match these filters.</TableCell></TableRow>}
        </TableBody></Table><SopPager page={page} total={Number(resource.data?.total)} onPage={setPage} /></>}
    </CardContent></Card>;
}
