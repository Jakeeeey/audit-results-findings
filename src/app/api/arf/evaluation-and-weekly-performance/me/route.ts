import { NextResponse } from 'next/server';
import { currentAccess, failure } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/queries';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const access = await currentAccess();
        return NextResponse.json({ data: { userId: access.userId, authorizationMode: access.mode, grants: access.grants,
            eligibleWarehouseIds: access.eligibleWarehouseIds.filter(id => access.grants.some(g => g.branchId === id)),
            persistence: 'NOT_VERIFIED' } }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) { return failure(error); }
}
