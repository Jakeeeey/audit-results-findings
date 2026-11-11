"use client";

import * as React from "react";
import { toast } from "sonner";

import type { PhysicalInventoryHeaderRow } from "../physical-inventory-manual-management-v2/types";
import type {
    OffsettingSelectableRow,
    PhysicalInventoryOffsetGroup,
    PhysicalInventoryOffsettingReportMeta,
} from "./types";
import {
    loadPhysicalInventoryOffsettingSnapshot,
    persistAllOffsetAssignments,
} from "./providers/fetchProvider";
import {
    derivePhysicalInventoryStatus,
} from "../physical-inventory-manual-management-v2/utils/compute";
import { printPhysicalInventoryOffsettingReport } from "./utils/printPhysicalInventoryOffsettingReport";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
    AlertTriangle,
    ArrowLeft,
    FileText,
    GitCompareArrows,
    Loader2,
    Plus,
    Save,
    Printer,
    RefreshCcw,
} from "lucide-react";

import { OffsettingGroupsTable } from "./components/OffsettingGroupsTable";
import { OffsettingSelectionTable } from "./components/OffsettingSelectionTable";
import { PhysicalInventoryUploadCountSheetDialog } from "../physical-inventory-manual-management-v2/components/PhysicalInventoryUploadCountSheetDialog";

type Props = {
    phId: number;
    onBack?: () => void;
    onCommitted?: (header: PhysicalInventoryHeaderRow) => void;
    onUnsavedChangesChange?: (hasUnsaved: boolean) => void;
    currentUser?: { id: number; name: string };
};

