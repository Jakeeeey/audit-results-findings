import { notFound } from 'next/navigation';
import { SopEntryRedirect } from '@/modules/audit-results-findings/sop-safety/server/SopEntryRedirect';
export default async function SopAuditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
    return <SopEntryRedirect screen="audits" auditId={Number(id)} />;
}
