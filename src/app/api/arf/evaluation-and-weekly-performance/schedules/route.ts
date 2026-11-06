import { NextRequest, NextResponse } from 'next/server';
import { currentAccess, failure } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/queries';
import { listSchedules, scheduleQuerySchema } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/schedules';
import { createSchedule, writeBody } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/writes';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
    try {
        const access = await currentAccess();
        const query = scheduleQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
        return NextResponse.json({ data: await listSchedules(access, query) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
    try {
        const access = await currentAccess();
        return NextResponse.json({ data: await createSchedule(access, await writeBody(request)) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) { return failure(error); }
}
