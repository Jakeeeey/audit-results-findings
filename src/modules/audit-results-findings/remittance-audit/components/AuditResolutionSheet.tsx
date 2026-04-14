"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, ShieldAlert, AlertTriangle, ArrowRightCircle, Banknote, Receipt, CheckCircle2, Printer, Store, FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

import { RemittanceAuditFinding, Salesman, User} from "../types";
import { useRemittanceAudit } from "../hooks/useRemittanceAudit";

interface AuditResolutionSheetProps {
    audit: RemittanceAuditFinding | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

// 🚀 BULLETPROOF HELPER: Extracts Invoice and Customer data safely!
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getContextData = (colDetail: any) => {
    let invNo = null;
    let custName = null;

    // 1. Try to get it from the Invoice FIRST (Priority!)
    if (colDetail?.invoice_id) {
        if (typeof colDetail.invoice_id === 'object') {
            invNo = colDetail.invoice_id.invoice_no;
            const cust = colDetail.invoice_id.customer_code;
            if (cust && typeof cust === 'object') {
                custName = cust.store_name && cust.store_name !== '0' ? cust.store_name : cust.customer_name;
            } else if (cust) {
                custName = String(cust);
            }
        } else {
            invNo = `INV-ID: ${colDetail.invoice_id}`;
        }
    }

    // 2. Fallback: If no customer found on invoice, check the collection detail directly
    if (!custName && colDetail?.customer_code) {
        if (typeof colDetail.customer_code === 'object') {
            custName = colDetail.customer_code.store_name && colDetail.customer_code.store_name !== '0'
                ? colDetail.customer_code.store_name
                : colDetail.customer_code.customer_name;
        } else {
            custName = String(colDetail.customer_code);
        }
    }

    return {
        invNo: invNo || null,
        custName: custName || null
    };
};

export function AuditResolutionSheet({ audit, open, onOpenChange, onSuccess }: AuditResolutionSheetProps) {
    const { details, loadingDetails, fetchDetails, updateStatus } = useRemittanceAudit();

    const [isSaving, setIsSaving] = useState(false);
    const [newStatus, setNewStatus] = useState<string>("");
    const [settlementMethod, setSettlementMethod] = useState<string>("");

    useEffect(() => {
        if (audit && open) {
            setTimeout(() => setNewStatus(audit.status), 0);
            setTimeout(() => setSettlementMethod(audit.settlement_method || ""), 0);
            fetchDetails(audit.id);
        }
    }, [audit, open, fetchDetails]);

    const handleResolve = async () => {
        if (!audit) return;
        setIsSaving(true);

        const payload: Partial<RemittanceAuditFinding> = {
            status: newStatus as RemittanceAuditFinding['status']
        };

// 🚀 FLAWLESS RESOLUTION LOGIC
        if (newStatus === "APPROVED_FOR_DEDUCTION") {
            if (!settlementMethod) {
                toast.error("Please select a recovery method.");
                setIsSaving(false);
                return;
            }
            payload.settlement_method = settlementMethod as 'CASH' | 'PAYROLL_DEDUCTION';

        } else if (newStatus === "SETTLED_CASH") {
            payload.settlement_method = "CASH";
            payload.amount_settled = audit.amount;

        } else if (newStatus === "DEDUCTED_PAYROLL") {
            payload.settlement_method = "PAYROLL_DEDUCTION";
            payload.amount_settled = audit.amount;
        }
        const success = await updateStatus(audit.id, payload);
        setIsSaving(false);

        if (success) onSuccess();
    };

    const handlePrintReport = () => {
        if (!audit) return;

        const auditeeName = typeof audit.auditee_id === 'object' && audit.auditee_id !== null ? (audit.auditee_id as Salesman).salesman_name : `ID: ${audit.auditee_id}`;
        const auditorName = typeof audit.auditor_id === 'object' && audit.auditor_id !== null ? `${(audit.auditor_id as User).user_fname} ${(audit.auditor_id as User).user_lname}` : "System Generated";

        const doc = new jsPDF();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("NOTICE OF AUDIT FINDING", 14, 20);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Document No: ${audit.doc_no}`, 14, 30);
        doc.text(`Auditee (Salesman): ${auditeeName}`, 14, 36);
        doc.text(`Date Flagged: ${format(new Date(audit.date_created), "MMMM dd, yyyy")}`, 14, 42);
        doc.text(`Auditor: ${auditorName}`, 14, 48);
        doc.text(`Current Status: ${audit.status.replace(/_/g, ' ')}`, 14, 54);

        const tableData = details.map(d => {
            const cd = d.collection_detail_id;
            const findingName = typeof cd?.finding === 'object' && cd.finding !== null ? cd.finding.finding_name : "Cash Shortage";

            // 🚀 Extract Invoice and Customer using our helper
            const { invNo, custName } = getContextData(cd);

            return [
                findingName,
                custName || "N/A",
                invNo || "N/A",
                cd?.remarks || "None",
                `Php ${cd?.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            ];
        });

