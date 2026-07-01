import { InventoryShortage, InventoryShortageFormData, User } from '../types';

const API_BASE = "/api/shortage/inventory";

export const shortageService = {
    async getUsers(): Promise<User[]> {
        const res = await fetch(`${API_BASE}?action=users`);
        if (!res.ok) return [];
        const result = await res.json();
        return result.data || [];
    },

    async getInventoryShortages(
        page: number,
        search: string
    ): Promise<{ data: InventoryShortage[]; total: number }> {
        const url = `${API_BASE}?action=list&page=${page}&limit=20&search=${encodeURIComponent(search)}`;
        const res = await fetch(url);
        if (!res.ok) return { data: [], total: 0 };
        const result = await res.json();
        
        return {
            data: result.data || [],
            total: result.meta?.total_count || 0
        };
    },

    async createInventoryShortage(data: InventoryShortageFormData, files?: File[]): Promise<InventoryShortage> {
        const formData = new FormData();
        
        // Append form data as a JSON string under a specific key, 
        // or append each field individually. Appending as JSON is cleaner.
        formData.append("data", JSON.stringify(data));

        if (files && files.length > 0) {
            files.forEach(file => {
                formData.append("files", file);
            });
        }

        const res = await fetch(API_BASE, {
            method: "POST",
            // Note: When sending FormData, DO NOT set Content-Type header manually.
            // The browser will automatically set it to multipart/form-data with the correct boundary.
            body: formData
        });
        
        const result = await res.json();
        if (!res.ok) {
            throw new Error(result.error || "Failed to create record");
        }
        
        return result.data;
    }
};
