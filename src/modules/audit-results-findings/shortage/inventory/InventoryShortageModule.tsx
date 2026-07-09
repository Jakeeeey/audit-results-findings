"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, PackageOpen, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { InventoryShortage, User } from "./types";
import { shortageService } from "./services/shortageService";
import { InventoryShortageForm } from "./components/InventoryShortageForm";
import { Badge } from "@/components/ui/badge";

export default function InventoryShortageModule() {
    const [shortages, setShortages] = useState<InventoryShortage[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [openAdd, setOpenAdd] = useState(false);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(handler);
    }, [search]);

    useEffect(() => {
        fetchShortages(1, debouncedSearch);
    }, [debouncedSearch]);

    const fetchShortages = async (page: number, search: string) => {
        setLoading(true);
        try {
            const { data } = await shortageService.getInventoryShortages(page, search);
            setShortages(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getUserName = (user: number | User | null | undefined) => {
        if (!user) return "N/A";
        if (typeof user === 'object') {
            return `${user.user_fname} ${user.user_lname}`;
        }
        return `ID: ${user}`;
    };

    return (
        <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <AlertCircle className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">
                            Inventory Shortage
                        </h1>
                        <p className="text-sm text-muted-foreground font-medium">
                            Manage notices of discrepancy (NOD) for inventory.
                        </p>
                    </div>
                </div>
                <Button onClick={() => setOpenAdd(true)} className="h-10 text-xs font-black uppercase tracking-widest shadow-md">
                    <Plus className="w-4 h-4 mr-2" /> Add Record
                </Button>
            </div>

            <Card className="shadow-sm border-border overflow-hidden">
                <div className="p-4 border-b bg-card flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full sm:w-72 shrink-0">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-50" />
                        <Input
                            placeholder="Search NTE Number..."
                            className="pl-9 h-10 text-xs font-bold uppercase bg-background"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase h-10 px-6">NTE Number</TableHead>
                                <TableHead className="text-[10px] font-black uppercase h-10">Receiver</TableHead>
                                <TableHead className="text-[10px] font-black uppercase h-10 text-right">Amount</TableHead>
                                <TableHead className="text-[10px] font-black uppercase h-10">NOD Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase h-10 text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="px-6 py-4"><div className="h-4 w-24 bg-muted rounded animate-pulse"></div></TableCell>
                                        <TableCell className="py-4"><div className="h-4 w-32 bg-muted rounded animate-pulse"></div></TableCell>
                                        <TableCell className="py-4"><div className="h-4 w-20 bg-muted rounded animate-pulse ml-auto"></div></TableCell>
                                        <TableCell className="py-4"><div className="h-4 w-20 bg-muted rounded animate-pulse"></div></TableCell>
                                        <TableCell className="py-4"><div className="h-6 w-24 bg-muted rounded-full animate-pulse mx-auto"></div></TableCell>
                                    </TableRow>
                                ))
                            ) : shortages.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                                <PackageOpen className="w-8 h-8 text-muted-foreground opacity-50" />
                                            </div>
                                            <span className="text-sm font-black uppercase text-foreground">No Records Found</span>
                                            <p className="text-xs text-muted-foreground font-medium mt-1">Try adjusting your search terms or add a new record.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                shortages.map((shortage) => (
                                    <TableRow key={shortage.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="px-6 py-4">
                                            <span className="text-sm font-black uppercase text-foreground">
                                                {shortage.nte_number || "N/A"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <span className="text-xs font-bold uppercase text-muted-foreground">
                                                {getUserName(shortage.receiver_id)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-4 text-right">
                                            <span className="text-sm font-black text-destructive">
                                                ₱ {Number(shortage.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <span className="text-xs font-semibold text-muted-foreground">
                                                {shortage.nod_date ? format(new Date(shortage.nod_date), "MMM dd, yyyy") : "N/A"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-4 text-center">
                                            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-muted/50">
                                                {shortage.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <InventoryShortageForm
                open={openAdd}
                onOpenChange={setOpenAdd}
                onSuccess={() => {
                    setOpenAdd(false);
                    fetchShortages(1, debouncedSearch);
                }}
            />
        </div>
    );
}
