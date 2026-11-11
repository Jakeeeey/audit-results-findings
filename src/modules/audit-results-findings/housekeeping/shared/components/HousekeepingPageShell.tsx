import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { NavUser } from '@/components/shared/app-sidebar/nav-user';
import { COOKIE_NAME, decodeJwtPayload } from '@/lib/auth-utils';

/** Same page/header structure as ARF InventoryAuditPage; claims are display-only. */
export async function HousekeepingPageShell({ title, children }: { title: string; children: ReactNode }) {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    const claims = token ? decodeJwtPayload(token) : null;
    const email = typeof claims?.email === 'string' ? claims.email : '';
    const first = typeof claims?.FirstName === 'string' ? claims.FirstName : '';
    const last = typeof claims?.LastName === 'string' ? claims.LastName : '';
    return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/20">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
            <div className="flex min-w-0 items-center gap-2"><SidebarTrigger /><Separator orientation="vertical" className="mr-2 h-4" />
                <Breadcrumb className="min-w-0 overflow-hidden"><BreadcrumbList className="flex-nowrap"><BreadcrumbItem className="hidden md:block"><BreadcrumbLink href="/arf">Audit &amp; Findings</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" /><BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{title}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
            </div><div className="w-12 shrink-0 overflow-hidden sm:w-56"><NavUser user={{ name: [first, last].filter(Boolean).join(' ') || email || 'User', email }} /></div>
        </header>
        <main className="flex-1 overflow-y-auto p-3 sm:p-6"><div className="mx-auto w-full max-w-7xl">{children}</div></main>
    </div>;
}
