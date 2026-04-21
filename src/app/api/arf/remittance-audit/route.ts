import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const fetchHeaders = {
    Authorization: `Bearer ${DIRECTUS_TOKEN}`,
    "Content-Type": "application/json",
};

export async function GET(req: NextRequest) {
    const action = req.nextUrl.searchParams.get("action");

    try {
        // ============================================================================
        // 0. OPTIMIZED: FETCH ONLY SALESMEN WITH AUDIT HISTORY
        // ============================================================================
        if (action === "salesmen") {
            // Step 1: Scan the audit table for unique offender IDs
            const auditUrl = `${DIRECTUS_URL}/items/remittance_audit_finding?limit=-1&fields=auditee_id`;
            const auditRes = await fetch(auditUrl, { headers: fetchHeaders, cache: "no-store" });
            const auditData = await auditRes.json();

            // Extract unique IDs safely
            const uniqueIds = [...new Set((auditData.data || []).map((a: { auditee_id: { id: string | number } | string | number }) =>
                typeof a.auditee_id === 'object' && a.auditee_id !== null ? a.auditee_id.id : a.auditee_id
            ))].filter(Boolean);

            if (uniqueIds.length === 0) return NextResponse.json({ data: [] });

            // Step 2: Fetch only those specific salesmen
            const filter = { id: { _in: uniqueIds } };
            const url = `${DIRECTUS_URL}/items/salesman?limit=-1&fields=id,salesman_name,salesman_code&sort=salesman_name&filter=${encodeURIComponent(JSON.stringify(filter))}`;
            const res = await fetch(url, { headers: fetchHeaders, cache: "no-store" });
            const data = await res.json();

            return NextResponse.json({ data: data.data || [] });
        }

        // ============================================================================
        // 1. FETCH MASTER AUDIT LEDGER
        // ============================================================================
        if (action === "list") {
            const page = req.nextUrl.searchParams.get("page") || "1";
            const limit = req.nextUrl.searchParams.get("limit") || "20";
            const search = req.nextUrl.searchParams.get("search") || "";
            const status = req.nextUrl.searchParams.get("status");
            const salesman_id = req.nextUrl.searchParams.get("salesman_id");

            let url = `${DIRECTUS_URL}/items/remittance_audit_finding?page=${page}&limit=${limit}&fields=*,auditee_id.*,auditor_id.*&meta=total_count&sort=-date_created`;

            const filters: Record<string, unknown>[] = [];

            if (search) {
                filters.push({
                    _or: [
                        { doc_no: { _icontains: search } },
                        { auditee_id: { salesman_name: { _icontains: search } } }
                    ]
                });
            }

            if (status) {
                filters.push({ status: { _eq: status } });
            }

            if (salesman_id && salesman_id !== "ALL") {
                filters.push({ auditee_id: { _eq: salesman_id } });
            }

            if (filters.length > 0) {
                const filter = filters.length === 1 ? filters[0] : { _and: filters };
                url += `&filter=${encodeURIComponent(JSON.stringify(filter))}`;
            }

            const res = await fetch(url, { headers: fetchHeaders, cache: "no-store" });
            const data = await res.json();

            return NextResponse.json({
                data: data.data || [],
                meta: data.meta || { total_count: 0 }
            });
        }

        // ============================================================================
        // 2. FETCH DETAILS & MANUALLY STITCH INVOICES/CUSTOMERS
        // ============================================================================
        if (action === "details") {
            const id = req.nextUrl.searchParams.get("id");
            if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

            const fields = "*,collection_detail_id.*,collection_detail_id.finding.*";
            const url = `${DIRECTUS_URL}/items/remittance_audit_finding_details?filter[remittance_audit_finding_id][_eq]=${id}&fields=${fields}`;

            const res = await fetch(url, { headers: fetchHeaders, cache: "no-store" });
            const json = await res.json();
            const details = json.data || [];

            const invoiceIds = new Set<number>();
            const customerCodes = new Set<string>();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            details.forEach((d: any) => {
                const cd = d.collection_detail_id;
                if (cd) {
                    if (cd.invoice_id && typeof cd.invoice_id !== 'object') invoiceIds.add(cd.invoice_id);
                    if (cd.customer_code && typeof cd.customer_code !== 'object') customerCodes.add(cd.customer_code);
                }
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let invoices: any[] = [];
            if (invoiceIds.size > 0) {
                const invFilter = { invoice_id: { _in: Array.from(invoiceIds) } };
                const invUrl = `${DIRECTUS_URL}/items/sales_invoice?limit=-1&fields=invoice_id,invoice_no,customer_code&filter=${encodeURIComponent(JSON.stringify(invFilter))}`;
                const invRes = await fetch(invUrl, { headers: fetchHeaders });
                const invJson = await invRes.json();
                invoices = invJson.data || [];

                invoices.forEach(inv => {
                    if (inv.customer_code && typeof inv.customer_code !== 'object') {
                        customerCodes.add(inv.customer_code);
                    }
                });
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let customers: any[] = [];
            if (customerCodes.size > 0) {
                const custFilter = { customer_code: { _in: Array.from(customerCodes) } };
                const custUrl = `${DIRECTUS_URL}/items/customer?limit=-1&fields=customer_code,customer_name,store_name&filter=${encodeURIComponent(JSON.stringify(custFilter))}`;
                const custRes = await fetch(custUrl, { headers: fetchHeaders });
                const custJson = await custRes.json();
                customers = custJson.data || [];
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const enrichedDetails = details.map((d: any) => {
                const cd = d.collection_detail_id;
                if (cd) {
                    if (cd.invoice_id && typeof cd.invoice_id !== 'object') {
                        const matchedInv = invoices.find(i => String(i.invoice_id) === String(cd.invoice_id));
                        if (matchedInv) {
                            if (matchedInv.customer_code && typeof matchedInv.customer_code !== 'object') {
                                const matchedCust = customers.find(c => String(c.customer_code) === String(matchedInv.customer_code));
                                if (matchedCust) matchedInv.customer_code = matchedCust;
                            }
                            cd.invoice_id = matchedInv;
                        }
                    }
                    if (cd.customer_code && typeof cd.customer_code !== 'object') {
                        const matchedCust = customers.find(c => String(c.customer_code) === String(cd.customer_code));
                        if (matchedCust) cd.customer_code = matchedCust;
                    }
                }
                return d;
            });

            return NextResponse.json({ data: enrichedDetails });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (e: unknown) {
        const err = e as Error;
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}export async function PATCH(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    try {
        const body = await req.json();
        const res = await fetch(`${DIRECTUS_URL}/items/remittance_audit_finding/${id}`, {
            method: "PATCH",
            headers: fetchHeaders,
            body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error("Failed to update audit finding");

        const data = await res.json();
        return NextResponse.json({ success: true, data: data.data });
    } catch (e: unknown) {
        const err = e as Error;
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}