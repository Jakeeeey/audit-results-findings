'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { AdherenceBadge } from './StatusBadge';
import { AdherenceRemarksDialog } from './AdherenceRemarksDialog';
import { toast } from 'sonner';
import { FileText, X, ChevronUp, ChevronDown, ChevronsUpDown, MessageSquare, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModuleLink } from '../hooks/useModuleLink';
import { SearchableFilter } from './SearchableFilter';
import type { SubsystemTableRow } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docType: string;
  rows: SubsystemTableRow[];
  onSuccess?: () => void;
}

type SortKey = 'docNo' | 'preparedBy' | 'dateCreated' | 'updatedDate' | 'daysElapsed' | 'adherenceStatus' | 'documentStatus' | 'nteNo';
type SortDir = 'asc' | 'desc';

const COLUMNS: { label: string; key: SortKey | null; cls: string }[] = [
  { label: 'Doc No.',           key: 'docNo',            cls: 'pl-6'       },
  { label: 'Prepared By',       key: 'preparedBy',       cls: ''           },
  { label: 'Date Created',      key: 'dateCreated',      cls: ''           },
  { label: 'Updated Date',      key: 'updatedDate',      cls: ''           },
  { label: 'Days Elapsed',      key: 'daysElapsed',      cls: 'text-right' },
  { label: 'Adherence Status',  key: 'adherenceStatus',  cls: ''           },
  { label: 'Doc Status',        key: 'documentStatus',   cls: ''           },
  { label: 'NTE No.',           key: 'nteNo',            cls: ''           },
  { label: 'Remarks',           key: null,               cls: 'text-center pr-6' },
];

