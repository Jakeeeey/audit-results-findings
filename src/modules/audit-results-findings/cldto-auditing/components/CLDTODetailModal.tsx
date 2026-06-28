/* eslint-disable */
"use client";

import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchProvider } from "../providers/fetchProvider";
import { ConsolidatorRecord, ConsolidatorDetailRecord, ConsolidatorDispatchRecord } from "../types";
import { toast } from "sonner";
import { FileText, Package, Truck, ChevronDown, ChevronRight, FileOutput, Printer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TracingReportPreviewModal } from "../../traceability-compliance/components/TracingReportPreviewModal";
import { generateCLDTOHtml } from "../utils/generateCLDTOHtml";

interface CLDTODetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  consolidatorId: number;
}

export function CLDTODetailModal({ isOpen, onClose, consolidatorId }: CLDTODetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [consolidator, setConsolidator] = useState<ConsolidatorRecord | null>(null);
  const [details, setDetails] = useState<ConsolidatorDetailRecord[]>([]);
  const [dispatches, setDispatches] = useState<ConsolidatorDispatchRecord[]>([]);
  const [postDispatchPlans, setPostDispatchPlans] = useState<any[]>([]);
  
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [expandedDispatch, setExpandedDispatch] = useState<number | string | null>(null);
  const [expandedSO, setExpandedSO] = useState<number | string | null>(null);

  useEffect(() => {
    if (isOpen && consolidatorId) {
      setLoading(true);
      fetchProvider.getConsolidatorDetails(consolidatorId)
        .then(data => {
          setConsolidator(data.consolidator);
          setDetails(data.details);
          setDispatches(data.dispatches);
          setPostDispatchPlans(data.postDispatchPlans || []);
        })
        .catch(err => {
          console.error(err);
          toast.error("Failed to load consolidator details");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, consolidatorId]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[90vw] lg:max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-border">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30">
          <DialogTitle className="flex items-center gap-3">
            <DialogDescription className="hidden">Details</DialogDescription>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-xl font-black uppercase tracking-tighter">
                {consolidator ? consolidator.consolidator_no : "Loading..."}
              </div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Consolidator Details
              </div>
            </div>
            
            {consolidator && (
              <div className="ml-auto flex items-center gap-3">
                <Badge variant="outline" className="font-black uppercase tracking-widest text-[10px]">
                  {consolidator.status}
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 rounded-xl font-bold uppercase tracking-widest text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    const html = generateCLDTOHtml({ consolidator, details, dispatches });
                    setPreviewHtml(html);
                    setIsPreviewOpen(true);
                  }}
                >
                  <Printer className="w-3.5 h-3.5 mr-2" />
                  Print
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-[300px] w-full rounded-xl" />
            </div>
          ) : (
            <Tabs defaultValue="products" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50">
                <TabsTrigger value="products" className="font-black uppercase text-xs tracking-widest gap-2">
                  <Package className="w-4 h-4" /> Consolidated Products
                </TabsTrigger>
                <TabsTrigger value="pdp" className="font-black uppercase text-xs tracking-widest gap-2">
                  <Truck className="w-4 h-4" /> Pre Dispatch Plan (PDP)
                </TabsTrigger>
                <TabsTrigger value="post-dp" className="font-black uppercase text-xs tracking-widest gap-2">
                  <FileText className="w-4 h-4" /> Post Dispatch Plan
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="products" className="m-0 border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 border-b border-border">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Product Code</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Product Name</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right h-10">Ordered</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right h-10">Picked</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right h-10">Applied</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right h-10">Variance</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right h-10">Accuracy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-50">
                            No products found
                          </TableCell>
                        </TableRow>
                      ) : (
                        details.map(item => (
                          <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono text-xs font-bold text-muted-foreground">
                              {item.product?.product_code || "---"}
                            </TableCell>
                            <TableCell className="font-black text-sm uppercase">
                              {item.product?.product_name || `Product ID: ${item.product_id}`}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-bold text-muted-foreground">
                              {item.ordered_quantity || 0}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-bold text-primary">
                              {item.picked_quantity || 0}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-bold text-emerald-600">
                              {item.applied_quantity || 0}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-bold">
                              {(() => {
                                const picked = item.picked_quantity || 0;
                                const applied = item.applied_quantity || 0;
                                const variance = applied - picked;
                                return (
                                  <span className={variance < 0 ? "text-rose-500" : variance > 0 ? "text-amber-500" : "text-emerald-500"}>
                                    {variance > 0 ? "+" : ""}{variance}
                                  </span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-black">
                              {(() => {
                                const picked = item.picked_quantity || 0;
                                const applied = item.applied_quantity || 0;
                                if (applied === 0) return "---";
                                const pct = (picked / applied) * 100;
                                return (
                                  <span className={pct < 100 ? "text-rose-500" : pct > 100 ? "text-amber-500" : "text-emerald-500"}>
                                    {pct.toFixed(1)}%
                                  </span>
                                );
                              })()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="post-dp" className="m-0 border border-border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50 border-b border-border">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Doc No</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Status</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postDispatchPlans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-50">
                          No Post Dispatch Plans found
                        </TableCell>
                      </TableRow>
                    ) : (
                      postDispatchPlans.map((pdp: any) => (
                        <TableRow key={pdp.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-black text-sm uppercase text-primary tracking-tighter">
                            {pdp.doc_no}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[9px] uppercase tracking-widest">{pdp.status || 'Unknown'}</Badge>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-muted-foreground uppercase">
                            {pdp.date_encoded ? format(new Date(pdp.date_encoded), "MMM dd, yyyy HH:mm") : "---"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="pdp" className="m-0 border border-border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50 border-b border-border">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">PDP No</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-8 text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-50">
                          No PDP found
                        </TableCell>
                      </TableRow>
                    ) : (
                      dispatches.map(dispatch => (
                        <React.Fragment key={dispatch.id}>
                          <TableRow 
                            className="hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => setExpandedDispatch(expandedDispatch === dispatch.id ? null : dispatch.id)}
                          >
                            <TableCell className="font-black text-sm uppercase text-primary tracking-tighter flex items-center gap-2">
                              {expandedDispatch === dispatch.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              {dispatch.dispatch_no}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-muted-foreground uppercase">
                              {dispatch.created_at ? format(new Date(dispatch.created_at), "MMM dd, yyyy HH:mm") : "---"}
                            </TableCell>
                          </TableRow>
                          {expandedDispatch === dispatch.id && dispatch.dispatch_plan_details && (
                            <TableRow className="bg-muted/10">
                              <TableCell colSpan={2} className="p-0 border-b border-border">
                                <div className="pl-12 pr-6 py-4">
                                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Linked Sales Orders</div>
                                  <div className="flex flex-col gap-2">
                                    {dispatch.dispatch_plan_details.length > 0 ? (
                                      dispatch.dispatch_plan_details.map((so, idx) => (
                                        <div key={idx} className="flex flex-col border border-border rounded-lg bg-background overflow-hidden">
                                          <div 
                                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                                            onClick={() => setExpandedSO(expandedSO === so.sales_order_id ? null : so.sales_order_id)}
                                          >
                                            <div className="flex items-center gap-3">
                                              {expandedSO === so.sales_order_id ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-primary" />}
                                              <FileOutput className="w-4 h-4 text-primary/60" />
                                              <span className="font-bold text-sm text-foreground">{so.order_no}</span>
                                            </div>
                                            <Badge variant="secondary" className="text-[9px] uppercase tracking-widest">{so.status}</Badge>
                                          </div>
                                            {expandedSO === so.sales_order_id && (
                                              <div className="bg-muted/5 border-t border-border p-4 flex flex-col gap-4">
                                                {so.invoices && so.invoices.length > 0 && (
                                                  <div className="flex flex-col gap-3">
                                                    {so.invoices.map((inv: any, iIdx: number) => (
                                                      <div key={iIdx} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg shadow-sm">
                                                        <div className="flex flex-col">
                                                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sales Invoice</span>
                                                          <span className="font-bold text-sm text-primary">{inv.invoice_no}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                          {inv.total_amount !== undefined && (
                                                            <div className="flex flex-col text-right">
                                                              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount</span>
                                                              <span className="font-mono text-sm font-bold">â‚±{Number(inv.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                          )}
                                                          {inv.pdf_file && (
                                                            <Button 
                                                              size="sm" 
                                                              variant="outline" 
                                                              className="h-8 text-xs font-bold"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                window.open(`${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${inv.pdf_file}`, "_blank");
                                                              }}
                                                            >
                                                              <FileText className="w-3.5 h-3.5 mr-2" />
                                                              View Attachment
                                                            </Button>
                                                          )}
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                                {so.details && so.details.length > 0 && (
                                                  <div className="border border-border rounded-lg overflow-hidden bg-background">
                                                    <Table>
                                                      <TableHeader className="bg-muted/20 border-b border-border">
                                                  <TableRow className="hover:bg-transparent">
                                                    <TableHead className="text-[9px] font-black uppercase h-8 pl-4">Product</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase text-right h-8">Ordered</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase text-right h-8">Allocated</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase text-right h-8 pr-4">Served</TableHead>
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  {so.details.map((detail, dIdx) => (
                                                    <TableRow key={dIdx} className="hover:bg-muted/30 border-b border-border/50">
                                                      <TableCell className="py-2 pl-4">
                                                        <div className="flex flex-col">
                                                          <span className="font-bold text-xs uppercase">{detail.product_name}</span>
                                                          <span className="text-[10px] text-muted-foreground font-mono">{detail.product_code}</span>
                                                        </div>
                                                      </TableCell>
                                                      <TableCell className="text-right py-2 font-mono text-xs font-medium">{detail.ordered_quantity}</TableCell>
                                                      <TableCell className="text-right py-2 font-mono text-xs font-bold text-amber-600">{detail.allocated_quantity}</TableCell>
                                                      <TableCell className="text-right py-2 pr-4 font-mono text-xs font-bold text-emerald-600">{detail.served_quantity}</TableCell>
                                                    </TableRow>
                                                  ))}
                                                  </TableBody>
                                                </Table>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))
                                    ) : (
                                      <div className="text-xs text-muted-foreground italic">No Sales Orders found for this Dispatch.</div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <TracingReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        html={previewHtml || ""}
        title="CLDTO Details Report"
        subtitle={consolidator?.consolidator_no || "CLDTO Auditing"}
    />
    </>
  );
}

