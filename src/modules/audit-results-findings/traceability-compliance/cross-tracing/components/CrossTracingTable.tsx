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
import { Search, ChevronDown, ChevronRight, Calculator } from "lucide-react";

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

                            {unifiedData.map((row, i) => (
                                <TableRow key={i} className="group hover:bg-primary/[0.01] transition-all duration-200 border-border/10">
                                    <TableCell className="pl-8 py-5 font-bold text-sm text-foreground/80">
                                        {row.docType || "Movement"}
                                    </TableCell>
                                    <TableCell className="py-5">
                                        {row.docNo ? (
                                            <span className="text-xs font-black font-mono text-primary/80 underline decoration-primary/20 underline-offset-4 cursor-pointer hover:text-primary transition-colors">
                                                {row.docNo}
                                            </span>
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
                                        const movement = row.branchMovements?.[branch.branchId] || 0;
                                        const val = movement / familyDivisor;
                                        return (
                                            <TableCell key={branch.branchId} className="py-5 text-center">
                                                {val !== 0 ? (
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
                            ))}

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
        </Card>
    );
}
