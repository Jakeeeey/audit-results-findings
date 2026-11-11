'use client';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function ReportingPeriod({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (date: string) => void; onTo: (date: string) => void }) {
    const display = (value: string) => value && !Number.isNaN(Date.parse(value)) ? format(new Date(`${value}T12:00:00`), 'MMM d, yyyy') : 'Choose date';
    return <Popover><PopoverTrigger asChild><Button variant="outline" className="h-9 w-full justify-start text-xs font-normal sm:w-auto" aria-label="Reporting period"><CalendarDays className="mr-2 size-4 shrink-0 text-muted-foreground" /><span className="truncate">{display(from)} – {display(to)}</span></Button></PopoverTrigger>
        <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] space-y-3"><p className="text-sm font-medium">Reporting period</p><div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label htmlFor="sop-period-from" className="text-xs">From</Label><Input id="sop-period-from" className="h-9 min-w-0 text-xs" type="date" aria-label="Reporting from date" value={from} onChange={event => onFrom(event.target.value)} /></div><div className="space-y-1"><Label htmlFor="sop-period-to" className="text-xs">To</Label><Input id="sop-period-to" className="h-9 min-w-0 text-xs" type="date" aria-label="Reporting to date" value={to} onChange={event => onTo(event.target.value)} /></div></div><p className="text-xs text-muted-foreground">Results update for the selected date range.</p></PopoverContent>
    </Popover>;
}
