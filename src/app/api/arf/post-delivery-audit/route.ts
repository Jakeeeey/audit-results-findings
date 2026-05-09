import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const fetchHeaders = {
  Authorization: `Bearer ${DIRECTUS_TOKEN}`,
  "Content-Type": "application/json",
};

interface DirectusPlan {
  id: number;
  driver_id: number;
  status: string;
  doc_no: string;
  time_of_dispatch?: string | null;
  time_of_arrival?: string | null;
  remarks?: string;
  date_encoded?: string;
}

interface DirectusUser {
  user_id: number;
  id?: number;
  user_fname?: string;
  user_lname?: string;
  user_email?: string;
  user_contact?: string;
  user_image?: string;
  first_name?: string;
  last_name?: string;
  department_id?: {
    department_id: number;
    department_name: string;
  } | number;
  user_department?: string;
  department?: string;
}

interface DirectusPDI {
  id: number;
  invoice_id: number;
  post_dispatch_plan_id: number;
  isCleared: number | boolean;
  invoiceAt?: number | null;
  status: string;
  remarks?: string;
}

interface DirectusSI {
  invoice_id: number;
  invoice_no: string;
  total_amount: number;
  net_amount: number;
  discount_amount?: number;
  salesman_id?: number;
}

interface DirectusUnfulfilled {
  id: number;
  sales_invoice_id: number;
  nte?: string;
  isCleared: number | boolean;
  variance_amount?: number;
  remarks?: string;
}

interface DirectusUnfulfilledDetail {
  unfulfilled_sales_transaction_id: { id: number } | number;
  sales_invoice_detail_id: { id: number } | number;
  total_amount: number;
}

interface DirectusNTE {
  id: number;
  doc_no: string;
  file: string;
  post_dispatch_invoice_id: number;
}

interface DirectusReturnLink {
  invoice_no: number;
  return_no: number;
}

interface DirectusReturn {
  return_id: number;
  return_number: string;
  total_amount: number;
}

interface DirectusMemo {
  customer_reference: string | number;
  amount: number;
  memo_number: string;
}

