"use client";

/**
 * PriceChangeFilters.tsx
 * ──────────────────────
 * Filter bar: start/end date pickers, status dropdown,
 * price-type dropdown, and a search bar.
 */

import { useId } from "react";
import { CalendarIcon, RotateCcw, Search } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

import type { PriceChangeFilters } from "../types";
import {
    PRICE_CHANGE_STATUSES,
    PRICE_TYPE_OPTIONS,
} from "../utils/priceChangeUtils";

interface Props {
    filters: PriceChangeFilters;
    onFilterChange: <K extends keyof PriceChangeFilters>(
        key: K,
        value: PriceChangeFilters[K],
    ) => void;
    onReset: () => void;
    loading: boolean;
}

function DatePickerField({
    id,
    label,
    value,
    onChange,
    disabled,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
}) {
    const date = value ? new Date(value + "T00:00:00") : undefined;

    const pad = (n: number) => String(n).padStart(2, "0");
    const toISO = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    return (
        <div className="space-y-1.5">
            <Label htmlFor={id} className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                {label}
            </Label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id={id}
                        variant="outline"
                        disabled={disabled}
                        className={cn(
                            "w-full justify-start text-left h-9 text-xs font-semibold bg-background",
                            !date && "text-muted-foreground",
                        )}
                    >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-60 shrink-0" />
                        {date ? format(date, "MMM dd, yyyy") : "Pick a date"}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => d && onChange(toISO(d))}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}

export function PriceChangeFilters({
    filters,
    onFilterChange,
    onReset,
    loading,
}: Props) {
    const uid = useId();

    return (
        <div className="flex flex-col gap-3 p-4 border-b bg-card">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                {/* Start Date */}
                <DatePickerField
                    id={`${uid}-start`}
                    label="Start Date"
                    value={filters.startDate}
                    onChange={(v) => onFilterChange("startDate", v)}
                    disabled={loading}
                />

                {/* End Date */}
                <DatePickerField
                    id={`${uid}-end`}
                    label="End Date"
                    value={filters.endDate}
                    onChange={(v) => onFilterChange("endDate", v)}
                    disabled={loading}
                />

                {/* Status */}
                <div className="space-y-1.5">
                    <Label
                        htmlFor={`${uid}-status`}
                        className="text-[11px] font-black uppercase tracking-widest text-muted-foreground"
                    >
                        Status
                    </Label>
                    <Select
                        value={filters.status || "__all__"}
                        onValueChange={(v) =>
                            onFilterChange(
                                "status",
                                v === "__all__" ? "" : (v as PriceChangeFilters["status"]),
                            )
                        }
                        disabled={loading}
                    >
                        <SelectTrigger
                            id={`${uid}-status`}
                            className="h-9 text-xs font-semibold bg-background cursor-pointer"
                        >
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            {PRICE_CHANGE_STATUSES.map((s) => (
                                <SelectItem
                                    key={s.value || "__all__"}
                                    value={s.value || "__all__"}
                                    className="text-xs font-semibold uppercase"
                                >
                                    {s.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Price Type */}
                <div className="space-y-1.5">
                    <Label
                        htmlFor={`${uid}-pricetype`}
                        className="text-[11px] font-black uppercase tracking-widest text-muted-foreground"
                    >
                        Price Type
                    </Label>
                    <Select
                        value={filters.priceTypeName || "__all__"}
                        onValueChange={(v) =>
                            onFilterChange(
                                "priceTypeName",
                                v === "__all__" ? "" : v,
                            )
                        }
                        disabled={loading}
                    >
                        <SelectTrigger
                            id={`${uid}-pricetype`}
                            className="h-9 text-xs font-semibold bg-background cursor-pointer"
                        >
                            <SelectValue placeholder="All Price Types" />
                        </SelectTrigger>
                        <SelectContent>
                            {PRICE_TYPE_OPTIONS.map((pt) => (
                                <SelectItem
                                    key={pt.value || "__all__"}
                                    value={pt.value || "__all__"}
                                    className="text-xs font-semibold"
                                >
                                    {pt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Search */}
                <div className="space-y-1.5">
                    <Label
                        htmlFor={`${uid}-search`}
                        className="text-[11px] font-black uppercase tracking-widest text-muted-foreground"
                    >
                        Search
                    </Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-60 pointer-events-none" />
                        <Input
                            id={`${uid}-search`}
                            placeholder="Brand, product, supplier, requested by…"
                            value={filters.search}
                            onChange={(e) =>
                                onFilterChange("search", e.target.value)
                            }
                            disabled={loading}
                            className="pl-8 h-9 text-xs font-semibold bg-background"
                        />
                    </div>
                </div>
            </div>

            {/* Reset */}
            <div className="flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
                    onClick={onReset}
                    disabled={loading}
                >
                    <RotateCcw className="h-3 w-3 mr-1.5" />
                    Reset Filters
                </Button>
            </div>
        </div>
    );
}
