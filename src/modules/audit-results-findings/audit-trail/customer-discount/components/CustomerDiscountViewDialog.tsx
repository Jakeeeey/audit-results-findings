"use client";

/**
 * CustomerDiscountViewDialog.tsx
 * ───────────────────────────────
 * Full-detail read-only dialog that opens when a table row is clicked.
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
    Percent,
    Store,
    Building2,
    Tag,
    User,
    CalendarDays,
    Activity,
} from "lucide-react";

import type { CustomerDiscountRow } from "../types";
import {
    formatDateDisplay,
    getActionMeta,
} from "../utils/customerDiscountUtils";

interface Props {
    row: CustomerDiscountRow | null;
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
                <div
                    className={`text-sm font-semibold text-foreground break-words ${valueClassName ?? ""}`}
                >
                    {value || (
                        <span className="text-muted-foreground font-normal">
                            —
                        </span>
                    )}
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

// ─── Main dialog ──────────────────────────────────────────────────────────────
export function CustomerDiscountViewDialog({
    row,
    open,
    onOpenChange,
}: Props) {
    if (!row) return null;

    const actionMeta = getActionMeta(row.action);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl w-full max-h-[90vh] overflow-y-auto">
                {/* ── Header ─────────────────────────────────────────────── */}
                <DialogHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Percent className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-black uppercase tracking-tight">
                                    Customer Discount Log
                                </DialogTitle>
                                <DialogDescription className="text-[11px] mt-0.5">
                                    Record ID:{" "}
                                    <span className="font-bold text-foreground">
                                        #{row.id}
                                    </span>
                                </DialogDescription>
                            </div>
                        </div>
                        <Badge
                            className={`text-[11px] font-black uppercase px-3 py-1 border ${actionMeta.className}`}
                        >
                            {actionMeta.label}
                        </Badge>
                    </div>
                </DialogHeader>

                <Separator />

                {/* ── Customer Info ───────────────────────────────────────── */}
                <Section title="Customer Information" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field
                        icon={User}
                        label="Customer Code"
                        value={row.customerCode}
                    />
                    <Field
                        icon={User}
                        label="Customer Name"
                        value={row.customerName}
                    />
                </div>

                {/* ── Store / Supplier / Category ─────────────────────────── */}
                <Section title="Store & Product Details" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field
                        icon={Store}
                        label="Store Name"
                        value={row.storeName}
                    />
                    <Field
                        icon={Building2}
                        label="Supplier Name"
                        value={row.supplierName}
                    />
                    <Field
                        icon={Tag}
                        label="Category Name"
                        value={row.categoryName}
                    />
                    <Field
                        icon={Percent}
                        label="Discount Type"
                        value={
                            row.discountType ? (
                                <Badge
                                    variant="outline"
                                    className="text-xs font-black px-2 py-0.5"
                                >
                                    {row.discountType}
                                </Badge>
                            ) : null
                        }
                    />
                </div>

                {/* ── Audit Info ──────────────────────────────────────────── */}
                <Section title="Audit Details" />
                <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Activity className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Action
                            </p>
                            <Badge
                                className={`mt-1 text-[11px] font-black uppercase px-2 py-0.5 border ${actionMeta.className}`}
                            >
                                {actionMeta.label}
                            </Badge>
                        </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                            <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Changed By
                            </p>
                            <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                                <span className="text-sm font-bold text-foreground">
                                    {row.changedBy || "—"}
                                </span>
                                {row.date && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <CalendarDays className="h-3 w-3" />
                                        {formatDateDisplay(row.date)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
