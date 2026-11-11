'use client';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SopSectionHeading({ title, description, actions, count }: { title: string; description?: string; actions?: ReactNode; count?: number }) {
    return <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="text-sm font-semibold tracking-tight">{title}{count !== undefined && <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{count}</span>}</h3>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>
        {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>;
}
export function SopEmptyState({ title, description, icon: Icon = ClipboardCheck }: { title: string; description?: string; icon?: LucideIcon }) {
    return <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-4 py-5">
        <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" /><div><p className="text-sm font-medium">{title}</p>{description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}</div>
    </div>;
}
export function SopFilterToolbar({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('flex min-w-0 flex-wrap items-end gap-2 rounded-xl border bg-background p-3 shadow-xs', className)}>{children}</div>;
}
