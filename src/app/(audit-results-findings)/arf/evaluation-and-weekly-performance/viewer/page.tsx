import EvaluationViewerModule from '@/modules/audit-results-findings/evaluation-and-weekly-performance/viewer/EvaluationViewerModule';
import { EvaluationPageShell } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/shared/components/EvaluationPageShell';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default function Page() { return <EvaluationPageShell title="Evaluation Viewer"><EvaluationViewerModule /></EvaluationPageShell>; }
