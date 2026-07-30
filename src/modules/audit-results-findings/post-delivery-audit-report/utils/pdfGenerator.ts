import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import { CompanyData } from "@/components/pdf-layout-design/types";
import { PAPER_SIZES } from "@/components/pdf-layout-design/constants";
import autoTable from "jspdf-autotable";
import { PostDispatchAuditReportData } from "../types";

export const generatePostDeliveryAuditPdf = async (
  templateName: string,
  companyData: CompanyData,
  reportData: PostDispatchAuditReportData
): Promise<string> => {
  try {
    const doc = await PdfEngine.generateWithFrame(templateName, companyData, (doc, startY, config) => {
      const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };
      
      const baseSize = config.paperSize === 'Custom' ? config.customSize : (PAPER_SIZES[config.paperSize] || PAPER_SIZES.A4);
      const paperHeight = config.orientation === 'landscape' ? baseSize.width : baseSize.height;
      const bottomMargin = config.bodyEnd ? (paperHeight - config.bodyEnd) : margins.bottom;

      let currentY = startY;

      // --- Header Information Table ---
      autoTable(doc, {
        startY: currentY,
        margin: { ...margins, bottom: bottomMargin, left: margins.left + 20 },
        theme: 'grid',
        head: [],
        body: [
          [{ content: 'Driver', styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] } }, { content: reportData.driver, colSpan: 3, styles: { halign: 'center' } }],
          [{ content: 'DP', styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] } }, { content: reportData.dp, colSpan: 3, styles: { halign: 'center' } }],
          [{ content: 'DelDate', styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] } }, { content: reportData.delDate, colSpan: 3, styles: { halign: 'center' } }],
          [
            { content: 'ETOD', styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] } },
            { content: 'ATOD', styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] } },
            { content: 'ETOA', styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] } },
            { content: 'ATOA', styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] } }
          ],
          [
            { content: reportData.etod, styles: { halign: 'center' } },
            { content: reportData.atod, styles: { halign: 'center' } },
            { content: reportData.etoa, styles: { halign: 'center' } },
            { content: reportData.atoa, styles: { halign: 'center' } }
          ]
        ],
        styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
            0: { cellWidth: 30 },
        },
        tableWidth: 150
      });

      currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

      // --- POD Section ---
      autoTable(doc, {
        startY: currentY,
        margin: { ...margins, bottom: bottomMargin },
        theme: 'grid',
        head: [
          [{ content: 'POD - Proof Of Delivery', colSpan: 5, styles: { halign: 'center', fillColor: [240, 240, 240], fontStyle: 'bold' } }]
        ],
        body: [
          [{ content: 'Dispatched Plan', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: 'MISSING', colSpan: 4 }],
          [{ content: 'Invoices', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: 'COMPLETED', colSpan: 4 }]
        ],
        styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
      });
      
      currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

      // POD Table
      const podBody = reportData.podInvoices && reportData.podInvoices.length > 0 
        ? reportData.podInvoices.map(invoice => [
            invoice.invoices || '', 
            invoice.storeName || '', 
            invoice.status || '', 
            String(invoice.isInvoiceReceived ?? ''), 
            invoice.remarks || ''
          ])
        : [['', '', '', '', ''], ['', '', '', '', '']]; // Empy rows for layout if empty

      autoTable(doc, {
        startY: currentY,
        margin: { ...margins, bottom: bottomMargin },
        theme: 'grid',
        head: [['Invoices', 'StoreName', 'Status', 'isInvoiceReceived?', 'Remarks']],
        body: podBody,
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
      });

      currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

      // --- Returned to Vendor Section ---
      autoTable(doc, {
        startY: currentY,
        margin: { ...margins, bottom: bottomMargin },
        theme: 'grid',
        head: [[{ content: 'Returned to Vendor', colSpan: 6, styles: { halign: 'center', fillColor: [240, 240, 240], fontStyle: 'bold' } }]],
        body: [],
        styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
      });

      currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

      const returnedBody: Array<Array<string | Record<string, unknown>>> = reportData.returnedToVendor && reportData.returnedToVendor.length > 0
        ? reportData.returnedToVendor.map(item => [
            item.customerName || '',
            item.product || '',
            item.qty?.toString() || '',
            item.unit || '',
            item.amount?.toString() || '',
            String(item.receivedByWarehouse ?? '')
          ])
        : [['', '', '', '', '', ''], ['', '', '', '', '', '']];

      const returnedTotalAmount = (reportData.returnedToVendor || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      returnedBody.push([
        { content: 'TOTAL AMOUNT', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] } },
        { content: returnedTotalAmount > 0 ? returnedTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '', styles: { fontStyle: 'bold', fillColor: [250, 250, 250] } },
        { content: '', styles: { fillColor: [250, 250, 250] } }
      ]);

      autoTable(doc, {
        startY: currentY,
        margin: { ...margins, bottom: bottomMargin },
        theme: 'grid',
        head: [['CustomerName', 'Product', 'QTY', 'Unit', 'Amount', 'Received by Warehouse?']],
        body: returnedBody,
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
      });

      currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

      // --- Rejected Upon Delivery Section ---
      autoTable(doc, {
        startY: currentY,
        margin: { ...margins, bottom: bottomMargin },
        theme: 'grid',
        head: [[{ content: 'Rejected Upon Delivery', colSpan: 6, styles: { halign: 'center', fillColor: [240, 240, 240], fontStyle: 'bold' } }]],
        body: [],
        styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
      });

      currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

      const rejectedBody: Array<Array<string | Record<string, unknown>>> = reportData.rejectedUponDelivery && reportData.rejectedUponDelivery.length > 0
        ? reportData.rejectedUponDelivery.map(item => [
            item.customerName || '',
            item.product || '',
            item.qty?.toString() || '',
            item.unit || '',
            item.amount?.toString() || '',
            String(item.receivedByWarehouse ?? '')
          ])
        : [['', '', '', '', '', ''], ['', '', '', '', '', '']];

      const rejectedTotalAmount = (reportData.rejectedUponDelivery || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      rejectedBody.push([
        { content: 'TOTAL AMOUNT', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] } },
        { content: rejectedTotalAmount > 0 ? rejectedTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '', styles: { fontStyle: 'bold', fillColor: [250, 250, 250] } },
        { content: '', styles: { fillColor: [250, 250, 250] } }
      ]);

      autoTable(doc, {
        startY: currentY,
        margin: { ...margins, bottom: bottomMargin },
        theme: 'grid',
        head: [['CustomerName', 'Product', 'QTY', 'Unit', 'Amount', 'Received by Warehouse?']],
        body: rejectedBody,
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
      });
      
    });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    return url;
  } catch (error) {
    console.error("Error generating Post Delivery Audit PDF:", error);
    throw error;
  }
};
