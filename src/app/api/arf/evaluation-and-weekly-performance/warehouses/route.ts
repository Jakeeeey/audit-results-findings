import { NextResponse } from 'next/server';
import { currentAccess, failure, warehouses } from '@/modules/audit-results-findings/evaluation-and-weekly-performance/server/queries';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        return NextResponse.json({ data: await warehouses(await currentAccess()) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) { return failure(error); }
}
