import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentAccess, failure } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/queries';
import { weeklyTemplates } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/recurrences';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
    try { const access=await currentAccess(); const branch=z.coerce.number().int().positive().max(2147483647).parse(request.nextUrl.searchParams.get('branchId'));
        return NextResponse.json({data:await weeklyTemplates(access,branch)},{headers:{'Cache-Control':'no-store'}});
    } catch(error) {return failure(error);}
}
