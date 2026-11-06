'use client';
import { useRouter } from 'next/navigation';
import { InspectionDetailDialog } from '../shared/components/InspectionDetailDialog';

export default function EvaluationEditorModule({ scheduleId }: { scheduleId: number }) {
    const router = useRouter();
    return <InspectionDetailDialog id={scheduleId} embedded onClose={() => router.push('/arf/evaluation-and-weekly-performance/viewer')} />;
}
