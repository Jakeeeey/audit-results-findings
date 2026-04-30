'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO, differenceInCalendarDays, addDays } from 'date-fns';
import type {
  SubsystemFilters,
  SubsystemTableRow,
  SummaryCard,
  DocTypeChartDatum,
  UserChartDatum,
  PerDayChartDatum,
  AdherenceRateTrendDatum,
  CompliancePieDatum,
  AgingBucket,
  SubsystemAdherenceRecord,
} from '../types';
import { fetchSubsystemRecords } from '../providers/fetchProviders';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(raw: string): string {
  try {
    return format(parseISO(raw.replace(' ', 'T')), 'MMM d, yyyy');
  } catch {
    return raw;
  }
}

/** Days Elapsed = Current Date – Date Created */
function computeDaysElapsed(dateCreated: string): number {
  try {
    const created = parseISO(dateCreated.replace(' ', 'T'));
    return differenceInCalendarDays(new Date(), created);
  } catch {
    return 0;
  }
}

/** 0-2 days = Compliant, 3+ days = Non-Compliant */
function computeAdherence(daysElapsed: number): string {
  return daysElapsed <= 2 ? 'Compliant' : 'Non-Compliant';
}

function toRow(r: SubsystemAdherenceRecord, idx: number): SubsystemTableRow {
  const daysElapsed = computeDaysElapsed(r.dateCreated);
  return {
    id:              `${r.docNumber}-${r.preparedBy}-${idx}`.replace(/\s+/g, '_'),
    docType:         r.doctype        || 'Unknown',
    docNo:           r.docNumber      || '',
    preparedBy:      r.preparedBy     || '',
    dateCreated:     formatDate(r.dateCreated),
    updatedDate:     formatDate(r.updatedDate),
    rawDate:         r.dateCreated,
    daysElapsed,
    adherenceStatus: computeAdherence(daysElapsed),
    documentStatus:  r.documentStatus || '',
    nteNo:           r.nteNo || null,
    hasRemarks:      r.hasRemarks || false,
  };
}

