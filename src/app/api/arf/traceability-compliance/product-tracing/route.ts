//src/app/api/scm/traceability-compliance/product-tracing/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

export async function GET(req: NextRequest): Promise<NextResponse> {
    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
        console.error("[Product Tracing Proxy] No vos_access_token cookie found!");
        return NextResponse.json(
            { ok: false, message: "Unauthorized: Missing access token" },
            { status: 401 },
        );
    }

    console.log(`[Product Tracing Proxy] Token found (prefix): ${token.substring(0, 10)}...`);

    if (!SPRING_API_BASE_URL) {
        return NextResponse.json(
            { ok: false, error: "SPRING_API_BASE_URL is not configured." },
            { status: 500 },
        );
    }

    try {
        const incomingUrl = new URL(req.url);
        const branchId = incomingUrl.searchParams.get("branchId") ?? "";
        const parentId = incomingUrl.searchParams.get("parentId") ?? "";
        const branchName = incomingUrl.searchParams.get("branchName") ?? "";
        const productName = incomingUrl.searchParams.get("productName") ?? "";
        const startDate = incomingUrl.searchParams.get("startDate") ?? "";
        const endDate = incomingUrl.searchParams.get("endDate") ?? "";

        // Use the /filter endpoint to get full history for the branch/product
        const targetUrl = new URL(
            `${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/view-product-movements/filter`,
        );

        if (branchName) targetUrl.searchParams.set("branchName", branchName);
        if (productName) targetUrl.searchParams.set("productName", productName);

        console.log(`[Product Tracing Proxy] Requesting full history: ${targetUrl.toString()}`);

        const springRes = await fetch(targetUrl.toString(), {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            cache: "no-store",
        });

        console.log(`[Product Tracing Proxy] Spring Response: ${springRes.status}`);

        const contentType = springRes.headers.get("content-type") ?? "application/json";
        const text = await springRes.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            return new NextResponse(text, { status: springRes.status, headers: { "Content-Type": contentType } });
        }

        // Patching Layer: Supplemental data for Consolidated Documents & Physical Inventory Counts
        if (Array.isArray(data) && parentId) {
            try {
                const { fetchConsolidationItems, fetchPHCountsForTracing, fetchAllFamilyPHs } = await import("@/modules/audit-results-findings/traceability-compliance/product-tracing/service");

                // 0. Proactively fetch ALL relevant PH documents for this family/branch from Directus.
                // This bridges the gap where the Spring movement view omits PH records that have 0 variance.
                const allFamilyPhs: Map<string, unknown[]> | null = await fetchAllFamilyPHs(branchId, parentId);
                const phRegistry = new Map<string, { seenIds: Set<string>, template: Record<string, unknown> | null, phDetails: unknown[] }>();

                // Pre-populate registry with proactive data to ensure they appear in the ledger
                if (allFamilyPhs) {
                    allFamilyPhs.forEach((details: unknown[], phNo: string) => {
                        const firstDetail = details[0] as { ph_id?: { date_encoded?: string } };
                        const ts = firstDetail?.ph_id?.date_encoded;
                        // Basic date filtering to match the query range if provided
                        if (startDate && ts && ts < startDate) return;
                        if (endDate && ts && ts > endDate) return;

                        phRegistry.set(phNo, {
                            seenIds: new Set(),
                            template: null,
                            phDetails: details
                        });
                    });
                }

                // Per-request cache to avoid redundant calls for same docNo in the ledger
                const consolidationCache = new Map<string, unknown[]>();
                const phCache = new Map<string, unknown[]>();

                const patchedConsolidations = new Set<string>();
                const docExistingOutBase = new Map<string, number>();

                data.forEach((row: { docType?: string; docNo?: string; outBase?: number }) => {
                    const docT = String(row.docType || "").toUpperCase();
                    const docN = String(row.docNo || "").toUpperCase().trim();
                    const isConsolidated = docT === "CONSOLIDATION DISPATCHES" || docN.startsWith("CLDTO");
                    if (isConsolidated) {
                        docExistingOutBase.set(docN, (docExistingOutBase.get(docN) || 0) + (row.outBase || 0));
                    }
                });

                await Promise.all(data.map(async (row: { 
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
                    const cleanDocN = docN.trim();

                    // 1. Patch Consolidation Dispatches (Outbound movement)
                    const isConsolidated = docT === "CONSOLIDATION DISPATCHES" || docN.startsWith("CLDTO");
                    if (isConsolidated && (row.inBase === 0 && row.outBase === 0)) {
                        let shouldPatch = false;
                        if (!patchedConsolidations.has(cleanDocN)) {
                            patchedConsolidations.add(cleanDocN);
                            shouldPatch = true;
                        }

                        if (shouldPatch) {
                            try {
                                let items = consolidationCache.get(docN) as { quantity?: number; remarks?: string | null; sales_invoice?: string; order_status?: string }[] | undefined;
                                if (!items) {
                                    items = await fetchConsolidationItems(row.docNo, parentId, null, null, token, row.productName);
                                    if (items) consolidationCache.set(docN, items);
                                }

                                if (!items) return;

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
                                console.error(`[Product Tracing Proxy] Consolidation Patch failed for ${row.docNo}:`, err);
                            }
                        }
                    }

                    // 2. Patch Physical Inventory Counts (Variance calculation)
                    const isPH = docT === "PHYSICAL INVENTORY" || docN.startsWith("PH") || docN.includes("PH ");
                    if (isPH) {
                        try {
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

                                // Update registry for seen documents
                                const info = phRegistry.get(cleanDocN);
                                if (info) {
                                    info.seenIds.add(String(pid));
                                    if (!info.template) info.template = { ...row };
                                } else {
                                    phRegistry.set(cleanDocN, { seenIds: new Set([String(pid)]), template: { ...row }, phDetails: phDetails });
                                }
                            }
                        } catch (err) {
                            console.error(`[Product Tracing Proxy] PH Patch failed for ${row.docNo}:`, err);
                        }
                    }
                }));

                // 3. Synthesis Layer: Inject missing family members for seen PH docs AND missing PH docs entirely
                phRegistry.forEach((info, phNo) => {
                    const template = (info.template as Record<string, unknown> | null) || {
                        ts: (info.phDetails[0] as { ph_id?: { date_encoded?: string } })?.ph_id?.date_encoded || new Date().toISOString(),
                        docNo: phNo,
                        docType: "Physical Inventory",
                        branchId: Number(branchId),
                        branchName: branchName || "N/A",
                        productName: productName || "N/A",
                        descr: "Physical Inventory"
                    };

                    (info.phDetails as { 
                        product_id?: { 
                            product_id: number | string; 
                            parent_id?: number | string; 
                            unit_of_measurement?: { unit_name: string };
                            unit_of_measurement_count?: number;
                        };
                        physical_count?: number;
                        system_count?: number;
                    }[]).forEach((detail) => {
                        const dPid = String(typeof detail.product_id === 'object' ? detail.product_id?.product_id : detail.product_id || "");
                        const dParentId = String(typeof detail.product_id === 'object' ? detail.product_id?.parent_id : "");

                        // If it belongs to our family but wasn't in the response yet
                        if (!info.seenIds.has(dPid) && (dPid === String(parentId) || dParentId === String(parentId))) {
                            const synth: Record<string, unknown> = { ...template };
                            synth.productId = Number(dPid);
                            synth.unit = detail.product_id?.unit_of_measurement?.unit_name || synth.unit;
                            synth.unitCount = detail.product_id?.unit_of_measurement_count || 1;
                            synth.physical_count = detail.physical_count;
                            synth.system_count = detail.system_count;
                            synth.variance = (Number(detail.physical_count) || 0) - (Number(detail.system_count) || 0);
                            synth.inBase = 0;
                            synth.outBase = 0;
                            data.push(synth as Record<string, unknown>);
                            info.seenIds.add(dPid);
                        }
                    });
                });

                return NextResponse.json(data, {
                    status: springRes.status,
                    headers: { "Content-Type": "application/json" }
                });
            } catch (patchErr) {
                console.error("[Product Tracing Proxy] Patching Layer Error:", patchErr);
            }
        }

        return new NextResponse(text, {
            status: springRes.status,
            headers: { "Content-Type": contentType },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Gateway Error";
        return NextResponse.json(
            { ok: false, error: message },
            { status: 502 },
        );
    }
}
