"use client";

import * as React from "react";
import { format } from "date-fns";
import { BranchMovementData, ProductMovementRow } from "../types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, ChevronRight, Calculator, Loader2, ListIcon } from "lucide-react";
import { ConsolidationDispatchTraceRow } from "../types";
import { fetchConsolidationDispatchTrace } from "../providers/fetchProvider";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

type Props = {
    data: BranchMovementData[];
    isLoading?: boolean;
    familyDivisor: number;
    valuationDivisor: number;
    costPerUnit: number | null;
    branchBeginningBalances: Record<number, number>;
    primaryFamilyRunningTotal?: number;
    startDate: string | null;
    endDate: string | null;
};

type UnifiedMovementRow = ProductMovementRow & {
    branchMovements: Record<number, number>;
    runningBalance: number;
    grossAmount: number | null;
};

export function CrossTracingTable({
    data,
    isLoading,
    familyDivisor,
    valuationDivisor,
    costPerUnit,
    branchBeginningBalances,
    primaryFamilyRunningTotal,
    startDate,
    endDate
}: Props) {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [isBBExpanded, setIsBBExpanded] = React.useState(false);
    const [selectedConsolidationDoc, setSelectedConsolidationDoc] = React.useState<string | null>(null);
    const [traceData, setTraceData] = React.useState<ConsolidationDispatchTraceRow[]>([]);
    const [isTracing, setIsTracing] = React.useState(false);

    const handleConsolidationClick = async (row: UnifiedMovementRow) => {
        const docNo = row.docNo;
        const docType = row.docType || "";
        
        const isConsolidation = /consolidation\s*dispatch/i.test(docType) || 
                              /^(CLDTO|CD|PDP|DP)-/i.test(docNo || "");

        if (!isConsolidation) return;

        // Extract PDP number from description (descr) like "Picked for DPS - PDP-01116"
        const protocolMatch = row.descr?.match(/(?:PDP|DP)-[A-Z0-9-]+/i);
        const protocolNo = protocolMatch ? protocolMatch[0] : null;

        // Extract potential Sales Order No from description
        const soMatch = row.descr?.match(/(?!(?:PDP|DP)-)(?:[A-Z]{2,7})-?[0-9]{3,20}/i);
        const orderNo = soMatch ? soMatch[0] : null;

        const targetProductId = row.productId || row.parentId;
        if (!targetProductId) {
            toast.error("Could not trace: Product ID is missing for this movement.");
            return;
        }

        setSelectedConsolidationDoc(docNo);
        setIsTracing(true);
        try {
            const results = await fetchConsolidationDispatchTrace(targetProductId, docNo, protocolNo, orderNo, row.productName);
            setTraceData(results);
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch consolidation trace details.");
        } finally {
            setIsTracing(false);
        }
    };

    const unifiedData = React.useMemo(() => {
        if (data.length === 0) return [];

        // 1. Accumulate all movements with branch context
        const allMovements: (ProductMovementRow & { branchId: number })[] = [];
        data.forEach(branch => {
            branch.movements.forEach(m => {
                allMovements.push({ ...m, branchId: branch.branchId });
            });
        });

        // 2. Sort chronologically
        const sorted = allMovements.sort((a, b) =>
            new Date(a.ts).getTime() - new Date(b.ts).getTime()
        );

        // 3. Calculate total beginning balance across all selected branches
        const totalBB = Object.values(branchBeginningBalances).reduce((sum, val) => sum + val, 0);

        // 4. Process with running balance and Grouping
        const groups: UnifiedMovementRow[] = [];
        let runningBalance = totalBB;

        sorted.forEach((m) => {
            const isPH = m.docNo.toUpperCase().startsWith("PH") || m.docType?.toUpperCase() === "PHYSICAL INVENTORY";

            const phys = m.physical_count !== undefined ? m.physical_count : m.physicalCount;
            const sys = m.system_count !== undefined ? m.system_count : m.systemCount;

            const effectiveUnitCount = (m.unitCount && m.unitCount > 0) ? m.unitCount : (isPH ? valuationDivisor : 1);

            const calcVariance = isPH && phys !== undefined && sys !== undefined
                ? (Number(phys) - Number(sys))
                : Number(m.variance || 0);

            const internalMovement = isPH
                ? (calcVariance * effectiveUnitCount)
                : ((Number(m.inBase) || 0) - (Number(m.outBase) || 0));

            runningBalance += internalMovement;

            const docIdentifier = m.docNo;
            const lastGroup = groups.length > 0 ? groups[groups.length - 1] : null;

            // Merge if same document identifier and not empty
            if (lastGroup && docIdentifier && lastGroup.docNo === docIdentifier) {
                lastGroup.branchMovements[m.branchId] = (lastGroup.branchMovements[m.branchId] || 0) + internalMovement;
                lastGroup.runningBalance = runningBalance;
                lastGroup.grossAmount = costPerUnit ? (runningBalance / valuationDivisor) * costPerUnit : null;
            } else {
                groups.push({
                    ...m,
                    branchMovements: { [m.branchId]: internalMovement },
                    runningBalance,
                    grossAmount: costPerUnit ? (runningBalance / valuationDivisor) * costPerUnit : null
                });
            }
        });

        const rows = groups;

        // ── Family Balance Consolidation (Correction) ────────────────────────
        // Compute the delta between movement-derived final balance and the true 
        // family total from v_running_inventory, then apply it as an offset.
        if (primaryFamilyRunningTotal && primaryFamilyRunningTotal > 0 && rows.length > 0) {
            const movementEndBalance = rows[rows.length - 1].runningBalance;
            const familyDelta = primaryFamilyRunningTotal - movementEndBalance;

            if (Math.abs(familyDelta) >= 1) {
                rows.forEach(row => {
                    row.runningBalance += familyDelta;
                    if (costPerUnit) {
                        row.grossAmount = (row.runningBalance / valuationDivisor) * costPerUnit;
                    }
                });
            }
        }

        const filtered = rows.filter(r => {
            const rowDate = new Date(r.ts);
            if (startDate && rowDate < new Date(startDate)) return false;
            if (endDate && rowDate > new Date(endDate)) return false;
            return true;
        });

        // 4. Search Filtering
        if (!searchQuery) return filtered;
        const query = searchQuery.toLowerCase();
        return filtered.filter(r =>
            (r.docNo || "").toLowerCase().includes(query) ||
            (r.docType || "").toLowerCase().includes(query)
        );
    }, [data, costPerUnit, valuationDivisor, searchQuery, startDate, endDate, primaryFamilyRunningTotal, branchBeginningBalances]);

    const totalBB = React.useMemo(() => {
        return Object.values(branchBeginningBalances).reduce((sum, val) => sum + val, 0);
    }, [branchBeginningBalances]);

    if (data.length === 0 && !isLoading) return null;

    return (
        <Card className="rounded-[2.5rem] border shadow-sm bg-background border-border/40 overflow-hidden">
            <CardContent className="p-0">
                <div className="bg-muted/10 px-8 py-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80">Transaction Ledger</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight opacity-60">Beginning balance, posted movements, and ending balance for the selected branches.</p>
                    </div>

                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                        <Input
                            placeholder="Search document or reference..."
                            className="pl-11 h-11 rounded-2xl border-muted-foreground/10 bg-background/50 focus-visible:ring-primary/20 text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b-2 border-muted/20">
                                <TableHead className="pl-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Document</TableHead>
                                <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Reference No.</TableHead>
                                <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Date</TableHead>
                                {data.map(branch => (
                                    <TableHead key={branch.branchId} className="py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 text-center">
                                        {branch.branchName}
                                    </TableHead>
                                ))}
                                <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-primary/60 text-right">Running Balance</TableHead>
                                <TableHead className="pr-8 py-5 text-[10px] font-black uppercase tracking-widest text-emerald-600/60 text-right">Gross Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Beginning Balance Row */}
                            {!searchQuery && (
                                <TableRow
                                    className="bg-muted/5 hover:bg-muted/10 transition-colors cursor-pointer border-l-4 border-l-blue-500"
                                    onClick={() => setIsBBExpanded(!isBBExpanded)}
                                >
                                    <TableCell className="pl-8 py-5 font-black text-sm text-blue-600 flex items-center gap-2">
                                        {isBBExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        Beginning Balance
                                    </TableCell>
                                    <TableCell className="py-5">
                                        <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tighter opacity-50">Combined Start</Badge>
                                    </TableCell>
                                    <TableCell className="py-5 font-semibold text-muted-foreground/60 tabular-nums">
                                        {startDate ? format(new Date(startDate), "MM/dd/yyyy") : "—"}
                                    </TableCell>
                                    {data.map(branch => {
                                        const bb = (branchBeginningBalances[branch.branchId] || 0) / familyDivisor;
                                        return (
                                            <TableCell key={branch.branchId} className="py-5 text-center">
                                                <span className={cn(
                                                    "text-xs font-black tabular-nums transition-opacity duration-300",
                                                    isBBExpanded ? "opacity-100" : "opacity-0"
                                                )}>
                                                    {bb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                </span>
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell className="py-5 text-right font-black text-sm text-primary tabular-nums tracking-tighter">
                                        {(totalBB / familyDivisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                    </TableCell>
                                    <TableCell className="pr-8 py-5 text-right font-black text-sm text-emerald-700 tabular-nums tracking-tight">
                                        {costPerUnit
                                            ? ((totalBB / valuationDivisor) * costPerUnit).toLocaleString(undefined, { style: 'currency', currency: 'PHP' })
                                            : "—"}
                                    </TableCell>
                                </TableRow>
                            )}

                            {/* Expanded Breakdown Info (Optional helper) */}
                            {isBBExpanded && !searchQuery && (
                                <TableRow className="bg-blue-50/5 hover:bg-transparent">
                                    <TableCell colSpan={3 + data.length + 2} className="px-8 py-3">
                                        <div className="flex items-center gap-4 text-[10px] font-bold text-blue-600/60 uppercase tracking-widest bg-blue-500/5 p-3 rounded-xl border border-blue-500/10">
                                            <Calculator className="h-3.5 w-3.5" />
                                            Beginning balance is aggregated from {data.length} warehouses independently anchored to their first physical inventory record.
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}

                            {unifiedData.map((row, i) => {
                                const rowDocNo = row.docNo;
                                const rowDocType = row.docType || "Movement";
                                const isConsolidation = /consolidation\s*dispatch/i.test(rowDocType) || 
                                                      /^(CLDTO|CD|PDP|DP)-/i.test(rowDocNo || "");

                                return (
                                    <TableRow 
                                        key={i} 
                                        className={cn(
                                            "group transition-all duration-200 border-border/10",
                                            isConsolidation ? "hover:bg-primary/5 cursor-pointer" : "hover:bg-primary/[0.01]"
                                        )}
                                        onClick={() => {
                                            if (isConsolidation) {
                                                handleConsolidationClick(row);
                                            }
                                        }}
                                    >
                                        <TableCell className="pl-8 py-5 font-bold text-sm text-foreground/80">
                                            <div className="flex items-center gap-2">
                                                {rowDocType}
                                                {isConsolidation && <ListIcon className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-5">
                                            {rowDocNo ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span 
                                                        className={cn(
                                                            "text-xs font-black font-mono underline-offset-4 transition-colors",
                                                            isConsolidation 
                                                                ? "text-primary underline decoration-primary/30 cursor-pointer hover:text-primary/70" 
                                                                : "text-primary/80 decoration-primary/20"
                                                        )}
                                                    >
                                                        {rowDocNo}
                                                    </span>
                                                    {isConsolidation && (
                                                        <ListIcon className="h-3 w-3 text-primary opacity-50" />
                                                    )}
                                                </div>
                                            ) : (
                                            <span className="text-muted-foreground/20 italic text-[10px]">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-5">
                                        <span className="text-sm font-semibold text-muted-foreground/70 tabular-nums">
                                            {format(new Date(row.ts), "MM/dd/yyyy")}
                                        </span>
                                    </TableCell>
                                    {data.map(branch => {
                                        const movement = row.branchMovements?.[branch.branchId];
                                        const isRelated = movement !== undefined;
                                        const val = (movement || 0) / familyDivisor;

                                        return (
                                            <TableCell key={branch.branchId} className="py-5 text-center">
                                                {isRelated ? (
                                                    val !== 0 ? (
                                                        <Badge
                                                            className={cn(
                                                                "rounded-lg px-2.5 py-1 text-[11px] font-black border tracking-tight",
                                                                val > 0
                                                                    ? "bg-emerald-500/5 text-emerald-600 border-emerald-500/10"
                                                                    : "bg-rose-500/5 text-rose-600 border-rose-500/10"
                                                            )}
                                                        >
                                                            {val > 0 ? `+${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-muted-foreground/40 tabular-nums uppercase tracking-widest">0.00</span>
                                                    )
                                                ) : (
                                                    <span className="text-muted-foreground/5 tabular-nums">—</span>
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell className="py-5 text-right font-black text-sm text-primary tabular-nums tracking-tighter">
                                        {(row.runningBalance / familyDivisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                    </TableCell>
                                    <TableCell className="pr-8 py-5 text-right font-black text-sm text-emerald-700 tabular-nums tracking-tight">
                                        {row.grossAmount != null
                                            ? row.grossAmount.toLocaleString(undefined, { style: 'currency', currency: 'PHP' })
                                            : "—"}
                                    </TableCell>
                                </TableRow>
                                );
                            })}

                            {/* Ending Balance Row */}
                            {unifiedData.length > 0 && (
                                <TableRow className="bg-primary/5 hover:bg-primary/10 transition-colors border-t-2 border-primary/20">
                                    <TableCell className="pl-8 py-6 font-black text-sm text-primary uppercase tracking-wider">
                                        Ending Balance
                                    </TableCell>
                                    <TableCell className="py-6">
                                        <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tighter bg-primary/10 text-primary border-primary/20">Final Position</Badge>
                                    </TableCell>
                                    <TableCell className="py-6 font-semibold text-muted-foreground/60 tabular-nums">
                                        {endDate ? format(new Date(endDate), "MM/dd/yyyy") : "Today"}
                                    </TableCell>
                                    {data.map(branch => {
                                        // Calculate ending balance for this specific branch
                                        const branchMovementTotal = unifiedData
                                            .reduce((sum, r) => sum + (r.branchMovements?.[branch.branchId] || 0), 0);
                                        const endingBal = ((branchBeginningBalances[branch.branchId] || 0) + branchMovementTotal) / familyDivisor;

                                        return (
                                            <TableCell key={branch.branchId} className="py-6 text-center">
                                                <Badge variant="secondary" className="bg-background/80 text-foreground font-black tabular-nums border-primary/10 px-3 py-1 text-xs">
                                                    {endingBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                </Badge>
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell className="py-6 text-right font-black text-lg text-primary tabular-nums tracking-tighter">
                                        {(unifiedData[unifiedData.length - 1].runningBalance / familyDivisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                    </TableCell>
                                    <TableCell className="pr-8 py-6 text-right font-black text-lg text-emerald-700 tabular-nums tracking-tight">
                                        {unifiedData[unifiedData.length - 1].grossAmount?.toLocaleString(undefined, { style: 'currency', currency: 'PHP' })}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* Consolidation Dispatches Trace Dialog */}
            <Dialog open={!!selectedConsolidationDoc} onOpenChange={(open) => !open && setSelectedConsolidationDoc(null)}>
                <DialogContent className="sm:max-w-6xl w-full rounded-[2.5rem] border shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-8 bg-primary/5 border-b">
                        <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                            <div className="p-2.5 bg-primary/10 rounded-2xl">
                                <ListIcon className="h-6 w-6 text-primary" />
                            </div>
                            Consolidation Dispatches Summary
                        </DialogTitle>
                        <DialogDescription className="font-mono mt-1 text-sm bg-background/50 px-3 py-1.5 rounded-lg inline-block w-fit border border-primary/10">
                            Ref: {selectedConsolidationDoc}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[60vh] overflow-y-auto min-h-[350px] flex flex-col">
                        {isTracing ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
                                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-60">Tracing sales orders...</p>
                            </div>
                        ) : traceData.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-24 text-center space-y-4">
                                <div className="h-16 w-16 bg-muted/20 rounded-full flex items-center justify-center">
                                    <Search className="h-8 w-8 text-muted-foreground/30" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-lg font-black opacity-40 uppercase tracking-tight">No records found</p>
                                    <p className="text-xs font-medium text-muted-foreground max-w-[280px] mx-auto opacity-60">No related invoice details were found for this product in the consolidation flow.</p>
                                </div>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-muted/20 sticky top-0 backdrop-blur-md z-10">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest pl-10 py-5 text-muted-foreground/50">Sales Invoice</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-5 text-muted-foreground/50">Customer Name</TableHead>
                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-5 text-muted-foreground/50">Quantity</TableHead>
                                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-5 text-muted-foreground/50">UOM</TableHead>
                                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest py-5 text-muted-foreground/50">Status</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest pr-10 py-5 text-muted-foreground/50">Remarks</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {traceData.map((row, i) => (
                                        <TableRow key={i} className="hover:bg-muted/50 border-muted/50 transition-colors group">
                                            <TableCell className="text-xs font-black py-5 pl-10 font-mono text-primary/80" title={row.sales_invoice}>
                                                {row.sales_invoice}
                                            </TableCell>
                                            <TableCell className="text-sm font-bold py-5 text-foreground/70">
                                                {row.customer_name}
                                            </TableCell>
                                            <TableCell className="text-right text-base font-black py-5 tabular-nums tracking-tighter">
                                                {(row.quantity ?? 0).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center py-5">
                                                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-muted/10 border-muted-foreground/10">
                                                    {row.uom}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center py-5">
                                                <Badge className={cn(
                                                    "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border shadow-sm",
                                                    row.order_status === "Remitted" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                                        row.order_status === "Dispatched" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                                                            row.order_status === "Posted" ? "bg-orange-500/10 text-orange-600 border-orange-500/20" :
                                                                row.order_status === "Receipt" ? "bg-purple-500/10 text-purple-600 border-purple-500/20" :
                                                                    "bg-muted text-muted-foreground font-medium"
                                                )}>
                                                    {row.order_status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs italic text-muted-foreground/60 py-5 pr-10 max-w-[150px] truncate" title={row.remarks || ""}>
                                                {row.remarks || "—"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    <div className="p-6 bg-muted/30 border-t flex justify-end">
                        <Badge variant="outline" className="px-4 py-1.5 font-black text-[11px] uppercase tracking-widest rounded-xl bg-background border-primary/10 text-primary/60">
                            Total Records Found: {traceData.length}
                        </Badge>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
