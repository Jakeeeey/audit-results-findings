/* eslint-disable */
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
    if (action === "list") {
      const dateFrom = req.nextUrl.searchParams.get("dateFrom");
      const dateTo = req.nextUrl.searchParams.get("dateTo");
      const status = req.nextUrl.searchParams.get("status");
      const search = req.nextUrl.searchParams.get("search");
      const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
      const pageSize = parseInt(req.nextUrl.searchParams.get("pageSize") || "15");

      const filters: any = {};
      
      if (dateFrom && dateTo) {
        filters.created_at = { _between: [dateFrom + "T00:00:00", dateTo + "T23:59:59"] };
      }
      
      if (status && status !== "ALL") {
        filters.status = { _eq: status };
      }

      if (search) {
        // Find matching SOs
        const soUrl = `${DIRECTUS_URL}/items/sales_order?filter[order_no][_icontains]=${search}&fields=order_id`;
        const soRes = await fetch(soUrl, { headers: fetchHeaders, cache: "no-store" });
        const soJson = await soRes.json();
        const soIds = (soJson.data || []).map((so: any) => so.order_id);

        let dispatchIdsFromSo: any[] = [];
        if (soIds.length > 0) {
          const dpdUrl = `${DIRECTUS_URL}/items/dispatch_plan_details?filter[sales_order_id][_in]=${soIds.join(',')}&fields=dispatch_id`;
          const dpdRes = await fetch(dpdUrl, { headers: fetchHeaders, cache: "no-store" });
          const dpdJson = await dpdRes.json();
          dispatchIdsFromSo = (dpdJson.data || []).map((d: any) => d.dispatch_id);
        }

        // Find matching PDPs + PDPs from SOs
        const dispatchFilters: any = {};
        if (dispatchIdsFromSo.length > 0) {
          dispatchFilters._or = [
            { dispatch_no: { _icontains: search } },
            { dispatch_id: { _in: dispatchIdsFromSo } }
          ];
        } else {
          dispatchFilters.dispatch_no = { _icontains: search };
        }
        
        const dpUrl = `${DIRECTUS_URL}/items/dispatch_plan?filter=${encodeURIComponent(JSON.stringify(dispatchFilters))}&fields=dispatch_id`;
        const dpRes = await fetch(dpUrl, { headers: fetchHeaders, cache: "no-store" });
        const dpJson = await dpRes.json();
        const dispatchIds = (dpJson.data || []).map((d: any) => d.dispatch_id);

        let cldtoIdsFromDispatch: any[] = [];
        if (dispatchIds.length > 0) {
          const cdUrl = `${DIRECTUS_URL}/items/consolidator_dispatches?filter[dispatch_id][_in]=${dispatchIds.join(',')}&fields=consolidator_id`;
          const cdRes = await fetch(cdUrl, { headers: fetchHeaders, cache: "no-store" });
          const cdJson = await cdRes.json();
          cldtoIdsFromDispatch = (cdJson.data || []).map((cd: any) => cd.consolidator_id);
        }

        filters._or = [
          { consolidator_no: { _icontains: search } },
          ...(cldtoIdsFromDispatch.length > 0 ? [{ id: { _in: cldtoIdsFromDispatch } }] : [])
        ];
      }

      const filterParam = Object.keys(filters).length > 0 ? `&filter=${encodeURIComponent(JSON.stringify(filters))}` : "";
      
      const url = `${DIRECTUS_URL}/items/consolidator?fields=*,created_by.*,checked_by.*&sort=-created_at&limit=${pageSize}&page=${page}${filterParam}`;
      const res = await fetch(url, { headers: fetchHeaders, cache: "no-store" });
      const json = await res.json();
      
      const consolidators = json.data || [];

      let results = [];
      
      if (consolidators.length > 0) {
        const ids = consolidators.map((c: any) => c.id).join(",");
        const detailsUrl = `${DIRECTUS_URL}/items/consolidator_details?limit=-1&filter[consolidator_id][_in]=${ids}&fields=consolidator_id,ordered_quantity,picked_quantity,applied_quantity`;
        const detailsRes = await fetch(detailsUrl, { headers: fetchHeaders, cache: "no-store" });
        const detailsJson = await detailsRes.json();
        const details = detailsJson.data || [];

        // 1. Check for PDP existence
        const cdUrl = `${DIRECTUS_URL}/items/consolidator_dispatches?limit=-1&filter[consolidator_id][_in]=${ids}&fields=consolidator_id,dispatch_no`;
        const cdRes = await fetch(cdUrl, { headers: fetchHeaders, cache: "no-store" });
        const cdJson = await cdRes.json();
        const cDispatches = cdJson.data || [];
        
        const dispatchNos = Array.from(new Set(cDispatches.map((cd: any) => cd.dispatch_no).filter(Boolean)));
        let dpMap: Record<string, number> = {}; // dispatch_no -> dispatch_id
        let pdpDispatchIds = new Set<number>();

        if (dispatchNos.length > 0) {
           const dpUrl = `${DIRECTUS_URL}/items/dispatch_plan?limit=-1&filter[dispatch_no][_in]=${dispatchNos.join(',')}&fields=dispatch_id,dispatch_no`;
           const dpRes = await fetch(dpUrl, { headers: fetchHeaders, cache: "no-store" });
           const dpJson = await dpRes.json();
           (dpJson.data || []).forEach((dp: any) => {
              dpMap[dp.dispatch_no] = dp.dispatch_id;
           });

           const dispatchIds = Object.values(dpMap);
           if (dispatchIds.length > 0) {
              const pddpUrl = `${DIRECTUS_URL}/items/post_dispatch_dispatch_plans?limit=-1&filter[dispatch_plan_id][_in]=${dispatchIds.join(',')}&fields=dispatch_plan_id,post_dispatch_plan_id`;
              const pddpRes = await fetch(pddpUrl, { headers: fetchHeaders, cache: "no-store" });
              const pddpJson = await pddpRes.json();
              (pddpJson.data || []).forEach((pddp: any) => {
                 const id = typeof pddp.dispatch_plan_id === 'object' && pddp.dispatch_plan_id !== null 
                    ? pddp.dispatch_plan_id.dispatch_id || pddp.dispatch_plan_id.id 
                    : pddp.dispatch_plan_id;
                 if (id) pdpDispatchIds.add(Number(id));
              });
           }
        }

        results = consolidators.map((c: any) => {
          const cDetails = details.filter((d: any) => d.consolidator_id === c.id);
          const totalOrderedQuantity = cDetails.reduce((sum: number, d: any) => sum + (Number(d.ordered_quantity) || 0), 0);
          const totalPickedQuantity = cDetails.reduce((sum: number, d: any) => sum + (Number(d.picked_quantity) || 0), 0);
          const totalAppliedQuantity = cDetails.reduce((sum: number, d: any) => sum + (Number(d.applied_quantity) || 0), 0);
          const quantityMismatch = cDetails.some((d: any) => (Number(d.picked_quantity) || 0) !== (Number(d.applied_quantity) || 0));
          
          // Check if this consolidator has any dispatch_no that has a PDP
          const myDispatches = cDispatches.filter((cd: any) => Number(cd.consolidator_id) === Number(c.id));
          const hasPDP = myDispatches.some((cd: any) => {
             const dId = dpMap[cd.dispatch_no];
             return dId && pdpDispatchIds.has(Number(dId));
          });

          const hasVariance = quantityMismatch && hasPDP;
          
          return {
             id: c.id,
             consolidator_no: c.consolidator_no,
             status: c.status,
             branch_id: c.branch_id,
             created_by: c.created_by?.user_id || c.created_by,
             creatorName: c.created_by?.user_fname ? `${c.created_by.user_fname} ${c.created_by.user_lname || ""}`.trim() : undefined,
             checked_by: c.checked_by?.user_id || c.checked_by,
             checkerName: c.checked_by?.user_fname ? `${c.checked_by.user_fname} ${c.checked_by.user_lname || ""}`.trim() : undefined,
             created_at: c.created_at,
             updated_at: c.updated_at,
             totalProducts: cDetails.length,
             totalOrderedQuantity,
             totalPickedQuantity,
             totalAppliedQuantity,
             hasVariance,
             hasPDP
          };
        });
      }

      return NextResponse.json({
        data: results,
        meta: {
          page,
          pageSize,
          hasMore: consolidators.length === pageSize
        }
      });
    }

    if (action === "details") {
      const id = req.nextUrl.searchParams.get("id");
      if (!id) return NextResponse.json({ error: "Consolidator ID is required" }, { status: 400 });

      // Fetch Consolidator
      const cUrl = `${DIRECTUS_URL}/items/consolidator/${id}?fields=*,created_by.*,checked_by.*`;
      const cRes = await fetch(cUrl, { headers: fetchHeaders, cache: "no-store" });
      const cJson = await cRes.json();
      const c = cJson.data;

      if (!c) {
        return NextResponse.json({ error: "Consolidator not found" }, { status: 404 });
      }

      const consolidator = {
        id: c.id,
        consolidator_no: c.consolidator_no,
        status: c.status,
        branch_id: c.branch_id,
        created_by: c.created_by?.user_id || c.created_by,
        creatorName: c.created_by?.user_fname ? `${c.created_by.user_fname} ${c.created_by.user_lname || ""}`.trim() : undefined,
        checked_by: c.checked_by?.user_id || c.checked_by,
        checkerName: c.checked_by?.user_fname ? `${c.checked_by.user_fname} ${c.checked_by.user_lname || ""}`.trim() : undefined,
        created_at: c.created_at,
        updated_at: c.updated_at,
      };

      // Fetch Details
      const detailsUrl = `${DIRECTUS_URL}/items/consolidator_details?filter[consolidator_id][_eq]=${id}&limit=-1&fields=*,product_id.*,picked_by.*`;
      const detailsRes = await fetch(detailsUrl, { headers: fetchHeaders, cache: "no-store" });
      const detailsJson = await detailsRes.json();
      const rawDetails = detailsJson.data || [];

      const details = rawDetails.map((d: any) => ({
        id: d.id,
        consolidator_id: d.consolidator_id,
        product_id: d.product_id?.product_id || d.product_id,
        ordered_quantity: d.ordered_quantity,
        picked_quantity: d.picked_quantity,
        applied_quantity: d.applied_quantity,
        picked_at: d.picked_at,
        picked_by: d.picked_by?.user_id || d.picked_by,
        pickerName: d.picked_by?.user_fname ? `${d.picked_by.user_fname} ${d.picked_by.user_lname || ""}`.trim() : undefined,
        product: d.product_id ? {
          product_name: d.product_id.description || d.product_id.product_name,
          product_code: d.product_id.product_code,
          barcode: d.product_id.barcode,
        } : undefined
      }));

      // Fetch Dispatches
      const dispatchUrl = `${DIRECTUS_URL}/items/consolidator_dispatches?filter[consolidator_id][_eq]=${id}&limit=-1&fields=*`;
      const dispatchRes = await fetch(dispatchUrl, { headers: fetchHeaders, cache: "no-store" });
      const dispatchJson = await dispatchRes.json();
      let dispatches = dispatchJson.data || [];

      // Fetch Sales Orders safely
      if (dispatches.length > 0) {
        const dispatchNos = dispatches.map((d: any) => d.dispatch_no).filter(Boolean);

        if (dispatchNos.length > 0) {
          // 1. Fetch dispatch_plan to get the dispatch_id for these dispatch_nos
          const dpUrl = `${DIRECTUS_URL}/items/dispatch_plan?filter[dispatch_no][_in]=${dispatchNos.join(",")}&limit=-1&fields=*`;
          const dpRes = await fetch(dpUrl, { headers: fetchHeaders, cache: "no-store" });
          const dpJson = await dpRes.json();
          const realDispatchPlans = dpJson.data || [];

          const dispatchPlanIds = realDispatchPlans.map((dp: any) => dp.dispatch_id).filter(Boolean);

          if (dispatchPlanIds.length > 0) {
            // 2. Fetch dispatch_plan_details to get sales_order_id
            const soUrl = `${DIRECTUS_URL}/items/dispatch_plan_details?filter[dispatch_id][_in]=${dispatchPlanIds.join(",")}&limit=-1&fields=*`;
            const soRes = await fetch(soUrl, { headers: fetchHeaders, cache: "no-store" });
            const soJson = await soRes.json();
            const soDetails = soJson.data || [];

            const rawSoIds = soDetails.map((s: any) => {
              const id = s.sales_order_id;
              return typeof id === 'object' && id !== null ? (id.order_id || id.id) : id;
            }).filter(Boolean);
            let realSOs: any[] = [];

            if (rawSoIds.length > 0) {
               // 3. Fetch sales_order to get order_no and order_status
               const trueSoUrl = `${DIRECTUS_URL}/items/sales_order?filter[order_id][_in]=${rawSoIds.join(',')}&limit=-1&fields=*`;
               const trueSoRes = await fetch(trueSoUrl, { headers: fetchHeaders, cache: "no-store" });
               const trueSoJson = await trueSoRes.json();
               realSOs = trueSoJson.data || [];

               // 4. Fetch sales_order_details
               const soDetailsUrl = `${DIRECTUS_URL}/items/sales_order_details?filter[order_id][_in]=${rawSoIds.join(',')}&limit=-1&fields=*`;
               const soDetailsRes = await fetch(soDetailsUrl, { headers: fetchHeaders, cache: "no-store" });
               const soDetailsJson = await soDetailsRes.json();
               const allSoDetails = soDetailsJson.data || [];

               const orderNos = realSOs.map((so: any) => so.order_no).filter(Boolean);
               const soIdentifiers = Array.from(new Set([...rawSoIds, ...orderNos]));
               
               // Fetch sales invoices
               const siUrl = `${DIRECTUS_URL}/items/sales_invoice?filter[order_id][_in]=${soIdentifiers.join(',')}&limit=-1&fields=*`;
               const siRes = await fetch(siUrl, { headers: fetchHeaders, cache: "no-store" });
               const siJson = await siRes.json();
               const salesInvoices = siJson.data || [];

               const invoiceIds = salesInvoices.map((si: any) => si.invoice_id).filter(Boolean);
               let salesInvoicePdfs: any[] = [];
               if (invoiceIds.length > 0) {
                 const sipdfUrl = `${DIRECTUS_URL}/items/sales_invoice_pdf?filter[sales_invoice_id][_in]=${invoiceIds.join(',')}&limit=-1&fields=*`;
                 const sipdfRes = await fetch(sipdfUrl, { headers: fetchHeaders, cache: "no-store" });
                 const sipdfJson = await sipdfRes.json();
                 salesInvoicePdfs = sipdfJson.data || [];
               }

               // 5. Fetch products manually since Directus relation expansion might not be configured
               const productIds = Array.from(new Set(allSoDetails.map((d: any) => d.product_id).filter(Boolean)));
               let productsMap: Record<number, any> = {};
               
               if (productIds.length > 0) {
                 const productsUrl = `${DIRECTUS_URL}/items/products?filter[product_id][_in]=${productIds.join(',')}&limit=-1&fields=product_id,product_name,product_code,description`;
                 const productsRes = await fetch(productsUrl, { headers: fetchHeaders, cache: "no-store" });
                 const productsJson = await productsRes.json();
                 (productsJson.data || []).forEach((p: any) => {
                   productsMap[p.product_id] = p;
                 });
               }

               realSOs.forEach(so => {
                 const soInvoices = salesInvoices.filter((si: any) => String(si.order_id) === String(so.order_id) || String(si.order_id) === String(so.order_no));
                 so.invoices = soInvoices.map((soInvoice: any) => {
                   const soInvoicePdf = salesInvoicePdfs.find((pdf: any) => String(pdf.sales_invoice_id) === String(soInvoice.invoice_id));
                   return {
                     invoice_no: soInvoice.invoice_no,
                     pdf_file: soInvoicePdf ? soInvoicePdf.pdf_file : null,
                     total_amount: soInvoice.total_amount,
                   };
                 });

                 so.details = allSoDetails
                   .filter((d: any) => {
                     const did = typeof d.order_id === 'object' && d.order_id !== null ? d.order_id.order_id : d.order_id;
                     return did === so.order_id;
                   })
                   .map((d: any) => {
                     const pObj = productsMap[d.product_id] || null;
                     return {
                       product_id: d.product_id,
                       product_code: pObj?.product_code || '---',
                       product_name: pObj?.description || pObj?.product_name || `Unknown Product (ID: ${d.product_id})`,
                       ordered_quantity: d.ordered_quantity || 0,
                       allocated_quantity: d.allocated_quantity || 0,
                       served_quantity: d.served_quantity || 0
                     };
                   });
               });
            }

            // Map it back to the dispatches array
            dispatches = dispatches.map((d: any) => {
               // Find the actual dispatch_plan for this consolidator_dispatch
               const actualDP = realDispatchPlans.find((dp: any) => dp.dispatch_no === d.dispatch_no);
               const planId = actualDP?.dispatch_id;
               
               // Find the sales orders linked to this dispatch_id
               const mappedSo = soDetails.filter((so: any) => so.dispatch_id === planId).map((so: any) => {
                   const soId = typeof so.sales_order_id === 'object' && so.sales_order_id !== null ? (so.sales_order_id.order_id || so.sales_order_id.id) : so.sales_order_id;
                   const actualSO = realSOs.find(r => r.order_id === soId);
                   return {
                     sales_order_id: soId,
                     order_no: actualSO?.order_no || `SO-${soId}`,
                     status: actualSO?.order_status || 'Unknown',
                     details: actualSO?.details || [],
                     invoices: actualSO?.invoices || []
                   };
               });

               return {
                   ...d,
                   dispatch_plan_details: mappedSo
               };
            });

            // Fetch post_dispatch_plans for the dispatchPlanIds
            const pddpUrl = `${DIRECTUS_URL}/items/post_dispatch_dispatch_plans?filter[dispatch_plan_id][_in]=${dispatchPlanIds.join(",")}&limit=-1&fields=post_dispatch_plan_id`;
            const pddpRes = await fetch(pddpUrl, { headers: fetchHeaders, cache: "no-store" });
            const pddpJson = await pddpRes.json();
            const pddpRecords = pddpJson.data || [];

            const pdpIds = Array.from(new Set(pddpRecords.map((p: any) => typeof p.post_dispatch_plan_id === 'object' && p.post_dispatch_plan_id !== null ? p.post_dispatch_plan_id.id || p.post_dispatch_plan_id.post_dispatch_plan_id : p.post_dispatch_plan_id).filter(Boolean)));
            
            let postDispatchPlans: any[] = [];
            if (pdpIds.length > 0) {
              const pdpUrl = `${DIRECTUS_URL}/items/post_dispatch_plan?filter[id][_in]=${pdpIds.join(",")}&limit=-1&fields=*`;
              const pdpRes = await fetch(pdpUrl, { headers: fetchHeaders, cache: "no-store" });
              const pdpJson = await pdpRes.json();
              postDispatchPlans = pdpJson.data || [];
            }

            return NextResponse.json({
              data: {
                consolidator,
                details,
                dispatches,
                postDispatchPlans
              }
            });
          }
        }
      }

      return NextResponse.json({
        data: {
          consolidator,
          details,
          dispatches,
          postDispatchPlans: []
        }
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    console.error("API Error in CLDTO Auditing:", e);
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
  }
}

