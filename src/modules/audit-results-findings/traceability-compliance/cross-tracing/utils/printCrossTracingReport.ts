import type { BranchMovementData, ProductMovementRow } from "../types";
import { format } from "date-fns";

type UnifiedMovementRow = ProductMovementRow & {
    branchMovements: Record<number, number>;
    runningBalance: number;
    grossAmount: number | null;
};

export type PrintCrossTracingArgs = {
    data: BranchMovementData[];
    unifiedData: UnifiedMovementRow[];
    branchBeginningBalances: Record<number, number>;
    productName: string;
    startDate: string | null;
    endDate: string | null;
    familyDivisor: number;
    valuationDivisor: number;
    costPerUnit: number | null;
};

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function fmtNumber(value: number): string {
    return value.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    });
}

function fmtCurrency(value: number): string {
    return value.toLocaleString("en-PH", {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
    });
}

export function generateCrossTracingHtml(args: PrintCrossTracingArgs): string {
    const { 
        data, 
        unifiedData, 
        branchBeginningBalances, 
        productName, 
        startDate, 
        endDate, 
        familyDivisor, 
        valuationDivisor, 
        costPerUnit 
    } = args;

    const totalBB = Object.values(branchBeginningBalances).reduce((sum, val) => sum + val, 0);
    const startStr = startDate ? format(new Date(startDate), "MMM dd, yyyy") : "Start";
    const endStr = endDate ? format(new Date(endDate), "MMM dd, yyyy") : "Present";

    let rowsHtml = `
        <tr class="bg-muted">
            <td class="pl-4 py-3 tabular-nums">${startDate ? format(new Date(startDate), "MM/dd/yyyy") : "—"}</td>
            <td class="font-bold text-blue-600">Beginning Balance</td>
            <td>—</td>
            ${data.map(branch => {
                const bb = (branchBeginningBalances[branch.branchId] || 0) / familyDivisor;
                return `<td class="text-center font-bold text-slate-400">${fmtNumber(bb)}</td>`;
            }).join("")}
            <td class="text-right font-bold text-primary">${fmtNumber(totalBB / familyDivisor)}</td>
            <td class="text-right font-bold text-emerald-700">${costPerUnit ? fmtCurrency((totalBB / valuationDivisor) * costPerUnit) : "—"}</td>
        </tr>
    `;

    unifiedData.forEach((row) => {
        rowsHtml += `
            <tr>
                <td class="pl-4 py-2 tabular-nums">${format(new Date(row.ts), "MM/dd/yyyy")}</td>
                <td class="font-medium">${escapeHtml(row.docType || "Movement")}</td>
                <td class="font-mono text-[10px]">${escapeHtml(row.docNo || "—")}</td>
                ${data.map(branch => {
                    const movement = row.branchMovements?.[branch.branchId];
                    const val = (movement || 0) / familyDivisor;
                    if (movement === undefined) return `<td class="text-center text-slate-200">—</td>`;
                    return `
                        <td class="text-center">
                            <span class="movement-badge ${val > 0 ? 'text-emerald-600' : val < 0 ? 'text-rose-600' : 'text-slate-400'}">
                                ${val !== 0 ? (val > 0 ? `+${fmtNumber(val)}` : fmtNumber(val)) : "0.00"}
                            </span>
                        </td>
                    `;
                }).join("")}
                <td class="text-right font-bold text-primary">${fmtNumber(row.runningBalance / familyDivisor)}</td>
                <td class="text-right font-bold text-emerald-700">${row.grossAmount != null ? fmtCurrency(row.grossAmount) : "—"}</td>
            </tr>
        `;
    });

    // Ending Balance Row
    if (unifiedData.length > 0) {
        const lastRow = unifiedData[unifiedData.length - 1];
        rowsHtml += `
            <tr class="bg-primary-light">
                <td class="pl-4 py-3 tabular-nums">${endDate ? format(new Date(endDate), "MM/dd/yyyy") : "Today"}</td>
                <td class="font-bold text-primary">Ending Balance</td>
                <td>—</td>
                ${data.map(branch => {
                    const branchMovementTotal = unifiedData.reduce((sum, r) => sum + (r.branchMovements?.[branch.branchId] || 0), 0);
                    const endingBal = ((branchBeginningBalances[branch.branchId] || 0) + branchMovementTotal) / familyDivisor;
                    return `<td class="text-center font-bold">${fmtNumber(endingBal)}</td>`;
                }).join("")}
                <td class="text-right font-bold text-primary" style="font-size: 14px;">${fmtNumber(lastRow.runningBalance / familyDivisor)}</td>
                <td class="text-right font-bold text-emerald-700" style="font-size: 14px;">${lastRow.grossAmount != null ? fmtCurrency(lastRow.grossAmount) : "—"}</td>
            </tr>
        `;
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>Cross Tracing Report - ${escapeHtml(productName)}</title>
    <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: 'Inter', sans-serif; font-size: 10px; color: #1e293b; margin: 0; padding: 20px; }
        .header { margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
        .title-section h1 { font-size: 20px; font-weight: 800; margin: 0; color: #0f172a; text-transform: uppercase; letter-spacing: -0.025em; }
        .title-section p { margin: 4px 0 0; color: #64748b; font-weight: 500; font-size: 11px; }
        .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 24px; background: #f8fafc; padding: 16px; rounded-xl; border: 1px solid #e2e8f0; border-radius: 12px; }
        .meta-item label { display: block; font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
        .meta-item span { display: block; font-size: 13px; font-weight: 700; color: #334155; }
        table { width: 100%; border-collapse: collapse; border-spacing: 0; }
        th { background: #f1f5f9; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 8px; letter-spacing: 0.05em; padding: 10px 8px; border-bottom: 2px solid #e2e8f0; text-align: left; }
        td { padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: 700; }
        .text-primary { color: #2563eb; }
        .text-emerald-600 { color: #059669; }
        .text-rose-600 { color: #dc2626; }
        .text-slate-400 { color: #94a3b8; }
        .bg-muted { background-color: #f8fafc; }
        .bg-primary-light { background-color: #eff6ff; }
        .movement-badge { font-weight: 800; }
        .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; font-weight: 600; }
        @media print {
            .no-print { display: none; }
            tr { break-inside: avoid; }
            thead { display: table-header-group; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title-section">
            <h1>Cross-Branch Tracing Report</h1>
            <p>Unified transaction ledger across multiple warehouses</p>
        </div>
        <div class="text-right">
            <p style="margin:0; font-weight: 800; color: #2563eb;">CONSOLIDATED AUDIT DOCUMENT</p>
            <p style="margin:4px 0 0; color: #64748b;">Generated on ${format(new Date(), "PPpp")}</p>
        </div>
    </div>

    <div class="meta-grid">
        <div class="meta-item">
            <label>Product Family</label>
            <span>${escapeHtml(productName)}</span>
        </div>
        <div class="meta-item">
            <label>Report Period</label>
            <span>${startStr} — ${endStr}</span>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reference</th>
                ${data.map(branch => `<th class="text-center">${escapeHtml(branch.branchName)}</th>`).join("")}
                <th class="text-right">Total Balance</th>
                <th class="text-right">Gross Amount</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>

    <div class="footer">
        <div>Printed by Audit Results & Findings System - Cross Tracing Module</div>
        <div>Continuous Ledger Document</div>
    </div>
</body>
</html>
    `;
}

export function printCrossTracingReport(args: PrintCrossTracingArgs): void {
    const html = generateCrossTracingHtml(args);


    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) {
        alert("Please allow pop-ups to print this report.");
        return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 500);
}
