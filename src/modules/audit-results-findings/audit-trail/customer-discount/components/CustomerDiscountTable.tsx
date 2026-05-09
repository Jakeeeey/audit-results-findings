"use client";

/**
 * CustomerDiscountTable.tsx
 * ─────────────────────────
 * Renders the customer-discount audit log table with:
 *  - Skeleton loading state
 *  - Empty state with icon
 *  - Action badges (colour-coded)
 *  - Date/time formatting
 *  - Pagination controls
 *
 * Columns: No. | Action | Customer Code | Customer Name | Store Name |
 *          Supplier Name | Category Name | Discount Type | Changed By | Date
 */

import { ArrowLeft, ArrowRight, Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { CardContent } from "@/components/ui/card";

import type { CustomerDiscountRow } from "../types";
import {
    formatDateDisplay,
    getActionMeta,
} from "../utils/customerDiscountUtils";

// Column count used for colspan in empty/loading states
const COL_COUNT = 10;
const SKELETON_ROWS = 8;

interface Props {
    rows: CustomerDiscountRow[];
    loading: boolean;
    page: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onRowClick: (row: CustomerDiscountRow) => void;
}

// ─── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow({ index }: { index: number }) {
    return (
        <TableRow key={index}>
            {Array.from({ length: COL_COUNT }).map((_, c) => (
                <TableCell key={c} className="py-3 px-3">
                    <div
                        className="h-3.5 bg-muted rounded animate-pulse"
                        style={{ width: `${50 + ((c * 17) % 40)}%` }}
                    />
                </TableCell>
            ))}
        </TableRow>
    );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function CustomerDiscountTable({
    rows,
    loading,
    page,
    totalPages,
    totalCount,
    pageSize,
    onPageChange,
    onRowClick,
}: Props) {
    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalCount);

    return (
        <>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table className="min-w-[1100px]">
                        <TableHeader className="bg-muted/30 sticky top-0 z-10">
                            <TableRow>
                                {[
                                    "No.",
                                    "Action",
                                    "Customer Code",
                                    "Customer Name",
                                    "Store Name",
                                    "Supplier Name",
                                    "Category Name",
                                    "Discount Type",
                                    "Changed By",
                                    "Date",
                                ].map((col) => (
                                    <TableHead
                                        key={col}
                                        className="text-[10px] font-black uppercase h-10 px-3 whitespace-nowrap tracking-wide"
                                    >
                                        {col}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {/* Loading skeleton */}
                            {loading &&
                                Array.from({ length: SKELETON_ROWS }).map(
                                    (_, i) => <SkeletonRow key={i} index={i} />,
                                )}

                            {/* Empty state */}
                            {!loading && rows.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={COL_COUNT}
                                        className="h-64 text-center"
                                    >
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                                                <Percent className="h-6 w-6 text-muted-foreground opacity-40" />
                                            </div>
                                            <span className="text-sm font-black uppercase text-foreground">
                                                No records found
                                            </span>
                                            <p className="text-xs text-muted-foreground">
                                                Try adjusting your filters or
                                                date range.
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}

                            {/* Data rows */}
                            {!loading &&
                                rows.map((row, idx) => {
                                    const actionMeta = getActionMeta(row.action);
                                    return (
                                        <TableRow
                                            key={`${row.id}-${idx}`}
                                            className="hover:bg-primary/5 hover:shadow-[inset_2px_0_0_0_hsl(var(--primary))] transition-all cursor-pointer group"
                                            onClick={() => onRowClick(row)}
                                        >
                                            {/* No. */}
                                            <TableCell className="px-3 py-2.5 text-[11px] font-bold text-muted-foreground tabular-nums w-12">
                                                {(page - 1) * pageSize +
                                                    idx +
                                                    1}
                                            </TableCell>

                                            {/* Action */}
                                            <TableCell className="px-3 py-2.5 text-center">
                                                <Badge
                                                    className={`text-[10px] font-black uppercase px-2 py-0.5 border ${actionMeta.className}`}
                                                >
                                                    {actionMeta.label}
                                                </Badge>
                                            </TableCell>

                                            {/* Customer Code */}
                                            <TableCell className="px-3 py-2.5 text-xs font-bold whitespace-nowrap">
                                                {row.customerCode ?? "—"}
                                            </TableCell>

                                            {/* Customer Name */}
                                            <TableCell className="px-3 py-2.5 text-xs font-semibold max-w-[160px] truncate">
                                                {row.customerName ?? "—"}
                                            </TableCell>

                                            {/* Store Name */}
                                            <TableCell className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap max-w-[160px] truncate">
                                                {row.storeName ?? "—"}
                                            </TableCell>

                                            {/* Supplier Name */}
                                            <TableCell className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap max-w-[160px] truncate">
                                                {row.supplierName ?? "—"}
                                            </TableCell>

                                            {/* Category Name */}
                                            <TableCell className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap max-w-[140px] truncate">
                                                {row.categoryName ?? "—"}
                                            </TableCell>

                                            {/* Discount Type */}
                                            <TableCell className="px-3 py-2.5 text-center">
                                                {row.discountType ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] font-black px-2 py-0"
                                                    >
                                                        {row.discountType}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </TableCell>

                                            {/* Changed By */}
                                            <TableCell className="px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                                                {row.changedBy ?? "—"}
                                            </TableCell>

                                            {/* Date */}
                                            <TableCell className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDateDisplay(row.date)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* ── Pagination footer ─────────────────────────────────────── */}
            {!loading && totalCount > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-card">
                    <p className="text-[11px] font-medium text-muted-foreground">
                        Showing{" "}
                        <span className="font-black text-foreground">
                            {startItem}–{endItem}
                        </span>{" "}
                        of{" "}
                        <span className="font-black text-foreground">
                            {totalCount}
                        </span>{" "}
                        records
                    </p>

                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[10px] font-black uppercase px-3"
                            onClick={() => onPageChange(page - 1)}
                            disabled={page <= 1}
                        >
                            <ArrowLeft className="h-3 w-3 mr-1" />
                            Prev
                        </Button>
                        <span className="text-[11px] font-black text-muted-foreground px-2">
                            {page} / {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[10px] font-black uppercase px-3"
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= totalPages}
                        >
                            Next
                            <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}
