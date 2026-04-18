//src/app/api/scm/traceability-compliance/cross-tracing/route.ts
import { NextRequest, NextResponse } from "next/server";
import { directusFetch, getDirectusBase } from "../directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

export async function GET(req: NextRequest): Promise<NextResponse> {
    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
        return NextResponse.json(
            { ok: false, message: "Unauthorized: Missing access token" },
            { status: 401 },
        );
    }

    if (!SPRING_API_BASE_URL) {
        return NextResponse.json(
            { ok: false, error: "SPRING_API_BASE_URL is not configured." },
            { status: 500 },
        );
    }

    try {
        const incomingUrl = new URL(req.url);
        const branchIds = incomingUrl.searchParams.getAll("branchIds");
        const parentId = incomingUrl.searchParams.get("parentId") ?? "";
        const startDate = incomingUrl.searchParams.get("startDate") ?? "";
        const endDate = incomingUrl.searchParams.get("endDate") ?? "";

        if (branchIds.length === 0 || !parentId) {
            return NextResponse.json(
                { ok: false, error: "Missing required parameters (branchIds, parentId)" },
                { status: 400 },
            );
        }

        const DIRECTUS_URL = getDirectusBase();

        // 1. Resolve Data for High-Performance Batch Request
        const [branchRes, productRes] = await Promise.all([
            directusFetch<{ data: { id: number; branch_name: string }[] }>(`${DIRECTUS_URL}/items/branches?fields=id,branch_name&filter[id][_in]=${branchIds.join(",")}`),
            directusFetch<{ data: { product_name: string }[] }>(`${DIRECTUS_URL}/items/products?fields=product_name&filter[product_id][_eq]=${parentId}`)
        ]);

        const branchMap = new Map<number, string>();
        branchRes.data?.forEach((b) => branchMap.set(Number(b.id), b.branch_name));

        const productName = productRes.data?.[0]?.product_name;
        if (!productName) {
            return NextResponse.json({ ok: false, error: "Product not found." }, { status: 404 });
        }

        // 2. Batch Fetch Movements via the /filter endpoint (Get full history for accurate balances)
        const targetUrl = new URL(`${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/view-product-movements/filter`);

        targetUrl.searchParams.set("productName", productName);
        if (startDate) targetUrl.searchParams.set("startDate", startDate);
        if (endDate) targetUrl.searchParams.set("endDate", endDate);

        // Append multiple branchName parameters for true batch fetching
        branchIds.forEach(id => {
            const name = branchMap.get(Number(id));
            if (name) targetUrl.searchParams.append("branchName", name);
        });

        console.log(`[Cross Tracing API] Batch Spring call (Full History): ${targetUrl.toString()}`);

        const springRes = await fetch(targetUrl.toString(), {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            cache: "no-store",
        });

        if (!springRes.ok) {
            const errBody = await springRes.text();
            console.error(`[Cross Tracing API] Batch Spring call failed: ${springRes.status}`, errBody);
            throw new Error(`Spring movements API responded with ${springRes.status}`);
        }

        const allMovements = await springRes.json();
        const movementsData = Array.isArray(allMovements) ? allMovements : [];

        // 3. Optimized Patching Layer (Consolidation & Physical Inventory Counts)
        if (movementsData.length > 0) {
            try {
                const { fetchConsolidationItems, fetchPHCountsForTracing } = await import("@/modules/audit-results-findings/traceability-compliance/product-tracing/service");

                const consolidationCache = new Map<string, unknown[]>();
                const phCache = new Map<string, unknown[]>();

                const patchedConsolidations = new Set<string>();
                const docExistingOutBase = new Map<string, number>();

                movementsData.forEach((row: { docType?: string; docNo?: string; outBase?: number }) => {
                    const docT = String(row.docType || "").toUpperCase();
                    const docN = String(row.docNo || "").toUpperCase().trim();
                    const isConsolidated = docT === "CONSOLIDATION DISPATCHES" || docN.startsWith("CLDTO");
                    if (isConsolidated) {
                        docExistingOutBase.set(docN, (docExistingOutBase.get(docN) || 0) + (row.outBase || 0));
                    }
                });

                await Promise.all(movementsData.map(async (row: {
                    docType?: string;
                    docNo: string;
                    inBase?: number;
                    outBase?: number;
                    productName?: string;
                    productId?: number | string;
                    product_id?: number | string;
                    system_count?: number;
                    physical_count?: number;
                }) => {
                    const docT = String(row.docType || "").toUpperCase();
                    const docN = String(row.docNo || "").toUpperCase();

                    // 1. Patch Consolidation Dispatches
                    const isConsolidated = docT === "CONSOLIDATION DISPATCHES" || docN.startsWith("CLDTO");
                    if (isConsolidated && (row.inBase === 0 && row.outBase === 0)) {
                        const cleanDocN = docN.trim();
                        let shouldPatch = false;
                        if (!patchedConsolidations.has(cleanDocN)) {
                            patchedConsolidations.add(cleanDocN);
                            shouldPatch = true;
                        }

                        if (shouldPatch) {
                            try {
                                let items = consolidationCache.get(docN) as { quantity?: number; remarks?: string | null; sales_invoice?: string; order_status?: string }[] | undefined;
                                if (!items) {
                                    items = await fetchConsolidationItems(row.docNo, parentId, null, null, token, productName);
                                    if (items) consolidationCache.set(docN, items);
                                }
                                const totalQty = items.reduce((sum, item) => {
                                    const isCancelled = item.remarks?.toUpperCase() === "CANCELLED" || item.sales_invoice === "No Invoice" || item.order_status === "No Invoice";
                                    if (isCancelled) return sum;
                                    return sum + (item.quantity || 0);
                                }, 0);

                                const existingOut = docExistingOutBase.get(cleanDocN) || 0;
                                if (totalQty > existingOut) {
                                    row.outBase = totalQty - existingOut;
                                }
                            } catch (err) {
                                console.error(`[Cross Tracing API] Consolidation Patch failed for ${row.docNo}:`, err);
                            }
                        }
                    }

                    // 2. Patch Physical Inventory Counts
                    const isPH = docT === "PHYSICAL INVENTORY" || docN.startsWith("PH") || docN.includes("PH ");
                    if (isPH) {
                        try {
                            const cleanDocN = docN.trim();
                            let phDetails = phCache.get(cleanDocN) as { product_id?: { product_id: number | string } | number | string; system_count?: number; physical_count?: number }[] | null | undefined;
                            if (!phDetails) {
                                phDetails = await fetchPHCountsForTracing(row.docNo);
                                if (phDetails) phCache.set(cleanDocN, phDetails);
                            }
                            if (phDetails) {
                                const pid = row.productId || row.product_id;
                                const detail = phDetails.find((d) => {
                                    const dPid = typeof d.product_id === 'object' ? d.product_id?.product_id : d.product_id;
                                    return String(dPid) === String(pid);
                                });
                                if (detail) {
                                    row.system_count = detail.system_count;
                                    row.physical_count = detail.physical_count;
                                }
                            }
                        } catch (err) {
                            console.error(`[Cross Tracing API] PH Patch failed for ${row.docNo}:`, err);
                        }
                    }
                }));
            } catch (patchErr) {
                console.error("[Cross Tracing API] Patching Layer Error:", patchErr);
            }
        }

        // 4. Group Results by Branch (Restore expected results structure)
        const results = branchIds.map(id => {
            const bId = Number(id);
            const bName = branchMap.get(bId) || `Branch ${id}`;
            return {
                branchId: bId,
                branchName: bName,
                movements: movementsData.filter((m: { branchId?: number | string; branchName?: string }) => Number(m.branchId) === bId || m.branchName === bName)
            };
        });

        return NextResponse.json(results);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Gateway Error";
        return NextResponse.json(
            { ok: false, error: message },
            { status: 502 },
        );
    }
}
