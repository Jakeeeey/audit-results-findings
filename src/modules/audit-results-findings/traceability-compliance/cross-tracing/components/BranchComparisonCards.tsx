//src/modules/supply-chain-management/traceability-compliance/cross-tracing/components/BranchComparisonCards.tsx
"use client";

import * as React from "react";
import { BranchMovementData } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { 
    ArrowUpCircle as InIcon, 
    ArrowDownCircle as OutIcon, 
    Activity as TrendIcon,
    Building2 as BranchIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
    data: BranchMovementData[];
    familyDivisor: number;
    familyUnitName: string;
};

export function BranchComparisonCards({ data, familyDivisor, familyUnitName }: Props) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.map((branch) => {
                let totalIn = 0;
                let totalOut = 0;

                branch.movements.forEach(m => {
                    const isPH = m.docNo.toUpperCase().startsWith("PH") || m.docType?.toUpperCase() === "PHYSICAL INVENTORY";
                    const phys = m.physical_count !== undefined ? m.physical_count : m.physicalCount;
                    const sys = m.system_count !== undefined ? m.system_count : m.systemCount;
                    const calcVariance = isPH && phys !== undefined && sys !== undefined 
                        ? (Number(phys) - Number(sys)) 
                        : Number(m.variance || 0);

                    const movement = isPH 
                        ? (calcVariance * (m.unitCount || 1)) 
                        : ((Number(m.inBase) || 0) - (Number(m.outBase) || 0));

                    if (movement > 0) {
                        totalIn += movement;
                    } else if (movement < 0) {
                        totalOut += Math.abs(movement);
                    }
                });

                totalIn /= familyDivisor;
                totalOut /= familyDivisor;
                const netChange = totalIn - totalOut;

                return (
                    <Card key={branch.branchId} className="rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all overflow-hidden border-border/40">
                        <div className="h-1 bg-primary/20 w-full" />
                        <CardContent className="p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <BranchIcon className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-sm truncate uppercase tracking-tight">{branch.branchName}</h3>
                                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Branch Summary</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-emerald-600">
                                        <InIcon className="h-3 w-3" />
                                        <span className="text-[9px] font-black uppercase tracking-wider">Total In</span>
                                    </div>
                                    <p className="text-lg font-black tabular-nums">{totalIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} <span className="text-[10px] text-muted-foreground font-bold">{familyUnitName}</span></p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-amber-600">
                                        <OutIcon className="h-3 w-3" />
                                        <span className="text-[9px] font-black uppercase tracking-wider">Total Out</span>
                                    </div>
                                    <p className="text-lg font-black tabular-nums">{totalOut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} <span className="text-[10px] text-muted-foreground font-bold">{familyUnitName}</span></p>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <TrendIcon className={cn("h-3 w-3", netChange >= 0 ? "text-emerald-500" : "text-amber-500")} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Net Change</span>
                                </div>
                                <span className={cn(
                                    "text-sm font-black tabular-nums px-2 py-0.5 rounded-full",
                                    netChange >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                                )}>
                                    {netChange >= 0 ? "+" : ""}{netChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
