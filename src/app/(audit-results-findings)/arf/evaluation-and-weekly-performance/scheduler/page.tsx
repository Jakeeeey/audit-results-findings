import EvaluationSchedulerModule from '@/modules/audit-results-findings/evaluation-and-weekly-performance/scheduler/EvaluationSchedulerModule';
import { EvaluationPageShell } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/shared/components/EvaluationPageShell';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default function Page() { return <EvaluationPageShell title="Evaluation Scheduler"><EvaluationSchedulerModule /></EvaluationPageShell>; }
