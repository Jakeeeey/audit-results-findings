'use client';
import { useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { manilaToday } from '../shared/contracts';
import { SpringStatusBadge } from '../spring/StatusBadge';
import { useCheckerAccess, useCheckerResults } from './hooks';
import { overdue, type CheckerAction } from './contracts';
import { CheckerResultDetails } from './components/CheckerResultDetails';
import { CorrectiveActionDetails } from './components/CorrectiveActionDetails';
import { CheckerActionStatus } from './components/CheckerStatus';

export default function HousekeepingCheckerModule() {
    const [accessRevision, setAccessRevision] = useState(0);
    const [revision, setRevision] = useState(0);
    const access = useCheckerAccess(accessRevision);
    const [requestedBranch, setRequestedBranch] = useState('');
    const [month, setMonth] = useState(() => manilaToday().slice(0, 7));
    const [tab, setTab] = useState('overview');
    const [auditPage, setAuditPage] = useState(1);
    const [actionPage, setActionPage] = useState(1);
    const [status, setStatus] = useState('ALL');
    const [assignedInput, setAssignedInput] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [filterError, setFilterError] = useState('');
    const [search, setSearch] = useState('');
    const [audit, setAudit] = useState<{ id: number; branchId: number }>();
    const [action, setAction] = useState<{ row: CheckerAction; branchId: number }>();
    const warehouses = access.data?.warehouses ?? [];
    const branch = warehouses.find(w => String(w.id) === requestedBranch) ?? warehouses[0];
    const branchId = branch ? String(branch.id) : '';
    const results = useCheckerResults(branchId, access.data?.userId, month, auditPage, actionPage, status, assignedTo, revision);
    const data = results.data;
    const error = access.error || results.error;
    const loading = access.loading || results.loading;
    const clearSelection = () => { setAudit(undefined); setAction(undefined); setAuditPage(1); setActionPage(1); setSearch(''); };
    const openAction = (row: CheckerAction) => { if (branch) { setAudit(undefined); setAction({ row, branchId: branch.id }); } };
    const openAudit = (id: number) => { if (branch) { setAction(undefined); setAudit({ id, branchId: branch.id }); } };
    const today = data?.summary.asOfDate ?? manilaToday();
    const shownActions = data?.actions.actions.filter(a => `${a.description} ${a.auditNo ?? ''} ${a.assignedToName ?? ''} ${a.criterionDescription ?? ''}`.toLowerCase().includes(search.toLowerCase())) ?? [];
    const shownAudits = data?.audits.audits.filter(a => `${a.auditNo} ${a.area ?? ''} ${a.checkedByName ?? a.checkedBy ?? ''}`.toLowerCase().includes(search.toLowerCase())) ?? [];
    const score = data?.summary.kpi.scorePercent;
    const applyAssignedFilter = () => {
        const value = assignedInput.trim();
        if (value && (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))) { setFilterError('Assigned user ID must be a positive integer, or leave it blank for all users.'); return; }
        setFilterError(''); setAssignedTo(value); setActionPage(1);
    };
    return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Eye className="size-6" /></div><div><h1 className="text-2xl font-semibold tracking-tight">Housekeeping Checker</h1><p className="text-sm text-muted-foreground">Monitor warehouse inspection results and corrective actions.</p></div></div><Button variant="outline" disabled={loading} onClick={() => { clearSelection(); setAccessRevision(v => v + 1); setRevision(v => v + 1); }}><RefreshCw className="mr-2 size-4" />Refresh</Button></div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {!access.loading && access.data && !warehouses.length && <Alert><AlertDescription>No approved active warehouses are available for this workspace.</AlertDescription></Alert>}
        <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-2"><div role="group" aria-label="Warehouse selector" className="space-y-1"><p className="text-sm font-medium">Warehouse</p><SearchableSelect value={branchId} disabled={access.loading || !warehouses.length} placeholder="Select warehouse" options={warehouses.map(w => ({ value: String(w.id), label: `${w.name}${w.code ? ` · ${w.code}` : ''}` }))} onValueChange={value => { setRequestedBranch(value); clearSelection(); }} /><p className="text-xs text-muted-foreground">Warehouse selection is a reporting filter, not proof of ownership or write permission.</p></div><div className="space-y-1"><Label htmlFor="checker-month">Reporting month</Label><Input id="checker-month" type="month" value={month} disabled={access.loading} onChange={e => { setMonth(e.target.value); clearSelection(); }} /><p className="text-xs text-muted-foreground">Submitted audit quality uses this month. Corrective-action counts include all dates in the selected warehouse.</p></div></CardContent></Card>
        <Tabs value={tab} onValueChange={value => { setTab(value); setSearch(''); }}><TabsList className="h-auto flex-wrap"><TabsTrigger id="checker-tab-overview" aria-controls="checker-panel-overview" value="overview">Overview</TabsTrigger><TabsTrigger id="checker-tab-audits" aria-controls="checker-panel-audits" value="audits">Audit Results</TabsTrigger><TabsTrigger id="checker-tab-actions" aria-controls="checker-panel-actions" value="actions">Corrective Actions</TabsTrigger></TabsList></Tabs>
        <section role="tabpanel" id={`checker-panel-${tab}`} aria-labelledby={`checker-tab-${tab}`} className="space-y-4">
        {tab === 'actions' && <Button variant="outline" size="sm" onClick={() => { setStatus('ALL'); setAssignedInput(''); setAssignedTo(''); setFilterError(''); setActionPage(1); setSearch(''); }}>Reset action filters</Button>}
        {loading && <div role="status" aria-label="Loading Checker results" className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}</div>}
        {!loading && !error && data && branch && <>
            {tab === 'overview' && <><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[
                { label: '5S Quality Score', value: score == null ? 'No data' : `${score.toFixed(2)}%`, color: 'text-primary' },
                { label: 'Completed Audits', value: data.summary.kpi.audits, color: 'text-emerald-700 dark:text-emerald-300' },
                { label: 'Open Actions', value: data.summary.openActions, color: 'text-amber-700 dark:text-amber-300' },
                { label: 'Completed Actions', value: data.summary.completedActions, color: 'text-emerald-700 dark:text-emerald-300' },
                { label: 'Overdue Actions', value: data.summary.overdueActions ?? 'Not available', color: 'text-red-700 dark:text-red-300' },
            ].map(card => <Card key={card.label}><CardHeader className="px-3 pb-2 pt-3"><CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle></CardHeader><CardContent className="px-3 pb-3"><p className={`text-2xl font-semibold ${card.color}`}>{card.value}</p></CardContent></Card>)}</div>
            {!data.summary.attentionComplete && <Alert><AlertDescription>The open-action list is too large or changed while loading. An exact overdue count is unavailable; use the paginated Corrective Actions tab.</AlertDescription></Alert>}
            <Card><CardHeader><CardTitle className="text-base">Corrective actions requiring attention</CardTitle></CardHeader><CardContent className="space-y-2">{data.summary.attention.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><div><p className="font-medium">{a.description}</p><p className="text-xs text-muted-foreground">Due {a.dueDate || 'not set'} · {a.auditNo || (a.auditId ? `Audit #${a.auditId}` : 'Related audit unavailable')}</p></div><CheckerActionStatus status={a.status} isOverdue={overdue(a, today)} /><Button size="sm" variant="outline" onClick={() => openAction(a)}>View action</Button></div>)}{!data.summary.attention.length && data.summary.attentionComplete && <p className="text-sm text-muted-foreground">No open corrective actions.</p>}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Recent submitted audits</CardTitle></CardHeader><CardContent className="space-y-2">{data.summary.recentAudits.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><div><p className="font-medium">{a.auditNo}</p><p className="text-xs text-muted-foreground">{a.auditDate} · {a.checkedByName || (a.checkedBy ? `User #${a.checkedBy}` : 'Auditor not returned')}</p></div><p className="font-semibold">{a.scorePercent == null ? 'No applicable score' : `${a.scorePercent.toFixed(2)}%`}</p><Button size="sm" variant="outline" onClick={() => openAudit(a.id)}>View details</Button></div>)}{!data.summary.recentAudits.length && <p className="text-sm text-muted-foreground">No submitted audits for this warehouse and month.</p>}</CardContent></Card></>}
            {tab === 'audits' && <Card><CardHeader><CardTitle className="text-base">Audit Results · submitted inspections</CardTitle></CardHeader><CardContent className="space-y-3"><Label htmlFor="checker-search">Search current page</Label><Input id="checker-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Audit number, auditor, area…" /><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow>{['Audit', 'Date', 'Warehouse', 'Auditor', 'Status', 'Official score', 'Action'].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{shownAudits.map(a => <TableRow key={a.id}><TableCell className="font-medium">{a.auditNo}</TableCell><TableCell>{a.auditDate}</TableCell><TableCell>{a.branchName || branch.name}</TableCell><TableCell>{a.checkedByName || a.checkedBy || 'Not returned'}</TableCell><TableCell><SpringStatusBadge status={a.status} /></TableCell><TableCell>{a.scorePercent == null ? 'No applicable score' : `${a.scorePercent.toFixed(2)}%`}</TableCell><TableCell><Button variant="outline" size="sm" onClick={() => openAudit(a.id)}>View details</Button></TableCell></TableRow>)}{!shownAudits.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No submitted audits match this page.</TableCell></TableRow>}</TableBody></Table></div><Pagination page={auditPage} total={data.audits.total} onPage={setAuditPage} /></CardContent></Card>}
            {tab === 'actions' && <Card><CardHeader><CardTitle className="text-base">Corrective Actions · all dates</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><div><Label htmlFor="checker-action-status">Status</Label><Select value={status} onValueChange={value => { setStatus(value); setActionPage(1); }}><SelectTrigger id="checker-action-status" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{['ALL', 'Open', 'Done', 'Cancelled'].map(value => <SelectItem key={value} value={value}>{value === 'ALL' ? 'All statuses' : value}</SelectItem>)}</SelectContent></Select></div><form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); applyAssignedFilter(); }}><div><Label htmlFor="checker-assigned">Assigned user ID</Label><Input id="checker-assigned" inputMode="numeric" value={assignedInput} onChange={e => setAssignedInput(e.target.value)} placeholder="All users" /></div><Button variant="outline" type="submit">Apply</Button></form><div><Label htmlFor="checker-search">Search current page</Label><Input id="checker-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Description, audit, person…" /></div></div>{filterError && <p role="alert" className="text-sm text-destructive">{filterError}</p>}
                <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow>{['Finding', 'Warehouse', 'Related audit / criterion', 'Assigned person', 'Due date', 'Status', 'Action'].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{shownActions.map(a => <TableRow key={a.id}><TableCell className="max-w-72 whitespace-normal">{a.description}</TableCell><TableCell>{a.branchName || branch.name}</TableCell><TableCell>{a.auditNo || (a.auditId ? `Audit #${a.auditId}` : 'Not returned')}<p className="text-xs text-muted-foreground">{a.criterionDescription || (a.gradeId ? 'Linked criterion · open for details' : 'No criterion link')}</p></TableCell><TableCell>{a.assignedToName || (a.assignedTo ? `User #${a.assignedTo}` : 'Unassigned')}</TableCell><TableCell>{a.dueDate || 'Not set'}</TableCell><TableCell><CheckerActionStatus status={a.status} isOverdue={overdue(a, today)} /></TableCell><TableCell><Button size="sm" variant="outline" onClick={() => openAction(a)}>View action</Button></TableCell></TableRow>)}{!shownActions.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No corrective actions match this page.</TableCell></TableRow>}</TableBody></Table></div><Pagination page={actionPage} total={data.actions.total} onPage={setActionPage} /></CardContent></Card>}
            </>}
        </section>
        {access.data && branch && audit?.branchId === branch.id && <CheckerResultDetails key={`${access.data.userId}:${branch.id}:${audit.id}`} auditId={audit.id} branchId={branch.id} onClose={() => setAudit(undefined)} onAction={openAction} />}
        {access.data && branch && action?.branchId === branch.id && <CorrectiveActionDetails key={`${access.data.userId}:${branch.id}:${action.row.id}`} action={action.row} branchId={branch.id} warehouse={branch.name} today={today} canComplete={access.data.canComplete} userId={access.data.userId} onClose={() => setAction(undefined)} onChanged={() => setRevision(v => v + 1)} />}
    </div>;
}
function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
    return <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p>{total} records · Page {page} of {Math.max(1, Math.ceil(total / 25))}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page * 25 >= total} onClick={() => onPage(page + 1)}>Next</Button></div></div>;
}
