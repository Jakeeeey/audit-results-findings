"use client";

/**
 * PriceChangeTable.tsx
 * ─────────────────────
 * Renders the full price-change data table with:
 *  - Skeleton loading state
 *  - Empty state with icon
 *  - Status badges (coloured)
 *  - Price formatting
 *  - Date/time formatting
 *  - Pagination controls
 */

import { ArrowLeft, ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
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

import type { PriceChangeRow } from "../types";
import {
    formatDateDisplay,
    formatPrice,
    getStatusMeta,
    computePriceDelta,
} from "../utils/priceChangeUtils";

// Column count used for colspan in empty/loading states
const COL_COUNT = 15;
const SKELETON_ROWS = 8;

interface Props {
    rows: PriceChangeRow[];
    loading: boolean;
    page: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onRowClick: (row: PriceChangeRow) => void;
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

// ─── Price delta indicator ─────────────────────────────────────────────────────
function PriceDelta({
    prev,
    proposed,
}: {
    prev: number | null;
    proposed: number | null;
}) {
    const delta = computePriceDelta(prev, proposed);
    if (delta == null) return null;
    const isUp = delta >= 0;
    return (
        <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-bold ml-1 ${
                isUp ? "text-emerald-600" : "text-red-500"
            }`}
        >
            {isUp ? (
                <TrendingUp className="h-3 w-3" />
            ) : (
                <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(delta).toFixed(1)}%
        </span>
    );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function PriceChangeTable({
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
                    <Table className="min-w-[1400px]">
                        <TableHeader className="bg-muted/30 sticky top-0 z-10">
                            <TableRow>
                                {[
                                    "No.",
                                    "Brand",
                                    "Category",
                                    "Product Name",
                                    "Supplier Name",
                                    "Price Type",
                                    "Previous Price",
                                    "Proposed Price",
                                    "Status",
                                    "Requested By",
                                    "Requested At",
                                    "Approved By",
                                    "Approved At",
                                    "Rejected By",
                                    "Rejected At",
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
                                                <TrendingDown className="h-6 w-6 text-muted-foreground opacity-40" />
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
                                    const statusMeta = getStatusMeta(
                                        row.status,
                                    );
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

                                            {/* Brand */}
                                            <TableCell className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap">
                                                {row.brand ?? "—"}
                                            </TableCell>

                                            {/* Category */}
                                            <TableCell className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                                {row.category ?? "—"}
                                            </TableCell>

                                            {/* Product Name */}
                                            <TableCell className="px-3 py-2.5 text-xs font-medium max-w-[180px] truncate">
                                                {row.productName ?? "—"}
                                            </TableCell>

                                            {/* Supplier Name */}
                                            <TableCell className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                                                {row.supplierName ?? "—"}
                                            </TableCell>

                                            {/* Price Type */}
                                            <TableCell className="px-3 py-2.5 text-center">
                                                {row.priceType ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] font-black px-2 py-0"
                                                    >
                                                        {row.priceType}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </TableCell>

                                            {/* Previous Price */}
                                            <TableCell className="px-3 py-2.5 text-right tabular-nums text-xs font-semibold">
                                                {formatPrice(row.previousPrice)}
                                            </TableCell>

                                            {/* Proposed Price */}
                                            <TableCell className="px-3 py-2.5 text-right tabular-nums">
                                                <span className="text-xs font-bold">
                                                    {formatPrice(
                                                        row.proposedPrice,
                                                    )}
                                                </span>
                                                <PriceDelta
                                                    prev={row.previousPrice}
                                                    proposed={row.proposedPrice}
                                                />
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell className="px-3 py-2.5 text-center">
                                                <Badge
                                                    className={`text-[10px] font-black uppercase px-2 py-0.5 border ${statusMeta.className}`}
                                                >
                                                    {statusMeta.label}
                                                </Badge>
                                            </TableCell>

                                            {/* Requested By */}
                                            <TableCell className="px-3 py-2.5 text-xs whitespace-nowrap">
                                                {row.requestedBy ?? "—"}
                                            </TableCell>

                                            {/* Requested At */}
                                            <TableCell className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDateDisplay(
                                                    row.requestedAt,
                                                )}
                                            </TableCell>

                                            {/* Approved By */}
                                            <TableCell className="px-3 py-2.5 text-xs whitespace-nowrap text-emerald-700">
                                                {row.approvedBy ?? (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </TableCell>

                                            {/* Approved At */}
                                            <TableCell className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDateDisplay(
                                                    row.approvedAt,
                                                )}
                                            </TableCell>

                                            {/* Rejected By */}
                                            <TableCell className="px-3 py-2.5 text-xs whitespace-nowrap text-red-600">
                                                {row.rejectedBy ?? (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </TableCell>

                                            {/* Rejected At */}
                                            <TableCell className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDateDisplay(
                                                    row.rejectedAt,
                                                )}
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
