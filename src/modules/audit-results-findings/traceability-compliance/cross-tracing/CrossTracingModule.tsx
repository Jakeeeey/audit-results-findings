//src/modules/supply-chain-management/traceability-compliance/cross-tracing/CrossTracingModule.tsx
"use client";

import * as React from "react";
import { CrossTracingFilters } from "./components/CrossTracingFilters";
import { CrossTracingTable } from "./components/CrossTracingTable";
import { BranchComparisonCards } from "./components/BranchComparisonCards";
import { CrossTracingSummaryTable } from "./components/CrossTracingSummaryTable";
import { 
    fetchBranches, 
    fetchProductFamilies, 
    fetchCrossMovements,
    fetchPhysicalInventories,
    fetchProductUOMs,
    fetchFamilyRunningInventory
} from "./providers/fetchProvider";
import { CrossTracingFiltersType, BranchMovementData, ProductFamilyRow } from "./types";
import { 
    GitCompare as CrossTracingIcon,
    Search as TracerSearchIcon,
    BadgeAlert as WarningIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const CrossTracingModule = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => {
    const [filters, setFilters] = React.useState<CrossTracingFiltersType>({
        primary_branch_id: null,
        secondary_branch_ids: [],
        parent_id: null,
        ph_id: null,
        uom: null,
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        endDate: new Date().toISOString(),
        dateRangeMode: 'manual',
    });

    const [branches, setBranches] = React.useState<Array<{ id: number; branch_name: string }>>([]);
    const [families, setFamilies] = React.useState<ProductFamilyRow[]>([]);
    const [physicalInventories, setPhysicalInventories] = React.useState<Array<{ id: number; ph_no: string; starting_date?: string; cutOff_date?: string }>>([]);
    const [uoms, setUoms] = React.useState<string[]>([]);
    const [crossData, setCrossData] = React.useState<BranchMovementData[]>([]);
    const [primaryFamilyRunningTotal, setPrimaryFamilyRunningTotal] = React.useState<number>(0);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [b, f] = await Promise.all([fetchBranches(), fetchProductFamilies()]);
                setBranches(b || []);
                setFamilies(f || []);
            } catch (err) {
                console.error("Failed to load initial data", err);
                toast.error("Failed to load necessary module data.");
            }
        };
        loadInitialData();
    }, []);

    // Fetch UOMs when product family changes
    React.useEffect(() => {
        if (filters.parent_id) {
            fetchProductUOMs(filters.parent_id).then(setUoms).catch(console.error);
        } else {
            setUoms([]);
        }
    }, [filters.parent_id]);

    // Fetch Physical Inventories when primary branch or product family changes
    React.useEffect(() => {
        if (filters.primary_branch_id && filters.parent_id) {
            fetchPhysicalInventories(filters.primary_branch_id, filters.parent_id)
                .then(setPhysicalInventories)
                .catch(console.error);
        } else {
            setPhysicalInventories([]);
        }
    }, [filters.primary_branch_id, filters.parent_id]);

    const handleFilterChange = (newFilters: Partial<CrossTracingFiltersType>) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
    };

    const handleReset = () => {
        setFilters({
            primary_branch_id: null,
            secondary_branch_ids: [],
            parent_id: null,
            ph_id: null,
            uom: null,
            startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
            endDate: new Date().toISOString(),
            dateRangeMode: 'manual',
        });
        setCrossData([]);
        setError(null);
    };

    const handleSearch = async () => {
        if (!filters.primary_branch_id || !filters.parent_id) return;

        setIsLoading(true);
        setError(null);
        try {
            const selectedPrimaryBranch = branches.find(mb => mb.id === filters.primary_branch_id);
            const secondaryBranches = branches.filter(mb => filters.secondary_branch_ids.includes(mb.id));
            const allSelectedBranches = [selectedPrimaryBranch, ...secondaryBranches].filter(Boolean);

            const [data, ...familyTotals] = await Promise.all([
                fetchCrossMovements(filters),
                ...allSelectedBranches.map(b => 
                    fetchFamilyRunningInventory(b!.branch_name, filters.parent_id!)
                )
            ]);
            
            // Sum up the ground-truth running inventory from ALL selected branches
            const consolidatedFamilyTotal = familyTotals.reduce((sum, val) => sum + (val || 0), 0);
            
            // Map branch names from the master list to ensure accuracy
            const enrichedData = (data || []).map(b => {
                const masterBranch = branches.find(mb => mb.id === b.branchId);
                return {
                    ...b,
                    branchName: masterBranch?.branch_name || b.branchName
                };
            });

            setCrossData(enrichedData);
            setPrimaryFamilyRunningTotal(consolidatedFamilyTotal);
            if (enrichedData.length === 0) {
                toast.info("No movements found for the selected criteria.");
            }
        } catch (err) {
            setError("Failed to fetch cross-branch data. Please try again.");
            console.error(err);
            toast.error("Failed to trace across branches.");
        } finally {
            setIsLoading(false);
        }
    };

    const currentFamily = families.find(f => f.parent_id === filters.parent_id);
    
    // Resolve UOM and Divisor
    const uomInfo = React.useMemo(() => {
        // 1. Build a map of all UOMs found in the data to their conversion counts
        const conversionMap = new Map<string, number>();
        let fallbackFamilyUnit = "Box";
        let fallbackFamilyCount = 1;

        crossData.forEach(branch => {
            branch.movements.forEach(m => {
                if (m.unit && m.unitCount !== undefined) {
                    conversionMap.set(m.unit, m.unitCount);
                    // Also try to capture PI units which might skip unitCount
                    if (m.unitCount === 0 && (m.docNo.startsWith("PH") || m.docType === "Physical Inventory")) {
                         // PH records usually match the unit names
                    }
                }
                if (m.familyUnit && m.familyUnitCount != null) {
                    fallbackFamilyUnit = m.familyUnit;
                    fallbackFamilyCount = m.familyUnitCount;
                }
            });
        });

        // 2. Resolve the divisor based on selected UOM
        const selectedUom = filters.uom;
        let divisor = fallbackFamilyCount;
        const unitName = selectedUom || fallbackFamilyUnit;

        if (selectedUom && conversionMap.has(selectedUom)) {
            divisor = conversionMap.get(selectedUom) ?? 1;
        } else if (selectedUom === "Pieces" || selectedUom === "PCS" || selectedUom?.toLowerCase() === "pieces") {
            // Pieces is always the base unit (1)
            divisor = 1;
        }

        return { divisor: Number(divisor) || 1, unit: unitName, valuationDivisor: fallbackFamilyCount };
    }, [crossData, filters.uom]);

    const familyUnitName = uomInfo.unit;
    const familyDivisor = uomInfo.divisor;
    const valuationDivisor = uomInfo.valuationDivisor;

    // Calculate independent beginning balances for ALL selected branches (ANCHORED TO EACH BRANCH'S FIRST PH)
    const branchBeginningBalances = React.useMemo(() => {
        const balances: Record<number, number> = {};
        if (!crossData.length || !filters.startDate) return balances;
        
        const start = new Date(filters.startDate);

        crossData.forEach(branchData => {
            // Sort movements chronologically for this branch
            const movements = [...branchData.movements].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

            // Find the FIRST PH for this specific branch
            const firstPHIndex = movements.findIndex(m => m.docNo.toUpperCase().startsWith("PH") || m.docType?.toUpperCase() === "PHYSICAL INVENTORY");
            
            if (firstPHIndex === -1) {
                balances[branchData.branchId] = 0;
                return;
            }

            // Calculate balance starting from that first PH up to the report startDate
            const history = movements.slice(firstPHIndex);
            let balance = 0;
            
            history.forEach((m, idx) => {
                const rowDate = new Date(m.ts);
                if (rowDate >= start) return;

                const isPH = m.docNo.toUpperCase().startsWith("PH") || m.docType?.toUpperCase() === "PHYSICAL INVENTORY";
                
                // For PI records, use m.unitCount if valid, otherwise fallback to the family standard (valuationDivisor)
                const effectiveUnitCount = (m.unitCount && m.unitCount > 0) ? m.unitCount : (isPH ? uomInfo.valuationDivisor : 1);

                if (idx === 0) {
                    const phys = m.physical_count !== undefined ? m.physical_count : m.physicalCount;
                    balance = Number(phys || 0) * effectiveUnitCount;
                } else {
                    if (isPH) {
                        const phys = m.physical_count !== undefined ? m.physical_count : m.physicalCount;
                        const sys = m.system_count !== undefined ? m.system_count : m.systemCount;
                        const variance = m.variance ?? (Number(phys || 0) - Number(sys || 0));
                        balance += variance * effectiveUnitCount;
                    } else {
                        balance += (Number(m.inBase) || 0) - (Number(m.outBase) || 0);
                    }
                }
            });

            balances[branchData.branchId] = balance;
        });

        return balances;
    }, [crossData, filters.startDate, uomInfo.valuationDivisor]);

    const totalBeginningBalance = React.useMemo(() => {
        return Object.values(branchBeginningBalances).reduce((sum, val) => sum + val, 0);
    }, [branchBeginningBalances]);

    return (
        <div ref={ref} className={cn("space-y-6 max-w-[1600px] mx-auto pb-10", props.className)} {...props}>
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-2xl">
                        <CrossTracingIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Cross Tracing Report</h1>
                        <p className="text-muted-foreground text-sm">Trace and compare product movements across multiple branches.</p>
                    </div>
                </div>
            </div>

            <CrossTracingFilters
                filters={filters}
                branches={branches}
                families={families}
                physicalInventories={physicalInventories}
                uoms={uoms}
                onFilterChange={handleFilterChange}
                onReset={handleReset}
                onSearch={handleSearch}
                isLoading={isLoading}
            />

            {error && (
                <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-sm font-medium flex items-center gap-3">
                    <WarningIcon className="h-4 w-4" />
                    {error}
                </div>
            )}

            {(crossData.length > 0 || isLoading) && (
                <div className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
                    <div className="space-y-8">
                        <div className="flex items-center gap-4 px-2">
                            <div className="h-8 w-2 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.3)]" />
                            <div className="space-y-1">
                                <h2 className="text-sm font-black tracking-[0.3em] uppercase text-foreground/90">Branch Performance Analytics</h2>
                                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Comparative metrics per location</p>
                            </div>
                        </div>
                        <BranchComparisonCards 
                            data={crossData}
                            familyDivisor={familyDivisor}
                            familyUnitName={familyUnitName}
                        />
                    </div>

                    <div className="space-y-8">
                        <div className="flex items-center gap-4 px-2">
                            <div className="h-8 w-2 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
                            <div className="space-y-1">
                                <h2 className="text-sm font-black tracking-[0.3em] uppercase text-foreground/90">Inventory Milestone Matrix</h2>
                                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Physical inventory audit trail</p>
                            </div>
                        </div>
                        <CrossTracingSummaryTable 
                            data={crossData}
                            familyDivisor={familyDivisor}
                            familyUnitName={familyUnitName}
                            costPerUnit={currentFamily?.cost_per_unit || null}
                            startDate={filters.startDate}
                            endDate={filters.endDate}
                            valuationDivisor={valuationDivisor}
                            beginningBaseBalance={totalBeginningBalance}
                            branchBeginningBalances={branchBeginningBalances}
                            primaryFamilyRunningTotal={primaryFamilyRunningTotal}
                        />
                    </div>

                    <div className="space-y-8 pb-24">
                        <div className="flex items-center gap-4 px-2">
                            <div className="h-8 w-2 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
                            <div className="space-y-1">
                                <h2 className="text-sm font-black tracking-[0.3em] uppercase text-foreground/90">Unified Transaction Ledger</h2>
                                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Granular cross-branch movement history</p>
                            </div>
                        </div>
                        <CrossTracingTable
                            data={crossData}
                            isLoading={isLoading}
                            familyDivisor={familyDivisor}
                            valuationDivisor={valuationDivisor}
                            costPerUnit={currentFamily?.cost_per_unit || null}
                            branchBeginningBalances={branchBeginningBalances}
                            primaryFamilyRunningTotal={primaryFamilyRunningTotal}
                            startDate={filters.startDate}
                            endDate={filters.endDate}
                        />
                    </div>
                </div>
            )}

            {crossData.length === 0 && !isLoading && !error && (
                <div className="flex flex-col items-center justify-center py-48 text-center border-2 border-dashed rounded-[4rem] bg-muted/5 border-muted-foreground/10 animate-in zoom-in-95 duration-1000 ease-in-out">
                    <div className="h-28 w-28 bg-primary/5 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] border border-primary/10">
                        <TracerSearchIcon className="h-12 w-12 text-primary/30" />
                    </div>
                    <h3 className="text-3xl font-black text-foreground/90 tracking-tighter">Ready to Cross Trace?</h3>
                    <p className="text-muted-foreground max-w-sm mt-4 text-sm font-medium leading-relaxed opacity-80">
                        Select a primary branch, comparison branches, and a product family to begin exploring inventory synchronicity across your supply chain.
                    </p>
                </div>
            )}
        </div>
    );
});

CrossTracingModule.displayName = "CrossTracingModule";