interface DirectusStaff {
  role: string;
  is_present: number | boolean;
  user_id: DirectusUser;
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  try {
    if (action === "memo-data") {
      const invoiceNo = req.nextUrl.searchParams.get("invoiceNo");
      
      // 1. Fetch Sales Invoice
      const siUrl = `${DIRECTUS_URL}/items/sales_invoice?filter[invoice_no][_eq]=${invoiceNo}&fields=*`;
      const siRes = await fetch(siUrl, { headers: fetchHeaders, cache: "no-store" });
      const siData = (await siRes.json()).data?.[0];

      // 2. Fetch Sales Returns for this invoice
      const srUrl = `${DIRECTUS_URL}/items/sales_return?filter[invoice_no][_eq]=${invoiceNo}&fields=*`;
      const srRes = await fetch(srUrl, { headers: fetchHeaders, cache: "no-store" });
      const salesReturns = (await srRes.json()).data || [];

      // 3. Fetch Suppliers (for the dropdown)
      const supUrl = `${DIRECTUS_URL}/items/suppliers?filter[isActive][_eq]=1&fields=*&limit=-1`;
      const supRes = await fetch(supUrl, { headers: fetchHeaders, cache: "no-store" });
      const suppliers = (await supRes.json()).data || [];

      // 4. Fetch Chart of Accounts (Try plural then singular fallback)
      let coas = [];
      try {
        const coaUrlPlural = `${DIRECTUS_URL}/items/chart_of_accounts?fields=*&limit=-1&filter[account_type][_in]=7,8,9,10,11`;
        const coaRes = await fetch(coaUrlPlural, { headers: fetchHeaders, cache: "no-store" });
        const coaJson = await coaRes.json();
        coas = coaJson.data || [];
        
        if (coas.length === 0) {
          const coaUrlSingular = `${DIRECTUS_URL}/items/chart_of_account?fields=*&limit=-1&filter[account_type][_in]=7,8,9,10,11`;
          const coaResSing = await fetch(coaUrlSingular, { headers: fetchHeaders, cache: "no-store" });
          const coaJsonSing = await coaResSing.json();
          coas = coaJsonSing.data || [];
        }
      } catch (e) {
        console.error("Error fetching COAs:", e);
      }

      // 5. COMPLEX SUPPLIER PATH: SR -> SI -> SO -> SUPPLIER
      let supplierShortcut = "MEMO";
      let resolvedSupplier = null;
      if (siData?.order_id) {
        try {
          // SI.order_id -> SO.order_no
          const soUrl = `${DIRECTUS_URL}/items/sales_order?filter[order_no][_eq]=${siData.order_id}&fields=supplier_id.*`;
          const soRes = await fetch(soUrl, { headers: fetchHeaders, cache: "no-store" });
          const soData = (await soRes.json()).data?.[0];
          
          if (soData?.supplier_id) {
            resolvedSupplier = soData.supplier_id;
            if (resolvedSupplier.supplier_shortcut) {
              supplierShortcut = resolvedSupplier.supplier_shortcut;
            }
          }
        } catch (e) {
          console.error("Error tracing supplier path:", e);
        }
      }

      // 6. AUTO-INCREMENT: Fetch current debit number
      let nextDebitNo = 1;
      try {
        const cdnUrl = `${DIRECTUS_URL}/items/credit_debit_numbers?limit=1&fields=customer_debit_no`;
        const cdnRes = await fetch(cdnUrl, { headers: fetchHeaders, cache: "no-store" });
        const cdnData = (await cdnRes.json()).data?.[0];
        if (cdnData && cdnData.customer_debit_no !== null) {
          nextDebitNo = Number(cdnData.customer_debit_no) + 1;
        }
      } catch (e) {
        console.error("Error fetching credit_debit_numbers:", e);
      }

      const generatedMemoNo = `${supplierShortcut}-${nextDebitNo}`;

      // 7. Try to find if a memo already exists for this invoice
      const existingMemoUrl = `${DIRECTUS_URL}/items/customers_memo?filter[customer_reference][_eq]=${invoiceNo}&fields=*`;
      const existingMemoRes = await fetch(existingMemoUrl, { headers: fetchHeaders, cache: "no-store" });
      const existingMemo = (await existingMemoRes.json()).data?.[0];

      const customerCode = siData?.customer_code || salesReturns[0]?.customer_code;
      let customer = { customer_code: customerCode, customer_name: "Unknown" };
      
      if (customerCode) {
        try {
          const custUrl = `${DIRECTUS_URL}/items/customer?filter[customer_code][_eq]=${customerCode}&fields=id,customer_name`;
          const custRes = await fetch(custUrl, { headers: fetchHeaders, cache: "no-store" });
          const custJson = await custRes.json();
          if (custJson.data?.[0]) {
            customer = { ...custJson.data[0], customer_code: customerCode };
          }
        } catch (e) {
          console.error("Error fetching customer details:", e);
        }
      }

      return NextResponse.json({
        data: {
          salesReturns,
          suppliers,
          coas,
          customer,
          salesmanId: siData?.salesman_id,
          existingMemo: existingMemo || null,
          invoiceDetails: siData,
          generatedMemoNo,
          resolvedSupplier 
        }
      });
    }

    if (action === "drivers") {
      // 1. Get unique driver IDs from posted plans
      const planUrl = `${DIRECTUS_URL}/items/post_dispatch_plan?fields=driver_id&filter[status][_eq]=Posted&limit=-1`;
      const planRes = await fetch(planUrl, { headers: fetchHeaders, cache: "no-store" });
      const planData = await planRes.json() as { data: DirectusPlan[] };
      const driverIds = [...new Set((planData.data || []).map((p: DirectusPlan) => p.driver_id).filter(Boolean))];

      if (driverIds.length === 0) return NextResponse.json({ data: [] });

      // 2. Fetch users from custom API
      const url = `${DIRECTUS_URL}/items/user?limit=-1&filter[user_id][_in]=${driverIds.join(",")}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json() as DirectusUser[] | { data: DirectusUser[] };
      const rawData = Array.isArray(json) ? json : (json.data || []);
      
      const mappedDrivers = rawData.map((u: DirectusUser) => ({
        id: u.user_id,
        first_name: u.user_fname,
        last_name: u.user_lname,
        email: u.user_email,
        contact: u.user_contact,
        image: u.user_image
      }));

      return NextResponse.json({ data: mappedDrivers });
    }

    if (action === "list") {
      const dateFrom = req.nextUrl.searchParams.get("dateFrom");
      const dateTo = req.nextUrl.searchParams.get("dateTo");
      const driverId = req.nextUrl.searchParams.get("driverId");
      const dispatchNo = req.nextUrl.searchParams.get("dispatchNo");

      // 1. Fetch Post Dispatch Plans (Posted)
      const planFilters: Record<string, unknown> = { status: { _eq: "Posted" } };
      if (dateFrom && dateTo) {
        // Use date_encoded for filtering to ensure we find "Posted" plans which might have null TOD
        planFilters.date_encoded = { _between: [dateFrom, dateTo] };
      }
      if (driverId && driverId !== "ALL") {
        planFilters.driver_id = { _eq: driverId };
      }
      if (dispatchNo) {
        planFilters.doc_no = { _icontains: dispatchNo };
      }

      const planUrl = `${DIRECTUS_URL}/items/post_dispatch_plan?fields=*&filter=${encodeURIComponent(JSON.stringify(planFilters))}&sort=-date_encoded&limit=-1`;
      const planRes = await fetch(planUrl, { headers: fetchHeaders, cache: "no-store" });
      const planJson = await planRes.json() as { data: DirectusPlan[] };
      const plans = planJson.data || [];

      if (plans.length === 0) return NextResponse.json({ data: [] });

      const planIds = plans.map((p: DirectusPlan) => p.id);
      const driverIds = [...new Set(plans.map((p: DirectusPlan) => p.driver_id).filter(Boolean))];

      // 2. Fetch Drivers from custom source
      let drivers: DirectusUser[] = [];
      if (driverIds.length > 0) {
        const drvUrl = `${DIRECTUS_URL}/items/user?limit=-1&filter[user_id][_in]=${driverIds.join(",")}`;
        const drvRes = await fetch(drvUrl, { cache: "no-store" });
        const drvJson = await drvRes.json() as DirectusUser[] | { data: DirectusUser[] };
        const rawDrvs = Array.isArray(drvJson) ? drvJson : (drvJson.data || []);
        drivers = rawDrvs.map((u: DirectusUser) => ({
          user_id: u.user_id,
          id: u.user_id,
          first_name: u.user_fname,
          last_name: u.user_lname
        }));
      }

      // 3. Fetch Post Dispatch Invoices
      const pdiUrl = `${DIRECTUS_URL}/items/post_dispatch_invoices?limit=-1&filter[post_dispatch_plan_id][_in]=${planIds.join(",")}`;
      const pdiRes = await fetch(pdiUrl, { headers: fetchHeaders, cache: "no-store" });
      const pdiJson = await pdiRes.json() as { data: DirectusPDI[] };
      const pdis = pdiJson.data || [];

      // 4. Fetch Sales Invoices
      const invoiceIds = [...new Set(pdis.map((p: DirectusPDI) => p.invoice_id))];
      let salesInvoices: DirectusSI[] = [];
      if (invoiceIds.length > 0) {
        const chunkSize = 200;
        for (let i = 0; i < invoiceIds.length; i += chunkSize) {
          const chunk = invoiceIds.slice(i, i + chunkSize);
          const siUrl = `${DIRECTUS_URL}/items/sales_invoice?limit=-1&fields=invoice_id,invoice_no&filter[invoice_id][_in]=${chunk.join(",")}`;
          const siRes = await fetch(siUrl, { headers: fetchHeaders, cache: "no-store" });
          const siJson = await siRes.json() as { data: DirectusSI[] };
          salesInvoices = [...salesInvoices, ...(siJson.data || [])];
        }
      }

      // 5. Fetch Unfulfilled Transactions (Concerns)
      let unfulfilled: DirectusUnfulfilled[] = [];
      if (invoiceIds.length > 0) {
        const chunkSize = 200;
        for (let i = 0; i < invoiceIds.length; i += chunkSize) {
          const chunk = invoiceIds.slice(i, i + chunkSize);
          const ufUrl = `${DIRECTUS_URL}/items/unfulfilled_sales_transaction?limit=-1&fields=sales_invoice_id&filter[sales_invoice_id][_in]=${chunk.join(",")}`;
          const ufRes = await fetch(ufUrl, { headers: fetchHeaders, cache: "no-store" });
          const ufJson = await ufRes.json() as { data: DirectusUnfulfilled[] };
          unfulfilled = [...unfulfilled, ...(ufJson.data || [])];
        }
      }

      // 6. Fetch Sales Returns
      const invoiceNos = salesInvoices.map((si: DirectusSI) => si.invoice_no).filter(Boolean);
      let returns: DirectusReturn[] = [];
      if (invoiceNos.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < invoiceNos.length; i += chunkSize) {
          const chunk = invoiceNos.slice(i, i + chunkSize);
          const srUrl = `${DIRECTUS_URL}/items/sales_return?limit=-1&fields=invoice_no&filter[invoice_no][_in]=${chunk.join(",")}`;
          const srRes = await fetch(srUrl, { headers: fetchHeaders, cache: "no-store" });
          const srJson = await srRes.json() as { data: DirectusReturn[] };
          returns = [...returns, ...(srJson.data || [])];
        }
      }

      // 7. Aggregate
      const result = plans.map((plan: DirectusPlan) => {
        const planInvoices = pdis.filter((p: DirectusPDI) => p.post_dispatch_plan_id === plan.id);
        
        let auditedCount = 0;
        let receivedCount = 0;
        let fulfilledCount = 0;
        let notFulfilledCount = 0;
        let withReturnsCount = 0;
        let withConcernsCount = 0;

        planInvoices.forEach((pdi: DirectusPDI) => {
          if (pdi.isCleared === 1 || pdi.isCleared === true) {
            auditedCount++;
          }
          if (pdi.invoiceAt) {
            receivedCount++;
          }

          if (pdi.status === "Fulfilled With Returns") {
            withReturnsCount++;
          } else if (pdi.status === "Fulfilled With Concerns") {
            withConcernsCount++;
          } else if (pdi.status === "Fulfilled") {
            fulfilledCount++;
          } else if (pdi.status === "Not Fulfilled") {
            notFulfilledCount++;
          }
        });

        const totalInvoices = planInvoices.length;
        const percentage = totalInvoices > 0 ? ((auditedCount + receivedCount) / (totalInvoices * 2)) * 100 : 0;

        const driver = drivers.find((d: DirectusUser) => d.id === plan.driver_id);
        const driverName = driver 
          ? `${driver.first_name || ""} ${driver.last_name || ""}`.trim() 
          : plan.driver_id ? `ID: ${plan.driver_id}` : "N/A";

        return {
          id: plan.id,
          tod: plan.time_of_dispatch,
          toa: plan.time_of_arrival,
          driver: driverName,
          dispatchNo: plan.doc_no,
          remarks: plan.remarks,
          logisticsStatus: {
            fulfilled: fulfilledCount,
            notFulfilled: notFulfilledCount,
            withReturns: withReturnsCount,
            withConcerns: withConcernsCount,
          },
          totalInvoices,
          percentage: Math.round(percentage * 100) / 100,
        };
      });

      const sortedResult = result.sort((a: { percentage?: number }, b: { percentage?: number }) => (a.percentage || 0) - (b.percentage || 0));

      // 6. Pagination
      const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
      const pageSize = parseInt(req.nextUrl.searchParams.get("pageSize") || "10");
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paginatedData = sortedResult.slice(start, end);

      return NextResponse.json({ 
        data: paginatedData,
        meta: {
          total: sortedResult.length,
          page,
          pageSize,
          hasMore: end < sortedResult.length
        }
      });
    }

    if (action === "debug-schema") {
      const planId = req.nextUrl.searchParams.get("planId");
      const pdiUrl = `${DIRECTUS_URL}/items/post_dispatch_invoices?limit=1&filter[post_dispatch_plan_id][_eq]=${planId}`;
      const pdiRes = await fetch(pdiUrl, { headers: fetchHeaders, cache: "no-store" });
      const pdiJson = await pdiRes.json();
      return NextResponse.json(pdiJson);
    }

    if (action === "get-profile") {
      const userId = req.nextUrl.searchParams.get("userId");
      if (!userId) return NextResponse.json({ error: "User ID is required" }, { status: 400 });

      const url = `${DIRECTUS_URL}/items/user?filter[user_id][_eq]=${userId}&fields=*,department_id.*`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      const userData = Array.isArray(json) ? json[0] : (json.data?.[0]);

      if (!userData) return NextResponse.json({ error: "User not found" }, { status: 404 });

      // Get department name from joined relation or fallback fields
      let department = userData.department_id?.department_name || userData.user_department || userData.department;
      
      // If still an ID (number) or missing, try a manual fetch from the department table
      if (department && !isNaN(Number(department))) {
        try {
          // Try fetching by ID directly
          const deptRes = await fetch(`${DIRECTUS_URL}/items/department/${department}?fields=department_name`, { headers: fetchHeaders, cache: "no-store" });
          const deptJson = await deptRes.json();
          if (deptJson.data?.department_name) {
            department = deptJson.data.department_name;
          } else {
            // Fallback to filter if direct ID fails
            const filterRes = await fetch(`${DIRECTUS_URL}/items/department?filter[department_id][_eq]=${department}&fields=department_name`, { headers: fetchHeaders, cache: "no-store" });
            const filterJson = await filterRes.json();
            if (filterJson.data?.[0]?.department_name) {
              department = filterJson.data[0].department_name;
            }
          }
        } catch (e) {
          console.error("Error fetching department name:", e);
        }
      }
      
      if (!department || department === "undefined") department = "N/A";
      
      return NextResponse.json({ data: { ...userData, departmentName: department } });
    }

    if (action === "details") {
      const planId = req.nextUrl.searchParams.get("planId");
      if (!planId) return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });

      // Step 1: Fetch Plan
      const planUrl = `${DIRECTUS_URL}/items/post_dispatch_plan?filter[id][_eq]=${planId}&fields=*`;
      const planRes = await fetch(planUrl, { headers: fetchHeaders, cache: "no-store" });
      const planJson = await planRes.json();
      const plan = planJson.data?.[0];

      if (!plan) {
        console.error(`Plan not found for ID: ${planId}`, planJson);
        return NextResponse.json({ error: `Plan not found (ID: ${planId})` }, { status: 404 });
      }

      // Step 1b: Fetch All Staff for the plan to ensure we find the driver/helpers
      const staffUrl = `${DIRECTUS_URL}/items/post_dispatch_plan_staff?filter[post_dispatch_plan_id][_eq]=${planId}&fields=role,is_present,user_id.*,user_id.department_id.*`;
      const staffRes = await fetch(staffUrl, { headers: fetchHeaders, cache: "no-store" });
      const staffJson = await staffRes.json();
      const staffData = staffJson.data || [] as DirectusStaff[];

      // Filter by is_present in JS (handling both 1/0 and true/false)
      const presentStaff = staffData.filter((s: DirectusStaff) => s.is_present == 1 || s.is_present === true);
      
      // Fallback: if no one is marked present, take everyone (to avoid N/A during testing)
      const activeStaff = presentStaff.length > 0 ? presentStaff : staffData;

      const driverStaff = activeStaff.find((s: DirectusStaff) => s.role === "Driver");
      const helperStaff = activeStaff.filter((s: DirectusStaff) => s.role === "Helper");
      const pdiUrl = `${DIRECTUS_URL}/items/post_dispatch_invoices?limit=-1&filter[post_dispatch_plan_id][_eq]=${planId}`;
      const pdiRes = await fetch(pdiUrl, { headers: fetchHeaders, cache: "no-store" });
      const pdiJson = await pdiRes.json();
      const pdis: DirectusPDI[] = pdiJson.data || [];
      if (pdis.length > 0) {
        console.log("PDI Sample Record:", JSON.stringify(pdis[0], null, 2));
      }

      if (pdis.length === 0) return NextResponse.json({ data: [] });

      const invoiceIds = pdis.map((p: DirectusPDI) => p.invoice_id);
      console.log(`[AUDIT DEBUG] Invoice IDs to fetch: ${invoiceIds.join(",")}`);

      // 2. Fetch Sales Invoices
      const siUrl = `${DIRECTUS_URL}/items/sales_invoice?limit=-1&fields=invoice_id,invoice_no,total_amount,net_amount,discount_amount&filter[invoice_id][_in]=${invoiceIds.join(",")}`;
      const siRes = await fetch(siUrl, { headers: fetchHeaders, cache: "no-store" });
      const siJson = await siRes.json();
      const salesInvoices = siJson.data || [];

      // Step 3a: Fetch ALL Unfulfilled Sales Transactions and filter in JS as a robust workaround
      const ufUrl = `${DIRECTUS_URL}/items/unfulfilled_sales_transaction?limit=-1&fields=*`;
      const ufRes = await fetch(ufUrl, { headers: fetchHeaders, cache: "no-store" });
      const allUfData = (await ufRes.json()).data || [];
      
      // Filter in JS
      const ufData = allUfData.filter((u: DirectusUnfulfilled) => {
        const sid = typeof u.sales_invoice_id === 'object' ? (u.sales_invoice_id as unknown as { id: number }).id : u.sales_invoice_id;
        return invoiceIds.map(id => Number(id)).includes(Number(sid));
      });

      // Step 3b: Fetch Unfulfilled Sales Transaction Details
      const ufIds = ufData.map((u: DirectusUnfulfilled) => u.id);
      let ufDetailsData: DirectusUnfulfilledDetail[] = [];
      if (ufIds.length > 0) {
        const ufdUrl = `${DIRECTUS_URL}/items/unfulfilled_sales_transaction_details?limit=-1&fields=unfulfilled_sales_transaction_id,sales_invoice_detail_id,total_amount&filter[unfulfilled_sales_transaction_id][_in]=${ufIds.join(",")}`;
        const ufdRes = await fetch(ufdUrl, { headers: fetchHeaders, cache: "no-store" });
        ufDetailsData = (await ufdRes.json()).data || [];
      }

      // Step 3c: Fetch Sales Invoice Details (using IDs from unfulfilled details)
      const siDetailIds = [...new Set(ufDetailsData.map(d => {
        const sid = d.sales_invoice_detail_id as unknown as { id: number } | number;
        return typeof sid === 'object' ? sid.id : sid;
      }).filter(id => id && !isNaN(Number(id))))];
      if (siDetailIds.length > 0) {
        // Use detail_id instead of id for the join as per instruction
        const sidUrl = `${DIRECTUS_URL}/items/sales_invoice_details?limit=-1&fields=detail_id,total_amount&filter[detail_id][_in]=${siDetailIds.join(",")}`;
        await fetch(sidUrl, { headers: fetchHeaders, cache: "no-store" });
      }

      // Step 3d: Fetch NTEs from post_dispatch_nte
      const nteUrl = `${DIRECTUS_URL}/items/post_dispatch_nte?limit=-1&fields=id,doc_no,file,post_dispatch_invoice_id&filter[post_dispatch_invoice_id][_in]=${pdis.map((p: DirectusPDI) => p.id).join(",")}`;
      const nteRes = await fetch(nteUrl, { headers: fetchHeaders, cache: "no-store" });
      const nteData = (await nteRes.json()).data || [] as DirectusNTE[];
      
      // Step 3e: Fetch all departments for name mapping (to avoid IDs like "8")
      const allDeptsRes = await fetch(`${DIRECTUS_URL}/items/department?limit=-1&fields=department_id,department_name`, { headers: fetchHeaders, cache: "no-store" });
      const allDepts = (await allDeptsRes.json()).data || [] as { department_id: number; department_name: string }[];
      const deptMap = new Map(allDepts.map((d: { department_id: number; department_name: string }) => [String(d.department_id), d.department_name]));

      // 4. Fetch Sales Returns and Linking Table
      let returns: DirectusReturn[] = [];
      let returnLinks: DirectusReturnLink[] = [];
      
      if (invoiceIds.length > 0) {
        // Fetch the linking table first: sales_invoice_sales_return
        const linkUrl = `${DIRECTUS_URL}/items/sales_invoice_sales_return?limit=-1&filter[invoice_no][_in]=${invoiceIds.join(",")}`;
        const linkRes = await fetch(linkUrl, { headers: fetchHeaders, cache: "no-store" });
        returnLinks = (await linkRes.json()).data || [];

        const returnIds = [...new Set(returnLinks.map((l: DirectusReturnLink) => l.return_no))];
        if (returnIds.length > 0) {
          const srUrl = `${DIRECTUS_URL}/items/sales_return?limit=-1&fields=*&filter[return_id][_in]=${returnIds.join(",")}`;
          const srRes = await fetch(srUrl, { headers: fetchHeaders, cache: "no-store" });
          returns = (await srRes.json()).data || [];
        }
      }

      // 5. Fetch Customer Memos for discrepancy tracking
      const siNos = salesInvoices.map((si: DirectusSI) => si.invoice_no).filter(Boolean);
      let memos: DirectusMemo[] = [];
      if (siNos.length > 0) {
        const memoUrl = `${DIRECTUS_URL}/items/customers_memo?limit=-1&fields=customer_reference,amount,memo_number&filter[customer_reference][_in]=${siNos.join(",")}`;
        const memoRes = await fetch(memoUrl, { headers: fetchHeaders, cache: "no-store" });
        memos = (await memoRes.json()).data || [];
      }

      // 6. Build detailed list based on user's status-based logic
      const details = pdis.map((pdi: DirectusPDI) => {
        const si = salesInvoices.find((s: DirectusSI) => s.invoice_id === pdi.invoice_id);
        const memo = memos.find((m: DirectusMemo) => String(m.customer_reference) === String(si?.invoice_no));
        
        // Find ALL return links for this invoice
        const currentReturnLinks = returnLinks.filter((l: DirectusReturnLink) => Number(l.invoice_no) === Number(pdi.invoice_id));
        const linkedReturns = currentReturnLinks.map((link: DirectusReturnLink) => {
          const r = returns.find((ret: DirectusReturn) => ret.return_id === link.return_no);
          return r ? { no: r.return_number, amount: Number(r.total_amount) || 0 } : null;
        }).filter(Boolean);
        
        const returnTotalAmount = linkedReturns.reduce((acc, curr) => acc + (curr?.amount || 0), 0);
        
        // Find concern record for this invoice
        const concern = ufData.find((uf: DirectusUnfulfilled) => Number(uf.sales_invoice_id) === Number(pdi.invoice_id));
        
        // DISCREPANCY calculation (Sum of total_amount from unfulfilled_sales_transaction_details)
        let discrepancySum = 0;
        if (concern) {
          const relatedDetails = ufDetailsData.filter(d => {
            const rawId = d.unfulfilled_sales_transaction_id;
            const uftId = (rawId && typeof rawId === 'object' && 'id' in rawId) 
              ? (rawId as { id: number }).id 
              : rawId;
            return Number(uftId) === Number(concern.id);
          });
          
          discrepancySum = relatedDetails.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
        }

        // Calculation Logic based on Status:
        const amount = pdi.status === "Fulfilled With Returns" 
          ? (si?.net_amount || 0) 
          : (si?.total_amount || 0);
        
        // NEW: For "With Returns", discrepancy comes from customers_memo table
        const finalDiscrepancy = pdi.status === "Fulfilled With Returns" 
          ? (Number(memo?.amount) || 0) 
          : discrepancySum;

        const returnedAmount = pdi.status === "Not Fulfilled" ? (amount - discrepancySum) : 0;
        const statusLower = (pdi.status || "").toLowerCase();
        const rejectedAmount = statusLower.includes("concern") ? (amount - discrepancySum) : 0;
        
        const returnTotalAmountVal = returnTotalAmount; 
        const payableAmount = pdi.status === "Fulfilled With Returns" ? ((si?.net_amount || 0) - returnTotalAmountVal) : 0;

        // Find ALL NTE records
        const relatedNtes = nteData.filter((n: DirectusNTE) => Number(n.post_dispatch_invoice_id) === Number(pdi.id));

        return {
          id: pdi.id,
          invoiceId: pdi.invoice_id,
          receiptNo: si?.invoice_no || "N/A",
          amount: amount, 
          status: pdi.status,
          warehouseRemarks: pdi.remarks || "", 
          discrepancyAmount: finalDiscrepancy, // Use the resolved finalDiscrepancy
          rejectedAmount: rejectedAmount,
          returnedAmount: returnedAmount,
          payableAmount: payableAmount,
          isAudited: (pdi.isCleared === 1 || pdi.isCleared === true), 
          isReceived: !!pdi.invoiceAt,
          concernId: concern?.id,
          memoNo: memo?.memo_number || "---", // Add memo number for UI reference
          ntes: relatedNtes.map((n: DirectusNTE) => ({
            no: n.doc_no,
            fileId: n.file
          })),
          nteNo: relatedNtes[0] ? relatedNtes[0].doc_no : "---",
          nteFileId: relatedNtes[0] ? relatedNtes[0].file : null,
          linkedReturn: linkedReturns[0] || null, 
          linkedReturns: linkedReturns, 
          concern: concern ? {
            nte: concern.nte,
            remarks: concern.remarks,
            rejectedAmount: rejectedAmount,
          } : null
        };
      });

      return NextResponse.json({ 
        data: details,
        plan: {
          docNo: plan.doc_no,
          toa: plan.time_of_arrival,
          driver: driverStaff?.user_id 
            ? (driverStaff.user_id.user_fname 
                ? `${driverStaff.user_id.user_fname} ${driverStaff.user_id.user_lname || ""}`.trim()
                : `${driverStaff.user_id.first_name || ""} ${driverStaff.user_id.last_name || ""}`.trim() || "N/A"
              )
            : "N/A",
          driverDepartment: (function() {
            const dId = driverStaff?.user_id?.department_id?.department_id || driverStaff?.user_id?.department_id || driverStaff?.user_id?.user_department;
            return deptMap.get(String(dId)) || dId || "Operations Department";
          })(),
          helpers: helperStaff.map((h: DirectusStaff) => {
            if (!h.user_id) return null;
            return h.user_id.user_fname 
              ? `${h.user_id.user_fname} ${h.user_id.user_lname || ""}`.trim()
              : `${h.user_id.first_name || ""} ${h.user_id.last_name || ""}`.trim() || null;
          }).filter(Boolean)
        }
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, planId, remarks } = body;

    if (action === "update-remarks") {
      if (!planId) return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });

      const url = `${DIRECTUS_URL}/items/post_dispatch_plan/${planId}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: fetchHeaders,
        body: JSON.stringify({ remarks }),
        cache: "no-store",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.errors?.[0]?.message || "Failed to update remarks");
      }

