import { ConsolidatorRecord, ConsolidatorDetailRecord, ConsolidatorDispatchRecord } from "../types";

interface GenerateCLDTOHtmlProps {
  consolidator: ConsolidatorRecord;
  details: ConsolidatorDetailRecord[];
  dispatches: ConsolidatorDispatchRecord[];
}

export function generateCLDTOHtml({
  consolidator,
  details,
  dispatches
}: GenerateCLDTOHtmlProps) {
  const styles = `
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #0f172a;
        margin: 0;
        padding: 0;
      }
      .header-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
        border-bottom: 1.5px solid #0f172a;
        padding-bottom: 6px;
      }
      .header-title h1 {
        font-size: 16px;
        font-weight: 900;
        text-transform: uppercase;
        margin: 0;
        letter-spacing: -0.02em;
      }
      .header-title p {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #64748b;
        margin: 4px 0 0 0;
      }
      .header-meta {
        text-align: right;
      }
      .status-badge {
        display: inline-block;
        padding: 2px 6px;
        border: 1px solid #0f172a;
        border-radius: 999px;
        font-size: 8px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 4px;
      }
      .print-date {
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        color: #64748b;
      }
      h3 {
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: 0 0 4px 0;
        padding-bottom: 4px;
        border-bottom: 1.5px solid #0f172a;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
        border: 1px solid #cbd5e1;
      }
      th {
        background-color: #f1f5f9;
        font-size: 8px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 4px 6px;
        text-align: left;
        border-bottom: 1px solid #94a3b8;
      }
      th.right, td.right {
        text-align: right;
      }
      td {
        font-size: 9px;
        padding: 4px 6px;
        border-bottom: 1px solid #e2e8f0;
      }
      td.mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-weight: 600;
      }
      td.strong {
        font-weight: 900;
        text-transform: uppercase;
      }
      .dispatch-item {
        margin-bottom: 2px;
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 9px;
        font-weight: 700;
      }
      .dispatch-status {
        font-size: 7px;
        opacity: 0.6;
        text-transform: uppercase;
        margin-left: 4px;
      }
      .no-data {
        text-align: center;
        padding: 12px;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        color: #94a3b8;
      }
    </style>
  `;

  const productsHtml = details.length === 0 
    ? `<tr><td colspan="6" class="no-data">No products found</td></tr>`
    : details.map(item => {
        const picked = item.picked_quantity || 0;
        const applied = item.applied_quantity || 0;
        const variance = applied - picked;
        const varianceStr = variance > 0 ? `+${variance}` : variance;

        return `
          <tr>
            <td class="mono">${item.product?.product_code || "---"}</td>
            <td class="strong">${item.product?.product_name || `Product ID: ${item.product_id}`}</td>
            <td class="right mono">${item.ordered_quantity || 0}</td>
            <td class="right mono">${item.picked_quantity || 0}</td>
            <td class="right mono">${item.applied_quantity || 0}</td>
            <td class="right mono">${varianceStr}</td>
          </tr>
        `;
      }).join('');

  const dispatchesHtml = dispatches.length === 0
    ? `<tr><td colspan="2" class="no-data">No dispatches found</td></tr>`
    : dispatches.map(dispatch => {
        const sosHtml = dispatch.dispatch_plan_details && dispatch.dispatch_plan_details.length > 0
          ? dispatch.dispatch_plan_details.map(so => `
              <div class="dispatch-item">
                • ${so.order_no} <span class="dispatch-status">(${so.status})</span>
              </div>
            `).join('')
          : '<span style="font-size: 9px; font-style: italic;">None</span>';

        return `
          <tr>
            <td class="strong" style="vertical-align: top; border-right: 1px solid #e2e8f0; width: 30%;">
              ${dispatch.dispatch_no}
            </td>
            <td style="vertical-align: top;">
              ${sosHtml}
            </td>
          </tr>
        `;
      }).join('');

  const printDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        ${styles}
      </head>
      <body>
        <div class="header-info">
          <div class="header-title">
            <h1>${consolidator.consolidator_no}</h1>
            <p>CLDTO Details Report</p>
          </div>
          <div class="header-meta">
            <div class="status-badge">${consolidator.status}</div>
            <div class="print-date">Printed: ${printDate}</div>
          </div>
        </div>

        <h3>Consolidated Products</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 12%;">Product Code</th>
              <th style="width: 60%;">Product Name</th>
              <th class="right" style="width: 7%;">Ordered</th>
              <th class="right" style="width: 7%;">Picked</th>
              <th class="right" style="width: 7%;">Applied</th>
              <th class="right" style="width: 7%;">Variance</th>
            </tr>
          </thead>
          <tbody>
            ${productsHtml}
          </tbody>
        </table>

        <h3>Dispatches & Sales Orders</h3>
        <table>
          <thead>
            <tr>
              <th>Dispatch No</th>
              <th>Linked Sales Orders</th>
            </tr>
          </thead>
          <tbody>
            ${dispatchesHtml}
          </tbody>
        </table>
      </body>
    </html>
  `;
}
