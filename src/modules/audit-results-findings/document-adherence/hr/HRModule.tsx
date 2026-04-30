'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Clock, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { useSubsystemList } from './hooks/useSubsystemList';
import { SubsystemFilterBar } from './components/SubsystemFilterBar';
import { SubsystemDocTypeChart } from './components/SubsystemDocTypeChart';
import { SubsystemUserChart } from './components/SubsystemUserChart';
import { SubsystemPerDayChart } from './components/SubsystemPerDayChart';
import { AdherenceRateTrendChart } from './components/AdherenceRateTrendChart';
import { AgingAnalysisChart } from './components/AgingAnalysisChart';
import { SubsystemTable } from './components/SubsystemTable';

function renderIcon(iconType?: string, color?: string) {
  const iconProps = { className: `w-4 h-4 ${color}` };
  switch (iconType) {
    case 'total':        return <Clock {...iconProps} />;
    case 'nonCompliant': return <AlertTriangle {...iconProps} />;
    case 'highest':      return <TrendingUp {...iconProps} />;
    case 'average':      return <FileText {...iconProps} />;
    case 'users':        return <Users {...iconProps} />;
    default:             return null;
  }
}

export default function HRModule() {
  const {
    rows,
    summaryCards,
    docTypeChart,
    userChart,
    perDayChart,
    adherenceRateTrend,
    agingBuckets,
    loading,
    docTypes,
    userNames,
    filters,
    setFilters,
    refresh,
  } = useSubsystemList();

  if (loading) return (
    <div className="p-8 space-y-6">
      <div>
        <Skeleton className="h-8 w-1/3 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );

  return (
    <div className="p-8 bg-background text-foreground min-h-screen space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Human Resource(HR)</h1>
        <p className="text-sm text-muted-foreground mt-1">Track document adherence and compliance status in HR subsystem</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <SubsystemFilterBar
          filters={filters}
          setFilters={setFilters}
          docTypes={docTypes}
          userNames={userNames}
          onClear={() => setFilters(prev => ({
            ...prev,
            dateFrom: undefined,
            dateTo:   undefined,
            docType:  '',
            user:     '',
            search:   '',
          }))}
        />
      </div>

      {/* Summary Cards */}
      <div className="flex gap-3 overflow-x-auto">
        {summaryCards.map((stat) => (
          <Card key={stat.label} className="shadow-none border-gray-200 flex-1 min-w-[180px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">{stat.label}</CardTitle>
              <div className="p-1.5 rounded-full">{renderIcon(stat.icon, stat.color)}</div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-lg font-bold">{stat.value}</div>
              {stat.subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate" title={stat.subtitle}>{stat.subtitle}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 — Per Doc Type + Per User */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SubsystemDocTypeChart data={docTypeChart} />
        <AgingAnalysisChart data={agingBuckets} />
        
      </div>

      {/* Charts Row 2 — Per Day (Line) + Adherence Rate Trend (Line) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SubsystemUserChart data={userChart} userNames={userNames} />
        <AdherenceRateTrendChart data={adherenceRateTrend} />
      </div>

      {/* Charts Row 3 — Compliant vs Non-Compliant (Pie) + Aging Analysis (Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
        <SubsystemPerDayChart data={perDayChart} />
      </div>

      {/* Table */}
      <SubsystemTable
        rows={rows}
        loading={loading}
        search={filters.search ?? ''}
        isUserFilterActive={!!filters.user}
        onSuccess={refresh}
      />

    </div>
  );
}