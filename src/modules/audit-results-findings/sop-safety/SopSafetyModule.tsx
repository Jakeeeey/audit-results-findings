'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, ClipboardCheck, LayoutDashboard, ListChecks, Plus, ShieldCheck, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChecklistFilters } from './components/ChecklistFilters';
import { ChecklistTable } from './components/ChecklistTable';
import { ChecklistDetailDialog } from './components/ChecklistDetailDialog';
import { ChecklistAdmin } from './components/ChecklistAdmin';
import { CreateAuditDialog } from './components/CreateAuditDialog';
import { AuditsPanel } from './components/AuditsPanel';
import { CorrectiveActions } from './components/CorrectiveActions';
import { SchedulesPanel } from './components/SchedulesPanel';
import { OverviewPanel } from './components/OverviewPanel';
import { SopError } from './components/SopShared';
import { useSopSafety } from './hooks/useSopSafety';
import { useSopLookups } from './hooks/useSopLookups';
import type { ChecklistStatusFilter, SopChecklist } from './types';
import { sopRolePaths, sopWorkspaceScreens, type SopRole } from './permissions';
import { useSopAccess, SopWorkspaceScope } from './components/SopAccessProvider';
import { cn } from '@/lib/utils';

const tabs = [{ key: 'overview', label: 'Overview', icon: LayoutDashboard }, { key: 'audits', label: 'Compliance audits', icon: ClipboardCheck }, { key: 'checklists', label: 'Checklists', icon: ListChecks }, { key: 'corrective-actions', label: 'Corrective actions', icon: Wrench }, { key: 'schedules', label: 'Schedules', icon: CalendarDays }];
export default function SopSafetyModule({ initialTab = 'overview', workspace }: { initialTab?: string; workspace: SopRole }) {
    // Each sidebar destination owns its workspace. No automatic role selection,
    // cross-role tabs, or in-screen user-type switcher is exposed.
    if (!sopWorkspaceScreens[workspace].includes(initialTab)) return <SopError error={new Error('This screen is not available in this SOP view.')} />;
    return <SopWorkspaceScope workspace={workspace}><SopWorkspace key={`${workspace}:${initialTab}`} initialTab={initialTab} workspace={workspace} /></SopWorkspaceScope>;
}

function SopWorkspace({ initialTab, workspace }: { initialTab: string; workspace: SopRole }) {
    const router = useRouter();
    const access = useSopAccess();
    const { checklists, error, loading, fetchChecklists } = useSopSafety();
    const lookup = useSopLookups();
    const [branch, setBranch] = useState('ALL');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<ChecklistStatusFilter>('ALL');
    const [selected, setSelected] = useState<SopChecklist | null>(null);
    const [creating, setCreating] = useState(false);
    const query = search.trim().toLocaleLowerCase();
    const rows = checklists.filter(row => (status === 'ALL' || row.active === (status === 'ACTIVE')) && (!query || `${row.name} ${row.description || ''}`.toLocaleLowerCase().includes(query)));
    const branchOptions = [{ value: 'ALL', label: 'All warehouses' }, ...lookup.branches];

    return <div className="flex min-w-0 w-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="size-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">SOP &amp; Safety Compliance</h1><span className="rounded-md border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{workspace === 'PLANNER' ? 'Planner' : 'Inspector'}</span></div><p className="mt-1 text-xs text-muted-foreground sm:text-sm">Monitor warehouse safety compliance, audits, and corrective actions.</p></div></div>{access.inspect && <Button size="sm" disabled={loading || !!error || !checklists.some(checklist => checklist.active)} onClick={() => setCreating(true)}><Plus className="mr-1.5 size-4" />New audit</Button>}</div>
        <nav className="flex min-w-0 gap-1 overflow-x-auto border-b pb-px" aria-label="SOP and safety navigation">{tabs.filter(tab => sopWorkspaceScreens[workspace].includes(tab.key)).map(tab => <Link key={tab.key} href={`${sopRolePaths[workspace]}/${tab.key}`} className={cn('flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-md border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', tab.key === initialTab ? 'border-primary bg-primary/5 text-primary' : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground')} aria-current={tab.key === initialTab ? 'page' : undefined}><tab.icon className="size-4" aria-hidden="true" />{tab.label}</Link>)}</nav>
        {initialTab !== 'checklists' && error && <SopError error={new Error(error)} retry={() => { void fetchChecklists(); }} />}
        <SopError error={lookup.error} retry={lookup.reload} />
        {initialTab === 'overview' && <OverviewPanel branch={branch} branches={branchOptions} onBranch={setBranch} />}
        {initialTab === 'audits' && <AuditsPanel branch={branch} branches={branchOptions} onBranch={setBranch} checklists={checklists} />}
        {initialTab === 'checklists' && <Card className="gap-4 rounded-xl py-4 shadow-xs"><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 py-0"><CardTitle className="text-sm">Checklists</CardTitle><ChecklistAdmin onChanged={() => { void fetchChecklists(); }} /></CardHeader><CardContent className="space-y-3 px-4 py-0"><ChecklistFilters search={search} status={status} loading={loading} onSearchChange={setSearch} onStatusChange={setStatus} onRefresh={() => { void fetchChecklists(); }} />{error ? <SopError error={new Error(error)} /> : <><ChecklistTable rows={rows} loading={loading} onOpen={setSelected} />{!loading && <p className="text-xs text-muted-foreground">Showing {rows.length} of {checklists.length} checklists.</p>}</>}</CardContent></Card>}
        {initialTab === 'corrective-actions' && <Card className="gap-0 rounded-xl py-0 shadow-xs"><CardContent className="p-4"><CorrectiveActions branch={branch} onBranch={setBranch} branchOptions={branchOptions} /></CardContent></Card>}
        {initialTab === 'schedules' && <Card className="gap-0 rounded-xl py-0 shadow-xs"><CardContent className="p-4"><SchedulesPanel branch={branch} branches={branchOptions} onBranch={setBranch} /></CardContent></Card>}
        <ChecklistDetailDialog key={selected?.id ?? 'closed'} checklist={selected} onClose={() => setSelected(null)} onChanged={() => { void fetchChecklists(); }} />
        {access.inspect && creating && <CreateAuditDialog checklists={checklists} onClose={() => setCreating(false)} onReviewAudits={() => { setCreating(false); router.push('/arf/sop-safety/inspector/audits'); }} />}
    </div>;
}
