//src/modules/supply-chain-management/traceability-compliance/product-tracing/components/ProductTracingTable.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductMovementRow, ConsolidationDispatchTraceRow } from "../types";
import { fetchConsolidationDispatchTrace } from "../providers/fetchProvider";
import { toast } from "sonner";
import { Loader2, ArrowUpDown, ChevronUp, ChevronDown, Layout, Columns } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { ListIcon, EyeIcon } from "lucide-react";

type Props = React.HTMLAttributes<HTMLDivElement> & {
    data: ProductMovementRow[];
    isLoading?: boolean;
    familyDivisor: number;
    familyUnitName: string;
    costPerUnit: number | null;
    beginningBaseBalance?: number;
    familyRunningTotal?: number;
};

export const ProductTracingTable = React.forwardRef<HTMLDivElement, Props>(({ data, isLoading, familyDivisor, familyUnitName, costPerUnit, beginningBaseBalance, familyRunningTotal, className, ...props }, ref) => {
    const [selectedDocNo, setSelectedDocNo] = React.useState<string | null>(null);
    const [selectedConsolidationDoc, setSelectedConsolidationDoc] = React.useState<string | null>(null);
    const [traceData, setTraceData] = React.useState<ConsolidationDispatchTraceRow[]>([]);
    const [isTracing, setIsTracing] = React.useState(false);
    const [showMainUnits, setShowMainUnits] = React.useState(true);
    const [sortConfig, setSortConfig] = React.useState<{ key: string | null; direction: "asc" | "desc" | null }>({
        key: 'ts',
        direction: 'asc'
    });

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current.key === key) {
                if (current.direction === 'asc') return { key, direction: 'desc' };
                return { key: null, direction: null };
            }
            return { key, direction: 'asc' };
        });
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="ml-1 h-3 w-3 text-primary font-bold" />
            : <ChevronDown className="ml-1 h-3 w-3 text-primary font-bold" />;
    };

    const handleConsolidationClick = async (row: ProductMovementRow) => {
        const docNo = row.docNo;
        // Extract PDP number from description (descr) like "Picked for DPS - PDP-01116"
        const protocolMatch = row.descr?.match(/(?:PDP|DP)-[A-Z0-9-]+/i);
        const protocolNo = protocolMatch ? protocolMatch[0] : null;

        // Extract potential Sales Order No from description (regex handles common prefixes like NFPI, SKN, SMPI)
        // specifically avoids matching PDP/DP to prevent collisions
        const soMatch = row.descr?.match(/(?!(?:PDP|DP)-)(?:[A-Z]{2,7})-?[0-9]{3,20}/i);
        const orderNo = soMatch ? soMatch[0] : null;

        const targetProductId = data[0]?.productId || data[0]?.parentId;
        if (!targetProductId) return;

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

    // Identify all unique UOMs present in the data to create dynamic columns
    const uniqueUOMs = React.useMemo(() => {
        const uoms = new Map<string, number>();
        data.forEach(row => {
            if (row.unit) {
                const normalizedUnit = row.unit.trim().toUpperCase();
                const currentCount = uoms.get(normalizedUnit) || 0;
                // If we have conflicting counts for the same unit name (e.g., "Pack"), 
                // prioritize the larger family-standard unit count (e.g., 2 instead of 1)
                if ((row.unitCount || 1) > currentCount) {
                    uoms.set(normalizedUnit, row.unitCount || 1);
                }
            }
        });
        // Include familyUnitName if not already present
        const normalizedFamilyUnit = familyUnitName?.trim().toUpperCase();
        if (normalizedFamilyUnit && !uoms.get(normalizedFamilyUnit)) {
            uoms.set(normalizedFamilyUnit, familyDivisor || 1);
        }

        return Array.from(uoms.entries())
            .sort((a, b) => b[1] - a[1]) // Sort by unitCount descending (e.g., Box > Pack > Pcs)
            .map(([unit, count]) => ({ unit, count }));
    }, [data, familyUnitName, familyDivisor]);

    // Calculate balances then group
    const groupedRows = React.useMemo(() => {
        let currentBaseBalance = beginningBaseBalance || 0;

        // Pass 0: Sort data chronologically ascending for balance calculation
        const sortedData = [...data].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

        // Pass 1: Compute Running Balances
        const enriched = sortedData.map(row => {
            const isPH = row.docType?.toUpperCase() === "PHYSICAL INVENTORY" || row.docNo?.toUpperCase().startsWith("PH");
            const phys = row.physical_count !== undefined ? row.physical_count : row.physicalCount;
            const sys = row.system_count !== undefined ? row.system_count : row.systemCount;
            // Use variance from API if available (newly added to the view), otherwise fallback to manual calc
            const calcVariance = isPH ? (row.variance ?? ((phys || 0) - (sys || 0))) : 0;
            const internalMovement = isPH
                ? (calcVariance * (row.unitCount || 1))
                : ((row.inBase || 0) - (row.outBase || 0));

            const prevBalance = currentBaseBalance;
            currentBaseBalance += internalMovement;

            // The movement shown in the table should explain the change in currentBaseBalance
            const movement = currentBaseBalance - prevBalance;

            const fDivisor = familyDivisor || 1;
            const absMovement = Math.abs(movement);

            const uomBreakdown: Record<string, number> = {};
            uniqueUOMs.forEach(u => uomBreakdown[u.unit] = 0);

            if (isPH) {
                // For PH, we use the variance directly for the unit specified in the row
                if (row.unit) {
                    const normalized = row.unit.trim().toUpperCase();
                    if (uomBreakdown[normalized] !== undefined) {
                        uomBreakdown[normalized] = calcVariance;
                    }
                }
            } else {
                // For non-PH, we use greedy decomposition but PRIORITIZE the row's own unit if it matches a known family column
                let remaining = absMovement;

                const normalizedRowUnit = row.unit?.trim().toUpperCase();
                // If the row explicitly has a unit that matches one of our family columns, use its count first
                if (normalizedRowUnit && row.unitCount && uomBreakdown[normalizedRowUnit] !== undefined) {
                    const explicitCount = Math.floor(remaining / row.unitCount);
                    if (explicitCount > 0) {
                        uomBreakdown[normalizedRowUnit] = (movement < 0 ? -explicitCount : explicitCount);
                        remaining -= explicitCount * row.unitCount;
                    }
                }

                // Decompose any remainder greedily across the established family units
                uniqueUOMs.forEach(u => {
                    const count = Math.floor(remaining / u.count);
                    if (count > 0) {
                        // Avoid double-counting if we already partially filled this unit
                        const currentVal = uomBreakdown[u.unit] || 0;
                        uomBreakdown[u.unit] = (movement < 0 ? currentVal - count : currentVal + count);
                        remaining -= count * u.count;
                    }
                });

                // If pieces are still remaining (e.g. piece count not in uniqueUOMs), 
                // we should keep it logged somewhere, but usually piecewise is the smallest.
            }

            return {
                ...row,
                displayBalance: currentBaseBalance / fDivisor,
                currentBaseBalance,
                isPH,
                absMovement,
                movement,
                effectiveIn: movement > 0 ? absMovement : 0,
                effectiveOut: movement < 0 ? absMovement : 0,
                uomBreakdown
            };
        });

        // ── Family Balance Consolidation ──────────────────────────────────────
        // The movement-computed balance only reflects movements visible in the
        // ledger (usually just one UOM variant). The familyRunningTotal from
        // v_running_inventory represents the TRUE current stock across ALL UOM
        // variants (Box + Pack + Piece) for this family at this branch.
        //
        // We compute the delta between the movement-derived final balance and
        // the true family total, then apply it as an offset to every row so
        // Balance (Box) reflects the consolidated family inventory.
        if (familyRunningTotal && familyRunningTotal > 0 && enriched.length > 0) {
            const movementEndBalance = enriched[enriched.length - 1].currentBaseBalance;
            const familyDelta = familyRunningTotal - movementEndBalance;

            // Only apply if there's a meaningful difference (i.e., sibling UOM
            // variants contribute inventory not captured by the movement rows)
            if (Math.abs(familyDelta) >= 1) {
                const fDiv = familyDivisor || 1;
                enriched.forEach(row => {
                    row.currentBaseBalance += familyDelta;
                    row.displayBalance = row.currentBaseBalance / fDiv;
                });
            }
        }

        // Pass 2: Group by docNo
        const groups: Array<{
            main: typeof enriched[0];
            items: typeof enriched;
            isGroup: boolean;
        }> = [];

        enriched.forEach(row => {
            const lastGroup = groups.length > 0 ? groups[groups.length - 1] : null;

            if (!lastGroup || lastGroup.main.docNo !== row.docNo) {
                groups.push({
                    main: { ...row },
                    items: [row],
                    isGroup: false
                });
            } else {
                lastGroup.items.push(row);
                lastGroup.isGroup = true;

                // Aggregate movements
                lastGroup.main.effectiveIn += row.effectiveIn;
                lastGroup.main.effectiveOut += row.effectiveOut;
                lastGroup.main.movement += row.movement;
                lastGroup.main.absMovement += row.absMovement;

                // Aggregate UOM breakdown
                Object.keys(row.uomBreakdown).forEach(unit => {
                    lastGroup.main.uomBreakdown[unit] = (lastGroup.main.uomBreakdown[unit] || 0) + row.uomBreakdown[unit];
                });

                // Balance should be row's balance (the last item in sequence)
                lastGroup.main.displayBalance = row.displayBalance;
                lastGroup.main.currentBaseBalance = row.currentBaseBalance;
            }
        });

        return groups;
    }, [data, uniqueUOMs, familyDivisor, familyRunningTotal, beginningBaseBalance]);

    const sortedGroupedRows = React.useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) return groupedRows;

        return [...groupedRows].sort((a, b) => {
            let valA: string | number;
            let valB: string | number;

            switch (sortConfig.key) {
                case 'ts':
                    valA = new Date(a.main.ts).getTime();
                    valB = new Date(b.main.ts).getTime();
                    break;
                case 'docType':
                    valA = a.main.docType?.toLowerCase() || '';
                    valB = b.main.docType?.toLowerCase() || '';
                    break;
                case 'qty':
                    valA = a.main.movement / (familyDivisor || 1);
                    valB = b.main.movement / (familyDivisor || 1);
                    break;
                case 'base':
                    valA = a.main.movement;
                    valB = b.main.movement;
                    break;
                default:
                    // Check if it's a dynamic UOM
                    if (sortConfig.key?.startsWith('uom:')) {
                        const unit = sortConfig.key.replace('uom:', '');
                        valA = a.main.uomBreakdown?.[unit] || 0;
                        valB = b.main.uomBreakdown?.[unit] || 0;
                    } else {
                        return 0;
                    }
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [groupedRows, sortConfig, familyDivisor]);

    const selectedGroup = React.useMemo(() => {
        if (!selectedDocNo) return null;
        return sortedGroupedRows.find(g => g.main.docNo === selectedDocNo);
    }, [selectedDocNo, sortedGroupedRows]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-16 w-full animate-pulse bg-muted/40 rounded-2xl border border-muted" />
                ))}
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground border-2 border-dashed rounded-[2.5rem] bg-muted/5">
                <p className="text-xl font-bold text-foreground/80 mb-1">No Trace records</p>
                <p className="text-sm font-medium opacity-60 max-w-xs mx-auto">Try adjusting your filters or selecting a different date range.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end pr-2">
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        "h-8 rounded-xl px-3 text-[10px] uppercase font-bold tracking-widest gap-2 transition-all",
                        !showMainUnits ? "bg-primary/10 text-primary border-primary/20" : "text-muted-foreground opacity-60"
                    )}
                    onClick={() => setShowMainUnits(!showMainUnits)}
                >
                    {showMainUnits ? (
                        <>
                            <Columns className="h-3 w-3" />
                            Hide Qty/Base
                        </>
                    ) : (
                        <>
                            <Layout className="h-3 w-3" />
                            Show Qty/Base
                        </>
                    )}
                </Button>
            </div>

            <Card ref={ref} className={cn("rounded-[2rem] border shadow-sm overflow-hidden bg-background/50 backdrop-blur-sm", className)} {...props}>
                <Table>
                    <TableHeader className="bg-muted/40 border-b">
                        <TableRow className="hover:bg-transparent">
                            <TableHead
                                className="w-[120px] h-12 text-[10px] font-bold uppercase tracking-widest pl-6 cursor-pointer group select-none"
                                onClick={() => handleSort('ts')}
                            >
                                <div className="flex items-center">
                                    Timestamp
                                    <SortIcon columnKey="ts" />
                                </div>
                            </TableHead>
                            <TableHead className="w-[120px] h-12 text-[10px] font-bold uppercase tracking-widest">Reference No.</TableHead>
                            <TableHead
                                className="h-12 text-[10px] font-bold uppercase tracking-widest text-center cursor-pointer group select-none"
                                onClick={() => handleSort('docType')}
                            >
                                <div className="flex items-center justify-center">
                                    Type
                                    <SortIcon columnKey="docType" />
                                </div>
                            </TableHead>
                            <TableHead className="max-w-[200px] h-12 text-[10px] font-bold uppercase tracking-widest underline decoration-dotted underline-offset-4">Description </TableHead>

                            {/* Dynamic UOM Columns */}
                            {uniqueUOMs.map((uom, i) => (
                                <TableHead
                                    key={uom.unit}
                                    className={cn(
                                        "h-12 text-[10px] font-bold uppercase tracking-widest text-right px-4 cursor-pointer group select-none border-l border-muted/20",
                                        i % 2 === 0 ? "bg-muted/20" : "bg-muted/10"
                                    )}
                                    onClick={() => handleSort(`uom:${uom.unit}`)}
                                >
                                    <div className="flex items-center justify-end">
                                        {uom.unit}
                                        <SortIcon columnKey={`uom:${uom.unit}`} />
                                    </div>
                                </TableHead>
                            ))}

                            {showMainUnits && (
                                <>
                                    <TableHead
                                        className="text-right h-12 text-[10px] font-bold uppercase tracking-widest px-4 cursor-pointer group select-none border-l border-muted/20"
                                        onClick={() => handleSort('qty')}
                                    >
                                        <div className="flex items-center justify-end">
                                            Qty ({familyUnitName})
                                            <SortIcon columnKey="qty" />
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="text-right h-12 text-[10px] font-bold uppercase tracking-widest px-4 cursor-pointer group select-none border-l border-muted/20"
                                        onClick={() => handleSort('base')}
                                    >
                                        <div className="flex items-center justify-end">
                                            Base (Pcs)
                                            <SortIcon columnKey="base" />
                                        </div>
                                    </TableHead>
                                </>
                            )}
                            <TableHead className="text-right h-12 text-[10px] font-bold uppercase tracking-widest font-bold px-4 border-l border-muted/20">
                                <div className="flex items-center justify-end">
                                    Balance ({familyUnitName})
                                </div>
                            </TableHead>
                            <TableHead className="text-right h-12 text-[10px] font-bold uppercase tracking-widest font-bold pl-4 pr-6 border-l border-muted/20">
                                <div className="flex items-center justify-end">
                                    Gross Amount
                                </div>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {/* Beginning Balance Row */}
                        {(beginningBaseBalance !== undefined || data.length > 0) && (
                            <TableRow className="bg-muted/10 hover:bg-muted/20 transition-colors border-b-2">
                                <TableCell className="py-4 pl-6" colSpan={4 + uniqueUOMs.length + (showMainUnits ? 2 : 0)}>
                                    <span className="font-bold text-muted-foreground uppercase tracking-widest text-[10px]">
                                        Beginning Balance
                                    </span>
                                </TableCell>
                                <TableCell className="text-right font-black tabular-nums text-foreground/90 bg-muted/20 px-4 border-l border-muted/30">
                                    {((beginningBaseBalance || 0) / (familyDivisor || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                </TableCell>
                                <TableCell className="text-right font-black tabular-nums text-emerald-700/90 bg-emerald-500/10 pl-4 pr-6 border-l border-muted/30">
                                    {costPerUnit != null ? (((beginningBaseBalance || 0) / (familyDivisor || 1)) * costPerUnit).toLocaleString(undefined, { style: 'currency', currency: 'PHP' }) : "—"}
                                </TableCell>
                            </TableRow>
                        )}

                        {sortedGroupedRows.map(({ main: row, items, isGroup }, index) => (
                            <TableRow
                                key={`${row.docNo}-${index}`}
                                className={cn(
                                    "group transition-colors border-muted/50",
                                    isGroup ? "hover:bg-primary/5 cursor-pointer" : "hover:bg-muted/30"
                                )}
                                onClick={() => {
                                    if (isGroup) {
                                        setSelectedDocNo(row.docNo);
                                    } else if (row.docType === "Consolidation Dispatches") {
                                        handleConsolidationClick(row);
                                    }
                                }}
                            >
                                <TableCell className="py-4 pl-6">
                                    <span className="text-[10px] font-bold text-muted-foreground opacity-60 uppercase">{format(new Date(row.ts), "MMM dd, HH:mm")}</span>
                                </TableCell>
                                <TableCell className="py-4">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-mono text-sm font-bold tracking-tight">{row.docNo}</span>
                                        {isGroup && <ListIcon className="h-3 w-3 text-primary opacity-50" />}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="outline" className={cn(
                                        "font-bold text-[9px] uppercase tracking-wider py-0.5 px-2 rounded-full",
                                        row.effectiveIn > 0
                                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                                            : "border-amber-500/20 bg-amber-500/10 text-amber-600"
                                    )}>
                                        {row.docType}
                                    </Badge>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate text-muted-foreground font-medium text-sm" title={row.descr || ""}>
                                    <div className="flex items-center gap-2">
                                        {isGroup ? (
                                            <span className="italic text-primary/80 flex items-center gap-1 font-bold">
                                                Consolidated ({items.length} items)
                                            </span>
                                        ) : (
                                            row.descr || "—"
                                        )}
                                    </div>
                                </TableCell>
                                {/* Dynamic UOM Cells */}
                                {uniqueUOMs.map((uom, i) => {
                                    const val = row.uomBreakdown?.[uom.unit] || 0;
                                    return (
                                        <TableCell key={uom.unit} className={cn(
                                            "text-right font-bold tabular-nums pr-4",
                                            i % 2 === 0 ? "bg-muted/10 text-foreground/80 font-black" : "bg-muted/5 text-muted-foreground"
                                        )}>
                                            {val !== 0 ? (val > 0 ? `+${val.toLocaleString()}` : val.toLocaleString()) : "0"}
                                        </TableCell>
                                    );
                                })}

                                {showMainUnits && (
                                    <>
                                        <TableCell className={cn(
                                            "text-right font-bold tabular-nums px-4",
                                            row.movement > 0 ? "text-emerald-600" : row.movement < 0 ? "text-amber-600" : "text-muted-foreground"
                                        )}>
                                            {row.movement !== 0 ? (row.movement > 0 ? "+" : "") : ""}
                                            {(row.movement / (familyDivisor || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground font-medium tabular-nums px-4 font-bold">
                                            {row.movement !== 0 ? (row.movement > 0 ? "+" : "") : ""}
                                            {row.movement.toLocaleString()}
                                        </TableCell>
                                    </>
                                )}
                                <TableCell className="text-right font-black tabular-nums text-foreground/90 bg-muted/20 group-hover:bg-muted/40 transition-colors px-4 border-l border-muted/30">
                                    {(row.displayBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                </TableCell>
                                <TableCell className="text-right font-black tabular-nums text-emerald-700/90 bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors pl-4 pr-6 border-l border-muted/30">
                                    {costPerUnit != null ? ((row.displayBalance || 0) * costPerUnit).toLocaleString(undefined, { style: 'currency', currency: 'PHP' }) : "—"}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Dialog open={!!selectedDocNo} onOpenChange={(open) => !open && setSelectedDocNo(null)}>
                    <DialogContent className="sm:max-w-5xl w-full rounded-[1.5rem] border shadow-2xl p-0 overflow-hidden">
                        <DialogHeader className="p-6 bg-muted/30 border-b">
                            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <EyeIcon className="h-5 w-5 text-primary" />
                                </div>
                                Consolidated Entries
                            </DialogTitle>
                            <DialogDescription className="font-mono mt-1 text-sm bg-background/50 px-2 py-1 rounded inline-block w-fit">
                                Ref: {selectedDocNo}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="max-h-[60vh] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-muted/20 sticky top-0 backdrop-blur z-10">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-bold uppercase pl-6 py-2">Line Description</TableHead>
                                        {uniqueUOMs.map(uom => (
                                            <TableHead key={uom.unit} className="text-right text-[10px] font-bold uppercase py-2">{uom.unit}</TableHead>
                                        ))}
                                        <TableHead className="text-right text-[10px] font-bold uppercase pr-6 py-2">Base (Total Pcs)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedGroup?.items.map((item, i) => (
                                        <TableRow
                                            key={i}
                                            className={cn(
                                                "group transition-colors border-muted/50",
                                                item.docType === "Consolidation Dispatches" ? "hover:bg-primary/5 cursor-pointer" : "hover:bg-muted/30"
                                            )}
                                            onClick={() => {
                                                if (item.docType === "Consolidation Dispatches") {
                                                    handleConsolidationClick(item);
                                                }
                                            }}
                                        >
                                            <TableCell className="text-sm font-medium py-3 pl-6">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        {item.descr || "—"}
                                                        {item.docType === "Consolidation Dispatches" && (
                                                            <ListIcon className="h-3 w-3 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground opacity-50">
                                                        Product ID: {item.productId} | Unit: {item.unit} (x{item.unitCount})
                                                    </span>
                                                </div>
                                            </TableCell>
                                            {uniqueUOMs.map(uom => {
                                                const val = item.uomBreakdown?.[uom.unit] || 0;
                                                return (
                                                    <TableCell key={uom.unit} className="text-right text-sm font-black tabular-nums py-3">
                                                        {val !== 0 ? (val > 0 ? `+${val.toLocaleString()}` : val.toLocaleString()) : "—"}
                                                    </TableCell>
                                                );
                                            })}
                                            <TableCell className="text-right text-sm font-mono text-muted-foreground py-3 pr-6 font-bold">
                                                {item.movement !== 0 ? (item.movement > 0 ? "+" : "") : ""}
                                                {item.movement.toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="p-6 bg-muted/30 border-t flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Group Total Movement</span>
                                <span className="text-lg font-black tabular-nums">
                                    {(selectedGroup?.main.movement || 0).toLocaleString()} PCS ({((selectedGroup?.main.movement || 0) / (familyDivisor || 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })} {familyUnitName.toUpperCase()})
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Balance Position</span>
                                <span className="text-lg font-black tabular-nums text-primary">
                                    {(selectedGroup?.main.displayBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                </span>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Consolidation Dispatches Trace Dialog */}
                <Dialog open={!!selectedConsolidationDoc} onOpenChange={(open) => !open && setSelectedConsolidationDoc(null)}>
                    <DialogContent className="sm:max-w-6xl w-full rounded-[1.5rem] border shadow-2xl p-0 overflow-hidden">
                        <DialogHeader className="p-6 bg-primary/5 border-b">
                            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <ListIcon className="h-5 w-5 text-primary" />
                                </div>
                                Consolidation Dispatches Summary
                            </DialogTitle>
                            <DialogDescription className="font-mono mt-1 text-sm bg-background/50 px-2 py-1 rounded inline-block w-fit">
                                Ref: {selectedConsolidationDoc}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="max-h-[60vh] overflow-y-auto min-h-[300px] flex flex-col">
                            {isTracing ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
                                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                    <p className="text-sm font-medium text-muted-foreground">Tracing sales orders...</p>
                                </div>
                            ) : traceData.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-2">
                                    <p className="text-lg font-bold opacity-40">No records found</p>
                                    <p className="text-sm text-muted-foreground">No related invoice details were found for this product in the consolidation flow.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-muted/20 sticky top-0 backdrop-blur z-10">
                                        <TableRow>
                                            <TableHead className="text-[10px] font-bold uppercase pl-8 py-4">Sales Invoice</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-4">Customer Name</TableHead>
                                            <TableHead className="text-right text-[10px] font-bold uppercase py-4">Quantity</TableHead>
                                            <TableHead className="text-center text-[10px] font-bold uppercase py-4">UOM</TableHead>
                                            <TableHead className="text-center text-[10px] font-bold uppercase py-4">Status</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase pr-8 py-4">Remarks</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {traceData.map((row, i) => (
                                            <TableRow key={i} className="hover:bg-muted/50 border-muted/50 transition-colors">
                                                <TableCell className="text-[11px] font-bold py-4 pl-8 font-mono max-w-[150px] truncate" title={row.sales_invoice}>
                                                    {row.sales_invoice}
                                                </TableCell>
                                                <TableCell className="text-xs font-medium py-4 text-muted-foreground">
                                                    {row.customer_name}
                                                </TableCell>
                                                <TableCell className="text-right text-sm font-black py-4 tabular-nums">
                                                    {(row.quantity ?? 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-center py-4">
                                                    <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0">
                                                        {row.uom}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center py-4">
                                                    <Badge className={cn(
                                                        "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm",
                                                        row.order_status === "Remitted" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                                            row.order_status === "Dispatched" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                                                                row.order_status === "Posted" ? "bg-orange-500/10 text-orange-600 border-orange-500/20" :
                                                                    row.order_status === "Receipt" ? "bg-purple-500/10 text-purple-600 border-purple-500/20" :
                                                                        "bg-muted text-muted-foreground font-medium"
                                                    )}>
                                                        {row.order_status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs italic text-muted-foreground/60 py-4 pr-8 max-w-[120px] truncate" title={row.remarks || ""}>
                                                    {row.remarks || "—"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>

                        <div className="p-4 bg-muted/30 border-t flex justify-end">
                            <Badge variant="outline" className="px-3 py-1 font-bold text-[10px] uppercase tracking-wider">
                                Total Records: {traceData.length}
                            </Badge>
                        </div>
                    </DialogContent>
                </Dialog>
            </Card>
        </div>
    );
});

ProductTracingTable.displayName = "ProductTracingTable";

