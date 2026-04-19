//src/modules/supply-chain-management/traceability-compliance/cross-tracing/components/SearchableMultiSelect.tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type Option = {
    value: number;
    label: string;
    description?: string;
};

type Props = {
    label: string;
    placeholder: string;
    emptyText: string;
    value: number[];
    options: Option[];
    disabled?: boolean;
    searchPlaceholder?: string;
    onChange: (value: number[]) => void;
    className?: string;
};

export function SearchableMultiSelect({
    label,
    placeholder,
    emptyText,
    value,
    options,
    disabled,
    searchPlaceholder = "Search...",
    onChange,
    className
}: Props) {
    const [open, setOpen] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");

    const selectedOptions = React.useMemo(
        () => options.filter((option) => value.includes(option.value)),
        [options, value],
    );

    const filteredOptions = React.useMemo(() => {
        if (!searchTerm) return options;
        const lowSearch = searchTerm.toLowerCase();
        return options.filter(opt =>
            (opt.label || "").toLowerCase().includes(lowSearch) ||
            (opt.description || "").toLowerCase().includes(lowSearch)
        );
    }, [options, searchTerm]);

    const handleToggle = (optionValue: number) => {
        if (value.includes(optionValue)) {
            onChange(value.filter(v => v !== optionValue));
        } else {
            onChange([...value, optionValue]);
        }
    };

    const handleRemove = (optionValue: number, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(value.filter(v => v !== optionValue));
    };

    React.useEffect(() => {
        if (open) setSearchTerm("");
    }, [open]);

    return (
        <div className={cn("space-y-2", className)}>
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70">{label}</Label>

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <div className="relative group">
                        <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            disabled={disabled}
                            className="w-full justify-between cursor-pointer font-normal min-h-10 h-auto py-2 rounded-xl px-4 border-muted-foreground/20 flex flex-wrap gap-1"
                        >
                            {selectedOptions.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {selectedOptions.map(opt => (
                                        <Badge 
                                            key={opt.value} 
                                            variant="secondary" 
                                            className="h-5 px-1 bg-primary/10 text-primary hover:bg-primary/20 border-transparent text-[10px] uppercase font-bold"
                                        >
                                            {opt.label}
                                            <X 
                                                className="ml-1 h-2.5 w-2.5 cursor-pointer" 
                                                onClick={(e) => handleRemove(opt.value, e)}
                                            />
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-muted-foreground">{placeholder}</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </div>
                </PopoverTrigger>

                <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0 shadow-2xl rounded-2xl border border-muted-foreground/10 overflow-hidden bg-background"
                >
                    <div className="flex items-center gap-2 border-b px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/20">
                        <Search className="h-3.5 w-3.5" />
                        Search {label.toLowerCase()}
                    </div>

                    <div className="p-2">
                        <Input
                            placeholder={searchPlaceholder}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-9 rounded-lg border-muted-foreground/10 focus-visible:ring-primary/20"
                            autoFocus
                        />
                    </div>

                    <ScrollArea className="h-[300px]">
                        <div className="p-1 space-y-0.5">
                            {filteredOptions.length === 0 ? (
                                <div className="py-10 text-center text-sm text-muted-foreground">
                                    {emptyText}
                                </div>
                            ) : (
                                filteredOptions.map((option) => {
                                    const isSelected = value.includes(option.value);
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleToggle(option.value)}
                                            className={cn(
                                                "w-full flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg text-left transition-colors",
                                                isSelected
                                                    ? "bg-primary/10 text-primary"
                                                    : "hover:bg-muted"
                                            )}
                                        >
                                            <div className="flex items-center w-full">
                                                <div className={cn(
                                                    "mr-2 h-4 w-4 rounded border flex items-center justify-center transition-colors",
                                                    isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                                                )}>
                                                    <Check className={cn("h-3 w-3 text-white", isSelected ? "opacity-100" : "opacity-0")} />
                                                </div>
                                                <span className="truncate font-semibold text-sm">{option.label}</span>
                                            </div>
                                            {option.description && (
                                                <span className="text-[10px] text-muted-foreground ml-6 font-medium uppercase tracking-tight opacity-70">
                                                    {option.description}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>
        </div>
    );
}
