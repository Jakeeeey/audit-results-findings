"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { shortageService } from "../services/shortageService";
import { User, InventoryShortageFormData } from "../types";
import { toast } from "sonner";
import { Loader2, X, UploadCloud, FileIcon } from "lucide-react";

interface InventoryShortageFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function InventoryShortageForm({ open, onOpenChange, onSuccess }: InventoryShortageFormProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [formData, setFormData] = useState<InventoryShortageFormData>({
        receiver_id: 0,
        amount: 0,
        date_from: null,
        date_to: null,
        nte_number: "",
        issuer_id: null,
        manager_id: null,
        nod_date: null,
        explanation_received_at: null,
        hearing_date: null,
        cash_payment_amount: 0,
        salary_deduction_amount: 0,
        payroll_run_employee_id: null,
        status: "Pending"
    });

    const [files, setFiles] = useState<File[]>([]);

    useEffect(() => {
        if (open && users.length === 0) {
            fetchUsers();
        }
        if (!open) {
            setFiles([]);
        }
    }, [open, users.length]);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const data = await shortageService.getUsers();
            setUsers(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load users");
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleChange = (field: keyof InventoryShortageFormData, value: string | number | null) => {
        setFormData(prev => ({ ...prev, [field]: value as never }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files as FileList)]);
            // Reset input so the user can select the same file again if they deleted it
            e.target.value = '';
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (
            !formData.receiver_id || 
            formData.amount <= 0 ||
            !formData.nod_date ||
            !formData.date_from ||
            !formData.date_to ||
            !formData.manager_id
        ) {
            toast.error("Please fill in all required fields.");
            return;
        }

        setSaving(true);
        try {
            await shortageService.createInventoryShortage(formData, files);
            toast.success("Inventory shortage created successfully!");
            onSuccess();
        } catch (error: unknown) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "Failed to create inventory shortage");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Create Inventory Shortage (NOD)</DialogTitle>
                    <DialogDescription className="text-xs font-bold uppercase">
                        Record a new inventory shortage Notice of Discrepancy.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase">Receiver (Employee) *</Label>
                            <SearchableSelect 
                                value={formData.receiver_id ? formData.receiver_id.toString() : ""} 
                                onValueChange={(v) => handleChange("receiver_id", parseInt(v))}
                                placeholder={loadingUsers ? "Loading..." : "Select Employee"}
                                options={users.map(u => ({
                                    value: u.user_id.toString(),
                                    label: `${u.user_fname} ${u.user_lname}`.toUpperCase()
                                }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase">Shortage Amount *</Label>
                            <Input 
                                type="number" 
                                step="0.01" 
                                value={formData.amount || ""} 
                                onChange={(e) => handleChange("amount", parseFloat(e.target.value) || 0)} 
                                required 
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase">NTE Number</Label>
                            <Input 
                                value={formData.nte_number || ""} 
                                onChange={(e) => handleChange("nte_number", e.target.value)} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase">NOD Date *</Label>
                            <Input 
                                type="date" 
                                value={formData.nod_date || ""} 
                                onChange={(e) => handleChange("nod_date", e.target.value || null)} 
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase">Date From *</Label>
                            <Input 
                                type="date" 
                                value={formData.date_from || ""} 
                                onChange={(e) => handleChange("date_from", e.target.value || null)} 
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase">Date To *</Label>
                            <Input 
                                type="date" 
                                value={formData.date_to || ""} 
                                onChange={(e) => handleChange("date_to", e.target.value || null)} 
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase">Manager *</Label>
                            <SearchableSelect 
                                value={formData.manager_id ? formData.manager_id.toString() : ""} 
                                onValueChange={(v) => handleChange("manager_id", parseInt(v))}
                                placeholder={loadingUsers ? "Loading..." : "Select Manager"}
                                options={users.map(u => ({
                                    value: u.user_id.toString(),
                                    label: `${u.user_fname} ${u.user_lname}`.toUpperCase()
                                }))}
                            />
                        </div>
                        
                        <div className="col-span-2 space-y-2">
                            <Label className="text-xs font-black uppercase">Attachments</Label>
                            <Label className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 hover:bg-muted/50 transition-colors flex flex-col items-center justify-center cursor-pointer w-full">
                                <input 
                                    type="file" 
                                    multiple
                                    onChange={handleFileChange}
                                    className="sr-only"
                                />
                                <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
                                <span className="text-xs font-bold text-muted-foreground uppercase text-center">
                                    Click or drag files to upload
                                </span>
                            </Label>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase">Cash Payment Amount</Label>
                            <Input 
                                type="number" 
                                step="0.01" 
                                value={formData.cash_payment_amount || ""} 
                                onChange={(e) => handleChange("cash_payment_amount", parseFloat(e.target.value) || 0)} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase">Salary Deduction Amount</Label>
                            <Input 
                                type="number" 
                                step="0.01" 
                                value={formData.salary_deduction_amount || ""} 
                                onChange={(e) => handleChange("salary_deduction_amount", parseFloat(e.target.value) || 0)} 
                            />
                        </div>
                    </div>

                    {files.length > 0 && (
                        <div className="space-y-2 col-span-2 mt-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selected Files</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {files.map((file, i) => {
                                    const isImage = file.type.startsWith('image/');
                                    const previewUrl = isImage ? URL.createObjectURL(file) : null;
                                    
                                    return (
                                        <div key={i} className="group relative bg-muted/50 rounded-md border text-xs overflow-hidden flex flex-col h-24">
                                            {isImage && previewUrl ? (
                                                <div className="flex-1 bg-black/5 relative">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={previewUrl} alt={file.name} className="absolute inset-0 w-full h-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex items-center justify-center bg-black/5">
                                                    <FileIcon className="w-8 h-8 text-muted-foreground/50" />
                                                </div>
                                            )}
                                            <div className="p-1.5 bg-background border-t text-[10px] truncate font-medium">
                                                {file.name}
                                            </div>
                                            <Button 
                                                type="button" 
                                                variant="destructive" 
                                                size="icon" 
                                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    removeFile(i);
                                                }}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="text-xs font-bold uppercase">
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={
                                saving || 
                                !formData.receiver_id || 
                                formData.amount <= 0 ||
                                !formData.nod_date ||
                                !formData.date_from ||
                                !formData.date_to ||
                                !formData.manager_id
                            } 
                            className="text-xs font-bold uppercase"
                        >
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Save Record
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