      return NextResponse.json({ success: true });
    }

    if (action === "batch-update-invoices") {
      const { updates, userId } = body; 
      if (!updates || !Array.isArray(updates)) {
        return NextResponse.json({ error: "Updates array is required" }, { status: 400 });
      }

      // 1. Prepare updates for post_dispatch_invoices (Always update isCleared)
      const pdiUpdates = updates.map(u => {
        const update: Record<string, unknown> = {
          id: u.id,
          isCleared: u.is_audited ? 1 : 0
        };

        // Only update invoiceAt if we are explicitly clearing it,
        // or if we have a valid userId to set it to.
        // This prevents accidentally clearing ALL received statuses if userId is missing.
        if (u.is_received === false) {
          update.invoiceAt = null;
        } else if (u.is_received === true && userId) {
          update.invoiceAt = Number(userId);
        }

        return update;
      });

      // 2. Prepare updates for unfulfilled_sales_transaction (Only for Not Fulfilled or Concerns)
      const ufUpdates = updates
        .filter(u => u.concernId && (u.status === "Not Fulfilled" || u.status === "Fulfilled With Concerns"))
        .map(u => ({
          id: u.concernId,
          isCleared: u.is_audited ? 1 : 0
        }));

      // 3. Batch Update Invoices
      const pdiUrl = `${DIRECTUS_URL}/items/post_dispatch_invoices`;
      const pdiRes = await fetch(pdiUrl, {
        method: "PATCH",
        headers: fetchHeaders,
        body: JSON.stringify(pdiUpdates),
        cache: "no-store",
      });

      if (!pdiRes.ok) {
        const err = await pdiRes.json();
        console.error("Directus Batch PDI Error:", JSON.stringify(err, null, 2));
        const msg = err.errors?.[0]?.message || JSON.stringify(err);
        throw new Error(msg);
      }

      // 4. Batch Update Concerns (if any)
      if (ufUpdates.length > 0) {
        const ufUrl = `${DIRECTUS_URL}/items/unfulfilled_sales_transaction`;
        const ufRes = await fetch(ufUrl, {
          method: "PATCH",
          headers: fetchHeaders,
          body: JSON.stringify(ufUpdates),
          cache: "no-store",
        });
        if (!ufRes.ok) {
          const err = await ufRes.json();
          console.error("Directus Batch Concern Error:", JSON.stringify(err, null, 2));
          const msg = err.errors?.[0]?.message || JSON.stringify(err);
          throw new Error(msg);
        }
      }

      return NextResponse.json({ success: true });
    }

    if (action === "post-nte") {
      const { pdiId, userId, fileBase64 } = body;
      if (!pdiId) return NextResponse.json({ error: "PDI ID is required" }, { status: 400 });
      if (!fileBase64) return NextResponse.json({ error: "PDF content is required" }, { status: 400 });

      // 1. Get or Create Folder "post_dispatch_nte"
      const folderName = "post_dispatch_nte";
      let folderId = null;
      
      try {
        const folderSearchUrl = `${DIRECTUS_URL}/folders?filter[name][_eq]=${folderName}`;
        const folderSearchRes = await fetch(folderSearchUrl, { headers: fetchHeaders });
        const folderSearchData = await folderSearchRes.json();
        
        if (folderSearchData.data && folderSearchData.data.length > 0) {
          folderId = folderSearchData.data[0].id;
        } else {
          const createFolderRes = await fetch(`${DIRECTUS_URL}/folders`, {
            method: "POST",
            headers: fetchHeaders,
            body: JSON.stringify({ name: folderName }),
          });
          const createFolderData = await createFolderRes.json();
          folderId = createFolderData.data?.id;
        }
      } catch (err) {
        console.error("Folder management error:", err);
        // Continue anyway, maybe root folder is okay
      }

      // Step 2: Generate sequential document number: NTE-YYYY-0001
      const year = new Date().getFullYear();
      let nextNumber = 1;
      
      try {
        const latestNteUrl = `${DIRECTUS_URL}/items/post_dispatch_nte?filter[doc_no][_starts_with]=NTE-${year}-&sort=-doc_no&limit=1&fields=doc_no`;
        const latestNteRes = await fetch(latestNteUrl, { headers: fetchHeaders });
        const latestNteData = await latestNteRes.json();
        
        if (latestNteData.data && latestNteData.data.length > 0) {
          const lastDocNo = latestNteData.data[0].doc_no;
          const lastNumStr = lastDocNo.split("-").pop();
          if (lastNumStr && !isNaN(parseInt(lastNumStr))) {
            nextNumber = parseInt(lastNumStr) + 1;
          }
        }
      } catch (err) {
        console.error("Sequence generation error:", err);
      }

      const docNo = `NTE-${year}-${nextNumber.toString().padStart(4, '0')}`;
      const fileName = `nte_${docNo}.pdf`;

      // 2. Upload File to Directus
      let fileId = fileName; // Fallback to name if upload fails
      try {
        const formData = new FormData();
        const buffer = Buffer.from(fileBase64, 'base64');
        const blob = new Blob([buffer], { type: 'application/pdf' });
        
        formData.append('file', blob, fileName);
        if (folderId) formData.append('folder', folderId);

        const uploadRes = await fetch(`${DIRECTUS_URL}/files`, {
          method: "POST",
          headers: { 
            'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
            // 'Content-Type': 'multipart/form-data' is set automatically by fetch when body is FormData
          },
          body: formData,
        });

        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.json();
          console.error("Upload error details:", uploadErr);
          throw new Error("Directus file upload failed");
        }

        const uploadData = await uploadRes.json();
        fileId = uploadData.data?.id || fileName;
      } catch (err) {
        console.error("File upload error:", err);
        throw new Error("Failed to upload PDF to Directus");
      }

      // 3. Save to post_dispatch_nte table
      const nteUrl = `${DIRECTUS_URL}/items/post_dispatch_nte`;
      const nteRes = await fetch(nteUrl, {
        method: "POST",
        headers: fetchHeaders,
        body: JSON.stringify({
          doc_no: docNo,
          post_dispatch_invoice_id: pdiId,
          file: fileId, // Store the UUID
          created_by: userId || 1
        }),
        cache: "no-store",
      });

      if (!nteRes.ok) {
        const error = await nteRes.json();
        throw new Error(error.errors?.[0]?.message || "Failed to post NTE record");
      }

      return NextResponse.json({ success: true, docNo });
    }

    if (action === "save-memo") {
      const { memoNumber, supplierId, customerId, salesmanId, amount, coaId, reason, invoiceNo, userId } = body;

      // 1. Robust check if memo already exists to decide between POST (create) and PATCH (update)
      // Check by BOTH customer_reference (Invoice No) AND memo_number to be absolutely sure
      const existingUrl = `${DIRECTUS_URL}/items/customers_memo?filter[customer_reference][_eq]=${invoiceNo}&filter[type][_eq]=1&fields=id,memo_number`;
      const existingRes = await fetch(existingUrl, { headers: fetchHeaders, cache: "no-store" });
      const existingData = (await existingRes.json()).data?.[0];

      // It's a new memo ONLY if we didn't find any existing record for this invoice context
      const isNewMemo = !existingData;
      const memoId = existingData?.id;
      
      const memoUrl = isNewMemo 
        ? `${DIRECTUS_URL}/items/customers_memo`
        : `${DIRECTUS_URL}/items/customers_memo/${memoId}`;

      // Mapping exactly to the provided MySQL schema
      const memoPayload = {
        memo_number: memoNumber,
        supplier_id: Number(supplierId) || 0,
        customer_id: Number(customerId) || 0,
        salesman_id: Number(salesmanId) || 0,
        amount: Number(amount) || 0,
        chart_of_account: Number(coaId) || 0,
        reason: reason || "Discrepancy Memo from Audit Console",
        customer_reference: String(invoiceNo),
        status: "APPROVED", // Auto-approve memos from the audit console
        type: 1, // Credit Memo type
        encoder_id: Number(userId) || null
      };

      const memoRes = await fetch(memoUrl, {
        method: isNewMemo ? "POST" : "PATCH",
        headers: fetchHeaders,
        body: JSON.stringify(memoPayload),
        cache: "no-store",
      });

      if (!memoRes.ok) {
        const error = await memoRes.json();
        console.error("Directus Save Memo Error:", JSON.stringify(error, null, 2));
        throw new Error(error.errors?.[0]?.message || "Failed to save memo record");
      }

      // 2. Increment customer_debit_no if this was a NEW memo
      if (isNewMemo) {
        try {
          // Fetch current ID 1 of credit_debit_numbers (assuming it's a single-row config table)
          const cdnFetchUrl = `${DIRECTUS_URL}/items/credit_debit_numbers?limit=1&fields=id,customer_debit_no`;
          const cdnFetchRes = await fetch(cdnFetchUrl, { headers: fetchHeaders, cache: "no-store" });
          const cdnRow = (await cdnFetchRes.json()).data?.[0];
          
          if (cdnRow) {
            const newDebitNo = (Number(cdnRow.customer_debit_no) || 0) + 1;
            await fetch(`${DIRECTUS_URL}/items/credit_debit_numbers/${cdnRow.id}`, {
              method: "PATCH",
              headers: fetchHeaders,
              body: JSON.stringify({ customer_debit_no: newDebitNo }),
              cache: "no-store"
            });
          }
        } catch (e) {
          console.error("Error incrementing debit number:", e);
          // Don't throw here as the memo is already saved
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
