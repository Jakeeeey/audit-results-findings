import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

export async function GET(req: NextRequest): Promise<NextResponse> {
    // ── 1. Extract JWT from the browser cookie ────────────────────────────────
    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
        return NextResponse.json(
            { error: "Unauthorized: Missing access token" },
            { status: 401 },
        );
    }

    if (!SPRING_API_BASE_URL) {
        return NextResponse.json(
            { error: "SPRING_API_BASE_URL is not configured." },
            { status: 500 },
        );
    }

    try {
        const { searchParams } = req.nextUrl;

        // ── 2. Build the upstream Spring Boot URL ─────────────────────────────
        const upstreamUrl = new URL(
            `${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/view-price-change-requests/filter`,
        );

        // Forward all query params (startDate, endDate, status, priceTypeName, requestedBy, …)
        searchParams.forEach((value, key) => {
            upstreamUrl.searchParams.set(key, value);
        });

        // ── 3. Forward request with Bearer token ──────────────────────────────
        const springRes = await fetch(upstreamUrl.toString(), {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            cache: "no-store",
        });

        const contentType = springRes.headers.get("content-type") ?? "application/json";
        const text = await springRes.text();

        // Try to parse as JSON; fall back to raw text
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            return new NextResponse(text, {
                status: springRes.status,
                headers: { "Content-Type": contentType },
            });
        }

        return NextResponse.json(data, { status: springRes.status });
    } catch (e: unknown) {
        const err = e as Error;
        return NextResponse.json({ error: err.message }, { status: 502 });
    }
}
