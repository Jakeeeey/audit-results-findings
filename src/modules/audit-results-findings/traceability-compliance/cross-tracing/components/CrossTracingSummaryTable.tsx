"use client";

import * as React from "react";
import { format } from "date-fns";
import { BranchMovementData, ProductMovementRow } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Calculator, Building2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
    data: BranchMovementData[];
    familyDivisor: number;
    valuationDivisor: number;
    familyUnitName: string;
    costPerUnit: number | null;
    startDate: string | null;
    endDate: string | null;
    beginningBaseBalance: number;
    branchBeginningBalances: Record<number, number>;
    primaryFamilyRunningTotal?: number;
};

type SummaryRow = {
    date: string;
    docNo: string;
    beginningBalance: number;
    branchValues: Record<number, number>;
    total: number;
    grossAmount: number | null;
    isBeginning?: boolean;
};

export function CrossTracingSummaryTable({
    data,
    familyDivisor,
    valuationDivisor,
    familyUnitName,
    costPerUnit,
    startDate,
    endDate,
    beginningBaseBalance,
    branchBeginningBalances,
    primaryFamilyRunningTotal
}: Props) {
    const tableData = React.useMemo(() => {
        if (data.length === 0) return [];

        // 1. Accumulate all movements across all branches (not just PI)
        const allMovements: (ProductMovementRow & { branchId: number; branchName: string })[] = [];
        data.forEach(branch => {
            branch.movements.forEach(m => {
                allMovements.push({
                    ...m,
                    branchId: branch.branchId,
                    branchName: branch.branchName
                });
            });
        });

        // 2. Sort chronologically
        const sorted = allMovements.sort((a, b) => 
            new Date(a.ts).getTime() - new Date(b.ts).getTime()
        );

        // 3. Process with running balance
        const groups: SummaryRow[] = [];
        let cumulativeTotal = beginningBaseBalance || 0;

        sorted.forEach((m) => {
            const isPH = m.docNo.toUpperCase().startsWith("PH") || m.docType?.toUpperCase() === "PHYSICAL INVENTORY";
            
            const phys = m.physical_count !== undefined ? m.physical_count : m.physicalCount;
            const sys = m.system_count !== undefined ? m.system_count : m.systemCount;
            
            const effectiveUnitCount = (m.unitCount && m.unitCount > 0) ? m.unitCount : (isPH ? valuationDivisor : 1);

            const calcVariance = isPH && phys !== undefined && sys !== undefined 
                ? (Number(phys) - Number(sys)) 
                : Number(m.variance || 0);

            // Calculate internal movement delta (same logic as ledger)
            const internalMovement = isPH 
                ? (calcVariance * effectiveUnitCount) 
                : ((Number(m.inBase) || 0) - (Number(m.outBase) || 0));
            
            const beforeBalance = cumulativeTotal;
            cumulativeTotal += internalMovement;

            // Only emit rows for Physical Inventory milestones
            if (isPH) {
                const physInBase = Number(phys || 0) * effectiveUnitCount;
                const lastGroup = groups.length > 0 ? groups[groups.length - 1] : null;
                
                if (lastGroup && lastGroup.docNo === m.docNo) {
                    // Same PH document across branches - aggregate the branch-specific physical count
                    lastGroup.branchValues[m.branchId] = (lastGroup.branchValues[m.branchId] || 0) + physInBase;
                    lastGroup.total = cumulativeTotal; 
                    lastGroup.grossAmount = costPerUnit ? (cumulativeTotal / valuationDivisor) * costPerUnit : null;
                } else {
                    // New PH milestone row
                    groups.push({
                        date: m.ts,
                        docNo: m.docNo,
                        beginningBalance: beforeBalance,
                        branchValues: { [m.branchId]: physInBase }, 
                        total: cumulativeTotal,
                        grossAmount: costPerUnit ? (cumulativeTotal / valuationDivisor) * costPerUnit : null
                    });
                }
            }
        });

        // ── Family Balance Consolidation (Correction) ────────────────────────
        // Apply delta to summary total if provided, synchronized with ledger
        if (primaryFamilyRunningTotal && primaryFamilyRunningTotal > 0 && groups.length > 0) {
            const movementEndBalance = cumulativeTotal;
            const familyDelta = primaryFamilyRunningTotal - movementEndBalance;

            if (Math.abs(familyDelta) >= 1) {
                groups.forEach(row => {
                    row.total += familyDelta;
                    row.beginningBalance += familyDelta;
                    if (costPerUnit) {
                        row.grossAmount = (row.total / valuationDivisor) * costPerUnit;
                    }
                });
            }
        }

        // 4. Final display filtering
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        const filtered = groups.filter(r => {
            const d = new Date(r.date);
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        });

        // 5. Mark first visible row as the Beginning for display purposes
        return filtered.map((r, i) => ({
            ...r,
            isBeginning: i === 0
        }));
    }, [data, costPerUnit, startDate, endDate, beginningBaseBalance, primaryFamilyRunningTotal, valuationDivisor]);

    if (data.length === 0) return null;

    return (
        <Card className="rounded-[2rem] border shadow-sm bg-background/50 backdrop-blur-sm border-border/40 overflow-hidden">
            <CardContent className="p-0">
                <div className="bg-muted/30 px-8 py-5 border-b flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/60">Inventory Summary Matrix</span>
                    <Badge variant="outline" className="rounded-full px-3 py-1 bg-background/50 text-[10px] uppercase font-bold tracking-widest text-primary/70 border-primary/10">
                        {familyUnitName} based
                    </Badge>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b-2 border-muted/20">
                                <TableHead className="pl-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Date</TableHead>
                                <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 text-center">Physical Count No.</TableHead>
                                <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 text-center">Beg.</TableHead>
                                {data.map(branch => (
                                    <TableHead key={branch.branchId} className="py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 text-center">
                                        {branch.branchName}
                                    </TableHead>
                                ))}
                                <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-primary/60 text-right">Total Inventory</TableHead>
                                <TableHead className="pr-8 py-5 text-[10px] font-black uppercase tracking-widest text-emerald-600/60 text-right">Gross Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Manual Beginning Balance Row */}
                            <TableRow className="bg-blue-500/[0.02] hover:bg-blue-500/[0.04] transition-all duration-300 border-border/20">
                                <TableCell className="pl-8 py-5">
                                    <span className="text-sm font-semibold text-blue-600/70 tabular-nums uppercase tracking-tight">
                                        {startDate ? format(new Date(startDate), "MM/dd/yyyy HH:mm") : "—"}
                                    </span>
                                </TableCell>
                                <TableCell className="py-5 text-center">
                                    <Badge variant="outline" className="font-black text-[10px] uppercase tracking-[0.15em] bg-blue-500/5 text-blue-600 border-blue-500/10 px-3 py-1.5 rounded-xl shadow-sm">
                                        Beginning Balance
                                    </Badge>
                                </TableCell>
                                <TableCell className="py-5 text-center">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <div className="inline-flex items-center gap-1.5 bg-blue-600 text-blue-50 font-black text-xs px-4 py-2 rounded-2xl border border-blue-400/20 shadow-lg shadow-blue-500/20 cursor-pointer hover:bg-blue-700 hover:scale-105 transition-all group/beg">
                                                {(beginningBaseBalance / familyDivisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                <ArrowUpRight className="h-4 w-4 opacity-50 group-hover/beg:opacity-100 transition-opacity" />
                                            </div>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[480px] rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0 bg-background">
                                            <div className="bg-primary/5 px-8 py-10 border-b border-primary/10">
                                                <DialogHeader className="space-y-3 text-left">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2.5 bg-primary/10 rounded-2xl">
                                                            <Calculator className="h-6 w-6 text-primary" />
                                                        </div>
                                                        <DialogTitle className="text-2xl font-black tracking-tight text-foreground">Beginning Balance Breakdown</DialogTitle>
                                                    </div>
                                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-relaxed opacity-70">
                                                        Independent physical inventory anchoring across all selected locations.
                                                    </p>
                                                </DialogHeader>
                                            </div>
                                            <div className="px-8 py-10 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                                <div className="grid gap-3">
                                                    {data.map((branch) => {
                                                        const count = (branchBeginningBalances[branch.branchId] || 0) / familyDivisor;
                                                        return (
                                                            <div key={branch.branchId} className="flex items-center justify-between p-5 rounded-[1.75rem] border border-border/40 bg-muted/20 hover:bg-muted/30 transition-all hover:border-primary/20 group">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="p-2.5 bg-background rounded-2xl border border-border/40 shadow-sm group-hover:scale-110 transition-transform">
                                                                        <Building2 className="h-4 w-4 text-primary/60" />
                                                                    </div>
                                                                    <div className="space-y-0.5">
                                                                        <h4 className="text-[11px] font-black uppercase tracking-[0.1em] text-foreground/90">{branch.branchName}</h4>
                                                                        <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-tight">Location Balance</p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-lg font-black text-primary tabular-nums tracking-tighter">
                                                                        {count.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                                    </span>
                                                                    <span className="ml-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">{familyUnitName}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="px-8 py-6 bg-muted/10 border-t border-border/10 flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Aggregate Inventory</span>
                                                <span className="text-xl font-black text-primary tracking-tighter tabular-nums">
                                                    {(beginningBaseBalance / familyDivisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                </span>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </TableCell>
                                {data.map(branch => {
                                    const val = (branchBeginningBalances[branch.branchId] || 0) / familyDivisor;
                                    return (
                                        <TableCell key={branch.branchId} className="py-5 text-center px-4">
                                            <span className="text-sm font-black text-foreground/30 tabular-nums drop-shadow-sm italic">
                                                {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                            </span>
                                        </TableCell>
                                    );
                                })}
                                <TableCell className="py-5 text-right">
                                    <span className="text-sm font-black text-primary tabular-nums tracking-tight">
                                        {(beginningBaseBalance / familyDivisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                    </span>
                                </TableCell>
                                <TableCell className="pr-8 py-5 text-right">
                                    <span className="text-sm font-black tabular-nums text-emerald-700 bg-emerald-500/5 px-4 py-2 rounded-2xl border border-emerald-500/10 shadow-sm inline-block min-w-[120px]">
                                        {costPerUnit 
                                            ? ((beginningBaseBalance / valuationDivisor) * costPerUnit).toLocaleString(undefined, { style: 'currency', currency: 'PHP' }) 
                                            : "—"}
                                    </span>
                                </TableCell>
                            </TableRow>

                            {tableData.map((row, i) => (
                                <TableRow key={i} className="group hover:bg-primary/[0.02] transition-all duration-300 border-border/20">
                                    <TableCell className="pl-8 py-5">
                                        <span className="text-sm font-semibold text-muted-foreground/80 tabular-nums">
                                            {format(new Date(row.date), "MM/dd/yyyy HH:mm")}
                                        </span>
                                    </TableCell>
                                    <TableCell className="py-5 text-center">
                                        {row.isBeginning && !row.docNo ? (
                                            <span className="opacity-0">—</span>
                                        ) : (
                                            <Badge variant="secondary" className="font-mono text-[10px] font-bold bg-muted/50 text-muted-foreground hover:bg-muted transition-colors px-3 py-1 rounded-lg">
                                                {row.docNo}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-5 text-center">
                                        {row.isBeginning ? (
                                            <div className="inline-flex items-center gap-1.5 bg-blue-500/5 text-blue-600 font-black text-xs px-3 py-1.5 rounded-xl border border-blue-500/10 shadow-sm shadow-blue-500/5">
                                                {(row.beginningBalance / familyDivisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                <ArrowUpRight className="h-3 w-3 opacity-60" />
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground/20">—</span>
                                        )}
                                    </TableCell>
                                    {data.map(branch => {
                                        const val = row.branchValues[branch.branchId];
                                        return (
                                            <TableCell key={branch.branchId} className="py-5 text-center px-4">
                                                {val !== undefined ? (
                                                    <span className="text-sm font-black text-foreground tabular-nums drop-shadow-sm">
                                                        {(val / familyDivisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground/10">—</span>
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell className="py-5 text-right">
                                        <span className="text-sm font-black text-primary tabular-nums tracking-tight">
                                            {(row.total / familyDivisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                        </span>
                                    </TableCell>
                                    <TableCell className="pr-8 py-5 text-right">
                                        <span className="text-sm font-black tabular-nums text-emerald-700 bg-emerald-500/5 px-4 py-2 rounded-2xl border border-emerald-500/10 shadow-sm inline-block min-w-[120px]">
                                            {row.grossAmount != null 
                                                ? row.grossAmount.toLocaleString(undefined, { style: 'currency', currency: 'PHP' }) 
                                                : "—"}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
