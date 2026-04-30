"use client";

/**
 * CustomerDiscountModule.tsx
 * ──────────────────────────
 * Module entry point.
 * Composes the filter bar + table, wires the hook, owns page-level layout.
 */

import { useState } from "react";
import { RefreshCcw, Percent } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useCustomerDiscount } from "./hooks/useCustomerDiscount";
import { CustomerDiscountFilters } from "./components/CustomerDiscountFilters";
import { CustomerDiscountTable } from "./components/CustomerDiscountTable";
import { CustomerDiscountViewDialog } from "./components/CustomerDiscountViewDialog";
import type { CustomerDiscountRow } from "./types";

export default function CustomerDiscountModule() {
    const {
        paginatedRows,
        loading,
        filters,
        setFilterField,
        resetFilters,
        page,
        totalPages,
        totalCount,
        pageSize,
        setPage,
        refresh,
    } = useCustomerDiscount();

    // ── Dialog state ────────────────────────────────────────────────────────
    const [selectedRow, setSelectedRow] = useState<CustomerDiscountRow | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    function handleRowClick(row: CustomerDiscountRow) {
        setSelectedRow(row);
        setDialogOpen(true);
    }

    return (
        <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ── Page Header ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <Percent className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">
                            Customer Discount
                        </h1>
                        <p className="text-sm text-muted-foreground font-medium">
                            Audit trail of all customer discount log changes.
                        </p>
                    </div>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-[11px] font-black uppercase tracking-widest"
                    onClick={refresh}
                    disabled={loading}
                >
                    <RefreshCcw
                        className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
                    />
                    {loading ? "Loading…" : "Refresh"}
                </Button>
            </div>

            {/* ── Card: Filters + Table ─────────────────────────────────── */}
            <Card className="shadow-sm border-border overflow-hidden">
                {/* Filter bar */}
                <CustomerDiscountFilters
                    filters={filters}
                    onFilterChange={setFilterField}
                    onReset={resetFilters}
                    loading={loading}
                />

                {/* Data table + pagination */}
                <CustomerDiscountTable
                    rows={paginatedRows}
                    loading={loading}
                    page={page}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onRowClick={handleRowClick}
                />
            </Card>

            {/* ── View dialog ────────────────────────────────────────────── */}
            <CustomerDiscountViewDialog
                row={selectedRow}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
            />
        </div>
    );
}
