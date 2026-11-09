"use client";

import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";
import { useSearchParams } from "next/navigation";

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
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { PhysicalInventoryOffsettingModule } from "@/modules/audit-results-findings/inventory-management/physical-inventory-offsetting-v2";
import {
    PhysicalInventoryListModule,
    type PhysicalInventoryListRow,
} from "@/modules/audit-results-findings/inventory-management/physical-inventory-list-v2";

type Props = {
    currentUser?: { id: number; name: string };
};

export default function PhysicalInventoryOffsettingWorkspaceClient({ currentUser }: Props) {
    const searchParams = useSearchParams();
    const urlPhId = searchParams.get("id");

    const [selectedHeaderId, setSelectedHeaderId] = React.useState<number | null>(null);
    const [isListCollapsed, setIsListCollapsed] = React.useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
    const [pendingRecordId, setPendingRecordId] = React.useState<number | null>(null);

    React.useEffect(() => {
        if (urlPhId) {
            const parsed = parseInt(urlPhId, 10);
            if (!isNaN(parsed)) {
                setSelectedHeaderId(parsed);
                setIsListCollapsed(true);
            }
        }
    }, [urlPhId]);

    React.useEffect(() => {
        if (typeof window === "undefined") return;

        const media = window.matchMedia("(max-width: 1279px)");

        const apply = () => {
            setIsListCollapsed(media.matches);
        };

        apply();
        media.addEventListener("change", apply);

        return () => {
            media.removeEventListener("change", apply);
        };
    }, []);

    const handleOpenRecord = React.useCallback(
        (row: PhysicalInventoryListRow) => {
            if (row.id === selectedHeaderId) {
                setIsListCollapsed(true);
                return;
            }
            if (hasUnsavedChanges) {
                setPendingRecordId(row.id);
                return;
            }
            setSelectedHeaderId(row.id);
            setIsListCollapsed(true);
        },
        [hasUnsavedChanges, selectedHeaderId],
    );

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 rounded-2xl border bg-background px-3 py-2 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="min-w-0 text-xs text-muted-foreground">
                    {isListCollapsed
                        ? selectedHeaderId
                            ? "PI list is hidden for a wider reconciliation work area."
                            : "PI list is hidden. Open the list to select a Physical Inventory for offsetting."
                        : "Select a Physical Inventory from the list to open its offsetting workspace."}
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer self-start sm:self-auto"
                    onClick={() => setIsListCollapsed((prev) => !prev)}
                >
                    {isListCollapsed ? (
                        <>
                            <PanelLeftOpen className="mr-2 h-3.5 w-3.5" />
                            Show List
                        </>
                    ) : (
                        <>
                            <PanelLeftClose className="mr-2 h-3.5 w-3.5" />
                            Hide List
                        </>
                    )}
                </Button>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-start lg:gap-3">
                <AnimatePresence initial={false}>
                    {!isListCollapsed && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "auto", opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                            className="overflow-hidden"
                        >
                            <div className="w-full pb-3 lg:w-[340px] lg:pb-0 xl:w-[360px] 2xl:w-[400px]">
                                <PhysicalInventoryListModule
                                    selectedHeaderId={selectedHeaderId}
                                    onOpenRecord={handleOpenRecord}
                                    hideCreateButton={true}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="min-w-0 flex-1">
                    {selectedHeaderId ? (
                        <PhysicalInventoryOffsettingModule
                            key={selectedHeaderId}
                            phId={selectedHeaderId}
                            currentUser={currentUser}
                            onUnsavedChangesChange={setHasUnsavedChanges}
                        />
                    ) : (
                        <div className="flex min-h-[420px] items-center justify-center rounded-2xl border bg-background">
                            <div className="text-center">
                                <p className="text-sm font-medium">
                                    No Physical Inventory selected
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {isListCollapsed
                                        ? "Click “Show List” and open a record to start offsetting."
                                        : "Choose a record from the list to open the offsetting module."}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AlertDialog
                open={pendingRecordId !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingRecordId(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard Unsaved Offset Changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved offset groups or remarks on the current Physical Inventory record. Switching to another record will discard these changes.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">
                            Stay on Current Record
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (pendingRecordId !== null) {
                                    setHasUnsavedChanges(false);
                                    setSelectedHeaderId(pendingRecordId);
                                    setPendingRecordId(null);
                                    setIsListCollapsed(true);
                                }
                            }}
                        >
                            Discard & Switch Record
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}