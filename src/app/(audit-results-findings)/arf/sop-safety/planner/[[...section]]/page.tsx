import { notFound } from 'next/navigation';
import SopSafetyModule from '@/modules/audit-results-findings/sop-safety';
import { sopWorkspaceScreens } from '@/modules/audit-results-findings/sop-safety/permissions';
export default async function PlannerPage({ params }: { params: Promise<{ section?: string[] }> }) {
    const { section = [] } = await params;
    if (section.length > 1 || section[0] && !sopWorkspaceScreens.PLANNER.includes(section[0])) notFound();
    return <SopSafetyModule workspace="PLANNER" initialTab={section[0] ?? 'checklists'} />;
}
