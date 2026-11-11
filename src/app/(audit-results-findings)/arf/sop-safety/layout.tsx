import type { ReactNode } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { NavUser } from '@/components/shared/app-sidebar/nav-user';
import { cookies } from 'next/headers';
import { COOKIE_NAME, decodeJwtPayload } from '@/lib/auth-utils';
import { SopAccessProvider } from '@/modules/audit-results-findings/sop-safety/components/SopAccessProvider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function SopSafetyLayout({ children }: { children: ReactNode }) {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    const payload = token ? decodeJwtPayload(token) : null;
    const pick = (keys: string[]) => keys.map(key => payload?.[key]).find((value): value is string => typeof value === 'string' && !!value.trim())?.trim() || '';
    const email = pick(['email', 'Email']);
    const name = [pick(['Firstname', 'FirstName', 'firstName', 'firstname', 'first_name']), pick(['LastName', 'Lastname', 'lastName', 'lastname', 'last_name'])].filter(Boolean).join(' ') || email || 'User';

    return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/20">
        <header className="relative z-20 flex h-14 shrink-0 items-center justify-between overflow-hidden border-b bg-background shadow-sm sm:h-16">
            <div className="flex h-full min-w-0 items-center gap-2 overflow-hidden px-3 sm:px-4">
                <SidebarTrigger className="-ml-1 shrink-0" />
                <Separator orientation="vertical" className="mr-2 hidden shrink-0 data-[orientation=vertical]:h-4 sm:block" />
                <Breadcrumb><BreadcrumbList className="min-w-0 overflow-hidden">
                    <BreadcrumbItem className="hidden shrink-0 md:block"><BreadcrumbLink href="/arf">Audit &amp; Findings</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden shrink-0 md:block" />
                    <BreadcrumbItem className="min-w-0 overflow-hidden"><BreadcrumbPage className="max-w-[56vw] truncate sm:max-w-[60vw] md:max-w-none">SOP &amp; Safety Compliance</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList></Breadcrumb>
            </div>
            <div className="flex h-full max-w-[48vw] shrink-0 items-center overflow-hidden px-2 sm:max-w-none sm:px-4"><NavUser user={{ name, email, avatar: '/avatars/shadcn.jpg' }} /></div>
        </header>
        <main className="flex min-w-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto p-3 sm:p-5">
            <div className="mx-auto flex min-w-0 w-full max-w-7xl flex-col pb-4"><SopAccessProvider>{children}</SopAccessProvider></div>
        </main>
    </div>;
}
