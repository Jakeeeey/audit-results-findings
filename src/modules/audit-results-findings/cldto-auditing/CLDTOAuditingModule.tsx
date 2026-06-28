"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { 
  CalendarIcon, 
  RotateCcw, 
  Search,
  FileText,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchProvider } from "./providers/fetchProvider";
import { ConsolidatorRecord, CLDTOFilters } from "./types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CLDTODetailModal } from "./components/CLDTODetailModal";

export default function CLDTOAuditingModule() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ConsolidatorRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Filters
  const [dateFrom, setDateFrom] = useState<string>(format(new Date(new Date().setDate(1)), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [status, setStatus] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [varianceOnly, setVarianceOnly] = useState<boolean>(false);

  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: format(new Date(new Date().setDate(1)), "yyyy-MM-dd"),
    dateTo: format(new Date(), "yyyy-MM-dd"),
    status: "ALL",
    search: "",
  });

  // Pagination
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

  // Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ConsolidatorRecord | null>(null);

  const fetchData = useCallback(async (pageNum = 1, isAppend = false) => {
    if (pageNum === 1) setLoading(true);
    else setIsFetchingMore(true);

    try {
      const filters: CLDTOFilters = {
        dateFrom: appliedFilters.dateFrom,
        dateTo: appliedFilters.dateTo,
        status: appliedFilters.status !== "ALL" ? appliedFilters.status : undefined,
        search: appliedFilters.search || undefined,
        page: pageNum,
        pageSize: 15
      };
      const response = await fetchProvider.getConsolidators(filters);
      if (isAppend) {
        setData(prev => [...prev, ...(response.data || [])]);
      } else {
        setData(response.data || []);
      }
      setHasMore(response.meta?.hasMore || false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch CLDTO data");
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [appliedFilters]);

  // Optionally load initial data
  useEffect(() => {
    // We wait for the user to hit search, but we could load initially if we want.
    // Let's load initially so the table is visible, just like before, but set hasSearched to true.
    setHasSearched(true);
    fetchData(1, false);
  }, [appliedFilters, fetchData]);

  useEffect(() => {
    if (page > 1) {
      fetchData(page, true);
    }
  }, [page, fetchData]);

  const handleFilter = () => {
    setHasSearched(true);
    setAppliedFilters({
      dateFrom,
      dateTo,
      status,
      search,
    });
    setPage(1);
    setVarianceOnly(false); // Reset variance filter when searching anew
  };

  const handleReset = () => {
    setDateFrom(format(new Date(new Date().setDate(1)), "yyyy-MM-dd"));
    setDateTo(format(new Date(), "yyyy-MM-dd"));
    setStatus("ALL");
    setSearch("");
    setVarianceOnly(false);
    setHasSearched(false);
    setData([]);
  };

  const handleRowClick = (row: ConsolidatorRecord) => {
    setSelectedRow(row);
    setDetailModalOpen(true);
  };

  const displayedData = varianceOnly ? data.filter(d => d.hasVariance) : data;

  // Compute KPI totals based on fetched data
  const totalRecords = data.length;
  const pendingRecords = data.filter(d => d.status === "Pending").length;
  const varianceRecords = data.filter(d => d.hasVariance).length;
  const auditedRecords = data.filter(d => d.status === "Audited").length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 px-4 md:px-8 mt-4 animate-in fade-in duration-700">
      
      {/* Module Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">CLDTO Auditing</h1>
            <p className="text-muted-foreground text-sm">Consolidator Dispatches & Details</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {(hasSearched || loading) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Loaded</p>
                  <h3 className="text-3xl font-black">{totalRecords}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <ClipboardList className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Pending Audit</p>
                  <h3 className="text-3xl font-black text-rose-500">{pendingRecords}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                  <Clock className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={cn(
              "rounded-2xl border shadow-sm cursor-pointer transition-all active:scale-95",
              varianceOnly ? "ring-2 ring-amber-500 bg-amber-500/5" : "hover:border-amber-500/50"
            )}
            onClick={() => setVarianceOnly(!varianceOnly)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">With Variance</p>
                  <h3 className="text-3xl font-black text-amber-500">{varianceRecords}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Audited</p>
                  <h3 className="text-3xl font-black text-emerald-500">{auditedRecords}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Card */}
      <Card className="rounded-2xl border shadow-sm overflow-visible">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12 items-end">
            <div className="space-y-2 lg:col-span-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">
                Date Range From
              </Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 shrink-0" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-background border-muted-foreground/20 h-10 rounded-xl text-xs font-bold uppercase pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2 lg:col-span-3">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">
                Date Range To
              </Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 shrink-0" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-background border-muted-foreground/20 h-10 rounded-xl text-xs font-bold uppercase pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2 lg:col-span-3">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">
                Status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-background border-muted-foreground/20 h-10 rounded-xl text-xs font-bold uppercase">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent className="border-border rounded-xl font-bold text-xs uppercase">
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Picking">Picking</SelectItem>
                  <SelectItem value="Picked">Picked</SelectItem>
                  <SelectItem value="Audited">Audited</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 shrink-0" />
                <Input
                  type="text"
                  placeholder="SO, PDP, or CLDTO No."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-background border-muted-foreground/20 h-10 rounded-xl text-xs font-bold pl-10"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 lg:col-span-3">
              <Button
                variant="ghost"
                className="h-10 rounded-xl px-4 flex-1 hover:bg-muted font-bold text-xs uppercase tracking-widest text-muted-foreground transition-colors"
                onClick={handleReset}
                disabled={loading}
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                className="h-10 rounded-xl px-6 flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs uppercase tracking-widest shadow-sm shadow-primary/20 transition-all active:scale-[0.98]"
                onClick={handleFilter}
                disabled={loading}
              >
                <Search className="mr-2 h-4 w-4" />
                {loading && !isFetchingMore ? "..." : "Audit"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(hasSearched || loading) && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Consolidators Ledger</h2>
            <div className="flex gap-2 items-center">
              {varianceOnly && (
                <span className="text-xs text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                  Variance Filter Active
                </span>
              )}
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full font-medium">
                {displayedData.length} records
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border shadow-sm overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-b-border">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest px-6 h-12 w-1/4">Consolidator No</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest px-6 text-center">Status</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest px-6 text-center">Created At</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest px-6 text-center border-r border-border">Ordered</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest px-6 text-center border-r border-border">Picked</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest px-6 text-center border-r border-border">Applied</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest px-6 text-center border-r border-border">Variance</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest px-6 text-center">Accuracy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && displayedData.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="px-6 py-4"><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                      <TableCell className="border-r border-border"><Skeleton className="h-5 w-12 mx-auto" /></TableCell>
                      <TableCell className="border-r border-border"><Skeleton className="h-5 w-12 mx-auto" /></TableCell>
                      <TableCell className="border-r border-border"><Skeleton className="h-5 w-12 mx-auto" /></TableCell>
                      <TableCell className="border-r border-border"><Skeleton className="h-5 w-12 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : displayedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-[200px] text-center">
                      <div className="text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-50">
                        {varianceOnly ? "No consolidators with variance found" : "No consolidators found"}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedData.map((row) => (
                    <TableRow 
                      key={row.id} 
                      ref={displayedData.indexOf(row) === displayedData.length - 1 ? lastElementRef : null}
                      className="group hover:bg-muted/30 transition-all cursor-pointer border-b-border"
                      onClick={() => handleRowClick(row)}
                    >
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-black uppercase tracking-tighter text-primary">
                            {row.consolidator_no}
                          </span>
                          {row.creatorName && (
                            <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                              By: {row.creatorName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center px-6">
                        <div className={cn(
                          "inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          row.status === "Audited" ? "bg-emerald-500/10 text-emerald-600" :
                          row.status === "Pending" ? "bg-rose-500/10 text-rose-600" :
                          row.status === "Picked" || row.status === "Picking" ? "bg-blue-500/10 text-blue-600" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {row.status || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell className="text-center px-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-foreground">
                            {row.created_at ? format(new Date(row.created_at), "MMM dd, yyyy") : "---"}
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                             {row.created_at ? format(new Date(row.created_at), "hh:mm a") : ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-border text-center font-black text-sm text-muted-foreground">
                        {row.totalOrderedQuantity ?? "---"}
                      </TableCell>
                      <TableCell className="border-r border-border text-center font-black text-sm text-primary">
                        {row.totalPickedQuantity ?? "---"}
                      </TableCell>
                      <TableCell className="border-r border-border text-center font-black text-sm text-emerald-600">
                        {row.totalAppliedQuantity ?? "---"}
                      </TableCell>
                      <TableCell className="border-r border-border text-center font-mono text-sm font-bold">
                        {(() => {
                          const picked = row.totalPickedQuantity || 0;
                          const applied = row.totalAppliedQuantity || 0;
                          const rawVariance = applied - picked;
                          
                          if (!row.hasPDP) {
                            return <span className="text-muted-foreground opacity-50">---</span>;
                          }

                          return (
                            <span className={rawVariance < 0 ? "text-rose-500" : rawVariance > 0 ? "text-amber-500" : "text-emerald-500"}>
                              {rawVariance > 0 ? "+" : ""}{rawVariance}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm font-black">
                        {(() => {
                          const picked = row.totalPickedQuantity || 0;
                          const applied = row.totalAppliedQuantity || 0;
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
                {isFetchingMore && (
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell colSpan={8} className="py-8 text-center">
                      <div className="flex items-center justify-center gap-3">
                         <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></div>
                         </div>
                         <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/50">Loading additional consolidators</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {!hasSearched && !loading && displayedData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed rounded-[2rem] bg-muted/5 animate-in zoom-in-95 duration-500 mt-6">
          <div className="h-20 w-20 bg-muted/10 rounded-full flex items-center justify-center mb-6">
              <Search className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-xl font-semibold text-muted-foreground">Ready to Audit?</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
              Select a date range and status to begin auditing CLDTO records.
          </p>
        </div>
      )}

      <CLDTODetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        consolidatorId={selectedRow?.id || 0}
      />
    </div>
  );
}


