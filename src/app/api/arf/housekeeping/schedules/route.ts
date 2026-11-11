import { NextRequest, NextResponse } from 'next/server';
import { currentAccess, failure } from '@/modules/audit-results-findings/housekeeping/server/queries';
import { listSchedules, scheduleQuerySchema } from '@/modules/audit-results-findings/housekeeping/server/schedules';
import { retiredEvaluationWrite } from '@/modules/audit-results-findings/housekeeping/archive/retired-write';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
    try {
        const access = await currentAccess();
        const query = scheduleQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
        return NextResponse.json({ data: await listSchedules(access, query) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) { return failure(error); }
}
export const POST = retiredEvaluationWrite;
