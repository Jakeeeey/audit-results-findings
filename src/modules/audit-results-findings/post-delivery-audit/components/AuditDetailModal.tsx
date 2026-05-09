import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Undo2, 
  Save, 
  RefreshCcw,
  Receipt,
  Wallet,
  ArrowRightLeft,
  PlusCircle,
  FileWarning,
  MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { NTEPreviewModal } from "./NTEPreviewModal";
import { DiscrepancyMemoModal } from "./DiscrepancyMemoModal";
import { fetchProvider } from "../providers/fetchProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AuditDetailRecord, AuditPlanInfo } from "../types";


interface AuditDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: number;
  dispatchNo: string;
  user?: { id: number | string; name?: string; position?: string; [key: string]: unknown };
  onSuccess?: (updatedDetails: AuditDetailRecord[]) => void;
}

export function AuditDetailModal({
  isOpen,
  onClose,
  planId,
  dispatchNo,
  user,
  onSuccess,
}: AuditDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<AuditDetailRecord[]>([]);
  const [planInfo, setPlanInfo] = useState<AuditPlanInfo | null>(null);
  const [originalDetails, setOriginalDetails] = useState<AuditDetailRecord[]>([]);
  const [userProfile, setUserProfile] = useState<{ user_id: number; user_fname?: string; user_lname?: string; user_position?: string; departmentName?: string; user_department?: string; department?: string; [key: string]: unknown } | null>(null);
  const [previewNTE, setPreviewNTE] = useState<{
    isOpen: boolean;
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
    } | null;
  }>({
    isOpen: false,
    data: null,
  });
  const [memoModal, setMemoModal] = useState<{ isOpen: boolean, invoiceNo: string }>({ isOpen: false, invoiceNo: "" });

  const loadUserProfile = React.useCallback(async (id: number | string) => {
    try {
      const profile = await fetchProvider.getProfile(id);
      setUserProfile(profile);
    } catch (e) {
      console.error("Failed to load user profile", e);
    }
  }, []);

  const loadDetails = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchProvider.getAuditDetails(planId);
      setDetails(res.data || []);
      setPlanInfo(res.plan || null);
      setOriginalDetails(JSON.parse(JSON.stringify(res.data || [])));
    } catch (e: unknown) {
      console.error(e);
      toast.error("Failed to load audit details");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (isOpen && planId) {
      loadDetails();
    }
    if (isOpen && user?.id) {
      loadUserProfile(user.id);
    }
  }, [isOpen, planId, user?.id, loadDetails, loadUserProfile]);

  const handleToggle = (id: number, field: "isAudited" | "isReceived") => {
    setDetails(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: !item[field] } : item
    ));
  };

  const hasChanges = useMemo(() => {
    return JSON.stringify(details) !== JSON.stringify(originalDetails);
  }, [details, originalDetails]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const rawUser = localStorage.getItem("user") || localStorage.getItem("profile") || localStorage.getItem("auth_user");
      let userId = undefined;
      
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          userId = parsed.user_id || parsed.id || parsed.userId || parsed.uid;
        } catch { /* ignore */ }
      }

      if (!userId && userProfile) {
        userId = userProfile.user_id || userProfile.id;
      }

      if (!userId) {
        toast.error("User session not found. Please log in again.");
        setSaving(false);
        return;
      }

      const updates = details.map(d => ({
        id: d.id,
        status: d.status,
        is_audited: d.isAudited,
        is_received: d.isReceived,
        concernId: d.concernId
      }));
      
      await fetchProvider.updateInvoices(updates, userId);
      toast.success("Audit records saved successfully");
      setOriginalDetails(JSON.parse(JSON.stringify(details)));
      onSuccess?.(details);
    } catch (e: unknown) {
      console.error(e);
      toast.error("Failed to save audit records");
    } finally {
      setSaving(false);
    }
  };

  const triggerGenerateNTE = (row: AuditDetailRecord) => {
    let userName = userProfile ? `${userProfile.user_fname || ""} ${userProfile.user_lname || ""}`.trim() : (user?.name || "N/A");
    let userPosition = userProfile?.user_position || user?.position || "Auditor";

    if (userName === "N/A" || !userName) {
      const getCookie = (name: string) => {
        if (typeof document === 'undefined') return null;
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
      };

      const decodeToken = (token: string) => {
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(window.atob(base64).split('').map((c) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          return JSON.parse(jsonPayload);
        } catch {
          return null;
        }
      };

      let userData: { user_fname?: string; first_name?: string; FirstName?: string; Firstname?: string; firstName?: string; firstname?: string; user_lname?: string; last_name?: string; LastName?: string; Lastname?: string; lastName?: string; lastname?: string; display_name?: string; name?: string; fullName?: string; email?: string; user_position?: string; position?: string; role?: string; Role?: string } | null = null;

      const token = getCookie("vos_access_token");
      if (token) {
        userData = decodeToken(token);
      }

      if (!userData) {
        const rawUser = localStorage.getItem("user") || localStorage.getItem("profile") || localStorage.getItem("vos_user");
        if (rawUser) {
          try {
            userData = JSON.parse(rawUser);
          } catch { /* ignore */ }
        }
      }

      if (userData) {
        const first = userData.user_fname || userData.first_name || userData.FirstName || userData.Firstname || userData.firstName || userData.firstname || "";
        const last = userData.user_lname || userData.last_name || userData.LastName || userData.Lastname || userData.lastName || userData.lastname || "";
        
        if (first || last) {
          userName = `${first} ${last}`.trim();
        } else if (userData.display_name || userData.name || userData.fullName) {
          userName = userData.display_name || userData.name || userData.fullName || "";
        } else if (userData.email) {
          userName = userData.email.split("@")[0];
        }

        userPosition = userData.user_position || userData.position || userData.role || userData.Role || "Auditor";
      }
    }

    setPreviewNTE({
      isOpen: true,
      data: {
        pdiId: row.id,
        userId: user?.id,
        driverName: planInfo?.driver || "N/A",
        amount: row.discrepancyAmount || 0,
        toa: planInfo?.toa || "---",
        dispatchNo: planInfo?.docNo || "---",
        invoiceNo: row.receiptNo || "---",
        userName,
        userPosition,
        userDepartment: userProfile?.departmentName || userProfile?.user_department || userProfile?.department || "Audit Department",
        driverDepartment: planInfo?.driverDepartment || "Operations Department",
        helpers: planInfo?.helpers || [],
      }
    });
  };

  const handleCreateMemo = (row: AuditDetailRecord) => {
    if (row.status === "Fulfilled With Returns" && (!row.linkedReturns || row.linkedReturns.length === 0)) {
      toast.error("No linked Sales Return found. Please link a return before creating a Discrepancy Memo.");
      return;
    }
    setMemoModal({ isOpen: true, invoiceNo: row.receiptNo });
  };


  const groupData = useMemo(() => {
    const fulfilled = details.filter(d => d.status === "Fulfilled");
    const notFulfilled = details.filter(d => d.status === "Not Fulfilled");
    const withReturns = details.filter(d => d.status === "Fulfilled With Returns");
    const withConcern = details.filter(d => d.status === "Fulfilled With Concerns");

    return { fulfilled, notFulfilled, withReturns, withConcern };
  }, [details]);

  const formatPHP = (val: number) => 
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[95vw] w-full h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl">
        <div className="bg-muted/30 p-6 border-b border-border shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Audit System Phase II
              </div>
              <DialogTitle className="text-3xl font-black tracking-tighter text-foreground uppercase italic flex items-center gap-3">
                <Receipt className="w-8 h-8 text-primary" />
                {dispatchNo}
              </DialogTitle>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadDetails}
                disabled={loading || saving}
                className="bg-background border-border hover:bg-muted text-[10px] font-black uppercase tracking-widest h-9"
              >
                <RefreshCcw className={cn("w-3.5 h-3.5 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button 
                size="sm" 
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-black uppercase tracking-widest h-9 px-6 shadow-lg shadow-primary/20"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />}
                Save Audit
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-8">
              {[
                { 
                  label: "Total Amount", 
                  val: details.reduce((acc, d) => acc + (Number(d.amount) || 0), 0), 
                  icon: Wallet, 
                  color: "text-emerald-500", 
                  bg: "bg-emerald-500/10" 
                },
                { 
                  label: "Net Payable", 
                  val: details.reduce((acc, d) => {
                    const statusLower = (d.status || "").toLowerCase();
                    if (statusLower.includes("returns")) {
                      return acc + (Number(d.payableAmount) || 0);
                    }
                    return acc;
                  }, 0), 
                  icon: ArrowRightLeft, 
                  color: "text-primary", 
                  bg: "bg-primary/10" 
                },
                { 
                  label: "Total Returns", 
                  val: details.reduce((acc, d) => acc + (Number(d.returnedAmount) || 0) + (Number(d.linkedReturns?.[0]?.amount) || 0), 0), 
                  icon: Undo2, 
                  color: "text-amber-500", 
                  bg: "bg-amber-500/10" 
                },
                { 
                  label: "Total Discrepancy", 
                  val: details.reduce((acc, d) => acc + (Number(d.discrepancyAmount) || 0), 0), 
                  icon: AlertCircle, 
                  color: "text-rose-500", 
                  bg: "bg-rose-500/10" 
                },
              ].map((m, i) => (
                <div key={i} className="bg-background border border-border rounded-2xl p-4 flex items-center gap-4 group hover:bg-muted/50 transition-all">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border border-transparent group-hover:scale-110 transition-transform", m.bg, m.color)}>
                    <m.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{m.label}</div>
                    <div className="text-lg font-black text-foreground">{formatPHP(m.val)}</div>
                  </div>
                </div>
             ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden px-6 pb-6">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Consolidating Transactional Ledger</p>
                <p className="text-[9px] font-medium text-muted-foreground italic uppercase">Verifying relational integrity across collections...</p>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="fulfilled" className="flex-1 flex flex-col overflow-hidden mt-6">
              <TabsList className="bg-muted border border-border p-1.5 rounded-2xl w-fit shrink-0 gap-1 self-center">
                <StatusTabTrigger value="fulfilled" label="Fulfilled" count={groupData.fulfilled.length} icon={CheckCircle2} color="data-[state=active]:bg-emerald-500" />
                <StatusTabTrigger value="not-fulfilled" label="Not Fulfilled" count={groupData.notFulfilled.length} icon={XCircle} color="data-[state=active]:bg-rose-500" />
                <StatusTabTrigger value="with-returns" label="With Returns" count={groupData.withReturns.length} icon={Undo2} color="data-[state=active]:bg-amber-500" />
                <StatusTabTrigger value="with-concern" label="With Concern" count={groupData.withConcern.length} icon={AlertCircle} color="data-[state=active]:bg-blue-500" />
              </TabsList>

              <div className="flex-1 mt-6 overflow-hidden rounded-3xl border border-border bg-muted/20">
                <TabsContent value="fulfilled" className="h-full m-0 outline-none">
                  <DetailTable 
                    data={groupData.fulfilled} 
                    type="fulfilled" 
                    formatPHP={formatPHP} 
                    onToggle={handleToggle} 
                    onGenerateNTE={triggerGenerateNTE} 
                    onCreateMemo={handleCreateMemo}
                  />
                </TabsContent>
                <TabsContent value="not-fulfilled" className="h-full m-0 outline-none">
                  <DetailTable 
                    data={groupData.notFulfilled} 
                    type="not-fulfilled" 
                    formatPHP={formatPHP} 
                    onToggle={handleToggle} 
                    onGenerateNTE={triggerGenerateNTE} 
                    onCreateMemo={handleCreateMemo}
                  />
                </TabsContent>
                <TabsContent value="with-returns" className="h-full m-0 outline-none">
                  <DetailTable 
                    data={groupData.withReturns} 
                    type="with-returns" 
                    formatPHP={formatPHP} 
                    onToggle={handleToggle} 
                    onGenerateNTE={triggerGenerateNTE} 
                    onCreateMemo={handleCreateMemo}
                  />
                </TabsContent>
                <TabsContent value="with-concern" className="h-full m-0 outline-none">
                  <DetailTable 
                    data={groupData.withConcern} 
                    type="with-concern" 
                    formatPHP={formatPHP} 
                    onToggle={handleToggle} 
                    onGenerateNTE={triggerGenerateNTE} 
                    onCreateMemo={handleCreateMemo}
                  />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </DialogContent>

      <DiscrepancyMemoModal 
        isOpen={memoModal.isOpen}
        onClose={() => setMemoModal({ ...memoModal, isOpen: false })}
        onSuccess={loadDetails}
        invoiceNo={memoModal.invoiceNo}
        user={user}
      />

      {previewNTE.isOpen && previewNTE.data && (
      <NTEPreviewModal
        isOpen={previewNTE.isOpen}
        data={previewNTE.data}
        onClose={() => setPreviewNTE({ ...previewNTE, isOpen: false })}
        onSuccess={loadDetails}
      />
      )}
    </Dialog>
  );
}

function StatusTabTrigger({ value, label, count, icon: Icon, color }: { value: string, label: string, count: number, icon: React.ElementType, color: string }) {
  return (
    <TabsTrigger 
      value={value} 
      className={cn(
        "rounded-xl px-6 py-2.5 font-black text-[10px] uppercase tracking-[0.1em] transition-all flex items-center gap-2.5",
        "data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-background/50",
        color
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      <span className="bg-black/10 dark:bg-black/20 px-2 py-0.5 rounded-md text-[9px] min-w-[20px]">{count}</span>
    </TabsTrigger>
  );
}

function DetailTable({ 
  data, 
  type, 
  formatPHP, 
  onToggle, 
  onGenerateNTE,
  onCreateMemo
}: { 
  data: AuditDetailRecord[], 
  type: string, 
  formatPHP: (v: number) => string, 
  onToggle: (id: number, field: "isAudited" | "isReceived") => void,
  onGenerateNTE: (row: AuditDetailRecord) => void,
  onCreateMemo: (row: AuditDetailRecord) => void
}) {
  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader className="bg-background sticky top-0 z-10 border-b border-border">
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[10px] font-black uppercase text-muted-foreground w-[180px] h-12 px-6">Receipt No</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-right w-[150px] h-12">Total Amount</TableHead>
            
            {type === "fulfilled" && (
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-12 px-6">Warehouse Remarks</TableHead>
            )}
            
            {type === "not-fulfilled" && (
              <>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-12 px-6">Warehouse Remarks</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-12 px-6 text-rose-500">NTE NO</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-right w-[150px] h-12">Discrepancy</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-right w-[150px] h-12">Returns</TableHead>
              </>
            )}
            
            {type === "with-returns" && (
              <>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-12 px-6 text-blue-500">Return No</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-12 px-6 text-rose-500">NTE NO</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-12 px-6">Warehouse Remarks</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-right w-[150px] h-12">Discrepancy</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-right w-[150px] h-12 text-primary">Payable</TableHead>
              </>
            )}
            
            {type === "with-concern" && (
              <>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-12 px-6 text-orange-500">Warehouse Remarks</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-12 px-6 text-rose-500">NTE NO</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-right w-[120px] h-12">Discrepancy</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-right w-[120px] h-12 text-rose-600">Rejected</TableHead>
              </>
            )}

            <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center w-[100px] h-12">Audited</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center w-[100px] h-12">Received</TableHead>
            {(type === "not-fulfilled" || type === "with-concern" || type === "with-returns") && (
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center w-[100px] h-12">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell 
                colSpan={10} 
                className="h-96 text-center"
              >
                <div className="flex flex-col items-center justify-center opacity-20 py-10 grayscale group">
                    <div className="relative mb-6">
                      <FileText className="h-24 w-24 text-foreground animate-pulse" />
                      <div className="absolute inset-x-0 -bottom-4 h-12 bg-primary/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-foreground">No Auditable Records</p>
                    <p className="mt-2 text-[9px] font-bold uppercase text-muted-foreground">Verification stage complete or data unavailable</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <ContextMenu key={row.id}>
                <ContextMenuTrigger asChild>
                  <TableRow className="hover:bg-muted/50 transition-all border-border active:bg-muted cursor-context-menu">
                    <TableCell className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground">
                          #
                        </div>
                        <div>
                           <div className="font-black text-xs uppercase text-foreground group-hover:text-primary transition-colors">
                            {row.receiptNo}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-black text-sm text-emerald-500">
                      {formatPHP(row.amount)}
                    </TableCell>

                    {type === "fulfilled" && (
                      <TableCell className="px-6 text-xs font-medium text-muted-foreground italic uppercase">
                        {row.warehouseRemarks || "---"}
                      </TableCell>
                    )}

                    {type === "not-fulfilled" && (
                      <>
                        <TableCell className="px-6 text-xs font-medium text-muted-foreground italic uppercase">
                          {row.warehouseRemarks || "---"}
                        </TableCell>
                        <TableCell className="px-6 text-[10px] font-black text-rose-500 uppercase">
                          <div className="flex flex-col gap-1">
                            {row.ntes && row.ntes.length > 0 ? (
                              row.ntes.map((nte, idx) => (
                                <a 
                                  key={idx}
                                  href={`${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${nte.fileId}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="hover:underline hover:text-rose-600 transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" />
                                  {nte.no}
                                </a>
                              ))
                            ) : (
                              "---"
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-black text-xs text-rose-500">
                          {formatPHP(row.discrepancyAmount || 0)}
                        </TableCell>
                        <TableCell className="text-right font-black text-xs text-amber-500">
                          {formatPHP(row.returnedAmount || 0)}
                        </TableCell>
                      </>
                    )}

                    {type === "with-returns" && (
                      <>
                        <TableCell className="px-6 text-xs font-black text-blue-500 uppercase tracking-tight">
                          <div className="flex flex-col gap-1">
                            {row.linkedReturns && row.linkedReturns.length > 0 ? (
                              row.linkedReturns.map((ret, idx) => (
                                <span key={idx}>{ret.no}</span>
                              ))
                            ) : (
                              "---"
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 text-[10px] font-black text-rose-500 uppercase">
                          <div className="flex flex-col gap-1">
                            {row.ntes && row.ntes.length > 0 ? (
                              row.ntes.map((nte, idx) => (
                                <a 
                                  key={idx}
                                  href={`${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${nte.fileId}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="hover:underline hover:text-rose-600 transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" />
                                  {nte.no}
                                </a>
                              ))
                            ) : (
                              "---"
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 text-xs font-medium text-muted-foreground italic uppercase">
                          {row.warehouseRemarks || "---"}
                        </TableCell>
                        <TableCell className="text-right font-black text-xs text-rose-500">
                          {formatPHP(row.discrepancyAmount || 0)}
                        </TableCell>
                        <TableCell className="text-right font-black text-xs text-primary">
                          {formatPHP(row.payableAmount || 0)}
                        </TableCell>
                      </>
                    )}

                    {type === "with-concern" && (
                      <>
                        <TableCell className="px-6 text-xs font-medium text-muted-foreground italic uppercase tracking-tight">
                          {row.warehouseRemarks || "---"}
                        </TableCell>
                        <TableCell className="px-6 text-[10px] font-black text-rose-500 uppercase">
                          <div className="flex flex-col gap-1">
                            {row.ntes && row.ntes.length > 0 ? (
                              row.ntes.map((nte, idx) => (
                                <a 
                                  key={idx}
                                  href={`${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${nte.fileId}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="hover:underline hover:text-rose-600 transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" />
                                  {nte.no}
                                </a>
                              ))
                            ) : (
                              "---"
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-black text-xs text-muted-foreground">
                          {formatPHP(row.discrepancyAmount || 0)}
                        </TableCell>
                        <TableCell className="text-right font-black text-xs text-rose-500">
                          {formatPHP(row.rejectedAmount || 0)}
                        </TableCell>
                      </>
                    )}

                    <TableCell className="text-center group/check">
                      <div className="flex items-center justify-center">
                        <Checkbox 
                          checked={row.isAudited} 
                          onCheckedChange={() => onToggle(row.id, "isAudited")}
                          className="w-5 h-5 rounded-md border-border data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 transition-all hover:scale-110 active:scale-95" 
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center group/check">
                       <div className="flex items-center justify-center">
                        <Checkbox 
                          checked={row.isReceived} 
                          onCheckedChange={() => onToggle(row.id, "isReceived")}
                          className="w-5 h-5 rounded-md border-border data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 transition-all hover:scale-110 active:scale-95" 
                        />
                      </div>
                    </TableCell>
                    {(type === "not-fulfilled" || type === "with-concern" || type === "with-returns") && (
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg hover:bg-muted transition-colors">
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 bg-background border-border shadow-xl rounded-xl p-1 z-[100]">
                            <DropdownMenuItem 
                              className="text-[10px] font-black uppercase tracking-widest gap-2 cursor-pointer py-3 rounded-lg focus:bg-muted transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                onGenerateNTE(row);
                              }}
                            >
                              <FileWarning className="w-4 h-4 text-rose-500" />
                              Generate NTE
                            </DropdownMenuItem>
                            
                            {type === "with-returns" && (
                              <DropdownMenuItem 
                                className="text-[10px] font-black uppercase tracking-widest gap-2 cursor-pointer py-3 rounded-lg focus:bg-muted transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCreateMemo(row);
                                }}
                              >
                                <PlusCircle className="w-4 h-4 text-primary" />
                                Create Discrepancy Memo
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                </ContextMenuTrigger>
                
                {(type === "not-fulfilled" || type === "with-concern" || type === "with-returns") && (
                  <ContextMenuContent className="w-64 bg-background border-border">
                    <ContextMenuItem 
                      className="text-[10px] font-black uppercase tracking-widest gap-2 cursor-pointer py-3"
                      onClick={() => onGenerateNTE(row)}
                    >
                      <FileWarning className="w-4 h-4 text-rose-500" />
                      Generate NTE
                    </ContextMenuItem>
                    
                    {type === "with-returns" && (
                      <ContextMenuItem 
                        className="text-[10px] font-black uppercase tracking-widest gap-2 cursor-pointer py-3"
                        onClick={() => onCreateMemo(row)}
                      >
                        <PlusCircle className="w-4 h-4 text-primary" />
                        Create Discrepancy Memo
                      </ContextMenuItem>
                    )}
                  </ContextMenuContent>
                )}
              </ContextMenu>
            ))
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
