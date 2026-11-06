import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentAccess, failure } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/queries';
import { inspectionDetail } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/schedules';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const access = await currentAccess();
        const id = z.coerce.number().int().positive().max(2147483647).parse((await context.params).id);
        return NextResponse.json({ data: await inspectionDetail(access, id) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) { return failure(error); }
}