export function DocTypeDetailModal({ open, onOpenChange, docType, rows, onSuccess }: Props) {
  const { getLinkForDocType, openDocLink } = useModuleLink();

  const [filterUser, setFilterUser] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterNte, setFilterNte] = useState('');

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchType = r.docType === docType;
      const matchUser = !filterUser || r.preparedBy === filterUser;
      const matchStatus = !filterStatus || r.documentStatus === filterStatus;
      const matchNte = !filterNte || (r.nteNo && r.nteNo.toLowerCase().includes(filterNte.toLowerCase()));
      return matchType && matchUser && matchStatus && matchNte;
    });
  }, [rows, docType, filterUser, filterStatus, filterNte]);

  const userOptions = useMemo(() => {
    const users = rows.filter(r => r.docType === docType).map(r => r.preparedBy);
    return [...new Set(users)].sort();
  }, [rows, docType]);

  const statusOptions = useMemo(() => {
    const statuses = rows.filter(r => r.docType === docType).map(r => r.documentStatus);
    return [...new Set(statuses)].sort();
  }, [rows, docType]);

  const nteOptions = useMemo(() => {
    const ntes = rows.filter(r => r.docType === docType && r.nteNo).map(r => r.nteNo as string);
    return [...new Set(ntes)].sort();
  }, [rows, docType]);

  const compliantCount    = filtered.filter(r => r.adherenceStatus === 'Compliant').length;
  const nonCompliantCount = filtered.filter(r => r.adherenceStatus === 'Non-Compliant').length;

  const [sortKey, setSortKey] = useState<SortKey>('daysElapsed');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [remarksOpen, setRemarksOpen]   = useState(false);
  const [remarkTarget, setRemarkTarget] = useState<{ docType: string; docNo: string } | null>(null);

  const handleSort = (key: SortKey | null) => {
    if (!key) return;
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

        {/* Full-Screen Modal with Margins */}
        <div
          className="relative z-10 w-full h-full bg-background shadow-2xl rounded-xl flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex flex-col border-b border-border/50 shrink-0">
            <div className="flex items-start justify-between px-6 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">{docType}</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {filtered.length} record{filtered.length !== 1 ? 's' : ''} ·{' '}
                    <span className="text-emerald-600 font-medium">{compliantCount} Compliant</span>
                    {' · '}
                    <span className="text-red-600 font-medium">{nonCompliantCount} Non-Compliant</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-md hover:bg-muted/60 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* In-modal Filters */}
            <div className="flex items-center gap-3 px-6 pb-3 overflow-x-auto no-scrollbar">
              <div className="w-[180px] shrink-0">
                <SearchableFilter
                  value={filterUser}
                  onChange={setFilterUser}
                  options={userOptions}
                  placeholder="Prepared By"
                />
              </div>
              <div className="w-[140px] shrink-0">
                <SearchableFilter
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={statusOptions}
                  placeholder="Doc Status"
                />
              </div>
              <div className="w-[160px] shrink-0">
                <SearchableFilter
                  value={filterNte}
                  onChange={setFilterNte}
                  options={nteOptions}
                  placeholder="NTE No."
                />
              </div>
              {(filterUser || filterStatus || filterNte) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => { setFilterUser(''); setFilterStatus(''); setFilterNte(''); }}
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-y-auto flex-1 min-h-0">
            <table className="w-full text-left border-collapse table-fixed">
              <colgroup>
                <col style={{ width: '9%'  }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '8%'  }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
              </colgroup>

              <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
                <tr>
                  {COLUMNS.map(col => (
                    <th
                      key={col.label}
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        'py-2.5 text-[10px] font-bold text-muted-foreground border-b border-border/50 whitespace-nowrap select-none',
                        col.cls,
                        col.key && 'cursor-pointer hover:text-foreground transition-colors'
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {col.key && (
                          sortKey === col.key
                            ? sortDir === 'asc'
                              ? <ChevronUp className="w-3 h-3 text-primary" />
                              : <ChevronDown className="w-3 h-3 text-primary" />
                            : <ChevronsUpDown className="w-3 h-3 opacity-30" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="text-center py-12 text-xs text-muted-foreground">
                      No records found for this document type.
                    </td>
                  </tr>
                ) : (
                  sorted.map(row => (
                    <tr key={row.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 pl-6 text-[10px] font-bold font-mono truncate">
                        {(() => {
                          const link = getLinkForDocType(row.docType);
                          return (
                            <button
                              onClick={() => {
                                if (link) openDocLink(row.docType, row.docNo);
                                else toast.error(`No module link configured for "${row.docType}"`);
                              }}
                              className={cn(
                                "inline-flex items-center gap-0.5 group transition-colors",
                                link ? "text-primary hover:underline" : "text-muted-foreground hover:text-foreground"
                              )}
                              title={link ? `Open ${row.docNo} in new tab` : `No link configured for ${row.docType}`}
                            >
                              {row.docNo}
                              {link && <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-70 transition-opacity" />}
                            </button>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 text-[10px] truncate" title={row.preparedBy}>{row.preparedBy}</td>
                      <td className="py-2.5 text-[10px] text-muted-foreground whitespace-nowrap">{row.dateCreated}</td>
                      <td className="py-2.5 text-[10px] text-muted-foreground whitespace-nowrap">{row.updatedDate}</td>
                      <td className="py-2.5 text-[10px] font-medium text-right pr-2">{row.daysElapsed}d</td>
                      <td className="py-2.5 text-[10px]"><AdherenceBadge status={row.adherenceStatus} /></td>
                      <td className="py-2.5 text-[10px] text-foreground">{row.documentStatus}</td>
                      <td className="py-2.5 text-[10px] font-mono text-muted-foreground truncate">
                        {row.nteNo ? (
                          row.nteFileId ? (
                            <a 
                              href={`${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${row.nteFileId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-0.5 group"
                              title="View NTE Document"
                            >
                              {row.nteNo}
                              <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-70 transition-opacity" />
                            </a>
                          ) : (
                            row.nteNo
                          )
                        ) : '—'}
                      </td>
                      <td className="py-2.5 pr-6 text-center">
                        <button
                          onClick={() => { setRemarkTarget({ docType: row.docType, docNo: row.docNo }); setRemarksOpen(true); }}
                          className="inline-flex items-center justify-center p-1 rounded hover:bg-muted/60 transition-colors"
                          title="Add / View Remarks"
                        >
                          <MessageSquare className={cn('w-3.5 h-3.5', row.hasRemarks ? 'text-red-500' : 'text-muted-foreground')} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AdherenceRemarksDialog
        open={remarksOpen}
        onOpenChange={setRemarksOpen}
        docType={remarkTarget?.docType ?? ''}
        docNo={remarkTarget?.docNo ?? ''}
        onSuccess={onSuccess}
      />
    </>,
    document.body
  );
}