const DEFAULT_FILTERS: SubsystemFilters = {
  docType:  '',
  dateFrom: undefined,
  dateTo:   undefined,
  user:     '',
  search:   '',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSubsystemList() {
  const [rows, setRows]       = useState<SubsystemTableRow[]>([]);
  const [allRows, setAllRows] = useState<SubsystemTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filters, setFilters] = useState<SubsystemFilters>(DEFAULT_FILTERS);

  // Fetch all records once (no filters) — used only to populate dropdown options
  useEffect(() => {
    fetchSubsystemRecords({ docType: '', user: '', dateFrom: undefined, dateTo: undefined })
      .then(records => setAllRows(records.map((r, idx) => toRow(r, idx))))
      .catch(() => setAllRows([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await fetchSubsystemRecords({
        docType:  filters.docType,
        user:     filters.user,
        dateFrom: filters.dateFrom,
        dateTo:   filters.dateTo,
      });
      const mapped = records.map((r, idx) => toRow(r, idx));
      mapped.sort((a, b) => b.rawDate.localeCompare(a.rawDate));
      setRows(mapped);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load data: ${errMsg}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters.docType, filters.user, filters.dateFrom, filters.dateTo]);

  useEffect(() => { load(); }, [load]);

  // ── Summary cards ─────────────────────────────────────────────────────────

  const summaryCards: SummaryCard[] = useMemo(() => {
    const totalPending = rows.length;
    const nonCompliantRows = rows.filter(r => r.adherenceStatus === 'Non-Compliant');
    const nonCompliantCount = nonCompliantRows.length;

    const highestRow = [...rows].sort((a, b) => b.daysElapsed - a.daysElapsed)[0];
    const highestDisplay = highestRow ? `${highestRow.daysElapsed}d` : 'N/A';
    const highestSubtitle = highestRow
      ? `${highestRow.docNo} · ${highestRow.preparedBy} · ${highestRow.docType}`
      : 'N/A';

    const avgDays = rows.length > 0
      ? Math.round(rows.reduce((sum, r) => sum + r.daysElapsed, 0) / rows.length)
      : 0;

    const userNonCompliantMap = new Map<string, number>();
    for (const r of nonCompliantRows) {
      userNonCompliantMap.set(r.preparedBy, (userNonCompliantMap.get(r.preparedBy) ?? 0) + 1);
    }
    const userNonCompliantCount = userNonCompliantMap.size;

    return [
      {
        label:    'Total Pending',
        value:    totalPending,
        color:    'text-amber-600',
        bg:       'bg-amber-50',
        icon:     'total',
        subtitle: 'Documents awaiting action',
      },
      {
        label:    'Total Non-Compliant',
        value:    nonCompliantCount,
        color:    'text-red-600',
        bg:       'bg-red-50',
        icon:     'nonCompliant',
        subtitle: `${rows.length > 0 ? ((nonCompliantCount / rows.length) * 100).toFixed(1) : 0}% of total documents`,
      },
      {
        label:    'Highest Days Elapsed',
        value:    highestDisplay,
        color:    'text-rose-600',
        bg:       'bg-rose-50',
        icon:     'highest',
        subtitle: highestSubtitle,
      },
      {
        label:    'Average Days Elapsed',
        value:    `${avgDays}d`,
        color:    'text-blue-600',
        bg:       'bg-blue-50',
        icon:     'average',
        subtitle: 'Across all documents',
      },
      {
        label:    'Users w/ Non-Compliant',
        value:    userNonCompliantCount,
        color:    'text-orange-600',
        bg:       'bg-orange-50',
        icon:     'users',
        subtitle: 'Need follow-up',
      },
    ];
  }, [rows]);

  // ── Charts ────────────────────────────────────────────────────────────────

  // Per Doc Type
  const docTypeChart: DocTypeChartDatum[] = useMemo(() => {
    const map = new Map<string, DocTypeChartDatum>();
    for (const r of rows) {
      const entry = map.get(r.docType) ?? {
        name:         r.docType,
        compliant:    0,
        nonCompliant: 0,
      };
      if (r.adherenceStatus === 'Compliant')          entry.compliant++;
      else if (r.adherenceStatus === 'Non-Compliant') entry.nonCompliant++;
      map.set(r.docType, entry);
    }
    return [...map.values()];
  }, [rows]);

  // Per User
  const userChart: UserChartDatum[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.preparedBy, (map.get(r.preparedBy) ?? 0) + 1);
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [rows]);

  // ── Per Day — Option B: Historical compliance trend ───────────────────────
  //
  // For every date in the full range (earliest doc → today), we evaluate
  // EVERY doc's status AS OF that date:
  //   - elapsedOnThisDay < 0  → doc didn't exist yet, skip
  //   - elapsedOnThisDay 0–2  → Compliant on this date
  //   - elapsedOnThisDay 3+   → Non-Compliant on this date
  //
  // This produces a true historical trend:
  //   - A doc created on Apr 1 appears as Compliant on Apr 1, 2, 3
  //     then flips to Non-Compliant from Apr 4 onward
  //   - You can see compliance degrade day-by-day as docs age past the window
  //   - Spikes in submissions show up as green peaks that turn red if unresolved

  const perDayChart: PerDayChartDatum[] = useMemo(() => {
    if (rows.length === 0) return [];

    // Find the date range: earliest creation date → today
    const sortedDates = rows
      .map(r => r.rawDate.slice(0, 10))
      .sort();
    const startDate = parseISO(sortedDates[0]);
    const today     = new Date();

    const results: PerDayChartDatum[] = [];
    let cursor = new Date(startDate);

    while (cursor <= today) {
      const dateKey = format(cursor, 'yyyy-MM-dd');
      let compliant    = 0;
      let nonCompliant = 0;

      for (const r of rows) {
        const created          = parseISO(r.rawDate.replace(' ', 'T'));
        const elapsedOnThisDay = differenceInCalendarDays(cursor, created);

        if (elapsedOnThisDay < 0) continue;       // doc not yet created
        if (elapsedOnThisDay <= 2) compliant++;    // within 0–2 days → Compliant
        else                       nonCompliant++; // 3+ days → Non-Compliant
      }

      // Only include dates where at least one doc existed
      if (compliant > 0 || nonCompliant > 0) {
        results.push({ date: dateKey, compliant, nonCompliant });
      }

      cursor = addDays(cursor, 1);
    }

    return results;
  }, [rows]);

  // Adherence Rate Trend — % compliant per day
  const adherenceRateTrend: AdherenceRateTrendDatum[] = useMemo(() => {
    return perDayChart.map(d => {
      const total = d.compliant + d.nonCompliant;
      return {
        date:          d.date,
        adherenceRate: total > 0 ? Math.round((d.compliant / total) * 100) : 0,
      };
    });
  }, [perDayChart]);

  // Compliant vs Non-Compliant pie
  const compliancePie: CompliancePieDatum[] = useMemo(() => {
    const compliantCount    = rows.filter(r => r.adherenceStatus === 'Compliant').length;
    const nonCompliantCount = rows.filter(r => r.adherenceStatus === 'Non-Compliant').length;
    if (compliantCount + nonCompliantCount === 0) return [];
    return [
      { name: 'Compliant',     value: compliantCount },
      { name: 'Non-Compliant', value: nonCompliantCount },
    ];
  }, [rows]);

  // Aging Analysis
  const agingBuckets: AgingBucket[] = useMemo(() => {
    let d0_2 = 0, d3_5 = 0, d6_10 = 0, d10plus = 0;
    for (const r of rows) {
      if      (r.daysElapsed <= 2)  d0_2++;
      else if (r.daysElapsed <= 5)  d3_5++;
      else if (r.daysElapsed <= 10) d6_10++;
      else                          d10plus++;
    }
    return [
      { label: '0–2 days',  count: d0_2 },
      { label: '3–5 days',  count: d3_5 },
      { label: '6–10 days', count: d6_10 },
      { label: '10+ days',  count: d10plus },
    ];
  }, [rows]);

  const docTypes  = useMemo(() => [...new Set(allRows.map(r => r.docType))],    [allRows]);
  const userNames = useMemo(() => [...new Set(allRows.map(r => r.preparedBy))], [allRows]);

  return {
    rows,
    summaryCards,
    docTypeChart,
    userChart,
    perDayChart,
    adherenceRateTrend,
    compliancePie,
    agingBuckets,
    loading,
    error,
    docTypes,
    userNames,
    filters,
    setFilters,
    refresh: load,
  };
}