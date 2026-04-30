const DIRECTUS_URL = "https://vos.skin-care.com.ph";
const fetchHeaders = {
  "Authorization": "Bearer 0123456789",
  "Content-Type": "application/json",
};

async function debugMemoData(invoiceNo) {
  console.log(`Debugging invoiceNo: ${invoiceNo}`);
  
  const siUrl = `${DIRECTUS_URL}/items/sales_invoice?filter[invoice_no][_eq]=${invoiceNo}&fields=*,customer_id.*,salesman_id.*`;
  const siRes = await fetch(siUrl, { headers: fetchHeaders });
  const siData = (await siRes.json()).data?.[0];
  console.log("Sales Invoice Data:", JSON.stringify(siData, null, 2));

  const srUrl = `${DIRECTUS_URL}/items/sales_return?filter[invoice_no][_eq]=${invoiceNo}&fields=*`;
  const srRes = await fetch(srUrl, { headers: fetchHeaders });
  const srData = (await srRes.json()).data || [];
  console.log("Sales Returns Data:", JSON.stringify(srData, null, 2));
}

debugMemoData("24750");