        autoTable(doc, {
            startY: 62,
            headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { fontSize: 8 },
            head: [['Finding Type', 'Customer/Store', 'Invoice No.', 'Remarks/Ref', 'Amount']],
            body: tableData,
            foot: [['', '', '', 'TOTAL SHORTAGE:', `Php ${audit.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`]],
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalY = (doc as any).lastAutoTable.finalY || 62;
        doc.setFont("helvetica", "bold");
        doc.text("RESOLUTION DIRECTIVE:", 14, finalY + 15);
        doc.setFont("helvetica", "normal");

        let directiveText = "This finding is currently pending review by management.";
        if (audit.status === "APPROVED_FOR_DEDUCTION") {
            directiveText = `This shortage is approved to be recovered via ${audit.settlement_method?.replace('_', ' ')}.`;
        } else if (audit.status.includes("SETTLED")) {
            directiveText = `This shortage has been fully resolved and settled via ${audit.settlement_method?.replace('_', ' ')}.`;
        }

        doc.text(directiveText, 14, finalY + 22);

        doc.text("_____________________________", 14, finalY + 50);
        doc.text("Employee Signature over Printed Name", 14, finalY + 56);

        window.open(doc.output('bloburl'), '_blank');
    };

    if (!audit) return null;

    const auditeeName = typeof audit.auditee_id === 'object' && audit.auditee_id !== null ? (audit.auditee_id as Salesman).salesman_name : `ID: ${audit.auditee_id}`;
    const auditorName = typeof audit.auditor_id === 'object' && audit.auditor_id !== null ? `${(audit.auditor_id as User).user_fname} ${(audit.auditor_id as User).user_lname}` : "System Auto-Generated";

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[550px] w-full p-0 flex flex-col bg-background border-l border-border">
                <SheetHeader className="p-6 border-b bg-destructive/5 relative">
                    <Button
                        variant="outline"
                        size="icon"
                        className="absolute right-6 top-6 h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={handlePrintReport}
                        title="Print Formal Audit Notice"
                    >
                        <Printer className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 pr-8">
                            <SheetTitle className="text-xl font-black uppercase text-foreground leading-none truncate">Resolution Protocol</SheetTitle>
                            <SheetDescription className="flex items-center gap-2 mt-2">
                                <Badge variant="destructive" className="text-[10px] uppercase font-black shrink-0 shadow-none">{audit.doc_no}</Badge>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase truncate">Target: {auditeeName}</span>
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-6 bg-muted/10 custom-scrollbar space-y-6">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                <AlertTriangle className="w-3 h-3 text-amber-500" /> Detected Shortages
                            </h3>
                            <span className="text-sm font-black text-destructive">
                                Total: ₱ {audit.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>

                        {loadingDetails ? (
                            <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground opacity-50" /></div>
                        ) : (
                            <div className="space-y-2">
                                {details.map(d => {
                                    const colDetail = d.collection_detail_id;
                                    const findingObj = colDetail?.finding;
                                    const findingName = typeof findingObj === 'object' && findingObj !== null ? findingObj.finding_name : "Unexplained Cash Shortage";

                                    // 🚀 Extract Invoice and Customer using our helper
                                    const { invNo, custName } = getContextData(colDetail);

                                    return (
                                        <Card key={d.id} className="shadow-sm border-destructive/20">
                                            <CardContent className="p-3 flex flex-col gap-2 bg-destructive/5">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black uppercase text-foreground">{findingName}</span>
                                                        <span className="text-[10px] text-muted-foreground font-bold truncate max-w-[250px]">{colDetail?.remarks || "Auto-detected by system"}</span>
                                                    </div>
                                                    <span className="text-xs font-black text-destructive shrink-0">₱ {colDetail?.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>

                                                {/* 🚀 Context Badges */}
                                                {(invNo || custName) && (
                                                    <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-destructive/10">
                                                        {custName && (
                                                            <span className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                                                                <Store className="w-3 h-3 opacity-60" /> {custName}
                                                            </span>
                                                        )}
                                                        {invNo && (
                                                            <span className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                                                                <FileText className="w-3 h-3 opacity-60" /> INV: {invNo}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                            <ArrowRightCircle className="w-3 h-3 text-primary" /> Resolution Actions
                        </h3>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted-foreground">Change Status To:</label>
                            <Select value={newStatus} onValueChange={setNewStatus}>
                                <SelectTrigger className="font-black uppercase h-12 bg-background border-primary/20">
                                    <SelectValue placeholder="Select Action" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
                                    <SelectItem value="APPROVED_FOR_DEDUCTION" className="text-blue-600 font-bold">Approve for Deduction</SelectItem>
                                    <SelectItem value="SETTLED_CASH" className="text-emerald-600 font-bold">Mark as Settled (Cash Paid)</SelectItem>
                                    <SelectItem value="DEDUCTED_PAYROLL" className="text-slate-600 font-bold">Mark as Deducted (Payroll)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {(newStatus === "APPROVED_FOR_DEDUCTION" || newStatus.includes("SETTLED")) && (
                            <div className="space-y-2 animate-in slide-in-from-top-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">Select Recovery Method:</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button type="button" variant="outline" className={`h-16 flex flex-col items-center justify-center gap-1 border-2 transition-all ${settlementMethod === "CASH" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border hover:bg-muted"}`} onClick={() => setSettlementMethod("CASH")}>
                                        <Banknote className="w-5 h-5" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Cash Recovery</span>
                                    </Button>
                                    <Button type="button" variant="outline" className={`h-16 flex flex-col items-center justify-center gap-1 border-2 transition-all ${settlementMethod === "PAYROLL_DEDUCTION" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-border hover:bg-muted"}`} onClick={() => setSettlementMethod("PAYROLL_DEDUCTION")}>
                                        <Receipt className="w-5 h-5" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Payroll Deduction</span>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t bg-card shrink-0">
                    <Button className="w-full h-12 font-black uppercase tracking-widest shadow-md" onClick={handleResolve} disabled={isSaving || (audit.status === newStatus && audit.settlement_method === settlementMethod)}>
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        {isSaving ? "Processing..." : "Commit Resolution"}
                    </Button>
                    <p className="text-center text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-3">
                        Auditor ID Reference: {auditorName}
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
}