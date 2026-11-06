'use client';
import { useState } from 'react';
import { CalendarDays, ClipboardCheck, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEvaluationWorkspace } from '../hooks/useEvaluationWorkspace';
import { statusLabels } from './EvaluationStatusBadge';
import { ScheduleBoard } from './ScheduleBoard';
import { InspectionDetailDialog } from './InspectionDetailDialog';
import { CreateScheduleDialog } from '../../scheduler/components/CreateScheduleDialog';
import type { EvaluationStatus } from '../scheduling';
import { displayTimestamp } from '../contracts';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { WeeklyTemplateTable } from '../../scheduler/components/WeeklyTemplateTable';

export function EvaluationWorkspace({ mode }: { mode: 'scheduler' | 'viewer' }) {
    const workspace = useEvaluationWorkspace(mode);
    const [view, setView] = useState<'table' | 'calendar'>('table');
    const [status, setStatus] = useState('ALL');
    const [inspector, setInspector] = useState('ALL');
    const [search, setSearch] = useState('');
    const [detailId, setDetailId] = useState<number | null>(null);
    const context = workspace.context;
    const planner = context?.access.grants.some(g => g.branchId === Number(workspace.branchId) && g.roles.includes('PLANNER')) ?? false;
    const branches = [...new Set((context?.access.grants ?? []).filter(g => context?.warehouses.some(w => w.id === g.branchId) && (mode === 'viewer' || g.roles.includes('PLANNER'))).map(g => g.branchId))];
    const warehouseName = (id: number) => context?.warehouses.find(w => w.id === id)?.branch_name ?? `Warehouse #${id} (historical scope)`;
    const allRows = workspace.data?.rows ?? [];
    const rows = allRows.filter(r => (status === 'ALL' || r.status === status) && (inspector === 'ALL' || String(r.inspectorId) === inspector) &&
        `${r.reference} ${r.warehouse} ${r.area ?? ''} ${r.inspectorId}`.toLowerCase().includes(search.toLowerCase()));
    const counts = Object.keys(statusLabels).map(key => ({ key: key as EvaluationStatus, label: statusLabels[key as EvaluationStatus], value: allRows.filter(r => r.status === key).length }));
    const Icon = mode === 'scheduler' ? CalendarDays : ClipboardCheck;
    return <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="size-7" /></div><div>
            <h1 className="text-2xl font-semibold tracking-tight">Evaluation {mode === 'scheduler' ? 'Scheduler' : 'Viewer'}</h1><p className="text-sm text-muted-foreground">{mode === 'scheduler' ? 'Plan and monitor assigned warehouse inspections.' : 'Review assigned inspections, saved checklists and historical results.'}</p>
        </div></div><div className="flex gap-2"><Button variant="outline" disabled={workspace.loading} onClick={workspace.reload}><RefreshCw className="mr-2 size-4" />Refresh</Button>
            {mode === 'scheduler' && planner && workspace.data && <CreateScheduleDialog key={workspace.branchId} branchId={Number(workspace.branchId)} warehouse={warehouseName(Number(workspace.branchId))} reason={workspace.data.capabilities.reason} canSave={workspace.data.capabilities.weeklyCreate} onSaved={workspace.reload} />}
        </div></div>
        {workspace.error && <Alert variant="destructive"><AlertTitle>Evaluation data could not be loaded</AlertTitle><AlertDescription className="space-y-2"><p>{workspace.error}</p><p>Access or backend configuration may require administrator setup. This is not an empty-results response.</p><Button size="sm" variant="outline" disabled={workspace.loading} onClick={workspace.reload}>Try again</Button></AlertDescription></Alert>}
        {!workspace.error && !workspace.loading && workspace.data && <Alert><AlertDescription>{workspace.data.capabilities.reason}</AlertDescription></Alert>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7"><Card><CardHeader className="px-3 py-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total scheduled</CardTitle></CardHeader><CardContent className="px-3 pb-3">{workspace.loading ? <Skeleton className="h-7 w-10" /> : <p className="text-2xl font-semibold">{workspace.data && !workspace.error ? allRows.length : '—'}</p>}</CardContent></Card>
            {counts.map(count => <Card key={count.key}><CardHeader className="px-3 py-2"><CardTitle className="text-xs font-medium text-muted-foreground">{count.label}</CardTitle></CardHeader><CardContent className="px-3 pb-3">{workspace.loading ? <Skeleton className="h-7 w-10" /> : <p className="text-2xl font-semibold">{workspace.data && !workspace.error ? count.value : '—'}</p>}</CardContent></Card>)}</div>
        <Card><CardHeader><CardTitle className="text-base">{mode === 'scheduler' ? 'Branch schedules' : 'Permitted inspections'}</CardTitle><p className="text-xs text-muted-foreground">Select a branch from Directus first. Summary counts cover the selected branch and month. All times are Asia/Manila.</p></CardHeader><CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="space-y-1"><Label>Branch</Label><SearchableSelect value={workspace.branchId} onValueChange={value => { workspace.changeBranch(value); setInspector('ALL'); }} disabled={!context || workspace.loading} placeholder="Select a branch" options={branches.map(id => { const branch = context?.warehouses.find(w => w.id === id); return { value: String(id), label: `${warehouseName(id)} · ${branch?.branch_code || id}` }; })} /><p className="text-xs text-muted-foreground">{context ? `${branches.length} active branches from Directus` : 'Loading branches…'}</p></div>
                <div className="space-y-1"><Label htmlFor="evaluation-month">{mode === 'scheduler' ? 'Evaluation summary month' : 'Month'}</Label><Input id="evaluation-month" type="month" value={workspace.month} onChange={e => workspace.changeMonth(e.target.value)} disabled={!context} /></div>
                {mode === 'viewer' && <><div className="space-y-1"><Label htmlFor="evaluation-status">Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger id="evaluation-status" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All statuses</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label htmlFor="evaluation-inspector">Inspector</Label><Select value={inspector} onValueChange={setInspector}><SelectTrigger id="evaluation-inspector" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All permitted inspectors</SelectItem>{workspace.data?.inspectorOptions.map(id => <SelectItem key={id} value={String(id)}>VOS user #{id}</SelectItem>)}</SelectContent></Select></div></>}
            </div>
            {mode === 'viewer' && <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Search evaluation schedules" placeholder="Search reference, warehouse or inspector ID…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div><Tabs value={view} onValueChange={value => setView(value === 'calendar' ? 'calendar' : 'table')}><TabsList><TabsTrigger value="table">Table</TabsTrigger><TabsTrigger value="calendar">Calendar</TabsTrigger></TabsList></Tabs></div>}
            {workspace.loading ? <div className="space-y-3" role="status" aria-label="Loading schedules">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : workspace.data && !workspace.error ? mode === 'scheduler'
                ? <WeeklyTemplateTable key={workspace.branchId} branchId={Number(workspace.branchId)} refreshKey={workspace.data.asOf} onChanged={workspace.reload} />
                : <ScheduleBoard key={`${workspace.branchId}:${workspace.month}:${status}:${inspector}:${search}`} rows={rows} view={view} month={workspace.month} onMonth={workspace.changeMonth} onOpen={setDetailId} /> : !workspace.error && <p className="py-8 text-center text-muted-foreground">Select a branch first.</p>}
            {workspace.data && !workspace.error && <p className="text-xs text-muted-foreground">Server snapshot: {displayTimestamp(workspace.data.asOf)}. Refresh for updated outcomes.</p>}
        </CardContent></Card>
        <InspectionDetailDialog id={detailId} onClose={() => { setDetailId(null); workspace.reload(); }} />
    </div>;
}
