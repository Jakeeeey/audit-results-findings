"use client";

import React from "react";
import type { ScanLogEntry } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ScanLogProps {
    scanLog: ScanLogEntry[];
}

const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", {
        hour:   "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });

export function ScanLog({ scanLog }: ScanLogProps) {
    return (
        <div className="rounded-lg border bg-card p-4 flex flex-col gap-2 h-full">
            <span className="text-sm font-semibold">Scan Log</span>
            {scanLog.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">
                    No scans yet
                </p>
            ) : (
                <ScrollArea className="h-48">
                    <div className="flex flex-col divide-y">
                        {scanLog.map((entry, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between py-2 px-1"
                            >
                                <span className="text-sm font-mono text-foreground">
                                    {entry.code}
                                </span>
                                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                    {formatTime(entry.time)}
                                </span>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
}
