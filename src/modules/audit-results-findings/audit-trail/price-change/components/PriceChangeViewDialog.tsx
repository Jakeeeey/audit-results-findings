"use client";

/**
 * PriceChangeViewDialog.tsx
 * ─────────────────────────
 * Full-detail view dialog that opens when a table row is clicked.
 * Read-only — no mutations.
 */

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    CheckCircle2,
    XCircle,
    Clock,
    Tag,
    Package,
    Building2,
    User,
    CalendarDays,
    TrendingUp,
    TrendingDown,
} from "lucide-react";

import type { PriceChangeRow } from "../types";
import {
    formatDateDisplay,
    formatPrice,
    getStatusMeta,
    computePriceDelta,
} from "../utils/priceChangeUtils";

interface Props {
    row: PriceChangeRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// ─── Small field display helper ───────────────────────────────────────────────
function Field({
    icon: Icon,
    label,
    value,
    valueClassName,
}: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    valueClassName?: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">
                    {label}
                </p>
                <div className={`text-sm font-semibold text-foreground break-words ${valueClassName ?? ""}`}>
                    {value || <span className="text-muted-foreground font-normal">—</span>}
                </div>
            </div>
        </div>
    );
}

// ─── Section header ───────────────────────────────────────────────────────────
function Section({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-2 my-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                {title}
            </span>
            <Separator className="flex-1" />
        </div>
    );
}

// ─── Price delta badge ────────────────────────────────────────────────────────
function PriceDeltaBadge({
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
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                isUp
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-600"
            }`}
        >
            {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isUp ? "+" : ""}{delta.toFixed(2)}%
        </span>
    );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────
export function PriceChangeViewDialog({ row, open, onOpenChange }: Props) {
    if (!row) return null;

    const statusMeta = getStatusMeta(row.status);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl w-full max-h-[90vh] overflow-y-auto">
                {/* ── Header ─────────────────────────────────────────────── */}
                <DialogHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Tag className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-black uppercase tracking-tight">
                                    Price Change Request
                                </DialogTitle>
                                <DialogDescription className="text-[11px] mt-0.5">
                                    Request ID: <span className="font-bold text-foreground">#{row.id}</span>
                                </DialogDescription>
                            </div>
                        </div>
                        <Badge
                            className={`text-[11px] font-black uppercase px-3 py-1 border ${statusMeta.className}`}
                        >
                            {statusMeta.label}
                        </Badge>
                    </div>
                </DialogHeader>

                <Separator />

                {/* ── Product Info ───────────────────────────────────────── */}
                <Section title="Product Information" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field icon={Package} label="Product Name" value={row.productName} />
                    <Field icon={Tag} label="Brand" value={row.brand} />
                    <Field icon={Tag} label="Category" value={row.category} />
                    <Field icon={Building2} label="Supplier" value={row.supplierName} />
                </div>

                {/* ── Price Info ─────────────────────────────────────────── */}
                <Section title="Price Details" />
                <div className="rounded-xl border bg-muted/30 p-4 flex flex-col sm:flex-row items-stretch gap-4">
                    {/* Price Type */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-1 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Price Type
                        </p>
                        {row.priceType ? (
                            <Badge variant="outline" className="text-sm font-black px-3 py-1">
                                {row.priceType}
                            </Badge>
                        ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                        )}
                    </div>

                    <Separator orientation="vertical" className="hidden sm:block h-auto" />

                    {/* Previous Price */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-1 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Previous Price
                        </p>
                        <p className="text-xl font-black text-foreground tabular-nums">
                            {formatPrice(row.previousPrice)}
                        </p>
                    </div>

                    <Separator orientation="vertical" className="hidden sm:block h-auto" />

                    {/* Proposed Price */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-1 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Proposed Price
                        </p>
                        <p className="text-xl font-black text-primary tabular-nums">
                            {formatPrice(row.proposedPrice)}
                        </p>
                        <PriceDeltaBadge prev={row.previousPrice} proposed={row.proposedPrice} />
                    </div>
                </div>

                {/* ── Workflow Timeline ──────────────────────────────────── */}
                <Section title="Workflow Timeline" />
                <div className="space-y-3">
                    {/* Requested */}
                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                            <Clock className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Requested By
                            </p>
                            <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                                <span className="text-sm font-bold text-foreground">
                                    {row.requestedBy || "—"}
                                </span>
                                {row.requestedAt && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <CalendarDays className="h-3 w-3" />
                                        {formatDateDisplay(row.requestedAt)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Approved */}
                    {(row.approvedBy || row.approvedAt) && (
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                    Approved By
                                </p>
                                <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                                    <span className="text-sm font-bold text-emerald-800">
                                        {row.approvedBy || "—"}
                                    </span>
                                    {row.approvedAt && (
                                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                                            <CalendarDays className="h-3 w-3" />
                                            {formatDateDisplay(row.approvedAt)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rejected */}
                    {(row.rejectedBy || row.rejectedAt) && (
                        <div className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50/50">
                            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                                <XCircle className="h-4 w-4 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-red-700">
                                    Rejected By
                                </p>
                                <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                                    <span className="text-sm font-bold text-red-800">
                                        {row.rejectedBy || "—"}
                                    </span>
                                    {row.rejectedAt && (
                                        <span className="text-xs text-red-500 flex items-center gap-1">
                                            <CalendarDays className="h-3 w-3" />
                                            {formatDateDisplay(row.rejectedAt)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Pending placeholder ────────────────────────────────── */}
                {!row.approvedBy && !row.approvedAt && !row.rejectedBy && !row.rejectedAt && (
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                        <User className="h-4 w-4 text-amber-600 shrink-0" />
                        <p className="text-xs font-semibold text-amber-700">
                            Awaiting approval — no decision recorded yet.
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
