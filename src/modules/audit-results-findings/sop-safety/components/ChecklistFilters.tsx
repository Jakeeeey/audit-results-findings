'use client';

import { Search, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ChecklistStatusFilter } from '../types';

type Props = {
    search: string;
    status: ChecklistStatusFilter;
    loading: boolean;
    onSearchChange: (value: string) => void;
    onStatusChange: (value: ChecklistStatusFilter) => void;
    onRefresh: () => void;
};

export function ChecklistFilters({ search, status, loading, onSearchChange, onStatusChange, onRefresh }: Props) {
    return <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input className="pl-9" aria-label="Search checklists" placeholder="Search checklist name or description…" value={search} onChange={event => onSearchChange(event.target.value)} />
        </div>
        <Select value={status} onValueChange={value => {
            if (value === 'ALL' || value === 'ACTIVE' || value === 'INACTIVE') onStatusChange(value);
        }}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Checklist status"><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
        </Select>
        <Button variant="outline" disabled={loading} onClick={onRefresh}><RotateCcw className="mr-2 h-4 w-4" />Refresh</Button>
    </div>;
}
