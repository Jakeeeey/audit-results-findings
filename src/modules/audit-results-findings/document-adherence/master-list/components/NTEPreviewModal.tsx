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

interface NTEPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  data: {
    userName: string;
    nteNo: string;
    rows: Array<{ docType: string; docNo: string; daysElapsed: number }>;
    remarks: string;
    recipientPosition?: string;
    recipientDepartment?: string;
  };
}

export const NTEPreviewModal: React.FC<NTEPreviewModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  data,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [currentUser, setCurrentUser] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recipientProfile, setRecipientProfile] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [generatedPdf, setGeneratedPdf] = useState<any>(null);

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

      // 2. Fetch Current User Profile (for signature)
      let auditor = currentUser;
      if (!auditor) {
        try {
          const userRes = await fetch("/api/arf/document-adherance/my-profile");
          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.ok) {
              auditor = userData.data;
              setCurrentUser(auditor);
            }
          }
        } catch (err) {
          console.warn("Failed to fetch current user profile", err);
        }
      }

      // 3. Fetch Recipient Profile (to get position/department)
      let recipient = recipientProfile;
      if (!recipient && data.userName) {
        try {
          const recipRes = await fetch(`/api/arf/document-adherance/user-profile?name=${encodeURIComponent(data.userName)}`);
          if (recipRes.ok) {
            const recipData = await recipRes.json();
            if (recipData.ok) {
              recipient = recipData.data;
              setRecipientProfile(recipient);
            }
          }
        } catch (err) {
          console.warn("Failed to fetch recipient profile", err);
        }
      }

      // 4. Fetch templates to find the correct Header template
      const templates = await pdfTemplateService.fetchTemplates();
      const headerTemplate = templates.find(t => t.name.toLowerCase().includes("header")) || templates[0];

      if (!headerTemplate) {
        throw new Error("No PDF header template found in the system.");
      }

      // 5. Generate PDF using PdfEngine with the found template
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

        const checkSpace = async (needed: number) => {
          if (currentY + needed > 270) {
            doc.addPage();
            currentY = await PdfEngine.applyTemplate(doc, headerTemplate.name, company);
            currentY += 10;
          }
        };

        // Details
        const fields = [
          { label: "Date:", value: format(new Date(), "MMMM d, yyyy") },
          { label: "NTE No:", value: data.nteNo },
          { label: "To:", value: recipient?.name || data.userName },
          { label: "Position:", value: recipient?.position || "Staff / Personnel" },
          { label: "Department:", value: recipient?.department || "Operations Department" },
          { 
            label: "Subject:", 
            value: `Notice to Explain Regarding Document Adherence (${[...new Set(data.rows.map(r => r.docType))].join(", ")})` 
          },
        ];

        for (const field of fields) {
          await checkSpace(6);
          doc.setFont("times", "bold");
          doc.text(field.label, 20, currentY);
          doc.setFont("times", "normal");
          doc.text(String(field.value || ""), 50, currentY);
          currentY += 6;
        }

        currentY += 10;
        
        // "Dear [Name]," with bold name
        await checkSpace(10);
        doc.setFont("times", "normal");
        doc.text("Dear ", 20, currentY);
        doc.setFont("times", "bold");
        doc.text(`${data.userName},`, 20 + doc.getTextWidth("Dear "), currentY);
        currentY += 10;

        // Paragraph 1
        currentY = renderMixedLine([
          { text: "This Notice to Explain is issued to formally require you to submit your written explanation regarding the identified delay or non-compliance in the submission/processing of the following " },
          { text: `${data.rows.length} document(s)`, bold: true },
          { text: " under your responsibility:" }
        ], 20, currentY, 170);

        currentY += 5;

        // Paragraph 2
        const body2 = "Based on the internal audit of the Document Adherence system, the records below appear to be lacking, unremitted, or not properly accounted for within the required timeline:";
        const split2 = doc.splitTextToSize(body2, 170);
        await checkSpace(split2.length * 5 + 4);
        doc.text(split2, 20, currentY);
        currentY += split2.length * 5 + 4;

        // Table-like structure manually for maximum control
        await checkSpace(15);
        doc.setFont("times", "bold");
        doc.setFillColor(240, 240, 240);
        doc.rect(20, currentY, 170, 7, 'F');
        doc.text("Document Type", 25, currentY + 5);
        doc.text("Document Number", 80, currentY + 5);
        doc.text("Days Elapsed", 150, currentY + 5);
        currentY += 10;

        doc.setFont("times", "normal");
        for (const row of data.rows) {
          await checkSpace(8);
          doc.text(row.docType, 25, currentY);
          doc.text(row.docNo, 80, currentY);
          doc.text(`${row.daysElapsed} days`, 150, currentY);
          currentY += 6;
        }

        currentY += 10;

        // Final content blocks
        const finalContent = [
          async () => {
            currentY = renderMixedLine([
              { text: "Please submit your written explanation within " },
              { text: "three (3) business days", bold: true },
              { text: " from receipt of this notice. Failure to submit your explanation within the given period may be considered a waiver of your right to be heard, and the company may proceed with its evaluation based on available records." }
            ], 20, currentY, 170);
          },
          async () => {
            doc.setFont("times", "italic");
            const bodyText5 = `This Notice to Explain is not yet a disciplinary action. It is issued to give you an opportunity to explain your side before the company makes any final decision regarding the matter.`;
            const splitText5 = doc.splitTextToSize(bodyText5, 170);
            await checkSpace(splitText5.length * 5 + 6);
            doc.text(splitText5, 20, currentY);
            currentY += splitText5.length * 5 + 6;
          }
        ];

        for (const block of finalContent) {
          await block();
        }

        if (data.remarks) {
          const splitRemarks = doc.splitTextToSize(data.remarks, 170);
          await checkSpace(splitRemarks.length * 5 + 10);
          doc.setFont("times", "bold");
          doc.text("Additional Findings / Violation Details:", 20, currentY);
          currentY += 6;
          doc.setFont("times", "normal");
          doc.text(splitRemarks, 20, currentY);
          currentY += (splitRemarks.length * 5) + 10;
        }

        // Signature block
        await checkSpace(40);
        doc.setFont("times", "normal");
        doc.text("For your immediate compliance.", 20, currentY);
        currentY += 10;
        doc.text("Respectfully,", 20, currentY);
        currentY += 6;
        doc.setFont("times", "bold");
        doc.text("Prepared by:", 20, currentY);
        doc.line(20, currentY + 1, 60, currentY + 1);
        currentY += 8;
        doc.setFont("times", "normal");
        doc.text(`Name: ${auditor?.name || 'Audit Compliance Team'}`, 20, currentY);
        currentY += 5;
        doc.text(`Position: ${auditor?.position || 'Auditor'}`, 20, currentY);
        currentY += 5;
        doc.text(`Department: ${auditor?.department || 'Audit Department'}`, 20, currentY);
      });

      setGeneratedPdf(doc);
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error: unknown) {
      console.error("Error generating NTE preview:", error);
      toast.error("Failed to generate PDF preview");
    } finally {
      setIsGenerating(false);
    }
  }, [data, companyData, currentUser, recipientProfile]);

  useEffect(() => {
    if (isOpen) {
      generatePreview();
    }
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [isOpen, generatePreview, pdfUrl]);

  const handleSave = async () => {
    if (!generatedPdf || isSaving) return;
    
    setIsSaving(true);
    try {
      const fileBase64 = generatedPdf.output("datauristring").split(",")[1];
      
      const payload = {
        nte_no: data.nteNo,
        details: data.rows.map(r => ({
          doc_type: r.docType,
          doc_number: r.docNo,
          days_elapsed: r.daysElapsed,
          prepared_by: data.userName
        })),
        remarks: data.remarks,
        fileBase64,
        fileName: `${data.nteNo}_${data.userName.replace(/\s+/g, '_')}.pdf`
      };

      const res = await fetch('/api/arf/document-adherance/nte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.ok) {
        toast.success(`NTE issued successfully: ${json.data.nte_no}`);
        // Download locally too
        generatedPdf.save(`${json.data.nte_no}.pdf`);
        onSuccess?.();
        onClose();
      } else {
        throw new Error(json.message || "Failed to save NTE");
      }
    } catch (e: unknown) {
      console.error(e);
      toast.error((e as Error).message || "Failed to generate and save NTE");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose()}>
        <DialogContent 
          className="max-w-5xl h-[90vh] p-0 flex flex-col bg-slate-900 border-slate-700 shadow-2xl overflow-hidden"
        >
          <DialogHeader className="px-8 py-6 bg-white border-b flex flex-row items-center justify-between shrink-0">
            <div>
              <DialogTitle className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                Notice to Explain Preview
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Issuing to: {data?.userName} | {data?.rows.length} Document(s)
              </p>
            </div>
          </DialogHeader>

          <div className="flex-1 bg-slate-800 flex items-center justify-center overflow-hidden relative">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="text-slate-400 text-xs font-medium animate-pulse tracking-widest uppercase">Drafting Document...</p>
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
            <Button variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold uppercase tracking-wider text-[10px] px-6 h-11 border-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || isGenerating}
              className="rounded-xl font-black uppercase tracking-wider text-[10px] px-8 h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Generate & Issue NTE
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
