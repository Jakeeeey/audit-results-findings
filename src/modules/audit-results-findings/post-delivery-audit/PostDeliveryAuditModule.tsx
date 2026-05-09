"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { format } from "date-fns";
import { 
  Search, 
  Calendar, 
  Truck, 
  Hash, 
  Filter,
  Package,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  MoreVertical,
  MessageSquare,
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchProvider } from "./providers/fetchProvider";
import { PostDeliveryAuditRecord, PostDeliveryAuditFilters, AuditDetailRecord } from "./types";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { AuditRemarksModal } from "./components/AuditRemarksModal";
import { AuditDetailModal } from "./components/AuditDetailModal";
import { toast } from "sonner";

export default function PostDeliveryAuditModule({ user }: { user?: { id: number | string; [key: string]: unknown } }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PostDeliveryAuditRecord[]>([]);
  const [drivers, setDrivers] = useState<{ id: number; first_name: string; last_name: string; [key: string]: unknown }[]>([]);
  
  // Filters (Inputs)
  const [dateFrom, setDateFrom] = useState<string>(format(new Date(), "yyyy-MM-01"));
  const [dateTo, setDateTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [driverId, setDriverId] = useState<string>("ALL");
  const [dispatchNo, setDispatchNo] = useState<string>("");
  const [openDriverSelect, setOpenDriverSelect] = useState(false);

  // Applied Filters (The actual filters used for fetching)
  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: format(new Date(), "yyyy-MM-01"),
    dateTo: format(new Date(), "yyyy-MM-dd"),
    driverId: "ALL",
    dispatchNo: ""
  });

  // Pagination & Lazy Loading
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback((node: HTMLTableRowElement | null) => {
    if (loading || isFetchingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, isFetchingMore, hasMore]);

  // Modals state
  const [remarksModalOpen, setRemarksModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<PostDeliveryAuditRecord | null>(null);

  const fetchData = useCallback(async (pageNum = 1, isAppend = false) => {
    if (pageNum === 1) setLoading(true);
    else setIsFetchingMore(true);

    try {
      const filters: PostDeliveryAuditFilters = {
        dateFrom: appliedFilters.dateFrom,
        dateTo: appliedFilters.dateTo,
        driverId: appliedFilters.driverId,
        dispatchNo: appliedFilters.dispatchNo || undefined,
        page: pageNum,
        pageSize: 15
      };
      const response = await fetchProvider.getAuditData(filters);
      if (isAppend) {
        setData(prev => [...prev, ...(response.data || [])]);
      } else {
        setData(response.data || []);
      }
      setHasMore(response.meta?.hasMore || false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch audit data");
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    const init = async () => {
      try {
        const driversList = await fetchProvider.getDrivers();
        setDrivers(driversList || []);
      } catch (e) {
        console.error(e);
      }
    };
    init();
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (page > 1) {
      fetchData(page, true);
    }
  }, [page, fetchData]);

  const handleFilter = () => {
    setAppliedFilters({
      dateFrom,
      dateTo,
      driverId,
      dispatchNo
    });
    setPage(1);
  };

  useEffect(() => {
    fetchData(1, false);
  }, [appliedFilters, fetchData]);

  const handleUpdateRemarks = async (remarks: string) => {
    if (!selectedRow) return;
    try {
      await fetchProvider.updateRemarks(selectedRow.id, remarks);
      toast.success("Remarks updated successfully");
      fetchData(); // Refresh main table
    } catch (e) {
      toast.error("Failed to update remarks");
      console.error(e);
    }
  };

  const handleRowRightClick = (e: React.MouseEvent, row: PostDeliveryAuditRecord) => {
    e.preventDefault();
    setSelectedRow(row);
    setRemarksModalOpen(true);
  };

  const handleRowClick = (row: PostDeliveryAuditRecord) => {
    setSelectedRow(row);
    setDetailModalOpen(true);
  };

  const handleAuditSuccess = (updatedDetails: AuditDetailRecord[]) => {
    if (!selectedRow) return;

    // Recalculate based on the same logic as the backend
    const totalInvoices = updatedDetails.length;
    const auditedCount = updatedDetails.filter(d => d.isAudited).length;
    const receivedCount = updatedDetails.filter(d => d.isReceived).length;
    
    // Recalculate logistics counts
    const fulfilled = updatedDetails.filter(d => d.status === "Fulfilled").length;
    const notFulfilled = updatedDetails.filter(d => d.status === "Not Fulfilled").length;
    const withReturns = updatedDetails.filter(d => d.status === "Fulfilled With Returns").length;
    const withConcerns = updatedDetails.filter(d => d.status === "Fulfilled With Concerns").length;

    // (audited + received) / (total * 2) * 100
    const percentage = totalInvoices > 0 ? ((auditedCount + receivedCount) / (totalInvoices * 2)) * 100 : 0;
    const roundedPercentage = Math.round(percentage * 100) / 100;

    setData(prev => prev.map(row => 
      row.id === selectedRow.id 
        ? { 
            ...row, 
            percentage: roundedPercentage,
            logisticsStatus: {
              fulfilled,
              notFulfilled,
              withReturns,
              withConcerns
            }
          } 
        : row
    ));
  };

  const totals = useMemo(() => {
    return {
      totalDispatches: data.length,
      avgFulfillment: data.length > 0 ? data.reduce((acc, curr) => acc + curr.percentage, 0) / data.length : 0,
      totalInvoices: data.reduce((acc, curr) => acc + curr.totalInvoices, 0),
      totalFulfilled: data.reduce((acc, curr) => acc + curr.logisticsStatus.fulfilled, 0),
      totalIssues: data.reduce((acc, curr) => 
        acc + curr.logisticsStatus.notFulfilled + curr.logisticsStatus.withReturns + curr.logisticsStatus.withConcerns, 0),
    };
  }, [data]);

  return (
    <div className="flex flex-col gap-8 p-8 animate-in fade-in duration-700 bg-background/50">
      {/* KPI Cards section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Total Dispatches" 
          value={totals.totalDispatches} 
          icon={Package} 
          trend="+12%" 
          color="primary"
        />
        <KPICard 
          title="Avg. Fulfillment" 
          value={`${Math.round(totals.avgFulfillment)}%`} 
          icon={TrendingUp} 
          trend="+2.4%" 
          color="emerald"
        />
        <KPICard 
          title="Total Fulfilled" 
          value={totals.totalFulfilled} 
          icon={CheckCircle2} 
          trend="+18%" 
          color="blue"
        />
        <KPICard 
          title="Issues Found" 
          value={totals.totalIssues} 
          icon={AlertTriangle} 
          trend="-5%" 
          color="rose"
        />
      </div>

      {/* Filter Section */}
      <Card className="border-border shadow-lg bg-card/60 backdrop-blur-xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
        <CardContent className="p-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Date Range From
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-background border-border focus-visible:ring-primary/20 h-11 text-xs font-bold uppercase transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Date Range To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-background border-border focus-visible:ring-primary/20 h-11 text-xs font-bold uppercase transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Truck className="w-3 h-3" /> Driver Search
              </label>
              <Popover open={openDriverSelect} onOpenChange={setOpenDriverSelect}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between bg-background border-border h-11 text-xs font-black uppercase tracking-wide hover:bg-muted font-mono"
                  >
                    {driverId === "ALL" ? "All Active Drivers" : drivers.find(d => String(d.id) === driverId) ? `${drivers.find(d => String(d.id) === driverId)?.first_name} ${drivers.find(d => String(d.id) === driverId)?.last_name}` : "Filter by Driver"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 shadow-2xl border-border" align="start">
                  <Command className="bg-popover/95 backdrop-blur-xl">
                    <CommandInput placeholder="Search driver..." className="h-11 font-bold text-xs uppercase" />
                    <CommandList>
                      <CommandEmpty className="py-6 text-center text-[10px] font-black uppercase opacity-20">No drivers identified.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="ALL"
                          onSelect={() => {
                            setDriverId("ALL");
                            setOpenDriverSelect(false);
                          }}
                          className="font-black text-[10px] uppercase cursor-pointer"
                        >
                          <Check className={cn("mr-2 h-4 w-4", driverId === "ALL" ? "opacity-100" : "opacity-0")} />
                          All Operations Personnel
                        </CommandItem>
                        {drivers.map((driver) => (
                          <CommandItem
                            key={driver.id}
                            value={String(driver.id)}
                            onSelect={() => {
                              setDriverId(String(driver.id));
                              setOpenDriverSelect(false);
                            }}
                            className="font-black text-[10px] uppercase cursor-pointer"
                          >
                            <Check className={cn("mr-2 h-4 w-4", driverId === String(driver.id) ? "opacity-100" : "opacity-0")} />
                            {driver.first_name} {driver.last_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex gap-2 items-end">
              <div className="space-y-2 flex-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Hash className="w-3 h-3" /> Dispatch ID
                </label>
                <div className="relative group">
                   <Input
                    placeholder="E.G. DP-XXX"
                    value={dispatchNo}
                    onChange={(e) => setDispatchNo(e.target.value)}
                    className="bg-background border-border focus-visible:ring-primary/20 h-11 text-xs font-bold uppercase pl-10 transition-all font-mono"
                  />
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
              </div>
              <Button 
                onClick={handleFilter} 
                className="h-11 px-8 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 shrink-0"
              >
                <Filter className="w-4 h-4" /> Apply Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table Section */}
      <Card className="border-border shadow-lg bg-card overflow-hidden relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />
        <CardHeader className="border-b border-border py-6 px-8 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center border border-primary/10">
                <FileText className="w-6 h-6 text-primary" />
             </div>
             <div>
                <CardTitle className="text-xl font-black italic uppercase tracking-tight">Audit Console</CardTitle>
                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Real-time Logistics Verification System</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
             {/* Export Report button removed */}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow className="hover:bg-transparent border-b-0">
                <TableHead rowSpan={2} className="text-[10px] font-black uppercase px-8 text-center border-r border-border h-14">TOD</TableHead>
                <TableHead rowSpan={2} className="text-[10px] font-black uppercase px-4 text-center border-r border-border">TOA</TableHead>
                <TableHead rowSpan={2} className="text-[10px] font-black uppercase px-6 text-center border-r border-border">Personnel</TableHead>
                <TableHead rowSpan={2} className="text-[10px] font-black uppercase px-6 text-center border-r border-border">Reference No</TableHead>
                <TableHead rowSpan={2} className="text-[10px] font-black uppercase px-8 text-center border-r border-border">Audit Remarks</TableHead>
                <TableHead colSpan={4} className="text-[10px] font-black uppercase h-10 text-center border-b border-r border-border bg-muted/20">Logistics status metrics</TableHead>
                <TableHead rowSpan={2} className="text-[10px] font-black uppercase px-6 text-center">Score</TableHead>
                <TableHead rowSpan={2} className="text-[10px] font-black uppercase px-6 text-center">Actions</TableHead>
              </TableRow>
              <TableRow className="hover:bg-transparent h-14">
                <TableHead className="text-[9px] font-black uppercase text-center border-r border-border px-4 hover:bg-emerald-500/5 transition-colors cursor-default">Fulfilled</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-center border-r border-border px-4 hover:bg-rose-500/5 transition-colors cursor-default">Not Fulfilled</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-center border-r border-border px-4 hover:bg-amber-500/5 transition-colors cursor-default">With Returns</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-center border-r border-border px-4 hover:bg-blue-500/5 transition-colors cursor-default">With Concern</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="px-8 py-5 border-r border-border"><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                    <TableCell className="border-r border-border"><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                    <TableCell className="border-r border-border"><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                    <TableCell className="border-r border-border"><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                    <TableCell className="border-r border-border"><Skeleton className="h-5 w-32 mx-auto" /></TableCell>
                    <TableCell className="border-r border-border"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    <TableCell className="border-r border-border"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    <TableCell className="border-r border-border"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    <TableCell className="border-r border-border"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    <TableCell className="border-r border-border"><Skeleton className="h-6 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 mx-auto rounded-lg" /></TableCell>
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-[400px] text-center px-8">
                    <div className="flex flex-col items-center justify-center opacity-30 gap-4 grayscale">
                      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center animate-pulse">
                        <Search className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Zero Data Points</p>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase italic max-w-sm mx-auto">Expand your search constraints or verify the dispatch plan synchronization status.</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => (
                  <TableRow 
                    key={row.id} 
                    ref={data.indexOf(row) === data.length - 1 ? lastElementRef : null}
                    className="group hover:bg-muted/30 transition-all cursor-pointer relative"
                    onClick={() => handleRowClick(row)}
                    onContextMenu={(e) => handleRowRightClick(e, row)}
                  >
                    <TableCell className="px-8 py-5 border-r border-border text-center">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-foreground">
                          {row.tod ? format(new Date(row.tod), "hh:mm a") : "---"}
                        </span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                           {row.tod ? format(new Date(row.tod), "MMM dd, yyyy") : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="border-r border-border text-center px-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-foreground">
                          {row.toa ? format(new Date(row.toa), "hh:mm a") : "---"}
                        </span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                           {row.toa ? format(new Date(row.toa), "MMM dd, yyyy") : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="border-r border-border text-center px-6">
                      <span className="text-xs font-black uppercase text-foreground leading-tight">{row.driver}</span>
                    </TableCell>
                    <TableCell className="border-r border-border text-center px-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-black uppercase tracking-tighter text-primary">
                          {row.dispatchNo}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="border-r border-border px-8">
                       <div className="flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0 opacity-20" />
                          <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed line-clamp-2 max-w-[200px]">
                            {row.remarks || "---"}
                          </p>
                       </div>
                    </TableCell>
                    <TableCell className="border-r border-border text-center font-black text-sm text-emerald-600 bg-emerald-50/20">
                      {row.logisticsStatus.fulfilled || 0}
                    </TableCell>
                    <TableCell className="border-r border-border text-center font-black text-sm text-rose-600 bg-rose-50/20">
                      {row.logisticsStatus.notFulfilled || 0}
                    </TableCell>
                    <TableCell className="border-r border-border text-center font-black text-sm text-amber-600 bg-amber-50/20">
                      {row.logisticsStatus.withReturns || 0}
                    </TableCell>
                    <TableCell className="border-r border-border text-center font-black text-sm text-blue-600 bg-blue-50/20">
                      {row.logisticsStatus.withConcerns || 0}
                    </TableCell>
                    <TableCell className="text-center px-6">
                       <div className="inline-flex flex-col items-center">
                          <span className={cn(
                            "text-sm font-black italic tracking-tighter",
                            row.percentage >= 90 ? "text-emerald-500" : row.percentage >= 70 ? "text-amber-500" : "text-rose-500"
                          )}>
                            {row.percentage}%
                          </span>
                          <div className="w-full h-1 bg-muted rounded-full mt-1 overflow-hidden min-w-[50px]">
                             <div 
                                className={cn(
                                  "h-full transition-all duration-1000",
                                  row.percentage >= 90 ? "bg-emerald-500" : row.percentage >= 70 ? "bg-amber-500" : "bg-rose-500"
                                )} 
                                style={{ width: `${row.percentage}%` }} 
                             />
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-center px-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-8 h-8 rounded-lg hover:bg-muted transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-background border-border shadow-xl rounded-xl p-1 z-[100]">
                          <DropdownMenuItem 
                            className="text-[10px] font-black uppercase tracking-widest gap-2 cursor-pointer py-3 rounded-lg focus:bg-muted transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(row);
                            }}
                          >
                            <FileText className="w-4 h-4 text-emerald-500" />
                            Open Audit
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem 
                            className="text-[10px] font-black uppercase tracking-widest gap-2 cursor-pointer py-3 rounded-lg focus:bg-muted transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRow(row);
                              setRemarksModalOpen(true);
                            }}
                          >
                            <MessageSquare className="w-4 h-4 text-primary" />
                            Update Remarks
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {/* Infinite Loading Indicator */}
              {isFetchingMore && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={10} className="py-8 text-center">
                    <div className="flex items-center justify-center gap-3">
                       <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></div>
                       </div>
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/50">Loading additional dispatches</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AuditRemarksModal
        isOpen={remarksModalOpen}
        onClose={() => setRemarksModalOpen(false)}
        onSave={handleUpdateRemarks}
        initialRemarks={selectedRow?.remarks || ""}
        dispatchNo={selectedRow?.dispatchNo || ""}
      />

      <AuditDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        planId={selectedRow?.id || 0}
        dispatchNo={selectedRow?.dispatchNo || ""}
        user={user}
        onSuccess={handleAuditSuccess}
      />
    </div>
  );
}

function KPICard({ title, value, icon: Icon, trend, color }: { title: string, value: string | number, icon: React.ElementType, trend: string, color: string }) {
  const colorMap: Record<string, string> = {
    primary: "from-primary/20 to-primary/5 text-primary border-primary/10 bg-primary/5",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-500 border-emerald-500/10 bg-emerald-500/5",
    blue: "from-blue-500/20 to-blue-500/5 text-blue-500 border-blue-500/10 bg-blue-500/5",
    rose: "from-rose-500/20 to-rose-500/5 text-rose-500 border-rose-500/10 bg-rose-500/5"
  };

  return (
    <Card className="border-border bg-card/40 backdrop-blur-md shadow-lg group transition-all hover:translate-y-[-4px]">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
               <div className={cn("p-2 rounded-xl bg-gradient-to-br", colorMap[color])}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</span>
            </div>
            <div className="space-y-1">
               <div className="text-3xl font-black italic tracking-tighter text-foreground group-hover:text-primary transition-colors">{value}</div>
               <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "text-[9px] font-black px-1.5 py-0.5 rounded-md",
                    trend.startsWith("+") ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                  )}>
                    {trend}
                  </span>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">Vs Last Period</span>
               </div>
            </div>
          </div>
          <div className="bg-primary/5 w-12 h-12 rounded-full absolute -top-4 -right-4 blur-2xl group-hover:scale-150 transition-transform duration-700" />
        </div>
      </CardContent>
    </Card>
  );
}
