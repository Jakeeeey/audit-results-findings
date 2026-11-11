'use client';
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useChecklistDetail } from '../hooks/useChecklistDetail';
import { groupChecklistItems } from '../utils/checklistUtils';
import { ChecklistAdmin, checklistItemForm } from './ChecklistAdmin';
import { SopFormDialog, type SopForm } from './SopFormDialog';
import { SopEmptyState, SopSectionHeading } from './SopUi';
import { useSopAccess } from './SopAccessProvider';
import type { SopChecklist } from '../types';

export function ChecklistDetailDialog({ checklist, onClose, onChanged }: { checklist: SopChecklist | null; onClose: () => void; onChanged?: () => void }) {
    const { result, error, loading, retry } = useChecklistDetail(checklist?.id ?? null);
    const access = useSopAccess();
    const [form, setForm] = useState<SopForm>();
    const changed = () => { retry(); onChanged?.(); };
    const metadata = result?.checklist ?? checklist;
    return <Dialog open={checklist !== null} onOpenChange={open => { if (!open) onClose(); }}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
            <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left"><DialogTitle className="break-words text-base">{metadata?.name || 'Checklist details'}</DialogTitle>
                <DialogDescription className="text-xs">{metadata?.description || 'Review requirements and their configured weights.'}</DialogDescription>
                {metadata && <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground"><Badge variant={metadata.active ? 'default' : 'secondary'} className="text-[10px]">{metadata.active ? 'Active' : 'Inactive'}</Badge><span>{metadata.frequency}</span><span aria-hidden="true">·</span><span>Maximum grade {metadata.maxGrade}</span>{result && <><span aria-hidden="true">·</span><span>{result.items.filter(item => item.active).length} active items</span></>}</div>}
            </DialogHeader>
            <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
                {loading && <p role="status" className="text-sm text-muted-foreground">Loading checklist…</p>}
                {error && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={retry}>Retry</Button></div>}
                {!loading && !error && result && <>
                    <SopSectionHeading title="Requirements" count={result.items.length} actions={<ChecklistAdmin checklist={result.checklist} detail={result} onChanged={changed} />} />
                    {!result.items.length && <SopEmptyState title="No checklist items yet" description={access.managePlanning ? 'Add the first requirement to this checklist.' : 'This checklist has no configured requirements.'} />}
                    <div className="overflow-hidden rounded-lg border">{groupChecklistItems(result.items).map(group => <section key={group.section} aria-label={`${group.section} checklist items`}>
                        <div className="flex items-center justify-between border-y bg-muted/40 px-3 py-2 first:border-t-0"><h4 className="text-xs font-semibold">{group.section}</h4><span className="text-[11px] text-muted-foreground">{group.items.length} {group.items.length === 1 ? 'item' : 'items'}</span></div>
                        <div className="divide-y">{group.items.map(item => <div key={item.id} className={cn('flex items-start justify-between gap-3 px-3 py-2.5', !item.active && 'bg-muted/20')}>
                            <div className="min-w-0 flex-1"><p className={cn('break-words text-sm leading-5', !item.active && 'text-muted-foreground')}>{item.description}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>Weight {item.weight}</span><span>Order {item.sortOrder}</span>{!item.active && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Inactive</Badge>}</div></div>
                            {access.managePlanning && <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" aria-label={`Edit ${item.description}`} onClick={() => setForm(checklistItemForm(result, item))}><Pencil className="mr-1 size-3" />Edit</Button>}
                        </div>)}</div>
                    </section>)}</div>
                </>}
            </div>
            {access.managePlanning && form && <SopFormDialog form={form} onClose={() => setForm(undefined)} onChanged={changed} />}
        </DialogContent>
    </Dialog>;
}
