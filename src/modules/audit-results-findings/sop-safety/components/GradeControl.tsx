'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function GradeControl({ label, maximum, value, disabled, canClear, onChange }: { label: string; maximum: number; value: number | null | undefined; disabled: boolean; canClear: boolean; onChange: (value: number | null | undefined) => void }) {
    const buttonScale = Number.isInteger(maximum) && maximum <= 20;
    return <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
        {buttonScale ? Array.from({ length: maximum + 1 }, (_, grade) => <Button key={grade} type="button" size="sm" variant={value === grade ? 'default' : 'outline'} aria-pressed={value === grade} aria-label={String(grade)} disabled={disabled} className={cn('h-9 min-w-9 px-2.5 tabular-nums focus-visible:ring-2', value === grade && 'shadow-sm')} onClick={() => onChange(grade)}>{grade}</Button>) : <Input type="number" min={0} max={maximum} step="any" aria-label={label} disabled={disabled} className="h-9 w-28" value={value ?? ''} onChange={event => { if (event.target.value !== '') onChange(Number(event.target.value)); else if (canClear) onChange(undefined); }} />}
        <Button type="button" size="sm" variant={value === null ? 'default' : 'outline'} aria-pressed={value === null} aria-label="Not Applicable" disabled={disabled} className="h-9 px-3" onClick={() => onChange(null)}>N/A</Button>
        {canClear && value !== undefined && <Button type="button" size="sm" variant="ghost" disabled={disabled} className="h-9 px-2 text-xs text-muted-foreground" onClick={() => onChange(undefined)}>Clear</Button>}
    </div>;
}
