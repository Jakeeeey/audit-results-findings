//src/modules/supply-chain-management/traceability-compliance/product-tracing/ProductTracingModule.tsx
"use client";

import * as React from "react";
import { ProductTracingFilters } from "./components/ProductTracingFilters";
import { ProductTracingTable } from "./components/ProductTracingTable";
import { PhysicalInventorySummary } from "./components/PhysicalInventorySummary";
import { fetchBranches, fetchProductFamilies, fetchMovements, fetchFamilyRunningInventory } from "./providers/fetchProvider";
import { ProductTracingFiltersType, ProductMovementRow, ProductFamilyRow } from "./types";
import {
    History as HistoryIcon,
    Search as TracerSearchIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ProductTracingModule = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => {
    const [filters, setFilters] = React.useState<ProductTracingFiltersType>({
        branch_id: null,
        parent_id: null,
        ph_id: null,
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        endDate: new Date().toISOString(),
        dateRangeMode: 'manual',
    });

    const [branches, setBranches] = React.useState<Array<{ id: number; branch_name: string }>>([]);
    const [families, setFamilies] = React.useState<ProductFamilyRow[]>([]);
    const [movements, setMovements] = React.useState<ProductMovementRow[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [familyRunningTotal, setFamilyRunningTotal] = React.useState<number>(0);

    React.useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [b, f] = await Promise.all([fetchBranches(), fetchProductFamilies()]);
                setBranches(b || []);
                setFamilies(f || []);
            } catch (err) {
                console.error("Failed to load initial data", err);
            }
        };
        loadInitialData();
    }, []);

    const handleFilterChange = (newFilters: Partial<ProductTracingFiltersType>) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
    };

    const handleReset = () => {
        setFilters({
            branch_id: null,
            parent_id: null,
            ph_id: null,
            startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
            endDate: new Date().toISOString(),
            dateRangeMode: 'manual',
        });
        setMovements([]);
        setError(null);
    };

    const handleSearch = async () => {
        if (!filters.branch_id || !filters.parent_id) return;

        // Resolve names from loaded dropdown data for the optimized /date endpoint
        const selectedBranch = branches.find(b => b.id === filters.branch_id);
        const selectedFamily = families.find(f => f.parent_id === filters.parent_id);

        setIsLoading(true);
        setError(null);
        try {
            // Use the actual startDate and endDate formatted as YYYY-MM-DD for the optimized /date endpoint
            const fetchFilters = {
                ...filters,
                startDate: null, // Always fetch from beginning to find the latest PH baseline
                endDate: filters.endDate || null,
                branchName: selectedBranch?.branch_name || null,
                productName: selectedFamily?.product_name || null,
            };
            const [movementsData, familyInvTotal] = await Promise.all([
                fetchMovements(fetchFilters),
                fetchFamilyRunningInventory(
                    selectedBranch?.branch_name || "",
                    filters.parent_id!,
                ),
            ]);
            setMovements(movementsData || []);
            setFamilyRunningTotal(familyInvTotal);
        } catch (err) {
            setError("Failed to fetch data. Please try again.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const stats = React.useMemo(() => {
        if (!movements.length) return { totalIn: 0, totalOut: 0, netChange: 0 };

        const start = filters.startDate ? new Date(filters.startDate) : null;
        const end = filters.endDate ? new Date(filters.endDate) : null;

        // Base filtering purely for product family, branch, and ending date
        let validMovements = movements.filter(row => {
            const rowDate = new Date(row.ts);
            if (end && rowDate > end) return false;

            if (filters.branch_id && row.branchId !== filters.branch_id) return false;

            if (filters.parent_id) {
                const matchesParent = row.productId === filters.parent_id || row.parentId === filters.parent_id;
                if (!matchesParent) return false;
            }

            return true;
        });

        // Sort chronologically so that firstPHIndex correctly identifies the very first historical Phase
        validMovements.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

        // The user requested that the beginning balance should be derived solely from the first PH.
        // Therefore, we ignore any non-PH transactions that occurred *before* the first ever PH.
        const firstPHIndex = validMovements.findIndex(row => row.docType === "Physical Inventory" || row.docNo?.toUpperCase().startsWith("PH"));
        if (firstPHIndex > -1) {
            validMovements = validMovements.slice(firstPHIndex);
            
            // Override the variance for the first PH since its baseline system count is no longer valid
            // due to us dropping the prior history. Its variance should purely be its physical count.
            const firstPHDocNo = validMovements[0].docNo;
            validMovements.forEach(row => {
                if (row.docNo === firstPHDocNo) {
                    const phys = row.physical_count !== undefined ? row.physical_count : row.physicalCount;
                    if (phys !== undefined) {
                        row.variance = Number(phys);
                        row.system_count = 0;
                        row.systemCount = 0;
                    }
                }
            });
        }

        // Split into "before" (for beginning balance) and "filtered" (for current period stats)
        const filtered: typeof movements = [];

        validMovements.forEach(row => {
            const rowDate = new Date(row.ts);
            if (!start || rowDate >= start) {
                filtered.push(row);
            }
        });

        const divisor = validMovements[0]?.familyUnitCount || 1;

        const getMovement = (row: ProductMovementRow) => {
            const isPH = row.docType === "Physical Inventory" || row.docNo?.startsWith("PH");
            if (isPH) {
                // Handle both camelCase and snake_case for API compatibility
                const phys = row.physical_count !== undefined ? row.physical_count : row.physicalCount;
                const sys = row.system_count !== undefined ? row.system_count : row.systemCount;
                // Use API variance if injected, otherwise calculate
                const calcVariance = row.variance ?? ((phys || 0) - (sys || 0));
                return calcVariance * (row.unitCount || 1);
            }
            return ((row.inBase || 0) - (row.outBase || 0));
        };

        const totalInBase = filtered.reduce((acc, row) => {
            const m = getMovement(row);
            return acc + (m > 0 ? m : 0);
        }, 0);

        const totalOutBase = filtered.reduce((acc, row) => {
            const m = getMovement(row);
            return acc + (m < 0 ? Math.abs(m) : 0);
        }, 0);

        const netChangeBase = totalInBase - totalOutBase;

        // Breakdown per UOM as requested
        const breakdown: Record<string, { beginning: number, in: number, out: number }> = {};
        let beginningBaseBalance = 0;

        // 1. Get all historical movements (strictly BEFORE start date)
        const historical = validMovements
            .filter(row => start && new Date(row.ts) < start);

        // 2. Sum up ALL historical movements to get the true beginning balance
        historical.forEach(row => {
            beginningBaseBalance += getMovement(row);
        });

        // Initialize breakdown for display
        validMovements.forEach(row => {
            const unit = row.unit || "Base";
            if (!breakdown[unit]) breakdown[unit] = { beginning: 0, in: 0, out: 0 };
            const div = row.unitCount && row.unitCount > 0 ? row.unitCount : 1;
            const m = getMovement(row);

            if (start && new Date(row.ts) < start) {
                // It's historical, so add to beginning balance breakdown
                breakdown[unit].beginning += m / div;
            } else {
                // It's in the current period, add to in/out
                if (m > 0) breakdown[unit].in += m / div;
                if (m < 0) breakdown[unit].out += Math.abs(m) / div;
            }
        });

        return {
            totalInBase,
            totalOutBase,
            netChangeBase,
            breakdown,
            beginningBaseBalance,
            filtered,
            divisor: divisor || 1,
            unit: validMovements.find(r => r.unitCount === (divisor || 1))?.unit || validMovements[0]?.familyUnit || "Box"
        };
    }, [movements, filters.startDate, filters.endDate, filters.branch_id, filters.parent_id]);

    const currentUnit = stats?.unit || "Units";
    const currentDivisor = stats?.divisor || 1;

    return (
        <div ref={ref} className={cn("space-y-6 max-w-[1600px] mx-auto pb-10", props.className)} {...props}>
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-2xl">
                        <HistoryIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Product Tracing Report</h1>
                        <p className="text-muted-foreground text-sm">Detailed product movement history and ledger.</p>
                    </div>
                </div>
            </div>

            <ProductTracingFilters
                filters={filters}
                branches={branches}
                families={families}
                onFilterChange={handleFilterChange}
                onReset={handleReset}
                onSearch={handleSearch}
                isLoading={isLoading}
            />

            {error && (
                <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-sm font-medium">
                    {error}
                </div>
            )}

            {(movements.length > 0 || isLoading) && (
                <div className="space-y-6">
                    {stats.filtered && stats.filtered.some(m => m.docNo.toUpperCase().startsWith("PH") || m.docType?.toUpperCase() === "PHYSICAL INVENTORY") && (
                        <PhysicalInventorySummary
                            movements={stats.filtered}
                            baseUnitName={currentUnit}
                            baseUnitDivisor={currentDivisor}
                            costPerUnit={families.find(f => f.parent_id === filters.parent_id)?.cost_per_unit || null}
                            beginningBaseBalance={stats.beginningBaseBalance || 0}
                            familyRunningTotal={filters.dateRangeMode === "manual" ? familyRunningTotal : undefined}
                        />
                    )}

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold tracking-tight">Movement Ledger</h2>
                            <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full font-medium">
                                {(stats.filtered?.length || movements.length)} records
                            </span>
                        </div>
                        <ProductTracingTable
                            data={stats.filtered || movements}
                            isLoading={isLoading}
                            familyDivisor={stats.divisor || 1}
                            familyUnitName={stats.unit || "Box"}
                            costPerUnit={families.find(f => f.parent_id === filters.parent_id)?.cost_per_unit || null}
                            beginningBaseBalance={stats.beginningBaseBalance || 0}
                            familyRunningTotal={filters.dateRangeMode === "manual" ? familyRunningTotal : undefined}
                        />
                    </div>
                </div>
            )}

            {movements.length === 0 && !isLoading && !error && (
                <div className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed rounded-[2rem] bg-muted/5 animate-in zoom-in-95 duration-500">
                    <div className="h-20 w-20 bg-muted/10 rounded-full flex items-center justify-center mb-6">
                        <TracerSearchIcon className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-xl font-semibold text-muted-foreground">Ready to Trace?</h3>
                    <p className="text-muted-foreground max-w-sm mt-2">
                        Select a branch, product family and date range to begin tracing movements.
                    </p>
                </div>
            )}
        </div>
    );
});

ProductTracingModule.displayName = "ProductTracingModule";
