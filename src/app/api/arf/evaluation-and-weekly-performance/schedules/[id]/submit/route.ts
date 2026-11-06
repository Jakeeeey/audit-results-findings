import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentAccess, failure } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/queries';
import { submitEvaluation, writeBody } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/writes';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const access = await currentAccess();
        const input = await writeBody(request);
        const id = z.coerce.number().int().positive().max(2147483647).parse((await context.params).id);
        return NextResponse.json({ data: await submitEvaluation(access, id, input) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) { return failure(error); }
}
