import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN =
    process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_SERVICE_TOKEN || "";

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const search = url.search;

        const upstream = `${DIRECTUS_URL}/files${search}`;
        const response = await fetch(upstream, {
            headers: {
                Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            },
            cache: "no-store",
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: unknown) {
        const err = error as Error;
        return NextResponse.json(
            { error: err.message || "Failed to fetch files" },
            { status: 500 }
        );
    }
}

