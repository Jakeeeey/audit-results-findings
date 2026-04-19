//src/modules/supply-chain-management/traceability-compliance/product-tracing/components/PhysicalInventorySummary.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { ProductMovementRow } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { PackageSearch as PHIcon } from "lucide-react";

interface PHRow {
    docNo: string;
    units: Record<string, number>;
    ts: string;
    balBefore: number;
    balAfter: number;
}

interface Props {
    movements: ProductMovementRow[];
    baseUnitName: string;
    baseUnitDivisor: number;
    costPerUnit: number | null;
    beginningBaseBalance: number;
    familyRunningTotal?: number;
}

export const PhysicalInventorySummary: React.FC<Props> = ({ movements, baseUnitName, baseUnitDivisor, costPerUnit, beginningBaseBalance, familyRunningTotal }) => {
    // 1. Calculate running balances chronologically so we can map Beginning and Ending Balance of a PH event
    const sortedData = [...movements].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    
    let currentBalance = beginningBaseBalance || 0;
    const phBalancesBefore: Record<string, number> = {};
    const phBalancesAfter: Record<string, number> = {};

    sortedData.forEach(m => {
        const isPH = m.docNo.toUpperCase().startsWith("PH") || m.docType?.toUpperCase() === "PHYSICAL INVENTORY";
        const phys = m.physical_count !== undefined ? m.physical_count : m.physicalCount;
        const sys = m.system_count !== undefined ? m.system_count : m.systemCount;
        // Use variance from API if available (newly added to the view), otherwise fallback to manual calc
        const calcVariance = isPH ? (m.variance ?? ((phys || 0) - (sys || 0))) : 0;
        const movement = isPH ? (calcVariance * (m.unitCount || 1)) : ((m.inBase || 0) - (m.outBase || 0));
        
        if (isPH && phBalancesBefore[m.docNo] === undefined) {
            phBalancesBefore[m.docNo] = currentBalance;
        }

        currentBalance += movement;

        if (isPH) {
            phBalancesAfter[m.docNo] = currentBalance;
        }
    });

    // ── Family Balance Consolidation ──────────────────────────────────────
    // Apply the same correction delta as in the main ledger table
    if (familyRunningTotal && familyRunningTotal > 0 && sortedData.length > 0) {
        const movementEndBalance = currentBalance;
        const familyDelta = familyRunningTotal - movementEndBalance;

        if (Math.abs(familyDelta) >= 1) {
            Object.keys(phBalancesBefore).forEach(key => phBalancesBefore[key] += familyDelta);
            Object.keys(phBalancesAfter).forEach(key => phBalancesAfter[key] += familyDelta);
        }
    }

    const phMovements = sortedData.filter(m =>
        m.docNo.toUpperCase().startsWith("PH") ||
        m.docType?.toUpperCase() === "PHYSICAL INVENTORY"
    );

    if (phMovements.length === 0) return null;

    // 2. Group by docNo and pivot by unit
    const grouped = phMovements.reduce((acc, m) => {
        if (!acc[m.docNo]) {
            acc[m.docNo] = {
                docNo: m.docNo,
                units: {},
                ts: m.ts,
                balBefore: phBalancesBefore[m.docNo] || 0,
                balAfter: phBalancesAfter[m.docNo] || 0
            };
        }

        const unit = m.unit || "Base";
        const phys = m.physical_count !== undefined ? m.physical_count : m.physicalCount;
        const sys = m.system_count !== undefined ? m.system_count : m.systemCount;

        // Use variance from API if available, otherwise calculate from counts
        const v = m.variance ?? (phys !== undefined && sys !== undefined ? ((Number(phys) || 0) - (Number(sys) || 0)) : undefined);
        
        if (v !== undefined && v !== null) {
             acc[m.docNo].units[unit] = (acc[m.docNo].units[unit] || 0) + v;
        }

        return acc;
    }, {} as Record<string, PHRow>);

    const rows = Object.values(grouped).sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    const allUnits = Array.from(new Set(phMovements.map(m => m.unit || "Base"))).sort();

    return (
        <Card className="rounded-[2rem] border shadow-sm bg-background border-border/40 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            <CardContent className="p-8">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-1.5 bg-primary/10 rounded-lg">
                        <PHIcon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Physical Inventory List</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border/40">
                                <th className="pb-4 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">PH</th>
                                <th className="pb-4 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] text-right">Beginning Balance</th>
                                {allUnits.map(unit => (
                                    <th key={unit} className="pb-4 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] text-right">{unit}</th>
                                ))}
                                <th className="pb-4 text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] text-right">Run.Inv ({baseUnitName})</th>
                                <th className="pb-4 text-[10px] font-black text-emerald-600/60 uppercase tracking-[0.2em] text-right">Gross Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {rows.map((row) => (
                                <tr key={row.docNo} className="group hover:bg-muted/5 transition-colors">
                                    <td className="py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-foreground uppercase tracking-tight">{row.docNo}</span>
                                            <span className="text-[10px] font-bold text-muted-foreground opacity-60 uppercase mt-0.5">{format(new Date(row.ts), "MMM dd, yyyy")}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 text-right">
                                        <span className="text-sm font-bold text-muted-foreground tabular-nums">
                                            {(row.balBefore / baseUnitDivisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                        </span>
                                    </td>
                                    {allUnits.map(unit => {
                                        const val = row.units[unit];
                                        return (
                                            <td key={unit} className="py-4 text-right">
                                                <span className="text-sm font-bold text-foreground/80 tabular-nums">
                                                    {(val !== undefined && val !== null) ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "—"}
                                                </span>
                                            </td>
                                        );
                                    })}
                                    <td className="py-4 text-right">
                                        <span className="text-sm font-black text-primary tabular-nums">
                                            {(row.balAfter / baseUnitDivisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right">
                                        <span className="text-sm font-black tabular-nums text-emerald-700/90 bg-emerald-500/10 px-4 rounded-md inline-block py-1">
                                            {costPerUnit != null ? ((row.balAfter / baseUnitDivisor) * costPerUnit).toLocaleString(undefined, { style: 'currency', currency: 'PHP' }) : '—'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};
