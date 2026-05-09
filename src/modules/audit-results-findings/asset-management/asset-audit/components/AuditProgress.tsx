"use client";

import React from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AuditProgressProps {
    scannedCount: number;
    totalCount: number;
}

export function AuditProgress({ scannedCount, totalCount }: AuditProgressProps) {
    const remaining = totalCount - scannedCount;
    const progress  = totalCount > 0 ? Math.round((scannedCount / totalCount) * 100) : 0;

    return (
        <div className="rounded-lg border bg-card p-4 flex flex-col gap-3 h-full">
            <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Audit Progress</span>
                <span className="text-sm font-bold text-primary">
                    {scannedCount}/{totalCount}
                </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {scannedCount} scanned
                </span>
                <span className="flex items-center gap-1 text-amber-500">
                    <Clock className="h-3.5 w-3.5" />
                    {remaining} remaining
                </span>
            </div>
        </div>
    );
}
