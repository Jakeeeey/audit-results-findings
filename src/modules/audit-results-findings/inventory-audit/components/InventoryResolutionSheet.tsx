"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, FileText, AlertCircle, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { InventoryAuditFinding, PhysicalInventoryDetail, Product, User, Branch, Supplier } from "../types";
import { inventoryAuditService } from "../services/inventoryAuditService";
import { cn } from "@/lib/utils";

interface InventoryResolutionSheetProps {
    audit: InventoryAuditFinding | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function InventoryResolutionSheet({ audit, open, onOpenChange, onSuccess }: InventoryResolutionSheetProps) {
    const [details, setDetails] = useState<PhysicalInventoryDetail[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const [status, setStatus] = useState<InventoryAuditFinding["status"]>("PENDING_REVIEW");
    const [remarks, setRemarks] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open && audit) {
            setStatus(audit.status);
            setRemarks(audit.remarks || "");
            
            setLoadingDetails(true);
            inventoryAuditService.getInventoryDetails(audit.id)
                .then(data => setDetails(data))
                .catch(err => console.error(err))
                .finally(() => setLoadingDetails(false));
        } else {
            setDetails([]);
        }
    }, [open, audit]);

    const handleSave = async () => {
        if (!audit) return;
        setSaving(true);
        try {
            const success = await inventoryAuditService.updateFindingStatus(audit.id, status, remarks);
            if (success) {
                onSuccess();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    if (!audit) return null;

    const auditorName = typeof audit.auditor_id === 'object' 
        ? `${(audit.auditor_id as User).user_fname} ${(audit.auditor_id as User).user_lname}` 
        : `User ID: ${audit.auditor_id}`;

    const branchName = typeof audit.branch === 'object'
        ? (audit.branch as Branch).branch_name
        : `Branch ID: ${audit.branch}`;

    const supplierName = typeof audit.supplier === 'object' && audit.supplier !== null
        ? (audit.supplier as Supplier).supplier_name || "UNKNOWN"
        : `Supplier ID: ${audit.supplier}`;

    let accountableName = "UNASSIGNED";
    if (typeof audit.branch === 'object' && audit.branch !== null) {
        const bh = (audit.branch as Branch).branch_head;
        if (typeof bh === 'object' && bh !== null) {
            accountableName = `${(bh as User).user_fname} ${(bh as User).user_lname}`;
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-2xl p-6 sm:p-8">
                <SheetHeader className="pb-6 border-b shrink-0">
                    <div className="flex items-center justify-between pr-8">
                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border-amber-200">
                            {audit.doc_no}
                        </Badge>
                        <Badge variant={audit.status === "PENDING_REVIEW" ? "destructive" : "default"} className="text-[10px] font-black uppercase">
                            {audit.status.replace(/_/g, ' ')}
                        </Badge>
                    </div>
                    <SheetTitle className="text-2xl font-black uppercase tracking-tight mt-2 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-primary" />
                        Inventory Audit Details
                    </SheetTitle>
                    <SheetDescription className="text-xs font-bold uppercase text-muted-foreground">
                        Audited on {format(new Date(audit.date_created), "MMM dd, yyyy")}
                    </SheetDescription>
                </SheetHeader>

                <div className="py-6 space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {/* Header Info */}
                    <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border">
                        <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Auditor</Label>
                            <p className="text-sm font-bold uppercase">{auditorName}</p>
                        </div>
                        <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Accountable / Branch Head</Label>
                            <p className="text-sm font-bold uppercase">{accountableName}</p>
                        </div>
                        <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Branch</Label>
                            <p className="text-sm font-bold uppercase">{branchName}</p>
                        </div>
                        <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Supplier</Label>
                            <p className="text-sm font-bold uppercase">{supplierName}</p>
                        </div>
                        <div className="col-span-2 bg-destructive/10 p-3 rounded-lg flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2 text-destructive">
                                <TrendingDown className="w-5 h-5" />
                                <span className="text-xs font-black uppercase tracking-widest">Net Variance Amount</span>
                            </div>
                            <span className="text-lg font-black text-destructive">
                                ₱ {Math.abs(audit.total_shortage).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Variance Table */}
                    <div>
                        <Label className="text-xs font-black uppercase tracking-widest text-foreground mb-3 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            Product Variances
                        </Label>
                        
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-black uppercase">Product Code</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-right">System</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-right">Physical</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-right">Variance</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingDetails ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8">
                                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : details.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                                                No inventory details found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        details.map((d) => (
                                            <TableRow key={d.id}>
                                                <TableCell className="font-medium text-xs">
                                                    {typeof d.product_id === 'object' && d.product_id !== null
                                                        ? ((d.product_id as Product).product_code || <span className="text-muted-foreground italic">Unknown</span>) 
                                                        : (d.product_id || <span className="text-muted-foreground italic">Unknown</span>)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs">{d.system_count}</TableCell>
                                                <TableCell className={cn("text-right text-xs font-bold", d.variance < 0 ? "text-destructive" : d.variance > 0 ? "text-emerald-600" : "")}>{d.physical_count}</TableCell>
                                                <TableCell className={cn("text-right text-xs font-black", d.variance < 0 ? "text-destructive" : d.variance > 0 ? "text-emerald-600" : "")}>
                                                    {d.variance > 0 ? "+" : ""}{d.variance}
                                                </TableCell>
                                                <TableCell className={cn("text-right text-xs font-bold", d.difference_cost < 0 ? "text-destructive" : d.difference_cost > 0 ? "text-emerald-600" : "")}>
                                                    {d.difference_cost < 0 ? "-₱ " : d.difference_cost > 0 ? "+₱ " : "₱ "}{Math.abs(d.difference_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Resolution Form */}
                    <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resolution Status</Label>
                            <Select value={status} onValueChange={(val: InventoryAuditFinding["status"]) => setStatus(val)}>
                                <SelectTrigger className="w-full font-bold text-xs h-10">
                                    <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PENDING_REVIEW" className="text-xs font-bold">Pending Review</SelectItem>
                                    <SelectItem value="APPROVED_FOR_DEDUCTION" className="text-xs font-bold">Approved for Deduction</SelectItem>
                                    <SelectItem value="SETTLED_CASH" className="text-xs font-bold">Settled (Cash)</SelectItem>
                                    <SelectItem value="DEDUCTED_PAYROLL" className="text-xs font-bold">Deducted (Payroll)</SelectItem>
                                    <SelectItem value="ADJUSTED" className="text-xs font-bold">Adjusted / Written-off</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Remarks / Resolution Notes</Label>
                            <Textarea 
                                placeholder="Enter details about the resolution..."
                                className="min-h-[100px] text-xs resize-none"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t mt-auto shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs font-bold uppercase tracking-wider" disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="text-xs font-black uppercase tracking-wider">
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Resolution
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
