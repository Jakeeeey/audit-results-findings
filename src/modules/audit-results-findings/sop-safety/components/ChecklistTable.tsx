'use client';

import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { SopChecklist } from '../types';

export function ChecklistTable({ rows, loading, onOpen }: { rows: SopChecklist[]; loading: boolean; onOpen: (row: SopChecklist) => void }) {
    return <Table aria-label="SOP and safety checklists" aria-busy={loading}>
        <TableHeader><TableRow className="bg-muted/40">
            <TableHead>Name</TableHead><TableHead>Warehouse applicability</TableHead><TableHead>Frequency</TableHead>
            <TableHead>Maximum grade</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
            {loading ? Array.from({ length: 3 }, (_, index) => <TableRow key={index}><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow>) : rows.length === 0 ?
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No checklists found. Try adjusting your search or status filter.</TableCell></TableRow> :
                rows.map(row => <TableRow key={row.id}>
                    <TableCell className="min-w-60"><p className="font-medium">{row.name}</p><p className="max-w-md text-xs text-muted-foreground">{row.description || '—'}</p></TableCell>
                    <TableCell>{row.branchId === null ? 'All warehouses' : `Warehouse #${row.branchId}`}</TableCell>
                    <TableCell>{row.frequency}</TableCell><TableCell>{row.maxGrade}</TableCell>
                    <TableCell><Badge variant={row.active ? 'default' : 'secondary'}>{row.active ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => onOpen(row)} aria-label={`View ${row.name}`}><Eye className="mr-2 h-4 w-4" />View</Button></TableCell>
                </TableRow>)}
        </TableBody>
    </Table>;
}
