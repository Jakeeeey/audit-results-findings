import type { ProductMovementRow } from "../types";
import { format } from "date-fns";

export type PrintProductTracingArgs = {
    movements: (ProductMovementRow & {
        uomBreakdown?: Record<string, number>;
        displayBalance?: number;
        isGroup?: boolean;
        itemCount?: number;
    })[];
    beginningBalance: number;
    branchName: string;
    productName: string;
    startDate: string | null;
    endDate: string | null;
    uniqueUOMs: Array<{ unit: string; count: number }>;
    showQtyBase: boolean;
    familyDivisor?: number;
};

function escapeHtml(value: string): string {
    return (value || "")
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

export function generateProductTracingHtml(args: PrintProductTracingArgs): string {
    const { 
        movements, 
        beginningBalance, 
        branchName, 
        productName, 
        startDate, 
        endDate, 
        uniqueUOMs,
        showQtyBase,
        familyDivisor = 1
    } = args;

    const startStr = startDate ? format(new Date(startDate), "MMM dd, yyyy") : "Start";
    const endStr = endDate ? format(new Date(endDate), "MMM dd, yyyy") : "Present";

    let currentBaseBalance = beginningBalance;

    let rowsHtml = `
        <tr class="bg-muted">
            <td class="pl-4 py-3 tabular-nums">${startDate ? format(new Date(startDate), "MM/dd/yyyy") : "—"}</td>
            <td class="font-bold text-blue-600">Beginning Balance</td>
            <td>—</td>
            <td class="font-medium">Combined Start</td>
            ${uniqueUOMs.map(() => `<td class="text-right opacity-30">—</td>`).join("")}
            <td class="text-right font-bold text-primary">${fmtNumber(beginningBalance / familyDivisor)}</td>
            <td class="text-right opacity-30">—</td>
        </tr>
    `;

    movements.forEach((m) => {
        const isPH = m.docNo.toUpperCase().startsWith("PH") || m.docType?.toUpperCase() === "PHYSICAL INVENTORY";
        
        const phys = m.physical_count !== undefined ? m.physical_count : m.physicalCount;
        const sys = m.system_count !== undefined ? m.system_count : m.systemCount;
        
        const effectiveUnitCount = (m.unitCount && m.unitCount > 0) ? m.unitCount : (isPH ? (m.familyUnitCount || 1) : 1);
        const internalMovement = isPH 
            ? ((Number(phys || 0) - Number(sys || 0)) * effectiveUnitCount) 
            : ((Number(m.inBase) || 0) - (Number(m.outBase) || 0));

        currentBaseBalance += internalMovement;
        const displayBal = m.displayBalance !== undefined ? m.displayBalance : (currentBaseBalance / familyDivisor);

        // UOM Breakdown Logic (similar to ProductTracingTable)
        const uomBreakdown: Record<string, number> = m.uomBreakdown || {};
        if (!m.uomBreakdown) {
            const movement = internalMovement;
            const absMovement = Math.abs(movement);
            uniqueUOMs.forEach(u => uomBreakdown[u.unit] = 0);

            if (isPH) {
                if (m.unit) {
                    const normalized = m.unit.trim().toUpperCase();
                    if (uomBreakdown[normalized] !== undefined) {
                        uomBreakdown[normalized] = (m.variance ?? ((Number(phys || 0) - Number(sys || 0))));
                    }
                }
            } else {
                let remaining = absMovement;
                const normalizedRowUnit = m.unit?.trim().toUpperCase();
                if (normalizedRowUnit && m.unitCount && uomBreakdown[normalizedRowUnit] !== undefined) {
                    const explicitCount = Math.floor(remaining / m.unitCount);
                    if (explicitCount > 0) {
                        uomBreakdown[normalizedRowUnit] = (movement < 0 ? -explicitCount : explicitCount);
                        remaining -= explicitCount * m.unitCount;
                    }
                }
                uniqueUOMs.forEach(u => {
                    const count = Math.floor(remaining / u.count);
                    if (count > 0) {
                        const currentVal = uomBreakdown[u.unit] || 0;
                        uomBreakdown[u.unit] = (movement < 0 ? currentVal - count : currentVal + count);
                        remaining -= count * u.count;
                    }
                });
            }
        }

        rowsHtml += `
            <tr>
                <td class="pl-4 py-2 tabular-nums">${format(new Date(m.ts), "MM/dd/yyyy")}</td>
                <td class="font-medium">
                    ${escapeHtml(m.docType)}
                </td>
                <td>
                    <div style="font-weight: 700; font-family: monospace;">${escapeHtml(m.docNo)}</div>
                </td>
                <td class="font-medium">
                    ${escapeHtml(m.brand || "Movement")}
                </td>
                ${uniqueUOMs.map(uom => {
                    const val = uomBreakdown[uom.unit] || 0;
                    return `
                        <td class="text-right font-bold ${val > 0 ? 'text-emerald-600' : val < 0 ? 'text-rose-600' : 'text-slate-300'}">
                            ${val !== 0 ? (val > 0 ? `+${val.toLocaleString()}` : val.toLocaleString()) : "0.00"}
                        </td>
                    `;
                }).join("")}
                <td class="text-right font-bold text-primary">${fmtNumber(displayBal)}</td>
                <td class="text-right pr-4 font-mono text-[10px] text-slate-400">
                    ${showQtyBase ? `(${fmtNumber(m.inBase)} / ${fmtNumber(m.outBase)})` : "—"}
                </td>
            </tr>
        `;
    });


    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>Product Tracing Ledger - ${escapeHtml(productName)}</title>
    <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: 'Inter', sans-serif; font-size: 10px; color: #1e293b; margin: 0; padding: 20px; }
        .header { margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
        .title-section h1 { font-size: 20px; font-weight: 800; margin: 0; color: #0f172a; text-transform: uppercase; letter-spacing: -0.025em; }
        .title-section p { margin: 4px 0 0; color: #64748b; font-weight: 500; font-size: 11px; }
        .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; background: #f8fafc; padding: 16px; rounded-xl; border: 1px solid #e2e8f0; border-radius: 12px; }
        .meta-item label { display: block; font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
        .meta-item span { display: block; font-size: 13px; font-weight: 700; color: #334155; }
        table { width: 100%; border-collapse: collapse; border-spacing: 0; }
        th { background: #f1f5f9; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; padding: 10px 8px; border-bottom: 2px solid #e2e8f0; text-align: left; }
        td { padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: 700; }
        .text-primary { color: #2563eb; }
        .text-emerald-600 { color: #059669; }
        .text-rose-600 { color: #dc2626; }
        .text-slate-300 { color: #cbd5e1; }
        .text-slate-400 { color: #94a3b8; }
        .badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
        .badge-supplier { background: #fef3c7; color: #92400e; }
        .badge-default { background: #f1f5f9; color: #475569; }
        .badge-outline { border: 1px solid #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; color: #94a3b8; }
        .bg-muted { background-color: #f8fafc; }
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
            <h1>Movement Ledger Report</h1>
            <p>Detailed historical audit trail of product movements</p>
        </div>
        <div class="text-right">
            <p style="margin:0; font-weight: 800; color: #2563eb;">CONFIDENTIAL AUDIT DOCUMENT</p>
            <p style="margin:4px 0 0; color: #64748b;">Generated on ${format(new Date(), "PPpp")}</p>
        </div>
    </div>

    <div class="meta-grid">
        <div class="meta-item">
            <label>Product Family</label>
            <span>${escapeHtml(productName)}</span>
        </div>
        <div class="meta-item">
            <label>Branch / Warehouse</label>
            <span>${escapeHtml(branchName)}</span>
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
                <th>Brand</th>
                ${uniqueUOMs.map(uom => `<th class="text-right">${escapeHtml(uom.unit)}</th>`).join("")}
                <th class="text-right">Running Balance</th>
                <th class="text-right">Qty/Base</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>

    <div class="footer">
        <div>Printed by Audit Results & Findings System</div>
        <div>Continuous Ledger Document</div>
    </div>
</body>
</html>
    `;
}

export function printProductTracingReport(args: PrintProductTracingArgs): void {
    const html = generateProductTracingHtml(args);


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
        // printWindow.close();
    }, 500);
}
