'use client';
import { useState } from 'react';
import { CheckCircle2, ClipboardList, Clock3, FilePenLine, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { actionSchema, auditSchema, kpiSchema, outcomes, pageSchema, scheduleSchema } from '../schemas/response.schema';
import { readSop } from '../services/sopClient';
import { useSopResource } from '../hooks/useSopResource';
import { SopError, SopLoading, SopSelect, todayManila, type LookupOption } from './SopShared';
import { SopEmptyState, SopFilterToolbar, SopSectionHeading } from './SopUi';
import { ReportingPeriod } from './ReportingPeriod';
import { sopStatusStyles } from '../utils/presentation';
import { useSopAccess } from './SopAccessProvider';
import { CorrectiveActions } from './CorrectiveActions';

export function OverviewPanel({ branch, branches, onBranch }: { branch: string; branches: LookupOption[]; onBranch: (value: string) => void }) {
    const access = useSopAccess();
    const [from, setFrom] = useState(`${todayManila().slice(0, 7)}-01`);
    const [to, setTo] = useState(todayManila());
    const query = new URLSearchParams({ from, to, ...(branch !== 'ALL' ? { branchId: branch } : {}) });
    const kpi = useSopResource(`kpi:${query}`, signal => readSop('kpi', kpiSchema, query, signal));
    const counts = useSopResource(`counts:${query}`, async signal => {
        const count = async (status?: string) => {
            const result = await readSop('audits', pageSchema('audits', auditSchema), new URLSearchParams({ ...Object.fromEntries(query), page: '1', pageSize: '1', ...(status ? { status } : {}) }), signal);
            return result.total;
        };
        const [total, submitted, drafts, open] = await Promise.all([count(), count('Submitted'), count('Draft'), readSop('corrective-actions', pageSchema('actions', actionSchema), new URLSearchParams({ status: 'Open', page: '1', pageSize: '1', ...(branch !== 'ALL' ? { branchId: branch } : {}) }), signal)]);
        return { total, submitted, drafts, open: open.total };
    });
    // Schedule outcomes are intentionally not tied to the compliance period: "Upcoming" would
    // otherwise always be zero because the default period ends today.
    const scheduleCounts = useSopResource(`schedule-counts:${branch}`, async signal => {
        const entries = await Promise.all(outcomes.map(async outcome => {
            const result = await readSop('schedules', pageSchema('schedules', scheduleSchema), new URLSearchParams({ ...(branch !== 'ALL' ? { branchId: branch } : {}), outcome, page: '1', pageSize: '1' }), signal);
            return [outcome, result.total] as const;
        }));
        return Object.fromEntries(entries) as Record<(typeof outcomes)[number], number>;
    });
    const score = kpi.data;
    const metrics = [
        { label: 'Compliance', value: score ? score.scorePercent === null ? 'No data' : `${score.scorePercent.toFixed(2)}%` : '—', icon: ShieldCheck, color: 'text-primary', detail: 'Submitted audits', loading: kpi.loading },
        { label: 'Total audits', value: counts.data?.total?.toLocaleString(), icon: ClipboardList, color: 'text-blue-600 dark:text-blue-400', detail: 'In reporting period', loading: counts.loading },
        { label: 'Submitted', value: counts.data?.submitted?.toLocaleString(), icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', detail: 'Finalized results', loading: counts.loading },
        { label: 'Drafts', value: counts.data?.drafts?.toLocaleString(), icon: FilePenLine, color: 'text-amber-600 dark:text-amber-400', detail: 'Not yet submitted', loading: counts.loading },
        { label: 'Open actions', value: counts.data?.open?.toLocaleString(), icon: Wrench, color: 'text-orange-600 dark:text-orange-400', detail: 'Across all dates', loading: counts.loading },
    ];
    return <div className="space-y-4">
        <SopFilterToolbar><div className="w-full sm:w-60"><SopSelect label="Warehouse" value={branch} options={branches} onChange={onBranch} /></div><ReportingPeriod from={from} to={to} onFrom={setFrom} onTo={setTo} /><Button size="sm" variant="outline" className="h-9 sm:ml-auto" disabled={kpi.loading || counts.loading || scheduleCounts.loading} onClick={() => { kpi.reload(); counts.reload(); scheduleCounts.reload(); }}><RefreshCw className="mr-2 size-3.5" />Refresh</Button></SopFilterToolbar>
        <SopError error={kpi.error} retry={kpi.reload} /><SopError error={counts.error} retry={counts.reload} />
        {access.roles.includes('VIEWER') && <section className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/40 p-4 dark:border-amber-900 dark:bg-amber-950/20" aria-label="Open corrective cases"><div className="flex items-center gap-2"><Wrench className="size-5 text-amber-700 dark:text-amber-400" /><h2 className="text-base font-semibold">Open cases requiring attention</h2></div><p className="text-xs text-muted-foreground">Open corrective actions for the selected warehouse, across all dates. Overdue due dates are highlighted below.</p><CorrectiveActions key={branch} branch={branch} openOnly onChanged={counts.reload} /></section>}
        <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-5">{metrics.map((metric, index) => <Card key={metric.label} className={cn('gap-0 rounded-xl py-0 shadow-xs', index === 0 && 'border-primary/20')}><CardContent className="p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-muted-foreground">{metric.label}</p><metric.icon className={cn('size-4 shrink-0', metric.color)} aria-hidden="true" /></div>{metric.loading ? <Skeleton className="my-2 h-8 w-20" /> : <p className={cn('my-1.5 truncate text-2xl font-semibold tracking-tight tabular-nums', index === 0 && 'text-primary')} title={metric.value ?? 'Unavailable'}>{metric.value ?? '—'}</p>}<p className="text-[11px] text-muted-foreground">{metric.detail}</p></CardContent></Card>)}</div>
        {kpi.loading ? <SopLoading /> : score && <Card className="gap-0 rounded-xl py-0 shadow-xs"><CardContent className="p-4 sm:p-5"><SopSectionHeading title="Compliance by section" description={`${score.audits} submitted ${score.audits === 1 ? 'audit' : 'audits'} · ${score.pointsEarned ?? '—'} / ${score.pointsPossible ?? '—'} points`} /><div className="mt-4 grid gap-x-8 gap-y-4 lg:grid-cols-2" aria-label="Compliance by section">{score.sections.map(section => <div key={section.section} className="min-w-0 space-y-2"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium">{section.section}</p><p className="text-[11px] text-muted-foreground">{section.pointsEarned ?? '—'} / {section.pointsPossible ?? '—'} points</p></div><span className="shrink-0 text-sm font-semibold tabular-nums">{section.scorePercent === null ? 'No data' : `${section.scorePercent.toFixed(2)}%`}</span></div>{section.scorePercent === null ? <div className="h-1.5 rounded-full bg-muted" aria-label={`${section.section}: no data`} /> : <Progress className="h-1.5" value={section.scorePercent} aria-valuenow={section.scorePercent} aria-label={`${section.section} compliance`} />}</div>)}</div>{!score.sections.length && <div className="mt-4"><SopEmptyState title="No section results yet" description="Choose another period or submit an audit to see compliance results." /></div>}</CardContent></Card>}
        <section className="space-y-3"><SopSectionHeading title="Inspection schedule" description="All scheduled inspection dates for the selected warehouse. Compliance scores reflect submitted audits." actions={<Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">All dates</Badge>} /><SopError error={scheduleCounts.error} retry={scheduleCounts.reload} /><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{outcomes.map(outcome => <div key={outcome} role="group" aria-label={`${outcome}: ${scheduleCounts.data?.[outcome] ?? 'unavailable'}`} className={cn('flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5', sopStatusStyles[outcome])}><span className="flex items-center gap-1.5 text-xs"><Clock3 className="size-3.5" aria-hidden="true" />{outcome}</span>{scheduleCounts.loading ? <Skeleton className="h-6 w-6" /> : <strong className="text-lg font-semibold tabular-nums">{scheduleCounts.data?.[outcome] ?? '—'}</strong>}</div>)}</div></section>
    </div>;
}
