//src/app/api/arf/inventory-management/physical-inventory/running-inventory/route.ts
import { NextRequest, NextResponse } from "next/server";

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

        const branchName = incomingUrl.searchParams.get("branchName")?.trim() ?? "";
        const cutOffDateStr = incomingUrl.searchParams.get("cutOffDate")?.trim() ?? "";
        
        let cutOffTime = Number.MAX_SAFE_INTEGER;
        if (cutOffDateStr) {
            cutOffTime = new Date(cutOffDateStr).getTime();
            if (isNaN(cutOffTime)) {
                cutOffTime = Number.MAX_SAFE_INTEGER;
            }
        }

        const targetUrl = new URL(
            `${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/view-product-movements/filter`,
        );

        if (branchName) {
            targetUrl.searchParams.set("branchName", branchName);
        }

        const springRes = await fetch(targetUrl.toString(), {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            cache: "no-store",
        });

        if (!springRes.ok) {
            throw new Error(`Spring API responded with status: ${springRes.status}`);
        }

        const text = await springRes.text();
        interface MovementRow {
            ts?: string | number;
            docType?: string;
            docNo?: string;
            physical_count?: number;
            physicalCount?: number;
            system_count?: number;
            systemCount?: number;
            variance?: number;
            unitCount?: number;
            inBase?: number;
            outBase?: number;
            productId?: number | string;
            product_id?: number | string;
            branchId?: number | string;
            branch_id?: number | string;
        }
        let movements: MovementRow[] = [];
        try {
            movements = JSON.parse(text);
        } catch {
            throw new Error("Failed to parse movements JSON");
        }

        if (!Array.isArray(movements)) {
            movements = [];
        }

        const inventoryMap = new Map<string, { productId: number; branchId: number; runningInventory: number }>();

        for (const row of movements) {
            if (!row) continue;

            const rowTime = new Date(row.ts as string | number).getTime();
            if (!isNaN(rowTime) && rowTime > cutOffTime) {
                continue; // Skip movements after the cut-off date
            }

            const docT = String(row.docType || "").toUpperCase();
            const docN = String(row.docNo || "").toUpperCase();
            const isPH = docT === "PHYSICAL INVENTORY" || docN.startsWith("PH");

            let change = 0;
            if (isPH) {
                const phys = row.physical_count !== undefined ? row.physical_count : row.physicalCount;
                const sys = row.system_count !== undefined ? row.system_count : row.systemCount;
                const calcVariance = row.variance ?? ((Number(phys) || 0) - (Number(sys) || 0));
                change = calcVariance * (Number(row.unitCount) || 1);
            } else {
                change = (Number(row.inBase) || 0) - (Number(row.outBase) || 0);
            }

            const pid = row.productId || row.product_id;
            if (!pid) continue;
            
            const pKey = String(pid);
            if (!inventoryMap.has(pKey)) {
                inventoryMap.set(pKey, {
                    productId: Number(pid),
                    branchId: Number(row.branchId || row.branch_id || 0),
                    runningInventory: 0
                });
            }

            const current = inventoryMap.get(pKey)!;
            current.runningInventory += change;
        }

        const results = Array.from(inventoryMap.values()).map(item => ({
            id: `calc-${item.productId}`,
            productId: item.productId,
            supplierId: 0, // Not strictly needed for module logic
            branchId: item.branchId,
            productCode: null,
            productName: "Calculated",
            productBarcode: null,
            productBrand: null,
            productCategory: null,
            unitName: null,
            unitCount: 1, // Base unit counts
            branchName: branchName,
            lastCutoff: cutOffDateStr || null,
            lastCount: null,
            movementAfter: null,
            runningInventory: item.runningInventory,
            supplierShortcut: null
        }));

        return NextResponse.json(results, {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : "Gateway Error";
        return NextResponse.json(
            { ok: false, error: message },
            { status: 502 },
        );
    }
}