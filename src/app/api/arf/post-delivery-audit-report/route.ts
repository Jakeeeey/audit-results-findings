import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

export async function GET(req: NextRequest): Promise<NextResponse> {
    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
        console.error("[Post Delivery Audit Report Proxy] No vos_access_token cookie found!");
        return NextResponse.json(
            { ok: false, message: "Unauthorized: Missing access token" },
            { status: 401 },
        );
    }

    try {
        const incomingUrl = new URL(req.url);
        const docNo = incomingUrl.searchParams.get("docNo");
        
        if (!docNo) {
            return NextResponse.json(
                { ok: false, message: "Bad Request: Missing docNo" },
                { status: 400 },
            );
        }


        
        const baseUrl = process.env.SPRING_API_BASE_URL;
        if (!baseUrl) {
            return NextResponse.json(
                { ok: false, error: "SPRING_API_BASE_URL is not configured." },
                { status: 500 }
            );
        }

        const targetUrl = new URL(`${baseUrl.replace(/\/$/, "")}/api/post-dispatch-audit-report`);
        targetUrl.searchParams.set("docNo", docNo);

        console.log(`[Post Delivery Audit Report Proxy] Requesting: ${targetUrl.toString()}`);

        const springRes = await fetch(targetUrl.toString(), {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            cache: "no-store",
        });

        const contentType = springRes.headers.get("content-type") ?? "application/json";
        const text = await springRes.text();
        
        try {
            const debugPath = path.join(process.cwd(), "debug_api_response.json");
            fs.writeFileSync(debugPath, text, "utf-8");
        } catch (e) {
            console.error("Failed to write debug file:", e);
        }

        try {
            const data = JSON.parse(text);
            return NextResponse.json(data, {
                status: springRes.status,
                headers: { "Content-Type": "application/json" }
            });
        } catch {
            return new NextResponse(text, { status: springRes.status, headers: { "Content-Type": contentType } });
        }
    } catch (error) {
        console.error("[Post Delivery Audit Report Proxy] Gateway Error:", error);
        const message = error instanceof Error ? error.message : "Gateway Error";
        return NextResponse.json(
            { ok: false, error: message },
            { status: 502 },
        );
    }
}
