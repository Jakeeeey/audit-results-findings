"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { MissingAsset, AuditCurrentUser } from "../types";

interface DoneAuditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    missingAssets: MissingAsset[];
    currentUser: AuditCurrentUser | null;
    isSubmitting: boolean;
    onSubmit: () => void;
}

export function DoneAuditDialog({
    open,
    onOpenChange,
    missingAssets,
    currentUser,
    isSubmitting,
    onSubmit,
}: DoneAuditDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Auditing for Missing Assets</DialogTitle>
                </DialogHeader>

                {/* Missing assets table */}
                <div className="flex-1 overflow-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                <TableHead className="h-10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                    Asset
                                </TableHead>
                                <TableHead className="h-10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                    Accountable User
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {missingAssets.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={2}
                                        className="text-center text-muted-foreground py-8"
                                    >
                                        All assets have been scanned. No
                                        missing assets.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                missingAssets.map((asset) => (
                                    <TableRow key={asset.asset_id}>
                                        <TableCell>
                                            <span className="font-medium">
                                                {asset.item_name ?? "—"}
                                            </span>
                                            {asset.serial && (
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    S/N: {asset.serial}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {asset.accountable_user_name ?? (
                                                <span className="text-muted-foreground">
                                                    —
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Reported by */}
                <div>
                    <Separator className="my-3" />
                    <p className="text-sm text-muted-foreground">
                        Reported by:{" "}
                        <span className="font-medium text-foreground">
                            {currentUser?.name ?? "Unknown"}
                        </span>
                    </p>
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onSubmit}
                        disabled={
                            isSubmitting || missingAssets.length === 0
                        }
                    >
                        {isSubmitting ? "Submitting..." : "Submit Report"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
