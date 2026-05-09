"use client";

import React from "react";

interface LastScannedTagProps {
    lastScanned: string | null;
}

export function LastScannedTag({ lastScanned }: LastScannedTagProps) {
    return (
        <div className="rounded-lg border bg-card p-4 flex flex-col gap-2 h-full">
            <span className="text-sm font-semibold">Last Scanned Tag</span>
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 min-h-[36px] flex items-center">
                <span className="text-sm font-mono text-blue-700 dark:text-blue-300 truncate">
                    {lastScanned ?? (
                        <span className="text-muted-foreground italic">None yet</span>
                    )}
                </span>
            </div>
        </div>
    );
}
