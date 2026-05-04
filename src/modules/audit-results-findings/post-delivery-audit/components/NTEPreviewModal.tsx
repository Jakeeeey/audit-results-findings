"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { 
  Save,
  Loader2,
  FileText
} from "lucide-react";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import { pdfTemplateService } from "@/components/pdf-layout-design/services/pdf-template";
import { CompanyData } from "@/components/pdf-layout-design/types";
import { toast } from "sonner";
import { fetchProvider } from "../providers/fetchProvider";

interface NTEPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  data: {
    pdiId: number;
    userId?: number | string;
    driverName: string;
    amount: number;
    toa: string;
    dispatchNo: string;
    invoiceNo: string;
    userName: string;
    userPosition: string;
    userDepartment: string;
    driverDepartment: string;
    helpers: string[];
  };
}

export const NTEPreviewModal: React.FC<NTEPreviewModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  data,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);

  const generatePreview = React.useCallback(async () => {
    setIsGenerating(true);
    try {
      // 1. Fetch Company Data
      let company = companyData;
      if (!company) {
        const res = await fetch("/api/pdf/company");
        if (res.ok) {
          const result = await res.json();
          company = result.data?.[0] || result.data;
          setCompanyData(company);
        }
      }

      // 2. Fetch Templates to find the Header
      const templates = await pdfTemplateService.fetchTemplates();
      const headerTemplate = templates.find(t => t.name.toLowerCase().includes("header")) || templates[0];

      if (!headerTemplate) throw new Error("No PDF templates found");

      // 3. Generate PDF using PdfEngine with the Header template
      const doc = await PdfEngine.generateWithFrame(headerTemplate.name, company, async (doc, startY) => {
        // Helper for mixed bold/normal text
        const renderMixedLine = (chunks: { text: string; bold?: boolean }[], x: number, y: number, maxWidth: number) => {
          let cursorX = x;
          let cursorY = y;
          const lineHeight = 6;

          chunks.forEach(chunk => {
            doc.setFont("times", chunk.bold ? "bold" : "normal");
            const words = chunk.text.split(" ");
            
            words.forEach((word, i) => {
              const textToPrint = word + (i === words.length - 1 ? "" : " ");
              const wordWidth = doc.getTextWidth(textToPrint);
              
              if (cursorX + wordWidth > x + maxWidth) {
                cursorX = x;
                cursorY += lineHeight;
              }
              
              doc.text(textToPrint, cursorX, cursorY);
              cursorX += wordWidth;
            });
          });
          
          return cursorY + lineHeight;
        };

        // Apply document styling
        doc.setFont("times", "bold");
        doc.setFontSize(18);
        
        const title = "NOTICE TO EXPLAIN";
        const titleWidth = doc.getTextWidth(title);
        const pageWidth = doc.internal.pageSize.getWidth();
        const centerX = (pageWidth - titleWidth) / 2;
        
        doc.setTextColor(0, 0, 0); 
        doc.text(title, centerX, startY + 10);
        doc.line(centerX, startY + 12, centerX + titleWidth, startY + 12);

        doc.setFont("times", "normal");
        doc.setFontSize(11);
        let currentY = startY + 25;

        // Details
        const details = [
          ["Date:", format(new Date(), "MMMM dd, yyyy")],
          ["To:", data.driverName],
          ["Position:", "Driver"],
          ["Department:", data.driverDepartment],
          ["Subject:", "Notice to Explain Regarding Missing / Discrepancy Amount"],
        ];

        details.forEach(([label, value]) => {
          doc.setFont("times", "bold");
          doc.text(label, 20, currentY);
          doc.setFont("times", "normal");
          doc.text(String(value || ""), 50, currentY);
          currentY += 6;
        });

        currentY += 10;
        
        // "Dear [Name]," with bold name
        doc.setFont("times", "normal");
        doc.text("Dear ", 20, currentY);
        doc.setFont("times", "bold");
        doc.text(`${data.driverName},`, 20 + doc.getTextWidth("Dear "), currentY);
        currentY += 10;

        // Paragraph 1 with bold Amount and TOA
        currentY = renderMixedLine([
          { text: "This Notice to Explain is issued to formally require you to submit your written explanation regarding the reported discrepancy involving the amount of " },
          { text: `PHP ${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, bold: true },
          { text: ", which was found to be missing, unaccounted for in connection with your assigned delivery transaction on " },
          { text: data.toa ? format(new Date(data.toa), "yyyy-MM-dd") : "N/A", bold: true },
          { text: "." }
        ], 20, currentY, 170);

        currentY += 1;
        // Paragraph 2 with bold Dispatch and Invoice
        currentY = renderMixedLine([
          { text: "Based on the initial review of the records, you were assigned as the driver for the said transaction involving " },
          { text: `Dispatch No. [${data.dispatchNo}] Invoice No. [${data.invoiceNo}]`, bold: true },
          { text: ". Upon checking of the related documents, collection records, remittance records, and/or delivery accountability, the amount of " },
          { text: `PHP ${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, bold: true },
          { text: " appears to be lacking or unaccounted for." }
        ], 20, currentY, 170);

        currentY += 1;

        // Paragraph 3
        const body3 = "Considering that the said amount was connected to your assigned route, delivery, or collection responsibility, you are hereby directed to explain in writing why the said amount is missing, unremitted, or not properly accounted for. You may include in your explanation any relevant details, supporting documents, receipts, acknowledgements, endorsements, or names of persons who may help clarify the matter.";
        const split3 = doc.splitTextToSize(body3, 170);
        doc.setFont("times", "normal");
        doc.text(split3, 20, currentY);
        currentY += split3.length * 5 + 4;

        // Paragraph 4 with bold "five (5) business days"
        currentY = renderMixedLine([
          { text: "Please submit your written explanation within " },
          { text: "five (5) business days", bold: true },
          { text: " from receipt of this notice. Failure to submit your explanation within the given period may be considered a waiver of your right to be heard, and the company may proceed with its evaluation based on the available records and evidence." }
        ], 20, currentY, 170);

        currentY += 1;

        doc.setFont("times", "italic");
        const bodyText5 = `This Notice to Explain is not yet a disciplinary action. It is issued to give you an opportunity to explain your side before the company makes any final decision regarding the matter.`;
        const splitText5 = doc.splitTextToSize(bodyText5, 170);
        doc.text(splitText5, 20, currentY);
        currentY += splitText5.length * 5 + 6;

        doc.setFont("times", "normal");
        doc.text("For your immediate compliance.", 20, currentY);
        currentY += 8;

        doc.text("Respectfully,", 20, currentY);
        currentY += 6;
        doc.setFont("times", "bold");
        doc.text("Prepared by:", 20, currentY);
        doc.line(20, currentY + 1, 60, currentY + 1);
        currentY += 6;
        doc.setFont("times", "normal");
        doc.text(`Name: ${data.userName}`, 20, currentY);
        currentY += 5;
        doc.text(`Position: ${data.userPosition}`, 20, currentY);
        currentY += 5;
        doc.text(`Department: ${data.userDepartment}`, 20, currentY);
        currentY += 10;

        // Signature section
        doc.setFont("times", "bold");
        doc.text("Auditee(s):", 20, currentY);
        doc.line(20, currentY + 1, 60, currentY + 1);
        currentY += 8;
        
        doc.setFont("times", "normal");
        const allAuditees = [
          { name: data.driverName, position: "Driver", department: data.driverDepartment },
          ...data.helpers.map(h => ({ name: h, position: "Helper", department: data.driverDepartment }))
        ];

        const baseY = currentY;
        allAuditees.forEach((auditee, idx) => {
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          const x = 20 + (col * 58);
          const y = baseY + (row * 18);
          doc.text(`Name: ${auditee.name}`, x, y);
          doc.text(`Position: ${auditee.position}`, x, y + 5);
          doc.text(`Department: ${auditee.department}`, x, y + 10);
          if (col === 2 || idx === allAuditees.length - 1) {
            currentY = y + 18;
          }
        });
      });

      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error: unknown) {
      console.error("Error generating NTE preview:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [data, companyData]);

  useEffect(() => {
    if (isOpen) {
      generatePreview();
    }
  }, [isOpen, generatePreview]);

  const handleGenerate = async () => {
    if (!isOpen || !data || isGenerating) return;
    
    setIsGenerating(true);
    try {
      // 1. Re-generate the PDF for saving/downloading
      let company = companyData;
      if (!company) {
        const res = await fetch("/api/pdf/company");
        if (res.ok) {
          const result = await res.json();
          company = result.data?.[0] || result.data;
          setCompanyData(company);
        }
      }

      const templates = await pdfTemplateService.fetchTemplates();
      const headerTemplate = templates.find(t => t.name.toLowerCase().includes("header")) || templates[0];
      if (!headerTemplate) throw new Error("No PDF templates found");

      const doc = await PdfEngine.generateWithFrame(headerTemplate.name, company, async (doc, startY) => {
        // Helper for mixed bold/normal text
        const renderMixedLine = (chunks: { text: string; bold?: boolean }[], x: number, y: number, maxWidth: number) => {
          let cursorX = x;
          let cursorY = y;
          const lineHeight = 6;

          chunks.forEach(chunk => {
            doc.setFont("times", chunk.bold ? "bold" : "normal");
            const words = chunk.text.split(" ");
            
            words.forEach((word, i) => {
              const textToPrint = word + (i === words.length - 1 ? "" : " ");
              const wordWidth = doc.getTextWidth(textToPrint);
              
              if (cursorX + wordWidth > x + maxWidth) {
                cursorX = x;
                cursorY += lineHeight;
              }
              
              doc.text(textToPrint, cursorX, cursorY);
              cursorX += wordWidth;
            });
          });
          
          return cursorY + lineHeight;
        };

        // Apply document styling
        doc.setFont("times", "bold");
        doc.setFontSize(18);
        const title = "NOTICE TO EXPLAIN";
        const titleWidth = doc.getTextWidth(title);
        const centerX = (doc.internal.pageSize.getWidth() - titleWidth) / 2;
        doc.text(title, centerX, startY + 10);
        doc.line(centerX, startY + 12, centerX + titleWidth, startY + 12);

        doc.setFont("times", "normal");
        doc.setFontSize(11);
        let currentY = startY + 25;

        // Details
        const details = [
          ["Date:", format(new Date(), "MMMM dd, yyyy")],
          ["To:", data.driverName],
          ["Position:", "Driver"],
          ["Department:", data.driverDepartment],
          ["Subject:", "Notice to Explain Regarding Missing / Discrepancy Amount"],
        ];

        details.forEach(([label, value]) => {
          doc.setFont("times", "bold");
          doc.text(label, 20, currentY);
          doc.setFont("times", "normal");
          doc.text(String(value || ""), 50, currentY);
          currentY += 6;
        });

        currentY += 10;
        doc.setFont("times", "normal");
        doc.text("Dear ", 20, currentY);
        doc.setFont("times", "bold");
        doc.text(`${data.driverName},`, 20 + doc.getTextWidth("Dear "), currentY);
        currentY += 10;

        currentY = renderMixedLine([
          { text: "This Notice to Explain is issued to formally require you to submit your written explanation regarding the reported discrepancy involving the amount of " },
          { text: `PHP ${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, bold: true },
          { text: ", which was found to be missing, unaccounted for in connection with your assigned delivery transaction on " },
          { text: data.toa ? format(new Date(data.toa), "yyyy-MM-dd") : "N/A", bold: true },
          { text: "." }
        ], 20, currentY, 170);
        currentY += 1;

        currentY = renderMixedLine([
          { text: "Based on the initial review of the records, you were assigned as the driver for the said transaction involving " },
          { text: `Dispatch No. [${data.dispatchNo}] Invoice No. [${data.invoiceNo}]`, bold: true },
          { text: ". Upon checking of the related documents, collection records, remittance records, and/or delivery accountability, the amount of " },
          { text: `PHP ${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, bold: true },
          { text: " appears to be lacking or unaccounted for." }
        ], 20, currentY, 170);
        currentY += 1;

        const body3 = "Considering that the said amount was connected to your assigned route, delivery, or collection responsibility, you are hereby directed to explain in writing why the said amount is missing, unremitted, or not properly accounted for. You may include in your explanation any relevant details, supporting documents, receipts, acknowledgements, endorsements, or names of persons who may help clarify the matter.";
        const split3 = doc.splitTextToSize(body3, 170);
        doc.setFont("times", "normal");
        doc.text(split3, 20, currentY);
        currentY += split3.length * 5 + 4;

        currentY = renderMixedLine([
          { text: "Please submit your written explanation within " },
          { text: "five (5) business days", bold: true },
          { text: " from receipt of this notice. Failure to submit your explanation within the given period may be considered a waiver of your right to be heard, and the company may proceed with its evaluation based on the available records and evidence." }
        ], 20, currentY, 170);
        currentY += 1;

        doc.setFont("times", "italic");
        const bodyText5 = `This Notice to Explain is not yet a disciplinary action. It is issued to give you an opportunity to explain your side before the company makes any final decision regarding the matter.`;
        const splitText5 = doc.splitTextToSize(bodyText5, 170);
        doc.text(splitText5, 20, currentY);
        currentY += splitText5.length * 5 + 6;

        doc.setFont("times", "normal");
        doc.text("For your immediate compliance.", 20, currentY);
        currentY += 8;

        doc.text("Respectfully,", 20, currentY);
        currentY += 6;
        doc.setFont("times", "bold");
        doc.text("Prepared by:", 20, currentY);
        doc.line(20, currentY + 1, 60, currentY + 1);
        currentY += 6;
        doc.setFont("times", "normal");
        doc.text(`Name: ${data.userName}`, 20, currentY);
        currentY += 5;
        doc.text(`Position: ${data.userPosition}`, 20, currentY);
        currentY += 5;
        doc.text(`Department: ${data.userDepartment}`, 20, currentY);
        currentY += 10;

        doc.setFont("times", "bold");
        doc.text("Auditee(s):", 20, currentY);
        doc.line(20, currentY + 1, 60, currentY + 1);
        currentY += 8;
        doc.setFont("times", "normal");
        const allAuditees = [
          { name: data.driverName, position: "Driver", department: data.driverDepartment },
          ...data.helpers.map(h => ({ name: h, position: "Helper", department: data.driverDepartment }))
        ];

        const baseY = currentY;
        allAuditees.forEach((auditee, idx) => {
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          const x = 20 + (col * 58);
          const y = baseY + (row * 18);
          doc.text(`Name: ${auditee.name}`, x, y);
          doc.text(`Position: ${auditee.position}`, x, y + 5);
          doc.text(`Department: ${auditee.department}`, x, y + 10);
          if (col === 2 || idx === allAuditees.length - 1) {
            currentY = y + 18;
          }
        });
      });

      // 2. Upload to Directus & Save to DB
      const pdfBase64 = doc.output("datauristring").split(",")[1];
      const result = await fetchProvider.postNTE(data.pdiId, pdfBase64, data.userId);

      // 3. Download locally
      doc.save(`NTE_${result.docNo || data.dispatchNo}.pdf`);

      toast.success(`NTE Generated Successfully: ${result.docNo}`);
      onSuccess?.(); // Refresh the table
      onClose();
    } catch (e: unknown) {
      console.error(e);
      toast.error((e as Error).message || "Failed to generate and save NTE");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isGenerating && onClose()}>
        <DialogContent 
          className="max-w-5xl h-[90vh] p-0 flex flex-col bg-slate-900 border-slate-700 shadow-2xl overflow-hidden"
          showCloseButton={false}
        >
          <DialogHeader className="px-8 py-6 bg-white border-b flex flex-row items-center justify-between shrink-0">
            <div>
              <DialogTitle className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                Notice to Explain Preview
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Reference: {data?.dispatchNo} | Invoice: {data?.invoiceNo}
              </p>
            </div>
          </DialogHeader>

          <div className="flex-1 bg-slate-800 flex items-center justify-center overflow-hidden">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-4 animate-pulse">
                <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                </div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Applying Template Frame...</p>
              </div>
            ) : pdfUrl ? (
              <iframe 
                src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
                className="w-full h-full border-none bg-slate-800"
                title="NTE Preview"
              />
            ) : (
              <div className="text-center text-slate-600">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest">Preview Unavailable</p>
              </div>
            )}
          </div>

          <DialogFooter className="px-8 py-6 bg-slate-50 border-t flex gap-3">
            <Button variant="outline" onClick={onClose} className="rounded-xl font-bold uppercase tracking-wider text-[10px] px-6 h-11 border-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              className="rounded-xl font-black uppercase tracking-wider text-[10px] px-8 h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 gap-2"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Generate & Save NTE
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
