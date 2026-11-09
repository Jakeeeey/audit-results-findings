'use client';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SopContractError } from '../services/sopClient';
import { sopStatusStyles } from '../utils/presentation';

export type LookupOption = { value: string; label: string };
export function SopSelect({ value, onChange, options, label, disabled, id }: { value: string; onChange: (value: string) => void; options: LookupOption[]; label: string; disabled?: boolean; id?: string }) {
    return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger id={id} className="h-9 w-full min-w-0 text-sm [&>span]:truncate" aria-label={label}><SelectValue placeholder={label} /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}
export function SopStatus({ value }: { value: string }) {
    return <Badge variant="outline" className={`whitespace-nowrap text-[11px] font-medium ${sopStatusStyles[value] ?? 'border-border bg-muted/40 text-foreground'}`}>{value}</Badge>;
}
export function SopError({ error, retry }: { error: unknown; retry?: () => void }) {
    if (!error) return null;
    return <Alert variant="destructive"><AlertTitle>Unable to complete request</AlertTitle><AlertDescription className="space-y-2">
        <p>{error instanceof Error ? error.message : 'Unknown SOP error.'}</p>
        {error instanceof SopContractError && <details><summary>Inspect actual backend response</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(error.body, null, 2)}</pre></details>}
        {retry && <Button variant="outline" size="sm" onClick={retry}>Reload</Button>}
    </AlertDescription></Alert>;
}
export function SopLoading() { return <div role="status" aria-label="Loading SOP data"><Skeleton className="h-32 w-full" /></div>; }
export function SopPager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
    return <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p>{total} records · Page {page} of {Math.max(1, Math.ceil(total / 25))}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page * 25 >= total} onClick={() => onPage(page + 1)}>Next</Button></div></div>;
}
export function todayManila() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = (key: string) => parts.find(value => value.type === key)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}
