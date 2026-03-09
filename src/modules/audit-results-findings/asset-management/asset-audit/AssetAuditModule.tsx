"use client";

import React from "react";
import { useAssetAudit } from "./hooks/useAssetAudit";
import { AssetAuditTable } from "./components/AssetAuditTable";
import { RFIDReader } from "./components/RFIDReader";
import { AuditProgress } from "./components/AuditProgress";
import { LastScannedTag } from "./components/LastScannedTag";
import { ScanLog } from "./components/ScanLog";
import { DoneAuditDialog } from "./components/DoneAuditDialog";

export default function AssetAuditModule() {
    const {
        assets,
        currentUser,
        scannedCodes,
        lastScanned,
        scanLog,
        isLoading,
        fetchError,
        isDoneDialogOpen,
        setIsDoneDialogOpen,
        missingAssets,
        isSubmitting,
        handleScan,
        handleDoneAudit,
        handleSubmitAudit,
    } = useAssetAudit();

    const matchedCount = assets.filter(
        (a) => a.rfid_code && scannedCodes.has(a.rfid_code.toUpperCase())
    ).length;

    return (
        <div className="flex flex-col gap-4">
            {/* Page heading */}
            <div>
                <h1 className="text-xl font-semibold tracking-tight">
                    Asset Inventory — Physical Audit
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Scan assets using the BT RFID Reader to reveal and verify
                    each item. Unscanned rows remain blurred.
                </p>
            </div>

            {/* RFID Reader + side panels – horizontal row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
                <RFIDReader
                    scannedCount={matchedCount}
                    totalCount={assets.length}
                    lastScanned={lastScanned}
                    onScan={handleScan}
                    onDoneAudit={handleDoneAudit}
                />
                <AuditProgress
                    scannedCount={matchedCount}
                    totalCount={assets.length}
                />
                <LastScannedTag lastScanned={lastScanned} />
                <ScanLog scanLog={scanLog} />
            </div>

            {/* Assets table */}
            <AssetAuditTable
                assets={assets}
                scannedCodes={scannedCodes}
                isLoading={isLoading}
                fetchError={fetchError}
            />

            {/* Done audit dialog */}
            <DoneAuditDialog
                open={isDoneDialogOpen}
                onOpenChange={setIsDoneDialogOpen}
                missingAssets={missingAssets}
                currentUser={currentUser}
                isSubmitting={isSubmitting}
                onSubmit={handleSubmitAudit}
            />
        </div>
    );
}
