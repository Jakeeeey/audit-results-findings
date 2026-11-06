import { notFound } from 'next/navigation';
import EvaluationEditorModule from '@/modules/audit-results-findings/evaluation-and-weekly-performance/viewer/EvaluationEditorModule';
import { EvaluationPageShell } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/shared/components/EvaluationPageShell';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const scheduleId = Number(id);
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(scheduleId) || scheduleId < 1 || scheduleId > 2147483647) notFound();
    return <EvaluationPageShell title="Make evaluation"><EvaluationEditorModule scheduleId={scheduleId} /></EvaluationPageShell>;
}
