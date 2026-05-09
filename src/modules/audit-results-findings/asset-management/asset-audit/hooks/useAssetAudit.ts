"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
    AssetAuditItem,
    AuditCurrentUser,
    MissingAsset,
    ScanLogEntry,
    SubmitAuditPayload,
} from "../types";
import { toast } from "sonner";

export function useAssetAudit() {
    const [assets, setAssets]               = useState<AssetAuditItem[]>([]);
    const [currentUser, setCurrentUser]     = useState<AuditCurrentUser | null>(null);
    const [scannedCodes, setScannedCodes]   = useState<Set<string>>(new Set());
    const [lastScanned, setLastScanned]     = useState<string | null>(null);
    const [isLoading, setIsLoading]         = useState(true);
    const [fetchError, setFetchError]       = useState<string | null>(null);
    const [isDoneDialogOpen, setIsDoneDialogOpen] = useState(false);
    const [missingAssets, setMissingAssets] = useState<MissingAsset[]>([]);
    const [isSubmitting, setIsSubmitting]   = useState(false);
    const [scanLog, setScanLog]             = useState<ScanLogEntry[]>([]);

    // RFID keystroke buffer for BT HID keyboard-emulation mode
    const rfidBuffer  = useRef<string>("");
    const rfidTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Fetch assets on mount ──────────────────────────────────────────────
    useEffect(() => {
        async function loadAssets() {
            setIsLoading(true);
            setFetchError(null);
            try {
                const res  = await fetch("/api/auth/arf/asset-management/asset-audit");
                const data = await res.json();

                if (data.current_user) setCurrentUser(data.current_user);

                if (data.ok) {
                    setAssets(data.assets ?? []);
                } else {
                    const msg = data.message ?? "Failed to load assets";
                    setFetchError(msg);
                    toast.error("Error", { description: msg });
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed to load assets";
                setFetchError(msg);
                toast.error("Error", { description: msg });
            } finally {
                setIsLoading(false);
            }
        }
        loadAssets();
    }, []);

    // ── Handle a scanned RFID code ─────────────────────────────────────────
    const handleScan = useCallback(
        (rfidCode: string) => {
            const code = rfidCode.trim().toUpperCase();
            if (!code) return;

            const matched = assets.some((a) => a.rfid_code === code);

            setScannedCodes((prev) => {
                const next = new Set(prev);
                next.add(code);
                return next;
            });
            setLastScanned(code);
            setScanLog((prev) => [{ code, time: new Date() }, ...prev]);

            if (matched) {
                toast.success("Asset Scanned", { description: `RFID: ${code}` });
            } else {
                toast.warning("Unknown RFID", {
                    description: `Code "${code}" not found in asset list`,
                });
            }
        },
        [assets]
    );

    // ── Global keyboard listener for BT reader in HID / keyboard-emulation mode ──
    // Ignores events while a form control is focused so manual typing still works.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName?.toUpperCase();
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

            if (e.key === "Enter") {
                const code = rfidBuffer.current.trim();
                rfidBuffer.current = "";
                if (rfidTimeout.current) clearTimeout(rfidTimeout.current);
                if (code) handleScan(code);
                return;
            }

            if (e.key.length === 1) {
                rfidBuffer.current += e.key;
                if (rfidTimeout.current) clearTimeout(rfidTimeout.current);
                // Clear the buffer if no Enter is received within 500 ms
                rfidTimeout.current = setTimeout(() => {
                    rfidBuffer.current = "";
                }, 500);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleScan]);

    // ── Done Audit: compute missing assets and open dialog ─────────────────
    const handleDoneAudit = useCallback(() => {
        const missing: MissingAsset[] = assets
            .filter((a) => !a.rfid_code || !scannedCodes.has(a.rfid_code.toUpperCase()))
            .map((a) => ({
                asset_id:              a.id,
                item_name:             a.item_name,
                rfid_code:             a.rfid_code,
                serial:                a.serial,
                accountable_user_id:   a.employee_id,
                accountable_user_name: a.employee_name,
            }));

        setMissingAssets(missing);
        setIsDoneDialogOpen(true);
    }, [assets, scannedCodes]);

    // ── Submit missing audit records to Directus via API route ─────────────
    const handleSubmitAudit = useCallback(async () => {
        if (!currentUser || missingAssets.length === 0) return;

        setIsSubmitting(true);
        try {
            const payload: SubmitAuditPayload = {
                records: missingAssets.map((a) => ({
                    asset_id:            a.asset_id,
                    accountable_user_id: a.accountable_user_id,
                    reported_by:         currentUser.id,
                })),
            };

            const res = await fetch(
                "/api/auth/arf/asset-management/asset-audit",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );
            const data = await res.json();

            if (data.ok) {
                toast.success("Audit Submitted", {
                    description: `${missingAssets.length} missing asset(s) reported.`,
                });
                setIsDoneDialogOpen(false);
            } else {
                toast.error("Submit Failed", {
                    description: data.message ?? "Unknown error",
                });
            }
        } catch (err) {
            toast.error("Submit Failed", {
                description: err instanceof Error ? err.message : "Unknown error",
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [currentUser, missingAssets]);

    return {
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
    };
}
