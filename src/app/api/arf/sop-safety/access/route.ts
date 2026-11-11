import { NextRequest, NextResponse } from 'next/server';
import { authorizeSop, SopAccessError } from '@/modules/audit-results-findings/sop-safety/server/access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (req.nextUrl.search) return NextResponse.json({ message: 'Role access does not accept query parameters.' }, { status: 400, headers });
    try {
        const { roles, capabilities, userId } = await authorizeSop(req);
        return NextResponse.json({ roles, capabilities, userId }, { headers });
    } catch (cause) {
        return NextResponse.json({ message: cause instanceof SopAccessError ? cause.message : 'SOP role verification unavailable.' }, { status: cause instanceof SopAccessError ? cause.status : 503, headers });
    }
}
