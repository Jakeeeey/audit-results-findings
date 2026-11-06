'use client';
import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { displayTime, type ScheduleView } from '../contracts';
import { formatLocalDate } from '../scheduling';
import { EvaluationStatusBadge } from './EvaluationStatusBadge';

export function ScheduleBoard({ rows, view, month, onMonth, onOpen }: { rows: ScheduleView[]; view: 'table' | 'calendar'; month: string;
    onMonth: (value: string) => void; onOpen: (id: number) => void }) {
    const [page, setPage] = useState(1);
    const [selectedDay, setSelectedDay] = useState<Date>();
    const selectedKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
    const shown = view === 'calendar' && selectedKey?.startsWith(month) ? rows.filter(r => r.localDate === selectedKey) : rows;
    const pages = Math.max(1, Math.ceil(shown.length / 10));
    const safePage = Math.min(page, pages);
    const tableRows = shown.slice((safePage - 1) * 10, safePage * 10);
    const [year, monthNumber] = month.split('-').map(Number);
    const days = [...new Set(rows.map(r => r.localDate))].map(day => new Date(`${day}T12:00:00`));
    return <div className={view === 'calendar' ? 'grid gap-4 xl:grid-cols-[auto_1fr]' : ''}>
        {view === 'calendar' && <div className="space-y-3 rounded-lg border p-3"><Calendar mode="single" selected={selectedDay} month={new Date(year, monthNumber - 1, 1)}
            onMonthChange={date => { onMonth(format(date, 'yyyy-MM')); setSelectedDay(undefined); setPage(1); }}
            onSelect={date => { setSelectedDay(date); setPage(1); }} modifiers={{ scheduled: days }} modifiersClassNames={{ scheduled: 'font-bold underline decoration-2 underline-offset-4' }} />
            <p className="max-w-64 text-xs text-muted-foreground">Underlined dates have saved inspection occurrences. Select a day to filter the list.</p>
            <Button variant="outline" size="sm" onClick={() => setSelectedDay(undefined)}>Show whole month</Button></div>}
        <div className="min-w-0 space-y-3"><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow>
            <TableHead>Evaluation</TableHead><TableHead>Warehouse / area</TableHead><TableHead>Date / time</TableHead><TableHead>Evaluator</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
        </TableRow></TableHeader><TableBody>{tableRows.map(row => <TableRow key={row.id}><TableCell className="max-w-40 truncate font-medium" title={row.reference}>{row.reference}</TableCell>
            <TableCell><p>{row.warehouse}</p>{row.area && <p className="text-xs text-muted-foreground">{row.area}</p>}</TableCell>
            <TableCell className="whitespace-nowrap"><p>{formatLocalDate(row.localDate)}</p><p className="text-xs text-muted-foreground">{displayTime(row.startsAt)}–{displayTime(row.endsAt)}</p></TableCell>
            <TableCell>{row.inspectorId ? `VOS #${row.inspectorId}` : 'Not started'}</TableCell><TableCell><EvaluationStatusBadge status={row.status} /></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => onOpen(row.id)}>View details</Button></TableCell>
        </TableRow>)}{!tableRows.length && <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No saved inspections match these filters.</TableCell></TableRow>}</TableBody></Table></div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">{shown.length} occurrences · Page {safePage} of {pages}{selectedKey?.startsWith(month) && view === 'calendar' ? ` · ${formatLocalDate(selectedKey)}` : ''}</span>
                <div className="flex gap-2"><Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>Next</Button></div></div>
        </div>
    </div>;
}
