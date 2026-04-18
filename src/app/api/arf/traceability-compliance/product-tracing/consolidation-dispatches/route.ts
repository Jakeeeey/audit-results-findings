// src/app/api/arf/traceability-compliance/product-tracing/consolidation-dispatches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchConsolidationItems } from "@/modules/audit-results-findings/traceability-compliance/product-tracing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/arf/traceability-compliance/product-tracing/consolidation-dispatches?product_id=XXX
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(req.url);
        const productId = searchParams.get("product_id");
        const productName = searchParams.get("product_name");
        const docNo = searchParams.get("doc_no");
        const protocolNo = searchParams.get("protocol_no");
        const orderNo = searchParams.get("order_no");
        const token = req.cookies.get("vos_access_token")?.value;

        if (!productId) {
            return NextResponse.json({ error: "product_id is required" }, { status: 400 });
        }

        if (!docNo) {
            return NextResponse.json([]);
        }

        const items = await fetchConsolidationItems(docNo, productId, protocolNo, orderNo, token, productName);
        return NextResponse.json(items);

    } catch (error) {
        console.error("[Consolidation Dispatches] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
