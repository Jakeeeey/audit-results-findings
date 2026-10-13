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

        let rawData: Record<string, unknown> | Array<Record<string, unknown>> | null = null;
        try {
            rawData = JSON.parse(text);
        } catch {
            return new NextResponse(text, { status: springRes.status, headers: { "Content-Type": contentType } });
        }

        const rows: Array<Record<string, unknown>> = Array.isArray(rawData) 
            ? rawData 
            : ((rawData?.data as Array<Record<string, unknown>>) || []);

        // Enrich with Sales Returns directly from Directus if returnedToVendor is empty or needs populating
        const directusUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        const directusToken = process.env.DIRECTUS_STATIC_TOKEN;

        if (directusUrl && directusToken && Array.isArray(rows) && rows.length > 0) {
            try {
                // Collect all invoice numbers from the dispatch plan
                const invoiceNos = [
                    ...new Set(
                        rows
                            .map((r: Record<string, unknown>) => r.invoiceNo || r.invoice_no || r.Invoice_No)
                            .filter(Boolean)
                            .map(String)
                    )
                ];

                if (invoiceNos.length > 0) {
                    const headers = {
                        Authorization: `Bearer ${directusToken}`,
                        "Content-Type": "application/json"
                    };

                    // 1. Fetch Sales Returns for these invoices (regardless of isApplied)
                    const srFilter = encodeURIComponent(invoiceNos.join(","));
                    const srUrl = `${directusUrl}/items/sales_return?limit=-1&fields=return_id,return_number,customer_code,invoice_no,remarks,isApplied&filter[invoice_no][_in]=${srFilter}`;
                    const srRes = await fetch(srUrl, { headers, cache: "no-store" });
                    const srJson = await srRes.json();
                    interface DirectusSalesReturn {
                        return_id: number;
                        return_number: string;
                        customer_code: string;
                        invoice_no: string;
                        remarks: string | null;
                        isApplied: number;
                    }
                    const salesReturns: DirectusSalesReturn[] = srJson.data || [];

                    if (salesReturns.length > 0) {
                        const returnNumbers = [...new Set(salesReturns.map((sr) => sr.return_number).filter(Boolean))];

                        // 2. Fetch Sales Return Details
                        const srdFilter = encodeURIComponent(returnNumbers.join(","));
                        const srdUrl = `${directusUrl}/items/sales_return_details?limit=-1&fields=detail_id,return_no,product_id,quantity,unit_price,total_amount,gross_amount,reason&filter[return_no][_in]=${srdFilter}`;
                        const srdRes = await fetch(srdUrl, { headers, cache: "no-store" });
                        const srdJson = await srdRes.json();
                        interface DirectusReturnDetail {
                            detail_id: number;
                            return_no: string;
                            product_id: number;
                            quantity: number;
                            unit_price: number;
                            total_amount?: number;
                            gross_amount?: number;
                            reason?: string | null;
                        }
                        const returnDetails: DirectusReturnDetail[] = srdJson.data || [];

                        // 3. Fetch Products, Units, and Customers to get readable names
                        const productIds = [...new Set(returnDetails.map((d) => d.product_id).filter(Boolean))];
                        const customerCodes = [...new Set(salesReturns.map((sr) => sr.customer_code).filter(Boolean))];

                        // Fetch Units dictionary
                        const unitMap = new Map<number | string, string>();
                        try {
                            const unitsUrl = `${directusUrl}/items/units?limit=-1&fields=unit_id,unit_name,unit_shortcut`;
                            const unitsRes = await fetch(unitsUrl, { headers, cache: "no-store" });
                            const unitsJson = await unitsRes.json();
                            interface DirectusUnitItem {
                                unit_id: number;
                                unit_name?: string;
                                unit_shortcut?: string;
                            }
                            (unitsJson.data || []).forEach((u: DirectusUnitItem) => {
                                const label = u.unit_shortcut || u.unit_name || String(u.unit_id);
                                unitMap.set(u.unit_id, label);
                                unitMap.set(String(u.unit_id), label);
                            });
                        } catch (e) {
                            console.error("[PDAR Proxy] Error fetching units:", e);
                        }

                        const productMap = new Map<number, { name: string; unit: string }>();
                        if (productIds.length > 0) {
                            try {
                                const prodUrl = `${directusUrl}/items/products?limit=-1&fields=product_id,product_name,description,unit_of_measurement&filter[product_id][_in]=${encodeURIComponent(productIds.join(","))}`;
                                const prodRes = await fetch(prodUrl, { headers, cache: "no-store" });
                                const prodJson = await prodRes.json();
                                interface DirectusProductItem {
                                    product_id: number;
                                    product_name?: string;
                                    description?: string;
                                    unit_of_measurement?: number | string;
                                }
                                (prodJson.data || []).forEach((p: DirectusProductItem) => {
                                    const uomId = p.unit_of_measurement;
                                    const unitLabel = uomId !== undefined && uomId !== null
                                        ? (unitMap.get(uomId) || unitMap.get(String(uomId)) || "PCS")
                                        : "PCS";
                                    productMap.set(p.product_id, {
                                        name: p.product_name || p.description || `Product #${p.product_id}`,
                                        unit: unitLabel
                                    });
                                });
                            } catch (e) {
                                console.error("[PDAR Proxy] Error fetching products:", e);
                            }
                        }

                        const customerMap = new Map<string, string>();
                        if (customerCodes.length > 0) {
                            try {
                                const custUrl = `${directusUrl}/items/customer?limit=-1&fields=customer_code,customer_name,store_name&filter[customer_code][_in]=${encodeURIComponent(customerCodes.join(","))}`;
                                const custRes = await fetch(custUrl, { headers, cache: "no-store" });
                                const custJson = await custRes.json();
                                interface DirectusCustomerItem {
                                    customer_code: string;
                                    customer_name?: string;
                                    store_name?: string;
                                }
                                (custJson.data || []).forEach((c: DirectusCustomerItem) => {
                                    customerMap.set(c.customer_code, c.store_name || c.customer_name || c.customer_code);
                                });
                            } catch (e) {
                                console.error("[PDAR Proxy] Error fetching customers:", e);
                            }
                        }

                        // Check if Spring already provided RTV rows
                        const existingRtvCount = rows.filter((r) => String(r.category || r.Category || "").toLowerCase() === "rtv").length;

                        if (existingRtvCount === 0) {
                            const firstRow = rows[0] || {};
                            // Map all return details into RTV rows
                            returnDetails.forEach((detail) => {
                                const parentSR = salesReturns.find((sr) => sr.return_number === detail.return_no);
                                const prodInfo = productMap.get(detail.product_id);
                                const custName = parentSR ? (customerMap.get(parentSR.customer_code) || parentSR.customer_code) : "";

                                rows.push({
                                    dpNumber: firstRow.dpNumber || firstRow.DP_Number || docNo,
                                    driverName: firstRow.driverName || firstRow.Driver_Name || "",
                                    delDate: firstRow.delDate || firstRow.DelDate || "",
                                    etod: firstRow.etod || firstRow.ETOD || "",
                                    atod: firstRow.atod || firstRow.ATOD || "",
                                    etoa: firstRow.etoa || firstRow.ETOA || "",
                                    atoa: firstRow.atoa || firstRow.ATOA || "",
                                    category: "rtv",
                                    invoiceNo: parentSR?.invoice_no || "",
                                    salesReturnNo: detail.return_no,
                                    customerName: custName,
                                    product: prodInfo?.name || `Product #${detail.product_id}`,
                                    qty: detail.quantity,
                                    unit: prodInfo?.unit || "PCS",
                                    amount: detail.total_amount ?? detail.gross_amount ?? 0,
                                    status: "Returned",
                                    remarks: detail.reason || parentSR?.remarks || ""
                                });
                            });
                        }
                    }
                }
            } catch (enrichErr) {
                console.error("[PDAR Proxy] Failed to enrich Sales Returns from Directus:", enrichErr);
            }
        }

        const finalResponse = Array.isArray(rawData) ? rows : { ...rawData, data: rows };
        return NextResponse.json(finalResponse, {
            status: springRes.status,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("[Post Delivery Audit Report Proxy] Gateway Error:", error);
        const message = error instanceof Error ? error.message : "Gateway Error";
        return NextResponse.json(
            { ok: false, error: message },
            { status: 502 },
        );
    }
}
