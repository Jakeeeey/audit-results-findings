"use client";

import React, { useRef, useCallback } from "react";
import { Bluetooth, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RFIDReaderProps {
    scannedCount: number;
    totalCount: number;
    lastScanned: string | null;
    onScan: (rfidCode: string) => void;
    onDoneAudit: () => void;
}

export function RFIDReader({
    scannedCount,
    totalCount,
    lastScanned,
    onScan,
    onDoneAudit,
}: RFIDReaderProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleInputKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                const val = inputRef.current?.value ?? "";
                if (val.trim()) {
                    onScan(val.trim());
                    if (inputRef.current) inputRef.current.value = "";
                }
            }
        },
        [onScan]
    );

    return (
        <div className="rounded-lg border bg-card p-4 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Bluetooth className="h-5 w-5 text-blue-500" />
                <span className="font-semibold text-sm">
                     BT RFID Reader
                </span>
                <Badge variant="secondary" className="ml-auto">
                    {scannedCount} / {totalCount} Scanned
                </Badge>
            </div>

            {/* Last scanned display */}
            <div className="rounded-md bg-muted px-3 py-2 flex items-center gap-2 min-h-[40px]">
                <ScanLine className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-mono truncate">
                    {lastScanned ? (
                        <span className="text-green-600 dark:text-green-400">
                            {lastScanned}
                        </span>
                    ) : (
                        <span className="text-muted-foreground">
                            Waiting for scan...
                        </span>
                    )}
                </span>
            </div>

            {/* RFID input */}
            <div className="flex flex-col gap-1">
                <Label htmlFor="rfid-input" className="text-xs text-muted-foreground">
                    RFID Input (press Enter to scan)
                </Label>
                <Input
                    id="rfid-input"
                    ref={inputRef}
                    placeholder="Point scanner here or type RFID code..."
                    onKeyDown={handleInputKeyDown}
                    className="font-mono text-sm"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
            </div>

            {/* Done Audit */}
            <Button variant="default" className="w-full" onClick={onDoneAudit}>
                Done Audit
            </Button>
        </div>
    );
}
