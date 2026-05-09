"use client";

import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save, X, Receipt, Hash } from "lucide-react";
import { toast } from "sonner";
import { ChartOfAccount, Supplier, SalesReturnRecord } from "../types";

interface DiscrepancyMemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  invoiceNo: string;
  user?: { id: number | string; [key: string]: unknown };
}

export function DiscrepancyMemoModal({ isOpen, onClose, onSuccess, invoiceNo, user }: DiscrepancyMemoModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<{
    salesReturns: SalesReturnRecord[];
    suppliers: Supplier[];
    coas: ChartOfAccount[];
    customer: { id: number; customer_name: string; [key: string]: unknown } | null;
    salesmanId: number | string | null;
    existingMemo?: { 
      memo_number?: string; 
      supplier_id?: { id: number } | number; 
      amount?: number; 
      chart_of_account?: { coa_id: number } | number;
      reason?: string;
    } | null;
    invoiceDetails?: { invoice_no: string; [key: string]: unknown } | null;
    resolvedSupplier?: { id: number; supplier_name: string; [key: string]: unknown } | null;
    generatedMemoNo?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    memoNumber: "",
    supplierId: "",
    amount: "0",
    coaId: "",
    reason: ""
  });

  const [displayCustomer, setDisplayCustomer] = useState<string>("---");
  const [displaySupplier, setDisplaySupplier] = useState<string>("---");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedSRAmount, setSelectedSRAmount] = useState<number>(0);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/arf/post-delivery-audit?action=memo-data&invoiceNo=${invoiceNo}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      
      const payload = json.data;
      setData(payload);
      
      if (payload.existingMemo) {
        setFormData({
          memoNumber: payload.existingMemo.memo_number || "",
          supplierId: payload.existingMemo.supplier_id?.id?.toString() || payload.existingMemo.supplier_id?.toString() || "",
          amount: payload.existingMemo.amount?.toString() || "0",
          coaId: payload.existingMemo.chart_of_account?.coa_id?.toString() || payload.existingMemo.chart_of_account?.toString() || "",
          reason: payload.existingMemo.reason || "Discrepancy Memo from Audit Console"
        });
        setDisplayCustomer(payload.customer?.customer_name || "---");
        setDisplaySupplier(payload.resolvedSupplier?.supplier_name || "---");
      } else {
        setFormData({
          memoNumber: "",
          supplierId: "",
          amount: "0",
          coaId: "",
          reason: "Discrepancy Memo from Audit Console"
        });
        setDisplayCustomer("---");
        setDisplaySupplier("---");
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to load memo data");
    } finally {
      setLoading(false);
    }
  }, [invoiceNo]);

  useEffect(() => {
    if (isOpen && invoiceNo) {
      loadData();
    }
  }, [isOpen, invoiceNo, loadData]);

  const handleSave = async () => {
    if (!formData.memoNumber) return toast.error("Please enter Customer Memo No");
    if (!formData.supplierId) return toast.error("Please select a Supplier");
    if (!formData.coaId) return toast.error("Please select a Chart of Account");

    setSaving(true);
    try {
      const res = await fetch("/api/arf/post-delivery-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-memo", 
          ...formData,
          amount: Number(formData.amount),
          customerId: data?.customer?.id || data?.customer,
          salesmanId: data?.salesmanId,
          invoiceNo: invoiceNo,
          userId: user?.id 
        })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      
      toast.success("Discrepancy Memo saved successfully");
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to save memo");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectSR = (sr: SalesReturnRecord & { supplier_id?: { id: number } | number }) => {
    const supplierId = (typeof sr.supplier_id === 'object' ? sr.supplier_id?.id : sr.supplier_id) || data?.resolvedSupplier?.id;
    const supplierName = data?.suppliers.find(s => s.id === supplierId)?.supplier_name || data?.resolvedSupplier?.supplier_name || "N/A";
    
    const resolvedMemoNo = data?.existingMemo?.memo_number || data?.generatedMemoNo || "";
    
    setFormData({
      ...formData,
      memoNumber: resolvedMemoNo, 
      supplierId: supplierId?.toString() || formData.supplierId,
      amount: sr.total_amount?.toString() || "0"
    });
    
    const custName = data?.customer?.customer_name || "N/A";
    setDisplayCustomer(custName);
    setDisplaySupplier(supplierName);
    setSelectedSRAmount(Number(sr.total_amount) || 0);
    
    toast.info(`Populated from ${sr.return_number}`);
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-card border-border shadow-2xl p-0 overflow-hidden flex flex-col h-[600px]">
        <DialogHeader className="p-4 bg-muted/30 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-primary">
            <Receipt className="w-5 h-5" />
            Discrepancy Memo Console
          </DialogTitle>
          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
            Invoice Context: <span className="text-foreground">{invoiceNo}</span>
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
              Syncing relational ledger...
            </p>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            <div className="w-64 border-r border-border bg-muted/10 flex flex-col">
              <div className="p-3 bg-primary text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-between">
                <span>Sales Returns</span>
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px]">{data?.salesReturns.length}</span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-0">
                  {data?.salesReturns.map((sr) => (
                    <div 
                      key={sr.return_id} 
                      className="p-4 border-b border-border/50 hover:bg-muted/30 transition-all group cursor-pointer active:scale-95"
                      onClick={() => handleSelectSR(sr as SalesReturnRecord)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-foreground uppercase tracking-tight group-hover:text-primary">{sr.return_number}</span>
                        <span className="text-[10px] font-bold text-emerald-600">₱{Number(sr.total_amount).toLocaleString()}</span>
                      </div>
                      <div className="text-[8px] font-bold text-muted-foreground uppercase mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to pre-fill form
                      </div>
                    </div>
                  ))}
                  {data?.salesReturns.length === 0 && (
                    <div className="p-10 text-center text-[10px] font-bold text-muted-foreground uppercase opacity-30 italic">
                      Empty Ledger
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <ScrollArea className="flex-1 bg-background">
              <div className="p-8">
                <div className="max-w-md mx-auto space-y-6 pb-8">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Customer Memo No</Label>
                    <Input 
                      value={formData.memoNumber}
                      onChange={(e) => setFormData({ ...formData, memoNumber: e.target.value })}
                      placeholder="e.g. SKN-89"
                      className="h-12 text-sm font-black uppercase tracking-tight bg-background border-border rounded-xl focus:ring-primary/20 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Customer</Label>
                    <div className="h-12 px-4 flex items-center bg-muted/20 border border-border rounded-xl text-sm font-black text-foreground/80 uppercase truncate shadow-inner">
                      {displayCustomer}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Supplier</Label>
                    <div className="h-12 px-4 flex items-center bg-muted/20 border border-border rounded-xl text-sm font-black text-foreground/80 uppercase truncate shadow-inner">
                      {displaySupplier}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                      Amount of SR - <span className="text-emerald-600">₱{selectedSRAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground opacity-30">₱</span>
                      <Input 
                        type="number"
                        value={formData.amount}
                        onChange={(e) => {
                          const input = e.target.value;
                          const val = Number(input);
                          if (val > selectedSRAmount && selectedSRAmount > 0) {
                            setFormData({ ...formData, amount: selectedSRAmount.toString() });
                            toast.warning(`Amount cannot exceed the selected Return value (₱${selectedSRAmount.toLocaleString()})`);
                          } else if (val < 0) {
                            setFormData({ ...formData, amount: "0" });
                          } else {
                            setFormData({ ...formData, amount: input });
                          }
                        }}
                        className="h-12 pl-8 text-sm font-black bg-background border-border rounded-xl text-emerald-600 shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Chart Of Account</Label>
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="h-12 w-full justify-between text-sm font-black uppercase bg-background rounded-xl border-border shadow-sm px-4"
                        >
                          <span className="truncate">
                            {formData.coaId 
                              ? data?.coas.find((c) => c.coa_id.toString() === formData.coaId)?.account_title 
                              : "Select Account"}
                          </span>
                          <Hash className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                    <PopoverContent align="start" sideOffset={4} className="w-[var(--radix-popover-trigger-width)] p-0 bg-card border border-border shadow-2xl rounded-xl z-[9999] overflow-hidden">
                      <div className="flex flex-col bg-transparent">
                        <div className="p-3 border-b border-border bg-muted/5 flex items-center gap-2">
                          <Hash className="w-4 h-4 text-muted-foreground opacity-50" />
                          <input 
                            placeholder="Search account title..." 
                            className="bg-transparent border-none outline-none text-[11px] font-bold uppercase w-full placeholder:text-muted-foreground/50"
                            onChange={(e) => {
                              const val = e.target.value.toLowerCase();
                              const items = document.querySelectorAll('.coa-item');
                              items.forEach((item) => {
                                const htmlItem = item as HTMLElement;
                                const text = htmlItem.innerText.toLowerCase();
                                if (text.includes(val)) {
                                  htmlItem.style.display = 'block';
                                } else {
                                  htmlItem.style.display = 'none';
                                }
                              });
                            }}
                          />
                        </div>
                        <div className="h-[250px] w-full overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40" onWheel={(e) => e.stopPropagation()}>
                          <div className="p-1">
                            {data?.coas.map((c) => (
                              <div
                                key={c.coa_id}
                                onClick={() => {
                                  setFormData({ ...formData, coaId: c.coa_id.toString() });
                                  setPopoverOpen(false);
                                }}
                                className="coa-item text-[11px] font-black uppercase py-3 px-4 cursor-pointer hover:bg-muted rounded-lg transition-colors flex items-center justify-between group"
                              >
                                <span>{c.account_title}</span>
                                <Receipt className="w-3 h-3 opacity-0 group-hover:opacity-20 transition-opacity" />
                              </div>
                            ))}
                            {data?.coas.length === 0 && (
                              <div className="p-4 text-[10px] font-bold text-muted-foreground uppercase text-center italic">
                                No accounts found
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="p-6 bg-muted/30 border-t border-border flex gap-3 shrink-0">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="flex-1 rounded-xl px-8 h-12 text-[10px] font-black uppercase tracking-widest border-border hover:bg-muted"
          >
            <X className="w-3.5 h-3.5 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={
              saving || 
              loading || 
              !formData.memoNumber || 
              !formData.supplierId || 
              !formData.coaId || 
              Number(formData.amount) <= 0
            }
            className="flex-1 rounded-xl px-10 h-12 text-[10px] font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Memo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
