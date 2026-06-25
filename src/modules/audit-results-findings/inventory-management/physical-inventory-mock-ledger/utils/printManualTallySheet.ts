import type { GroupedPhysicalInventoryRow, MockLedgerHeaderRow } from "../types";

export type PrintManualTallySheetArgs = {
    header: MockLedgerHeaderRow;
    groupedRows: GroupedPhysicalInventoryRow[];
    branchName: string;
    supplierName: string;
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
        maximumFractionDigits: 0,
    });
}

function formatDateString(value: string | null | undefined): string {
    if (!value) return "";
    try {
        const d = new Date(value);
        if (isNaN(d.getTime())) return value;
        return d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return value;
    }
}

export function printManualTallySheet(args: PrintManualTallySheetArgs): void {
    const { header, groupedRows, branchName, supplierName } = args;

    let tableRowsHtml = "";

    for (const group of groupedRows) {
        const sortedChildren = [...group.rows].sort((a, b) => {
            return a.unit_count - b.unit_count;
        });

        for (let idx = 0; idx < sortedChildren.length; idx++) {
            const child = sortedChildren[idx];
            const codeCell = escapeHtml(child.product_code ?? "");
            const descCell = escapeHtml(child.product_name || group.base_product_name);
            const unitCell = escapeHtml(child.unit_name ?? child.unit_shortcut ?? "PCS");
            const systemQtyVal = fmtNumber(child.system_count);

            tableRowsHtml += `
                <tr>
                    <td class="code-cell">${codeCell}</td>
                    <td class="desc-cell">${descCell}</td>
                    <td class="unit-cell">${unitCell}</td>
                    <td class="qty-cell">${systemQtyVal}</td>
                    <td class="tally-cell"></td>
                    <td class="tally-cell"></td>
                    <td class="tally-cell"></td>
                    <td class="tally-cell"></td>
                    <td class="tally-cell"></td>
                    <td class="tally-cell"></td>
                    <td class="tally-cell"></td>
                    <td class="tally-cell"></td>
                    <td class="tally-cell"></td>
                    <td class="tally-cell"></td>
                    <td class="total-cell"></td>
                </tr>
            `;
        }
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>Mock Ledger Manual Tally Sheet</title>
    <style>
        * {
            box-sizing: border-box;
        }

        html, body {
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            color: #000;
        }

        body {
            padding: 20px;
        }

        .header-title {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 2px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .header-subtitle {
            text-align: center;
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 15px;
            text-transform: uppercase;
            text-decoration: underline;
        }

        .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 10px;
        }

        .meta-table td {
            border: none;
            padding: 3px 0;
            vertical-align: top;
        }

        .meta-label {
            font-weight: bold;
            white-space: nowrap;
            padding-right: 5px;
        }

        .meta-value {
            border-bottom: 1px solid #ccc;
            padding-right: 15px;
        }

        table.tally-table {
            width: 100%;
            border-collapse: collapse;
        }

        table.tally-table th {
            background-color: #e0e0e0;
            border: 1px solid #666;
            padding: 4px 2px;
            font-size: 9px;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
        }

        table.tally-table td {
            border: 1px solid #666;
            padding: 4px 6px;
            vertical-align: middle;
            height: 25px;
        }

        .code-cell {
            width: 12%;
            white-space: nowrap;
            font-size: 9px;
        }

        .desc-cell {
            width: 28%;
            font-weight: normal;
        }

        .unit-cell {
            width: 8%;
            text-align: center;
        }

        .qty-cell {
            width: 8%;
            text-align: right;
            font-weight: bold;
            background-color: #fcfcfc;
        }

        .tally-cell {
            width: 3.5%;
        }

        .total-cell {
            width: 7%;
            background-color: #fafafa;
        }

        .slash-header {
            position: relative;
            width: 3.5%;
            padding: 0 !important;
            height: 25px;
        }

        .slash-header::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(to top right, transparent calc(50% - 0.5px), #666, transparent calc(50% + 0.5px));
            pointer-events: none;
        }

        @media print {
            body {
                padding: 10px;
            }
            tr {
                break-inside: avoid;
            }
            thead {
                display: table-header-group;
            }
        }
    </style>
</head>
<body>
    <div class="header-title">MEN2 MARKETING CORPORATION</div>
    <div class="header-subtitle">MOCK LEDGER - MANUAL TALLY SHEET</div>

    <table class="meta-table">
        <tr>
            <td class="meta-label" style="width: 8%;">Control No:</td>
            <td class="meta-value" style="width: 25%;">${escapeHtml(header.ph_no || "")}</td>
            <td class="meta-label" style="width: 5%;">PH:</td>
            <td class="meta-value" style="width: 20%;">${header.id}</td>
            <td class="meta-label" style="width: 6%;">Branch:</td>
            <td class="meta-value" style="width: 36%;">${escapeHtml(branchName)}</td>
        </tr>
        <tr>
            <td class="meta-label">Supplier:</td>
            <td class="meta-value" colspan="3">${escapeHtml(supplierName)}</td>
            <td class="meta-label">Cut-off Date:</td>
            <td class="meta-value">${formatDateString(header.cutOff_date)}</td>
        </tr>
    </table>

    <table class="tally-table">
        <thead>
            <tr>
                <th style="width: 12%;">Code</th>
                <th style="width: 28%;">Description</th>
                <th style="width: 8%;">Unit</th>
                <th style="width: 8%;">Phys Qty</th>
                <th class="slash-header"></th>
                <th class="slash-header"></th>
                <th class="slash-header"></th>
                <th class="slash-header"></th>
                <th class="slash-header"></th>
                <th class="slash-header"></th>
                <th class="slash-header"></th>
                <th class="slash-header"></th>
                <th class="slash-header"></th>
                <th class="slash-header"></th>
                <th style="width: 7%;">TOTAL</th>
            </tr>
        </thead>
        <tbody>
            ${tableRowsHtml}
        </tbody>
    </table>
</body>
</html>
    `;

    const printWindow = window.open("", "_blank", "width=1200,height=900");

    if (!printWindow) {
        throw new Error("Unable to open print window. Please allow pop-ups for this site.");
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 400);
}
