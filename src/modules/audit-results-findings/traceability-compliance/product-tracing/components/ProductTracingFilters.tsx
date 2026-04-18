//src/modules/supply-chain-management/traceability-compliance/product-tracing/components/ProductTracingFilters.tsx
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
import { ProductTracingFiltersType, ProductFamilyRow, PhysicalInventoryRow } from "../types";
import { SearchableSelect } from "./SearchableSelect";
import { fetchPhysicalInventories } from "../providers/fetchProvider";
import { Input } from "@/components/ui/input";

type Props = {
    filters: ProductTracingFiltersType;
    branches: Array<{ id: number; branch_name: string }>;
    families: ProductFamilyRow[];
    onFilterChange: (filters: Partial<ProductTracingFiltersType>) => void;
    onReset: () => void;
    onSearch: () => void;
    isLoading?: boolean;
};

export function ProductTracingFilters({
    filters,
    branches,
    families,
    onFilterChange,
    onReset,
    onSearch,
    isLoading
}: Props) {
    const branchOptions = React.useMemo(() => 
        branches.map(b => ({ value: b.id, label: b.branch_name })),
    [branches]);

    const familyOptions = React.useMemo(() => 
        families.map(f => ({ 
            value: f.parent_id, 
            label: f.product_name || "Unknown Product",
            description: `${f.category_name || "No Category"} | ${f.brand_name || "No Brand"}`
        })),
    [families]);

    const [phList, setPhList] = React.useState<PhysicalInventoryRow[]>([]);
    const [isPhLoading, setIsPhLoading] = React.useState(false);

    React.useEffect(() => {
        if (filters.branch_id && filters.parent_id) {
            const loadPh = async () => {
                setIsPhLoading(true);
                try {
                    const list = await fetchPhysicalInventories(filters.branch_id!, filters.parent_id!);
                    setPhList(list);
                } catch (err) {
                    console.error("Failed to load PH list", err);
                    setPhList([]);
                } finally {
                    setIsPhLoading(false);
                }
            };
            loadPh();
        } else {
            setPhList([]);
        }
    }, [filters.branch_id, filters.parent_id]);

    const phOptions = React.useMemo(() => 
        phList.map(p => ({ 
            value: p.id, 
            label: p.ph_no,
            description: `Start: ${p.starting_date ? format(new Date(p.starting_date), "MMM dd, yyyy HH:mm") : "N/A"} | Cutoff: ${p.cutOff_date ? format(new Date(p.cutOff_date), "MMM dd, yyyy HH:mm") : "N/A"}`
        })),
    [phList]);

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

    return (
        <Card className="rounded-2xl border shadow-sm overflow-visible">
            <CardContent className="p-4 sm:p-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12 items-end">
                    <div className="xl:col-span-4">
                        <SearchableSelect 
                            label="Branch"
                            placeholder="Select Branch"
                            emptyText="No branch found."
                            value={filters.branch_id}
                            options={branchOptions}
                            onChange={(val) => onFilterChange({ branch_id: val })}
                            searchPlaceholder="Search branch..."
                            disabled={isLoading}
                        />
                    </div>

                    <div className="xl:col-span-5">
                        <SearchableSelect 
                            label="Product Family"
                            placeholder="Select Product"
                            emptyText="No product family found."
                            value={filters.parent_id}
                            options={familyOptions}
                            onChange={(val) => onFilterChange({ parent_id: val, ph_id: null })}
                            searchPlaceholder="Search product family..."
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2 xl:col-span-3">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">Date Selection</Label>
                        <Tabs 
                            value={filters.dateRangeMode || "manual"} 
                            onValueChange={(val) => onFilterChange({ 
                                dateRangeMode: val as 'manual' | 'ph',
                                ph_id: val === 'manual' ? null : filters.ph_id 
                            })}
                            className="w-full"
                        >
                            <TabsList className="grid w-full grid-cols-2 h-10 rounded-xl bg-muted/50 p-1">
                                <TabsTrigger value="manual" className="rounded-lg text-[10px] uppercase tracking-wider font-bold h-8">Manual</TabsTrigger>
                                <TabsTrigger value="ph" className="rounded-lg text-[10px] uppercase tracking-wider font-bold h-8">Inventory</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {filters.dateRangeMode === 'ph' ? (
                        <div className="xl:col-span-5">
                            <SearchableSelect 
                                label="Physical Inventory"
                            placeholder={isPhLoading ? "Loading..." : "Select PH Record"}
                            emptyText="No PH records found."
                            value={filters.ph_id || null}
                            options={phOptions}
                            onChange={(val) => {
                                const selected = phList.find(p => p.id === val);
                                if (selected) {
                                    onFilterChange({ 
                                        ph_id: val,
                                        startDate: selected.starting_date ? new Date(selected.starting_date).toISOString() : null,
                                        endDate: selected.cutOff_date ? new Date(selected.cutOff_date).toISOString() : null
                                    });
                                } else {
                                    onFilterChange({ ph_id: null });
                                }
                            }}
                            searchPlaceholder="Search PH #..."
                            disabled={isLoading || isPhLoading || !filters.branch_id || !filters.parent_id}
                        />
                        </div>
                    ) : (
                        <div className="space-y-2 xl:col-span-5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">Date Range</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal h-10 rounded-xl px-4 border-muted-foreground/20",
                                            !filters.startDate && "text-muted-foreground"
                                        )}
                                        disabled={isLoading}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50 shrink-0" />
                                        {safeStartDate ? (
                                            safeEndDate ? (
                                                <div className="truncate">
                                                    {format(safeStartDate, "LLL dd, y HH:mm")} -{" "}
                                                    {format(safeEndDate, "LLL dd, y HH:mm")}
                                                </div>
                                            ) : (
                                                <div className="truncate">
                                                    {format(safeStartDate, "LLL dd, y HH:mm")}
                                                </div>
                                            )
                                        ) : (
                                            <span>Pick range</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-2xl border overflow-hidden shadow-xl" align="start">
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
                                            
                                            if (s && !range?.from) { /* nothing */ }
                                            if (s) s.setHours(0, 0, 0, 0);
                                            if (e) e.setHours(23, 59, 59, 999);

                                            onFilterChange({ 
                                                startDate: s ? s.toISOString() : null, 
                                                endDate: e ? e.toISOString() : null 
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
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">Range Status</Label>
                            <div className="h-10 rounded-xl px-4 border border-muted-foreground/10 bg-muted/30 flex items-center gap-2 text-xs font-medium text-muted-foreground shadow-inner">
                                <CalendarIcon className="h-3.5 w-3.5 opacity-50" />
                                {safeStartDate && safeEndDate ? (
                                    <span>
                                        {format(safeStartDate, "MMM dd, yyyy HH:mm")} - {format(safeEndDate, "MMM dd, yyyy HH:mm")}
                                    </span>
                                ) : (
                                    <span className="italic opacity-60 italic">Waiting...</span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2 xl:col-span-3">
                             <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">Manual Time</Label>
                             <div className="flex gap-2 h-10 items-center">
                                 <Input 
                                    type="time" 
                                    className="h-full text-[10px] rounded-xl px-2 border-muted-foreground/20"
                                    value={safeStartDate ? format(safeStartDate, "HH:mm") : ""}
                                    onChange={(e) => handleTimeChange('start', e.target.value)}
                                    disabled={!safeStartDate || isLoading}
                                 />
                                 <span className="text-muted-foreground">-</span>
                                 <Input 
                                    type="time" 
                                    className="h-full text-[10px] rounded-xl px-2 border-muted-foreground/20"
                                    value={safeEndDate ? format(safeEndDate, "HH:mm") : ""}
                                    onChange={(e) => handleTimeChange('end', e.target.value)}
                                    disabled={!safeEndDate || isLoading}
                                 />
                             </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 xl:col-span-4">
                        <Button
                            variant="ghost"
                            className="h-10 rounded-xl px-4 flex-1 hover:bg-muted font-bold text-xs uppercase tracking-widest text-muted-foreground transition-colors"
                            onClick={onReset}
                            disabled={isLoading}
                        >
                            <RotateCcw className="mr-2 h-3.5 w-3.5" />
                            Reset
                        </Button>
                        <Button
                            className="h-10 rounded-xl px-6 flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs uppercase tracking-widest shadow-sm shadow-primary/20 transition-all active:scale-[0.98]"
                            onClick={onSearch}
                            disabled={isLoading || !filters.branch_id || !filters.parent_id}
                        >
                            <Search className="mr-2 h-4 w-4" />
                            {isLoading ? "..." : "Trace"}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