function nowLiteralIso(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function fmtMoney(value: number): string {
    return value.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function PhysicalInventoryOffsettingModule({
                                                      phId,
                                                      onBack,
                                                      onUnsavedChangesChange,
                                                      currentUser,
                                                  }: Props) {
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
    const [unsavedGroupIds, setUnsavedGroupIds] = React.useState<Set<string>>(new Set());

    React.useEffect(() => {
        onUnsavedChangesChange?.(hasUnsavedChanges);
    }, [hasUnsavedChanges, onUnsavedChangesChange]);

    const [openRefreshConfirmDialog, setOpenRefreshConfirmDialog] = React.useState(false);
    const [openCountSheetDialog, setOpenCountSheetDialog] = React.useState(false);

    const [header, setHeader] = React.useState<PhysicalInventoryHeaderRow | null>(null);
    const [varianceRows, setVarianceRows] = React.useState<OffsettingSelectableRow[]>([]);
    const [offsetGroups, setOffsetGroups] = React.useState<PhysicalInventoryOffsetGroup[]>([]);
    const [reportMeta, setReportMeta] = React.useState<PhysicalInventoryOffsettingReportMeta>({
        branch_name: "",
        supplier_name: "",
        category_name: "",
        encoder_name: "",
    });

    const [selectedShortIds, setSelectedShortIds] = React.useState<number[]>([]);
    const [selectedOverIds, setSelectedOverIds] = React.useState<number[]>([]);

    // Browser navigation / tab closing prompt when unsaved changes exist
    React.useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = "You have unsaved offset group changes. Are you sure you want to leave?";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [hasUnsavedChanges]);

    const consumedRowIds = React.useMemo(() => {
        return new Set(
            offsetGroups.flatMap((group) => [
                ...group.short_rows.map((row) => row.row_id),
                ...group.over_rows.map((row) => row.row_id),
            ]),
        );
    }, [offsetGroups]);

    const allShortRows = React.useMemo(() => {
        return varianceRows.filter((row) => row.offset_direction === "SHORT");
    }, [varianceRows]);

    const allOverRows = React.useMemo(() => {
        return varianceRows.filter((row) => row.offset_direction === "OVER");
    }, [varianceRows]);

    const openShortRows = React.useMemo(() => {
        return allShortRows.filter((row) => !consumedRowIds.has(row.row_id));
    }, [allShortRows, consumedRowIds]);

    const openOverRows = React.useMemo(() => {
        return allOverRows.filter((row) => !consumedRowIds.has(row.row_id));
    }, [allOverRows, consumedRowIds]);

    const selectedShortRows = React.useMemo(() => {
        const selected = new Set(selectedShortIds);
        return openShortRows.filter((row) => selected.has(row.row_id));
    }, [openShortRows, selectedShortIds]);

    const selectedOverRows = React.useMemo(() => {
        const selected = new Set(selectedOverIds);
        return openOverRows.filter((row) => selected.has(row.row_id));
    }, [openOverRows, selectedOverIds]);

    const selectedShortTotal = React.useMemo(() => {
        return selectedShortRows.reduce((acc, row) => acc + row.selection_amount, 0);
    }, [selectedShortRows]);

    const selectedOverTotal = React.useMemo(() => {
        return selectedOverRows.reduce((acc, row) => acc + row.selection_amount, 0);
    }, [selectedOverRows]);

    const selectedDifference = React.useMemo(() => {
        return selectedShortTotal - selectedOverTotal;
    }, [selectedOverTotal, selectedShortTotal]);

    const unmatchedShortTotal = React.useMemo(() => {
        return openShortRows.reduce((acc, row) => acc + row.selection_amount, 0);
    }, [openShortRows]);

    const unmatchedOverTotal = React.useMemo(() => {
        return openOverRows.reduce((acc, row) => acc + row.selection_amount, 0);
    }, [openOverRows]);

    const loadSnapshot = React.useCallback(async () => {
        try {
            setIsLoading(true);

            const snapshot = await loadPhysicalInventoryOffsettingSnapshot(phId);

            setHeader(snapshot.header);
            setVarianceRows(snapshot.rows);
            setOffsetGroups(snapshot.initialGroups);
            setHasUnsavedChanges(false);
            setUnsavedGroupIds(new Set());
            setReportMeta(snapshot.reportMeta);
            setSelectedShortIds([]);
            setSelectedOverIds([]);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to load Physical Inventory offsetting data.";
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, [phId]);

    React.useEffect(() => {
        void loadSnapshot();
    }, [loadSnapshot]);

    const handleRefreshClick = React.useCallback(() => {
        if (hasUnsavedChanges) {
            setOpenRefreshConfirmDialog(true);
            return;
        }
        void loadSnapshot();
    }, [hasUnsavedChanges, loadSnapshot]);

    const handleToggleShortRow = React.useCallback((rowId: number, checked: boolean) => {
        setSelectedShortIds((prev) =>
            checked ? [...new Set([...prev, rowId])] : prev.filter((id) => id !== rowId),
        );
    }, []);

    const handleToggleOverRow = React.useCallback((rowId: number, checked: boolean) => {
        setSelectedOverIds((prev) =>
            checked ? [...new Set([...prev, rowId])] : prev.filter((id) => id !== rowId),
        );
    }, []);

    const statusText = React.useMemo(() => {
        if (!header) return "";
        return derivePhysicalInventoryStatus({
            isCancelled: header.isCancelled,
            isComitted: header.isComitted,
        });
    }, [header]);

    // Offsetting is ONLY allowed when the Physical Inventory is Committed
    const canOffset = React.useMemo(() => {
        return statusText === "Committed";
    }, [statusText]);

    const handleCreateOffsetGroup = React.useCallback(() => {
        if (!header?.id) {
            toast.error("Physical Inventory header is missing.");
            return;
        }

        if (!canOffset) {
            toast.error("Offsetting is only allowed when the Physical Inventory is Committed.");
            return;
        }

        if (!selectedShortRows.length) {
            toast.error("Select at least one SHORT row.");
            return;
        }

        if (!selectedOverRows.length) {
            toast.error("Select at least one OVER row.");
            return;
        }

        const existingMatches = offsetGroups.map((g) => g.offset_match || 0);
        const nextMatchNumber = existingMatches.length > 0 ? Math.max(...existingMatches) + 1 : 1;
        const newGroupId = `offset-match-${nextMatchNumber}`;

        const nextGroup: PhysicalInventoryOffsetGroup = {
            id: newGroupId,
            ph_id: header.id,
            created_at: nowLiteralIso(),
            short_rows: selectedShortRows,
            over_rows: selectedOverRows,
            short_total: selectedShortTotal,
            over_total: selectedOverTotal,
            difference: selectedDifference,
            offset_match: nextMatchNumber,
            remarks: "",
        };

        setOffsetGroups((prev) => [...prev, nextGroup]);
        setSelectedShortIds([]);
        setSelectedOverIds([]);
        setHasUnsavedChanges(true);
        setUnsavedGroupIds((prev) => new Set([...prev, newGroupId]));

        toast.info("Offset group created. Click 'Save' to persist changes to the database.");
    }, [
        header?.id,
        canOffset,
        selectedDifference,
        selectedOverRows,
        selectedOverTotal,
        selectedShortRows,
        selectedShortTotal,
        offsetGroups,
    ]);

    const handleSaveOffsetChanges = React.useCallback(async () => {
        if (!header?.id) {
            toast.error("Physical Inventory header is missing.");
            return;
        }

        if (!canOffset) {
            toast.error("Offsetting is only allowed when the Physical Inventory is Committed.");
            return;
        }

        try {
            setIsSaving(true);

            const allAssignedDetailIds = new Set<number>();
            const bulkPayload: Array<{
                id: number;
                offset_match: number | null;
                offset_remarks: string | null;
            }> = [];
            const detailAssignmentMap = new Map<number, { match: number; remarks: string | null }>();

            const normalizedGroups: PhysicalInventoryOffsetGroup[] = offsetGroups.map((group, index) => {
                const matchNumber = index + 1;
                const trimmedRemarks = group.remarks?.trim() || null;
                const groupDetailIds = [
                    ...group.short_rows.map((r) => r.detail_id).filter((id): id is number => Boolean(id)),
                    ...group.over_rows.map((r) => r.detail_id).filter((id): id is number => Boolean(id)),
                ];

                groupDetailIds.forEach((id) => {
                    allAssignedDetailIds.add(id);
                    detailAssignmentMap.set(id, { match: matchNumber, remarks: trimmedRemarks });
                    bulkPayload.push({
                        id,
                        offset_match: matchNumber,
                        offset_remarks: trimmedRemarks,
                    });
                });

                return {
                    ...group,
                    id: `offset-match-${matchNumber}`,
                    offset_match: matchNumber,
                    remarks: trimmedRemarks,
                    short_rows: group.short_rows.map((r) => ({
                        ...r,
                        offset_match: matchNumber,
                        offset_remarks: trimmedRemarks,
                    })),
                    over_rows: group.over_rows.map((r) => ({
                        ...r,
                        offset_match: matchNumber,
                        offset_remarks: trimmedRemarks,
                    })),
                };
            });

            // Only reset detail rows that previously had an offset_match or offset_remarks in the database
            const unassignedDetailIds = varianceRows
                .filter(
                    (r) =>
                        r.detail_id !== null &&
                        r.detail_id !== undefined &&
                        !allAssignedDetailIds.has(r.detail_id) &&
                        ((r.offset_match && r.offset_match > 0) || Boolean(r.offset_remarks))
                )
                .map((r) => r.detail_id as number);

            if (unassignedDetailIds.length > 0) {
                unassignedDetailIds.forEach((id) => {
                    bulkPayload.push({
                        id,
                        offset_match: 0,
                        offset_remarks: null,
                    });
                });
            }

            if (bulkPayload.length > 0) {
                await persistAllOffsetAssignments(bulkPayload);
            }

            // Sync local state with normalized match numbers and updated row metadata
            setOffsetGroups(normalizedGroups);
            setVarianceRows((prev) =>
                prev.map((row) => {
                    if (!row.detail_id) return row;
                    const assigned = detailAssignmentMap.get(row.detail_id);
                    if (assigned) {
                        return {
                            ...row,
                            offset_match: assigned.match,
                            offset_remarks: assigned.remarks,
                        };
                    }
                    return {
                        ...row,
                        offset_match: 0,
                        offset_remarks: null,
                    };
                })
            );
            setHasUnsavedChanges(false);
            setUnsavedGroupIds(new Set());
            toast.success("Offset groups and remarks saved successfully.");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to save offset changes.";
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    }, [header?.id, canOffset, offsetGroups, varianceRows]);

    const handleChangeGroupRemarks = React.useCallback((groupId: string, newRemarks: string) => {
        if (!canOffset) return;
        setOffsetGroups((prev) =>
            prev.map((g) => (g.id === groupId ? { ...g, remarks: newRemarks } : g))
        );
        setHasUnsavedChanges(true);
        setUnsavedGroupIds((prev) => new Set([...prev, groupId]));
    }, [canOffset]);

    const handlePrintReport = React.useCallback(() => {
        if (!header) {
            toast.error("Physical Inventory header is missing.");
            return;
        }

        try {
            printPhysicalInventoryOffsettingReport({
                header,
                reportMeta,
                allShortRows,
                allOverRows,
                unresolvedShortRows: openShortRows,
                unresolvedOverRows: openOverRows,
                offsetGroups,
                preparedBy: currentUser?.name || reportMeta.encoder_name,
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to print the reconciliation report.";
            toast.error(message);
        }
    }, [
        allOverRows,
        allShortRows,
        header,
        offsetGroups,
        openOverRows,
        openShortRows,
        reportMeta,
        currentUser?.name,
    ]);

    const handleEditOffsetGroup = React.useCallback(
        (groupId: string) => {
            if (!canOffset) return;
            const group = offsetGroups.find((g) => g.id === groupId);
            if (!group) return;

            // Restore products to selection pool
            setSelectedShortIds((prev) => [
                ...new Set([...prev, ...group.short_rows.map((r) => r.row_id)]),
            ]);
            setSelectedOverIds((prev) => [
                ...new Set([...prev, ...group.over_rows.map((r) => r.row_id)]),
            ]);

            // Remove group
            setOffsetGroups((prev) => prev.filter((g) => g.id !== groupId));
            setHasUnsavedChanges(true);
            setUnsavedGroupIds((prev) => {
                const next = new Set(prev);
                next.delete(groupId);
                return next;
            });
            toast.info("Group disbanded. Items restored to selection pool.");
        },
        [canOffset, offsetGroups],
    );

    const handleDeleteOffsetGroup = React.useCallback((groupId: string) => {
        if (!canOffset) return;
        setOffsetGroups((prev) => prev.filter((g) => g.id !== groupId));
        setHasUnsavedChanges(true);
        setUnsavedGroupIds((prev) => {
            const next = new Set(prev);
            next.delete(groupId);
            return next;
        });
        toast.info("Offset group removed.");
    }, [canOffset]);

    const canCreateGroup =
        selectedShortRows.length > 0 &&
        selectedOverRows.length > 0 &&
        canOffset &&
        !isSaving;

    if (isLoading || !header) {
        return (
            <div className="flex min-h-[220px] items-center justify-center rounded-2xl border bg-background">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading Physical Inventory offsetting module...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border bg-background px-3 py-2 shadow-sm sm:px-4">
                <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <div className="rounded-xl border bg-muted/40 p-1.5">
                                <GitCompareArrows className="h-4 w-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-base font-semibold tracking-tight">
                                        Physical Inventory Offsetting
                                    </h1>
                                    <Badge
                                        variant="outline"
                                        className={
                                            statusText === "Committed"
                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                                                : statusText === "Cancelled"
                                                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                                                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                                        }
                                    >
                                        {statusText}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Reconcile SHORT and OVER rows through manual multi-row grouping on committed Physical Inventory records.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {onBack ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="cursor-pointer"
                                onClick={onBack}
                            >
                                <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                                Back
                            </Button>
                        ) : null}

                        <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            onClick={handleRefreshClick}
                            disabled={isLoading || isSaving}
                        >
                            <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                            Refresh
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            onClick={handlePrintReport}
                            disabled={isLoading || isSaving}
                        >
                            <Printer className="mr-2 h-3.5 w-3.5" />
                            Print Report
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-900/60 dark:bg-teal-950/30 dark:text-teal-300 dark:hover:bg-teal-900/40"
                            onClick={() => setOpenCountSheetDialog(true)}
                            disabled={isLoading || isSaving || !header?.id}
                        >
                            <FileText className="mr-2 h-3.5 w-3.5" />
                            View Count Sheet
                        </Button>
                    </div>
                </div>
            </div>

            {!canOffset && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                        <span className="font-semibold">
                            {statusText === "Cancelled"
                                ? "Offsetting Disabled (Cancelled):"
                                : "Offsetting Disabled (Pending):"}
                        </span>{" "}
                        {statusText === "Cancelled"
                            ? "This Physical Inventory is Cancelled and cannot be modified."
                            : "This Physical Inventory is still Pending. Please commit the Physical Inventory in Manual Count first before performing offsetting."}
                    </div>
                </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Card className="rounded-2xl">
                    <CardContent className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            PI No
                        </p>
                        <p className="mt-1 text-sm font-semibold">{header.ph_no || `PI #${header.id}`}</p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardContent className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Created By
                        </p>
                        <p className="mt-1 text-sm font-semibold truncate" title={reportMeta.encoder_name}>
                            {reportMeta.encoder_name || "—"}
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardContent className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Open Short
                        </p>
                        <p className="mt-1 text-sm font-semibold text-red-700 dark:text-red-300">
                            ₱ {fmtMoney(unmatchedShortTotal)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardContent className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Open Over
                        </p>
                        <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                            ₱ {fmtMoney(unmatchedOverTotal)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardContent className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Offset Groups
                        </p>
                        <p className="mt-1 text-sm font-semibold">{offsetGroups.length}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
                <OffsettingSelectionTable
                    title="SHORT Pool"
                    direction="SHORT"
                    rows={openShortRows}
                    selectedIds={selectedShortIds}
                    onToggleRow={handleToggleShortRow}
                    disabled={!canOffset || isSaving}
                />

                <OffsettingSelectionTable
                    title="OVER Pool"
                    direction="OVER"
                    rows={openOverRows}
                    selectedIds={selectedOverIds}
                    onToggleRow={handleToggleOverRow}
                    disabled={!canOffset || isSaving}
                />
            </div>

            <Card className="rounded-2xl">
                <CardContent className="px-4 py-3">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="rounded-xl border bg-muted/20 px-4 py-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Selected Short Total
                                </p>
                                <p className="mt-1 text-sm font-semibold text-red-700 dark:text-red-300">
                                    ₱ {fmtMoney(selectedShortTotal)}
                                </p>
                            </div>

                            <div className="rounded-xl border bg-muted/20 px-4 py-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Selected Over Total
                                </p>
                                <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                    ₱ {fmtMoney(selectedOverTotal)}
                                </p>
                            </div>

                            <div className="rounded-xl border bg-muted/20 px-4 py-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Difference
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    ₱ {fmtMoney(selectedDifference)}
                                </p>
                            </div>
                        </div>

                        <div className="flex shrink-0 flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto">
                            <Button
                                size="sm"
                                className="cursor-pointer shrink-0"
                                onClick={handleCreateOffsetGroup}
                                disabled={!canCreateGroup}
                            >
                                <Plus className="mr-2 h-3.5 w-3.5" />
                                Create Offset Group
                            </Button>
                            <Button
                                size="sm"
                                variant={hasUnsavedChanges ? "default" : "outline"}
                                className={`cursor-pointer shrink-0 font-medium ${
                                    hasUnsavedChanges ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                                }`}
                                onClick={() => {
                                    void handleSaveOffsetChanges();
                                }}
                                disabled={!canOffset || isSaving || isLoading || !hasUnsavedChanges}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-3.5 w-3.5" />
                                        Save {hasUnsavedChanges ? "*" : ""}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-tight">
                        Reconciliation Groups
                    </h2>
                </div>
                <OffsettingGroupsTable
                    groups={offsetGroups}
                    onEditGroup={handleEditOffsetGroup}
                    onDeleteGroup={handleDeleteOffsetGroup}
                    onChangeGroupRemarks={handleChangeGroupRemarks}
                    isPending={canOffset}
                    disabled={!canOffset || isSaving}
                    unsavedGroupIds={unsavedGroupIds}
                />
            </div>

            {/* Refresh Discard Confirmation Dialog */}
            <AlertDialog open={openRefreshConfirmDialog} onOpenChange={setOpenRefreshConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard Unsaved Changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved offset groups or remarks. Refreshing will discard these changes and reload the latest data saved in the database.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">
                            Keep Editing
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                setOpenRefreshConfirmDialog(false);
                                void loadSnapshot();
                            }}
                        >
                            Discard & Refresh
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <PhysicalInventoryUploadCountSheetDialog
                isOpen={openCountSheetDialog}
                onOpenChange={setOpenCountSheetDialog}
                physicalInventoryId={header?.id || null}
                phNo={header?.ph_no}
                canEdit={false}
                isCommitted={true}
                currentUserId={currentUser?.id}
            />
        </div>
    );
}
