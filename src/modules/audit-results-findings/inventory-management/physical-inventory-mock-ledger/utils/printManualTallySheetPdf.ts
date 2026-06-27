import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { GroupedPhysicalInventoryRow, MockLedgerHeaderRow } from "../types";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";

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

export async function generateManualTallySheetPdf(args: GenerateManualTallySheetPdfArgs): Promise<jsPDF> {
    const { header, groupedRows, branchName, supplierName } = args;

    // Fetch company data
    let companyData = null;
    try {
        const cached = localStorage.getItem("pdf_company_data");
        if (cached) {
            companyData = JSON.parse(cached);
        } else {
            const compRes = await fetch("/api/pdf/company");
            if (compRes.ok) {
                const result = await compRes.json();
                companyData = result.data?.[0] || result.data || null;
                if (companyData) {
                    localStorage.setItem("pdf_company_data", JSON.stringify(companyData));
                }
            }
        }
    } catch (e) {
        console.error("Error loading company data:", e);
    }

    const doc = await PdfEngine.generateWithFrame("Legal - Landscape", companyData, (doc, startY) => {
        // Subtitle "MOCK LEDGER - MANUAL TALLY SHEET"
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("MOCK LEDGER - MANUAL TALLY SHEET", 177.8, startY + 5, { align: "center" });

        // Underline subtitle
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        const subWidth = doc.getTextWidth("MOCK LEDGER - MANUAL TALLY SHEET");
        doc.line(177.8 - subWidth / 2, startY + 6, 177.8 + subWidth / 2, startY + 6);

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
            startY: startY + 10,
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

        const tableStartY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

        const tableBody: string[][] = [];
        const lastRowIndices = new Set<number>();
        const firstRowIndices = new Set<number>();
        let rowIndex = 0;

        for (const group of groupedRows) {
            const sortedChildren = [...group.rows].sort((a, b) => a.unit_count - b.unit_count);

            firstRowIndices.add(rowIndex);

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

                if (idx === sortedChildren.length - 1) {
                    lastRowIndices.add(rowIndex);
                }
                rowIndex++;
            }
        }

        // Headers
        const headers = [
            "Code", "Description", "Unit", "Phys Qty",
            "", "", "", "", "", "", "", "", "", "", // 10 empty columns
            "TOTAL"
        ];

        autoTable(doc, {
            startY: tableStartY,
            margin: { left: 20, right: 20 },
            theme: "grid",
            styles: {
                fontSize: 7.5,
                cellPadding: [1, 2],
                lineColor: [102, 102, 102],
                lineWidth: 0.15,
            },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                minCellHeight: 10
            },
            bodyStyles: {
                minCellHeight: 5.5,
                valign: "middle"
            },
            rowPageBreak: "avoid",
            head: [headers],
            body: tableBody,
            columnStyles: {
                0: { cellWidth: 40 }, // Code
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

                // Draw thick, dark bottom border for the table header row
                if (data.row.section === "head") {
                    const cellX = data.cell.x;
                    const cellY = data.cell.y;
                    const cellW = data.cell.width;
                    const cellH = data.cell.height;

                    doc.setDrawColor(50, 50, 50);
                    doc.setLineWidth(0.5);
                    doc.line(cellX, cellY + cellH, cellX + cellW, cellY + cellH);
                }

                // Draw thick, dark top border for the first row of each product family
                if (data.row.section === "body" && firstRowIndices.has(data.row.index)) {
                    const cellX = data.cell.x;
                    const cellY = data.cell.y;
                    const cellW = data.cell.width;

                    doc.setDrawColor(50, 50, 50);
                    doc.setLineWidth(0.5);
                    doc.line(cellX, cellY, cellX + cellW, cellY);
                }

                // Draw thick, dark bottom border for the last row of each product family
                if (data.row.section === "body" && lastRowIndices.has(data.row.index)) {
                    const cellX = data.cell.x;
                    const cellY = data.cell.y;
                    const cellW = data.cell.width;
                    const cellH = data.cell.height;

                    doc.setDrawColor(50, 50, 50);
                    doc.setLineWidth(0.5);
                    doc.line(cellX, cellY + cellH, cellX + cellW, cellY + cellH);
                }
            }
        });

        const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

        // 4. Footer sign-offs (Legal height is 215.9mm, so check overflow > 170mm)
        if (finalY > 170) {
            doc.addPage();
        }

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);

        const labelY = (finalY > 170 ? 20 : finalY) + 10;
        const footerYLine = labelY + 12;
        const footerYText = footerYLine + 5;

        // Counted By
        doc.text("Counted By:", 20, labelY);
        doc.line(20, footerYLine, 100, footerYLine);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Signature over Printed Name", 20, footerYText);

        // Verified By
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Verified By:", 135, labelY);
        doc.line(135, footerYLine, 215, footerYLine);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Signature over Printed Name", 135, footerYText);

        // Posted By
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Posted By:", 250, labelY);
        doc.line(250, footerYLine, 330, footerYLine);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Signature over Printed Name", 250, footerYText);
    });

    return doc;
}
