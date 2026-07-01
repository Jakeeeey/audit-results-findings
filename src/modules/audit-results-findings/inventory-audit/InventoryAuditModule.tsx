"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, AlertCircle, ShieldAlert, CheckCircle2, Receipt, ArrowRight, TrendingDown, Clock, CheckCircle, ChevronsUpDown, Check, Building2, PackageOpen } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import { InventoryAuditFinding, Branch, User } from "./types";
import { useInventoryAudit } from "./hooks/useInventoryAudit";
import { InventoryResolutionSheet } from "./components/InventoryResolutionSheet";

export default function InventoryAuditModule() {
    const { audits, loading, fetchAudits, branches, fetchBranchesList, kpis, loadingKpis, fetchKpis } = useInventoryAudit();

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("PENDING_REVIEW");
    const [branchFilter, setBranchFilter] = useState<string>("ALL");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [openCombobox, setOpenCombobox] = useState(false);
    const [selectedAudit, setSelectedAudit] = useState<InventoryAuditFinding | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    useEffect(() => {
        fetchBranchesList();
    }, [fetchBranchesList]);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(handler);
    }, [search]);

    useEffect(() => {
        fetchKpis(branchFilter);
    }, [branchFilter, fetchKpis]);

    useEffect(() => {
        fetchAudits(1, debouncedSearch, statusFilter === "ALL" ? "" : statusFilter, branchFilter);
    }, [debouncedSearch, statusFilter, branchFilter, fetchAudits]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PENDING_REVIEW": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none font-black text-[9px] uppercase"><AlertCircle className="w-3 h-3 mr-1" /> Pending</Badge>;
            case "APPROVED_FOR_DEDUCTION": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none font-black text-[9px] uppercase"><ShieldAlert className="w-3 h-3 mr-1" /> For Deduction</Badge>;
            case "SETTLED_CASH": return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none font-black text-[9px] uppercase"><CheckCircle2 className="w-3 h-3 mr-1" /> Cash Settled</Badge>;
            case "DEDUCTED_PAYROLL": return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none font-black text-[9px] uppercase"><Receipt className="w-3 h-3 mr-1" /> Payroll Settled</Badge>;
            case "ADJUSTED": return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-none font-black text-[9px] uppercase"><PackageOpen className="w-3 h-3 mr-1" /> Adjusted</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive shadow-inner">
                        <PackageOpen className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">
                            Inventory Audit
                        </h1>
                        <p className="text-sm text-muted-foreground font-medium">
                            Manage and resolve physical inventory shortages.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="shadow-sm border-amber-200 bg-amber-50/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-amber-700 tracking-widest">Pending Reviews</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500 opacity-50" />
                    </CardHeader>
                    <CardContent>
                        {loadingKpis ? <div className="h-8 w-12 bg-amber-200/50 rounded animate-pulse" /> : <div className="text-2xl font-black text-amber-700">{kpis.pendingCount}</div>}
                        <p className="text-xs text-amber-600/70 font-bold mt-1">Requires immediate action</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-destructive/20 bg-destructive/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-destructive tracking-widest">Total Shortage Value</CardTitle>
                        <TrendingDown className="h-4 w-4 text-destructive opacity-50" />
                    </CardHeader>
                    <CardContent>
                        {loadingKpis ? <div className="h-8 w-32 bg-destructive/10 rounded animate-pulse" /> : (
                            <div className="text-2xl font-black text-destructive">
                                ₱ {kpis.totalShortage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        )}
                        <p className="text-xs text-destructive/70 font-bold mt-1">Unresolved physical discrepancies</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-emerald-200 bg-emerald-50/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Resolved Audits</CardTitle>
                        <CheckCircle className="h-4 w-4 text-emerald-500 opacity-50" />
                    </CardHeader>
                    <CardContent>
                        {loadingKpis ? <div className="h-8 w-12 bg-emerald-200/50 rounded animate-pulse" /> : <div className="text-2xl font-black text-emerald-700">{kpis.resolvedCount}</div>}
                        <p className="text-xs text-emerald-600/70 font-bold mt-1">Settled or adjusted</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm border-border overflow-hidden">
                <div className="p-4 border-b bg-card flex flex-col xl:flex-row items-center justify-between gap-4">
                    <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full xl:w-auto overflow-x-auto">
                        <TabsList className="h-10 w-full xl:w-auto flex justify-start">
                            <TabsTrigger value="ALL" className="text-xs font-bold uppercase shrink-0">All Shortages</TabsTrigger>
                            <TabsTrigger value="PENDING_REVIEW" className="text-xs font-bold uppercase text-amber-600 shrink-0">Pending</TabsTrigger>
                            <TabsTrigger value="APPROVED_FOR_DEDUCTION" className="text-xs font-bold uppercase text-blue-600 shrink-0">Deduction Auth</TabsTrigger>
                            <TabsTrigger value="SETTLED_CASH" className="text-xs font-bold uppercase text-emerald-600 shrink-0">Settled (Cash)</TabsTrigger>
                            <TabsTrigger value="DEDUCTED_PAYROLL" className="text-xs font-bold uppercase text-slate-600 shrink-0">Settled (Payroll)</TabsTrigger>
                            <TabsTrigger value="ADJUSTED" className="text-xs font-bold uppercase text-purple-600 shrink-0">Adjusted</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full xl:w-auto">
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCombobox}
                                    className="w-full sm:w-[250px] justify-between h-10 text-xs font-bold uppercase bg-background"
                                >
                                    <div className="flex items-center min-w-0">
                                        <Building2 className="w-4 h-4 mr-2 opacity-50 shrink-0" />
                                        <span className="truncate">
                                            {branchFilter === "ALL"
                                                ? "ALL BRANCHES"
                                                : branches.find((b) => b.id.toString() === branchFilter)?.branch_name || "SELECT BRANCH..."}
                                        </span>
                                    </div>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full sm:w-[250px] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search branch..." className="h-9 text-xs font-bold uppercase" />
                                    <CommandList className="custom-scrollbar">
                                        <CommandEmpty className="text-[10px] font-black uppercase text-center p-4 text-muted-foreground tracking-widest">
                                            No match found.
                                        </CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                value="ALL BRANCHES"
                                                onSelect={() => {
                                                    setBranchFilter("ALL");
                                                    setOpenCombobox(false);
                                                }}
                                                className="text-xs font-bold uppercase tracking-wide cursor-pointer"
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", branchFilter === "ALL" ? "opacity-100" : "opacity-0")} />
                                                ALL BRANCHES
                                            </CommandItem>
                                            {branches.map((b) => (
                                                <CommandItem
                                                    key={b.id}
                                                    value={b.branch_name}
                                                    onSelect={() => {
                                                        setBranchFilter(b.id.toString());
                                                        setOpenCombobox(false);
                                                    }}
                                                    className="text-xs font-bold uppercase tracking-wide cursor-pointer"
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", branchFilter === b.id.toString() ? "opacity-100" : "opacity-0")} />
                                                    {b.branch_name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        <div className="relative w-full sm:w-64 shrink-0">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-50" />
                            <Input
                                placeholder="Search Document..."
                                className="pl-9 h-10 text-xs font-bold uppercase bg-background"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase h-10 px-6">Audit Doc No.</TableHead>
                                <TableHead className="text-[10px] font-black uppercase h-10">Branch</TableHead>
                                <TableHead className="text-[10px] font-black uppercase h-10">Auditor</TableHead>
                                <TableHead className="text-[10px] font-black uppercase h-10 text-right">Shortage Amount</TableHead>
                                <TableHead className="text-[10px] font-black uppercase h-10 text-center">Status</TableHead>
                                <TableHead className="w-[120px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="px-6 py-4"><div className="h-4 w-24 bg-muted rounded animate-pulse"></div></TableCell>
                                        <TableCell className="py-4"><div className="h-4 w-32 bg-muted rounded animate-pulse"></div></TableCell>
                                        <TableCell className="py-4"><div className="h-4 w-20 bg-muted rounded animate-pulse"></div></TableCell>
                                        <TableCell className="py-4"><div className="h-4 w-20 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                                        <TableCell className="py-4"><div className="h-6 w-24 bg-muted rounded-full animate-pulse mx-auto"></div></TableCell>
                                        <TableCell className="py-4"><div className="h-8 w-20 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                                    </TableRow>
                                ))
                            ) : audits.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                                <PackageOpen className="w-8 h-8 text-muted-foreground opacity-50" />
                                            </div>
                                            <span className="text-sm font-black uppercase text-foreground">No Audits Found</span>
                                            <p className="text-xs text-muted-foreground font-medium mt-1">Try adjusting your filters or search terms.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                audits.map((audit) => (
                                    <TableRow key={audit.id} className="hover:bg-muted/30 transition-colors group">
                                        <TableCell className="px-6 py-4">
                                            <span className="text-sm font-black uppercase text-foreground">{audit.doc_no}</span>
                                            <div className="text-[10px] text-muted-foreground font-semibold mt-1">
                                                {format(new Date(audit.date_created), "MMM dd, yyyy")}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <span className="text-xs font-bold uppercase text-muted-foreground">
                                                {typeof audit.branch === 'object' && audit.branch !== null
                                                    ? (audit.branch as Branch).branch_name
                                                    : `Branch ID: ${audit.branch}`}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <span className="text-xs font-semibold text-muted-foreground">
                                                {typeof audit.auditor_id === 'object'
                                                    ? `${(audit.auditor_id as User).user_fname} ${(audit.auditor_id as User).user_lname}`
                                                    : `User ID: ${audit.auditor_id}`}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-4 text-right">
                                            <span className="text-sm font-black text-destructive">
                                                ₱ {audit.total_shortage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-4 text-center">
                                            {getStatusBadge(audit.status)}
                                        </TableCell>
                                        <TableCell className="py-4 pr-6 text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-[10px] font-black uppercase tracking-widest bg-background group-hover:border-primary/50 group-hover:text-primary transition-colors"
                                                onClick={() => { setSelectedAudit(audit); setSheetOpen(true); }}
                                            >
                                                Inspect <ArrowRight className="w-3 h-3 ml-1" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <InventoryResolutionSheet
                audit={selectedAudit}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                onSuccess={() => {
                    setSheetOpen(false);
                    fetchAudits(1, debouncedSearch, statusFilter === "ALL" ? "" : statusFilter, branchFilter);
                    fetchKpis(branchFilter);
                }}
            />
        </div>
    );
}
