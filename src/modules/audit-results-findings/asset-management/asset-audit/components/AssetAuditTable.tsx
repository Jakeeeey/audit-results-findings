"use client";

import React from "react";
import type { AssetAuditItem } from "../types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface AssetAuditTableProps {
    assets: AssetAuditItem[];
    scannedCodes: Set<string>;
    isLoading: boolean;
    fetchError: string | null;
}

export function AssetAuditTable({
    assets,
    scannedCodes,
    isLoading,
    fetchError,
}: AssetAuditTableProps) {
    const isScanned = (asset: AssetAuditItem) =>
        !!(asset.rfid_code && scannedCodes.has(asset.rfid_code.toUpperCase()));

    if (isLoading) {
        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                            <TableHead className="h-10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Asset
                            </TableHead>
                            <TableHead className="h-10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Item Classification
                            </TableHead>
                            <TableHead className="h-10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Item Type
                            </TableHead>
                            <TableHead className="h-10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Employee
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <TableRow key={i}>
                                {Array.from({ length: 4 }).map((_, j) => (
                                    <TableCell key={j}>
                                        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    return (
        <div className="rounded-md border overflow-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                        <TableHead className="h-10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Asset
                        </TableHead>
                        <TableHead className="h-10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Item Classification
                        </TableHead>
                        <TableHead className="h-10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Item Type
                        </TableHead>
                        <TableHead className="h-10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Employee
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {fetchError ? (
                        <TableRow>
                            <TableCell colSpan={4} className="py-8">
                                <div className="flex flex-col items-center gap-2 text-destructive">
                                    <AlertCircle className="h-5 w-5" />
                                    <span className="text-sm font-medium">Failed to load assets</span>
                                    <span className="text-xs text-muted-foreground text-center max-w-sm">{fetchError}</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : assets.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={4}
                                className="text-center text-muted-foreground py-8"
                            >
                                No assets found
                            </TableCell>
                        </TableRow>
                    ) : (
                        assets.map((asset) => {
                            const scanned = isScanned(asset);
                            return (
                                <TableRow
                                    key={asset.id}
                                    className={cn(
                                        "border-l-4 transition-colors duration-300",
                                        scanned
                                            ? "!bg-green-100 dark:!bg-green-900/30 border-l-green-500 hover:!bg-green-100 dark:hover:!bg-green-900/30"
                                            : "!bg-muted/60 border-l-transparent hover:!bg-muted/60"
                                    )}
                                >
                                    <TableCell className={cn("transition-all duration-300", !scanned && "blur-sm select-none pointer-events-none")}>
                                        <span className={cn("font-medium", scanned && "text-green-800")}>
                                            {asset.item_name ?? "—"}
                                        </span>
                                        {asset.serial && (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                S/N: {asset.serial}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className={cn("transition-all duration-300", !scanned && "blur-sm select-none pointer-events-none")}>
                                        {asset.classification_name ? (
                                            <Badge variant="secondary">
                                                {asset.classification_name}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className={cn("transition-all duration-300", !scanned && "blur-sm select-none pointer-events-none")}>
                                        {asset.type_name ? (
                                            <Badge variant="outline">
                                                {asset.type_name}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className={cn("transition-all duration-300", !scanned && "blur-sm select-none pointer-events-none")}>
                                        {asset.employee_name ?? (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
