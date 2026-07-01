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
        if (action === "branches") {
            const url = `${DIRECTUS_URL}/items/branches?limit=-1&fields=id,branch_name&sort=branch_name`;
            const res = await fetch(url, { headers: fetchHeaders, cache: "no-store" });
            const data = await res.json();
            return NextResponse.json({ data: data.data || [] });
        }

        if (action === "list") {
            const page = req.nextUrl.searchParams.get("page") || "1";
            const limit = req.nextUrl.searchParams.get("limit") || "20";
            const search = req.nextUrl.searchParams.get("search") || "";
            const branch_id = req.nextUrl.searchParams.get("branch_id");

            let url = `${DIRECTUS_URL}/items/physical_inventory?page=${page}&limit=${limit}&fields=*,branch_id.*,branch_id.branch_head.*,encoder_id.*,supplier_id.*&meta=total_count&sort=-date_encoded`;

            const filters: Record<string, unknown>[] = [
                { isComitted: { _eq: 1 } }
            ];

            if (search) {
                filters.push({
                    _or: [
                        { ph_no: { _icontains: search } }
                    ]
                });
            }

            if (branch_id && branch_id !== "ALL") {
                filters.push({ branch_id: { _eq: branch_id } });
            }

            if (filters.length > 0) {
                const filter = filters.length === 1 ? filters[0] : { _and: filters };
                url += `&filter=${encodeURIComponent(JSON.stringify(filter))}`;
            }

            const res = await fetch(url, { headers: fetchHeaders, cache: "no-store" });
            const data = await res.json();
            const inventories = data.data || [];

            // We need to calculate shortage dynamically.
            // For now, we return them, and the frontend/service can calculate or we can fetch details here.
            // Since KPI needs total shortage, we might need to fetch details for all these inventories.
            // But this might be too heavy. Let's fetch details for the current page only.
            const phIds = inventories.map((inv: Record<string, unknown>) => inv.id);
            if (phIds.length > 0) {
                const detailsUrl = `${DIRECTUS_URL}/items/physical_inventory_details?limit=-1&filter=${encodeURIComponent(JSON.stringify({ ph_id: { _in: phIds } }))}`;
                const detailsRes = await fetch(detailsUrl, { headers: fetchHeaders });
                const detailsData = await detailsRes.json();
                const details = detailsData.data || [];

                inventories.forEach((inv: Record<string, unknown>) => {
                    const invDetails = details.filter((d: Record<string, unknown>) => d.ph_id === inv.id);
                    const totalDifferenceCost = invDetails.reduce((sum: number, d: Record<string, unknown>) => sum + (Number(d.difference_cost) || 0), 0);
                    
                    inv.total_shortage = totalDifferenceCost;
                    if (!inv.status) {
                        inv.status = totalDifferenceCost < 0 ? "PENDING_REVIEW" : "ADJUSTED";
                    }
                });
            }

            return NextResponse.json({
                data: inventories,
                meta: data.meta || { total_count: 0 }
            });
        }

        if (action === "details") {
            const id = req.nextUrl.searchParams.get("id");
            if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

            // Fetch details and include products
            const url = `${DIRECTUS_URL}/items/physical_inventory_details?filter[ph_id][_eq]=${id}&fields=*,product_id.*`;

            const res = await fetch(url, { headers: fetchHeaders, cache: "no-store" });
            const json = await res.json();
            const details = json.data || [];

            return NextResponse.json({ data: details });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (e: unknown) {
        const err = e as Error;
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    try {
        const body = await req.json();
        // Since status is not in the schema, maybe we only update remarks
        const res = await fetch(`${DIRECTUS_URL}/items/physical_inventory/${id}`, {
            method: "PATCH",
            headers: fetchHeaders,
            body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error("Failed to update inventory audit");

        const data = await res.json();
        return NextResponse.json({ success: true, data: data.data });
    } catch (e: unknown) {
        const err = e as Error;
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
