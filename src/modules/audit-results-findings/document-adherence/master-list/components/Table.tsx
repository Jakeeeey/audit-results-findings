'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationLink, PaginationPrevious, PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { AdherenceBadge } from '../../master-list/components/StatusBadge';
import { AdherenceRemarksDialog } from './AdherenceRemarksDialog';
import { NTEConfirmationDialog } from './NTEConfirmationDialog';
import { MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SubsystemTableRow } from '../types';

interface Props {
  rows:     SubsystemTableRow[];
  loading:  boolean;
  search:   string;
  isUserFilterActive?: boolean;
  onSuccess?: () => void;
}

const HEADERS = [
  'Doc Type',
  'Doc No.',
  'Prepared By',
  'Date Created',
  'Updated Date',
  'Days Elapsed',
  'Adherence Status',
  'Document Status',
  'NTE No.',
  'Actions'
];

const ITEMS_PER_PAGE = 10;

export function SubsystemTable({ rows, loading, search, isUserFilterActive, onSuccess }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [remarksOpen, setRemarksOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<{ docType: string; docNo: string } | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isCreatingNTE, setIsCreatingNTE] = useState(false);
  const [isNTEConfirmOpen, setIsNTEConfirmOpen] = useState(false);

  const handleViewRemarks = (docType: string, docNo: string) => {
    setSelectedRow({ docType, docNo });
    setRemarksOpen(true);
  };

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.docNo.toLowerCase().includes(q)           ||
      r.docType.toLowerCase().includes(q)         ||
      r.preparedBy.toLowerCase().includes(q)      ||
      r.adherenceStatus.toLowerCase().includes(q) ||
      r.documentStatus.toLowerCase().includes(q)
    );
  }, [rows, search]);

  useEffect(() => { 
    setCurrentPage(1); 
    setSelectedRowIds(new Set());
  }, [filteredRows]);

  const totalPages    = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  const handleCreateNTE = async (remarks: string) => {
    const selectedRows = rows.filter(r => selectedRowIds.has(r.id));
    if (selectedRows.length === 0) return;

    // Verify all selected rows belong to the same person
    const uniquePreparedBy = new Set(selectedRows.map(r => r.preparedBy));
    if (uniquePreparedBy.size > 1) {
      toast.error('All selected documents must belong to the same person.');
      return;
    }

    setIsCreatingNTE(true);
    try {
      const details = selectedRows.map(r => ({
        doc_type: r.docType,
        doc_number: r.docNo,
        days_elapsed: r.daysElapsed,
        prepared_by: r.preparedBy
      }));

      const res = await fetch('/api/arf/document-adherance/nte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details, remarks })
      });

      const json = await res.json();
      if (json.ok) {
        toast.success(json.message || 'NTE created successfully');
        setSelectedRowIds(new Set());
        setIsNTEConfirmOpen(false);
      } else {
        toast.error(json.message || 'Failed to create NTE');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while creating NTE');
    } finally {
      setIsCreatingNTE(false);
    }
  };

  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between gap-4 pb-3 pt-3">
        <CardTitle className="text-sm font-bold uppercase shrink-0">
          Documents
        </CardTitle>
        <span className="text-xs text-muted-foreground shrink-0">
          {filteredRows.length} result{filteredRows.length !== 1 ? 's' : ''} — page {currentPage} of {totalPages || 1}
        </span>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {isUserFilterActive && (
                <TableHead className="w-[50px] text-center pl-6">
                  <Checkbox 
                    checked={filteredRows.filter(r => !r.nteNo).length > 0 && filteredRows.filter(r => !r.nteNo).every(r => selectedRowIds.has(r.id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedRowIds(new Set(filteredRows.filter(r => !r.nteNo).map(r => r.id)));
                      } else {
                        setSelectedRowIds(new Set());
                      }
                    }}
                  />
                </TableHead>
              )}
              {HEADERS.map((h, idx) => (
                <TableHead
                  key={h}
                  className={cn(
                    'text-xs font-bold py-4',
                    idx === 0 && 'pl-6',
                    idx === HEADERS.length - 1 && 'pr-6 text-right',
                    h === 'Days Elapsed' && 'text-right',
                  )}
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={HEADERS.length} className="text-center py-10 text-sm text-muted-foreground">
                  <span className="animate-pulse">Loading records…</span>
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={HEADERS.length + (isUserFilterActive ? 1 : 0)} className="text-center py-10 text-sm text-muted-foreground">
                  {search ? `No results for "${search}"` : 'No records found.'}
                </TableCell>
              </TableRow>
            ) : paginatedRows.map(row => (
              <TableRow key={row.id} className="border-border/40 hover:bg-muted/20">
                {isUserFilterActive && (
                  <TableCell className="text-center pl-6">
                    <Checkbox 
                      checked={selectedRowIds.has(row.id)}
                      disabled={!!row.nteNo}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedRowIds);
                        if (checked) newSet.add(row.id);
                        else newSet.delete(row.id);
                        setSelectedRowIds(newSet);
                      }}
                    />
                  </TableCell>
                )}
                <TableCell className="text-xs font-medium py-4 pl-6">{row.docType}</TableCell>
                <TableCell className="text-xs text-primary font-bold font-mono py-4 max-w-[150px] truncate" title={row.docNo}>{row.docNo}</TableCell>
                <TableCell className="text-xs py-4 max-w-[180px] truncate" title={row.preparedBy}>{row.preparedBy}</TableCell>
                <TableCell className="text-xs text-muted-foreground py-4">{row.dateCreated}</TableCell>
                <TableCell className="text-xs text-muted-foreground py-4">{row.updatedDate}</TableCell>
                <TableCell className="text-xs py-4 text-right font-medium">{row.daysElapsed}d</TableCell>
                <TableCell className="text-xs py-4"><AdherenceBadge status={row.adherenceStatus} /></TableCell>
                <TableCell className="text-xs py-4">{row.documentStatus}</TableCell>
                <TableCell className="text-xs py-4 font-mono text-muted-foreground">{row.nteNo || '—'}</TableCell>
                <TableCell className="text-xs py-4 pr-6 text-right">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 relative" 
                    onClick={() => handleViewRemarks(row.docType, row.docNo)} 
                    title="View Remarks"
                  >
                    <MessageSquare className={cn("h-4 w-4", row.hasRemarks && "text-primary")} />
                    {row.hasRemarks && (
                      <span className="absolute top-1 right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredRows.length > 0 && (
          <div className="py-4 px-6 border-t border-border/50 flex flex-row items-center justify-between">
            <div className="flex-1">
              {isUserFilterActive && selectedRowIds.size > 0 && (
                <Button onClick={() => setIsNTEConfirmOpen(true)} disabled={isCreatingNTE} size="sm">
                  {isCreatingNTE && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create NTE ({selectedRowIds.size})
                </Button>
              )}
            </div>
            <Pagination className="flex-1 justify-end mx-0">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={e => { e.preventDefault(); if (currentPage > 1) setCurrentPage(p => p - 1); }}
                    className={cn(currentPage === 1 && 'pointer-events-none opacity-50')}
                  />
                </PaginationItem>

                {(() => {
                  const pages: React.ReactNode[] = [];
                  let lastRendered = 0;
                  for (let page = 1; page <= totalPages; page++) {
                    const isVisible = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                    if (!isVisible) {
                      if (lastRendered !== -1) {
                        pages.push(<PaginationItem key={`el-${page}`}><PaginationEllipsis /></PaginationItem>);
                        lastRendered = -1;
                      }
                      continue;
                    }
                    pages.push(
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          onClick={e => { e.preventDefault(); setCurrentPage(page); }}
                          isActive={page === currentPage}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                    lastRendered = page;
                  }
                  return pages;
                })()}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={e => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(p => p + 1); }}
                    className={cn(currentPage === totalPages && 'pointer-events-none opacity-50')}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>

      <AdherenceRemarksDialog 
        open={remarksOpen} 
        onOpenChange={(open) => {
          setRemarksOpen(open);
          if (!open && onSuccess) onSuccess();
        }} 
        docType={selectedRow?.docType || ''} 
        docNo={selectedRow?.docNo || ''} 
      />

      <NTEConfirmationDialog
        open={isNTEConfirmOpen}
        onOpenChange={setIsNTEConfirmOpen}
        selectedCount={selectedRowIds.size}
        preparedBy={Array.from(selectedRowIds).map(id => rows.find(r => r.id === id)?.preparedBy).filter(Boolean)[0] || ''}
        onConfirm={handleCreateNTE}
        isCreating={isCreatingNTE}
      />
    </Card>
  );
}