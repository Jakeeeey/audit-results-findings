import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { GroupedPhysicalInventoryRow, MockLedgerHeaderRow } from "../types";

export type GenerateManualTallySheetPdfArgs = {
    header: MockLedgerHeaderRow;
    groupedRows: GroupedPhysicalInventoryRow[];
    branchName: string;
    supplierName: string;
};

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

export function generateManualTallySheetPdf(args: GenerateManualTallySheetPdfArgs): jsPDF {
    const { header, groupedRows, branchName, supplierName } = args;

    // Landscape, Legal size format
    const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "legal", // 355.6mm x 215.9mm
    });

    // 1. Corporate Header (Center on 355.6mm -> X=177.8mm)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("MEN2 MARKETING CORPORATION", 177.8, 16, { align: "center" });

    doc.setFontSize(11);
    doc.text("MOCK LEDGER - MANUAL TALLY SHEET", 177.8, 21, { align: "center" });

    // Underline subtitle
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    const subWidth = doc.getTextWidth("MOCK LEDGER - MANUAL TALLY SHEET");
    doc.line(177.8 - subWidth / 2, 22, 177.8 + subWidth / 2, 22);

    // 2. Metadata Table
    const metaBody = [
        [
            { content: "Control No:", styles: { fontStyle: "bold" as const } },
            header.ph_no || "",
            { content: "Branch:", styles: { fontStyle: "bold" as const } },
            branchName,
        ],
        [
            { content: "Supplier:", styles: { fontStyle: "bold" as const } },
            supplierName,
            { content: "Cut-off Date:", styles: { fontStyle: "bold" as const } },
            formatDateString(header.cutOff_date),
        ]
    ];

    autoTable(doc, {
        startY: 26,
        margin: { left: 20, right: 20 },
        theme: "plain",
        styles: { fontSize: 9.5, cellPadding: 2 },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 120 },
            2: { cellWidth: 25 },
            3: { cellWidth: 145 }
        },
        body: metaBody,
    });

    const startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

    // 3. Prepare Tally Table Data
    const tableBody: string[][] = [];

    for (const group of groupedRows) {
        const sortedChildren = [...group.rows].sort((a, b) => b.unit_count - a.unit_count);

        for (let idx = 0; idx < sortedChildren.length; idx++) {
            const child = sortedChildren[idx];
            const codeCell = child.product_code ?? "";
            const descCell = child.product_name || group.base_product_name;
            const unitCell = child.unit_name || child.unit_shortcut || "PCS";
            const systemQtyVal = fmtNumber(child.system_count);

            tableBody.push([
                codeCell,
                descCell,
                unitCell,
                systemQtyVal,
                "", "", "", "", "", "", "", "", "", "", // 10 tally columns
                "" // TOTAL column
            ]);
        }
    }

    // Headers
    const headers = [
        "Code", "Description", "Unit", "Phys Qty",
        "", "", "", "", "", "", "", "", "", "", // 10 empty columns
        "TOTAL"
    ];

    autoTable(doc, {
        startY: startY,
        margin: { left: 20, right: 20 },
        theme: "grid",
        styles: {
            fontSize: 8.5,
            cellPadding: 2,
            lineColor: [102, 102, 102],
            lineWidth: 0.15,
        },
        headStyles: {
            fillColor: [224, 224, 224],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
            minCellHeight: 10
        },
        bodyStyles: {
            minCellHeight: 10,
            valign: "middle"
        },
        rowPageBreak: "avoid",
        head: [headers],
        body: tableBody,
        columnStyles: {
            0: { cellWidth: 40, fontSize: 8 }, // Code
            1: { cellWidth: 100 }, // Description
            2: { cellWidth: 20, halign: "center" }, // Unit
            3: { cellWidth: 20, halign: "right", fontStyle: "bold", fillColor: [252, 252, 252] }, // Phys Qty
            4: { cellWidth: 11 },
            5: { cellWidth: 11 },
            6: { cellWidth: 11 },
            7: { cellWidth: 11 },
            8: { cellWidth: 11 },
            9: { cellWidth: 11 },
            10: { cellWidth: 11 },
            11: { cellWidth: 11 },
            12: { cellWidth: 11 },
            13: { cellWidth: 11 },
            14: { cellWidth: 25, fillColor: [250, 250, 250] } // TOTAL
        },
        didDrawCell: (data) => {
            // Draw diagonal slashes on the header cells of the 10 tally columns
            if (data.row.section === "head" && data.column.index >= 4 && data.column.index <= 13) {
                const cellX = data.cell.x;
                const cellY = data.cell.y;
                const cellW = data.cell.width;
                const cellH = data.cell.height;

                doc.setDrawColor(102, 102, 102);
                doc.setLineWidth(0.15);
                doc.line(cellX, cellY + cellH, cellX + cellW, cellY);
            }
        }
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

    // 4. Footer sign-offs (Legal height is 215.9mm, so check overflow > 175mm)
    if (finalY > 175) {
        doc.addPage();
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);

    const footerYLine = (finalY > 175 ? 20 : finalY) + 12;
    const footerYText = footerYLine + 5;

    // Counted By
    doc.text("Counted By:", 20, footerYLine - 5);
    doc.line(20, footerYLine, 100, footerYLine);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Signature over Printed Name", 20, footerYText);

    // Verified By
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Verified By:", 135, footerYLine - 5);
    doc.line(135, footerYLine, 215, footerYLine);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Signature over Printed Name", 135, footerYText);

    // Posted By
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Posted By:", 250, footerYLine - 5);
    doc.line(250, footerYLine, 330, footerYLine);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Signature over Printed Name", 250, footerYText);

    return doc;
}
