//src/modules/supply-chain-management/traceability-compliance/cross-tracing/components/CrossTracingFilters.tsx
"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CrossTracingFiltersType, ProductFamilyRow } from "../types";
import { SearchableSelect } from "../../product-tracing/components/SearchableSelect";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { Input } from "@/components/ui/input";

type Props = {
    filters: CrossTracingFiltersType;
    branches: Array<{ id: number; branch_name: string }>;
    families: ProductFamilyRow[];
    physicalInventories: Array<{ id: number; ph_no: string; starting_date?: string; cutOff_date?: string }>;
    uoms: string[];
    onFilterChange: (filters: Partial<CrossTracingFiltersType>) => void;
    onReset: () => void;
    onSearch: () => void;
    isLoading?: boolean;
};

export function CrossTracingFilters({
    filters,
    branches,
    families,
    physicalInventories,
    uoms,
    onFilterChange,
    onReset,
    onSearch,
    isLoading
}: Props) {
    const primaryBranchOptions = React.useMemo(() => 
        branches.map(b => ({ value: b.id, label: b.branch_name })),
    [branches]);

    const secondaryBranchOptions = React.useMemo(() => 
        branches
            .filter(b => b.id !== filters.primary_branch_id)
            .map(b => ({ value: b.id, label: b.branch_name })),
    [branches, filters.primary_branch_id]);

    const familyOptions = React.useMemo(() => 
        families.map(f => ({ 
            value: f.parent_id, 
            label: f.product_name || "Unknown Product",
            description: `${f.category_name || "No Category"} | ${f.brand_name || "No Brand"}`
        })),
    [families]);

    const piOptions = React.useMemo(() => 
        physicalInventories.map(pi => ({ value: pi.id, label: pi.ph_no })),
    [physicalInventories]);

    const uomOptions = React.useMemo(() => 
        uoms.map(u => ({ value: u, label: u })),
    [uoms]);

    const safeStartDate = filters.startDate ? new Date(filters.startDate) : null;
    const safeEndDate = filters.endDate ? new Date(filters.endDate) : null;

    const handleTimeChange = (type: 'start' | 'end', time: string) => {
        if (!time) return;
        const current = type === 'start' ? safeStartDate : safeEndDate;
        if (!current) return;
        
        const [hours, minutes] = time.split(':').map(Number);
        const newDate = new Date(current);
        newDate.setHours(hours, minutes, 0, 0);
        
        onFilterChange({
            [type === 'start' ? 'startDate' : 'endDate']: newDate.toISOString()
        });
    };

    const handlePIChange = (phId: number | null) => {
        const selectedPI = physicalInventories.find(pi => pi.id === phId);
        if (selectedPI) {
            onFilterChange({ 
                ph_id: phId,
                startDate: selectedPI.starting_date || null,
                endDate: selectedPI.cutOff_date || null
            });
        } else {
            onFilterChange({ ph_id: null });
        }
    };

    return (
        <Card className="rounded-[2.5rem] border shadow-sm overflow-visible bg-background/50 backdrop-blur-sm">
            <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12 items-end">
                    <div className="xl:col-span-3">
                        <SearchableSelect 
                            label="Product Family"
                            placeholder="Select Product"
                            emptyText="No product family found."
                            value={filters.parent_id}
                            options={familyOptions}
                            onChange={(val) => onFilterChange({ parent_id: val, ph_id: null, uom: null })}
                            searchPlaceholder="Search product family..."
                            disabled={isLoading}
                        />
                    </div>

                    <div className="xl:col-span-3">
                        <SearchableSelect 
                            label="Primary Batch (Branch)"
                            placeholder="Select Branch"
                            emptyText="No branch found."
                            value={filters.primary_branch_id}
                            options={primaryBranchOptions}
                            onChange={(val) => onFilterChange({ primary_branch_id: val, ph_id: null })}
                            searchPlaceholder="Search branch..."
                            disabled={isLoading}
                        />
                    </div>

                    <div className="xl:col-span-4">
                        <SearchableMultiSelect 
                            label="Secondary Batches (Comparison)"
                            placeholder="Select Branches"
                            emptyText="No branch found."
                            value={filters.secondary_branch_ids}
                            options={secondaryBranchOptions}
                            onChange={(val) => onFilterChange({ secondary_branch_ids: val })}
                            searchPlaceholder="Search branches..."
                            disabled={isLoading || !filters.primary_branch_id}
                        />
                    </div>

                    <div className="xl:col-span-2">
                        <SearchableSelect 
                            label="Unit of Measure (UOM)"
                            placeholder="Filter by UOM"
                            emptyText="No units found."
                            value={filters.uom}
                            options={uomOptions}
                            onChange={(val) => onFilterChange({ uom: val })}
                            searchPlaceholder="Search UOM..."
                            disabled={isLoading || !filters.parent_id}
                        />
                    </div>

                    <div className="space-y-2 xl:col-span-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Date Selection</Label>
                        <Tabs 
                            value={filters.dateRangeMode || "manual"} 
                            onValueChange={(val) => onFilterChange({ 
                                dateRangeMode: val as 'manual' | 'ph',
                                ph_id: val === 'manual' ? null : filters.ph_id 
                            })}
                            className="w-full"
                        >
                            <TabsList className="grid w-full grid-cols-2 h-10 rounded-xl bg-muted/20 p-1">
                                <TabsTrigger value="manual" className="rounded-lg text-[10px] uppercase tracking-wider font-bold h-8">Manual</TabsTrigger>
                                <TabsTrigger value="ph" className="rounded-lg text-[10px] uppercase tracking-wider font-bold h-8">Inventory</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {filters.dateRangeMode === 'ph' ? (
                        <div className="xl:col-span-4">
                            <SearchableSelect 
                                label="Physical Inventory"
                                placeholder="Filter by PI record"
                                emptyText="No records found."
                                value={filters.ph_id}
                                options={piOptions}
                                onChange={handlePIChange}
                                searchPlaceholder="Search PI number..."
                                disabled={isLoading || !filters.primary_branch_id || !filters.parent_id}
                            />
                        </div>
                    ) : (
                        <div className="space-y-2 xl:col-span-4">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Manual Date Range</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-medium h-10 rounded-2xl px-5 border-muted-foreground/10 bg-background/50 hover:bg-background/80 transition-all",
                                            !filters.startDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-3 h-4 w-4 opacity-50 shrink-0" />
                                        {safeStartDate ? (
                                            safeEndDate ? (
                                                <div className="truncate text-sm">
                                                    {format(safeStartDate, "MMM dd, yyyy HH:mm")} - {format(safeEndDate, "MMM dd, yyyy HH:mm")}
                                                </div>
                                            ) : (
                                                <div className="truncate text-sm">{format(safeStartDate, "MMM dd, yyyy HH:mm")}</div>
                                            )
                                        ) : (
                                            <span className="text-sm">Select dates</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-[2rem] border overflow-hidden shadow-2xl" align="start">
                                    <Calendar
                                        mode="range"
                                        defaultMonth={safeStartDate || undefined}
                                        selected={{ 
                                            from: safeStartDate || undefined, 
                                            to: safeEndDate || undefined 
                                        }}
                                        onSelect={(range) => {
                                            const s = range?.from ? new Date(range.from) : null;
                                            const e = range?.to ? new Date(range.to) : null;
                                            
                                            if (s) s.setHours(0, 0, 0, 0);
                                            if (e) e.setHours(23, 59, 59, 999);

                                            onFilterChange({ 
                                                startDate: s ? s.toISOString() : null, 
                                                endDate: e ? e.toISOString() : null,
                                                ph_id: null // Reset PI if manual date is picked
                                            });
                                        }}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}
                    
                    {filters.dateRangeMode === 'ph' ? (
                        <div className="space-y-2 xl:col-span-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Range Status</Label>
                            <div className="h-10 rounded-2xl px-5 border border-muted-foreground/10 bg-muted/20 flex items-center gap-2 text-xs font-medium text-muted-foreground shadow-inner">
                                <CalendarIcon className="h-3.5 w-3.5 opacity-50" />
                                {safeStartDate && safeEndDate ? (
                                    <span className="truncate">
                                        {format(safeStartDate, "MMM dd, yyyy HH:mm")} - {format(safeEndDate, "MMM dd, yyyy HH:mm")}
                                    </span>
                                ) : (
                                    <span className="italic opacity-60">Waiting for PI...</span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2 xl:col-span-3">
                             <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Manual Time Selection</Label>
                             <div className="flex gap-2 h-10 items-center">
                                 <Input 
                                    type="time" 
                                    className="h-full px-4 rounded-2xl border-muted-foreground/10 bg-background/50 text-xs font-medium focus:ring-primary/20 transition-all"
                                    value={safeStartDate ? format(safeStartDate, "HH:mm") : ""}
                                    onChange={(e) => handleTimeChange('start', e.target.value)}
                                    disabled={!safeStartDate || isLoading}
                                 />
                                 <span className="text-muted-foreground font-bold text-[10px]">to</span>
                                 <Input 
                                    type="time" 
                                    className="h-full px-4 rounded-2xl border-muted-foreground/10 bg-background/50 text-xs font-medium focus:ring-primary/20 transition-all"
                                    value={safeEndDate ? format(safeEndDate, "HH:mm") : ""}
                                    onChange={(e) => handleTimeChange('end', e.target.value)}
                                    disabled={!safeEndDate || isLoading}
                                 />
                             </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 xl:col-span-3">
                        <Button
                            variant="ghost"
                            className="h-10 rounded-2xl px-4 flex-1 hover:bg-muted font-bold text-[9px] uppercase tracking-[0.2em] text-muted-foreground transition-all active:scale-95"
                            onClick={onReset}
                            disabled={isLoading}
                        >
                            <RotateCcw className="mr-2 h-3.5 w-3.5 opacity-70" />
                            Reset
                        </Button>
                        <Button
                            className="h-10 rounded-2xl px-6 flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-black text-[9px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                            onClick={onSearch}
                            disabled={isLoading || !filters.primary_branch_id || !filters.parent_id}
                        >
                            <Search className="mr-2 h-3.5 w-3.5" />
                            {isLoading ? "Running..." : "Trace"}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
