import type { ReactNode } from 'react';
import { SopRoleGate } from '@/modules/audit-results-findings/sop-safety/server/SopRoleGate';
export default function ViewerLayout({ children }: { children: ReactNode }) {
    return <SopRoleGate role="VIEWER">{children}</SopRoleGate>;
}
