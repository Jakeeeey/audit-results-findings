'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AdherenceBadge } from './StatusBadge';
import { AdherenceRemarksDialog } from './AdherenceRemarksDialog';
import { NTEConfirmationDialog } from './NTEConfirmationDialog';
import { toast } from 'sonner';
import { Loader2, User, X, ChevronUp, ChevronDown, ChevronsUpDown, MessageSquare, ExternalLink, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModuleLink } from '../hooks/useModuleLink';
import { SearchableFilter } from './SearchableFilter';
import { NTEPreviewModal } from './NTEPreviewModal';
import type { SubsystemTableRow } from '../types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  rows: SubsystemTableRow[];
  onSuccess?: () => void;
}

type SortKey = 'docType' | 'docNo' | 'dateCreated' | 'updatedDate' | 'daysElapsed' | 'adherenceStatus' | 'documentStatus' | 'nteNo';
type SortDir = 'asc' | 'desc';

const COLUMNS: { label: string; key: SortKey | null; cls: string }[] = [
  { label: 'Doc Type',         key: 'docType',          cls: ''           },
  { label: 'Doc No.',          key: 'docNo',            cls: ''           },
  { label: 'Date Created',     key: 'dateCreated',      cls: ''           },
  { label: 'Updated Date',     key: 'updatedDate',      cls: ''           },
  { label: 'Days Elapsed',     key: 'daysElapsed',      cls: 'text-right' },
  { label: 'Adherence Status', key: 'adherenceStatus',  cls: ''           },
  { label: 'Doc Status',       key: 'documentStatus',   cls: ''           },
  { label: 'NTE No.',          key: 'nteNo',            cls: ''           },
  { label: 'Remarks',          key: null,               cls: 'text-center pr-6' },
];

export function UserDetailModal({ open, onOpenChange, userName, rows, onSuccess }: Props) {
  const { getLinkForDocType, openDocLink } = useModuleLink();

  const [filterDocType, setFilterDocType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterNte, setFilterNte] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchUser = r.preparedBy === userName;
      const matchType = !filterDocType || r.docType === filterDocType;
      const matchStatus = !filterStatus || r.documentStatus === filterStatus;
      const matchNte = !filterNte || (r.nteNo && r.nteNo.toLowerCase().includes(filterNte.toLowerCase()));
      const matchNonCompliant = r.adherenceStatus === 'Non-Compliant';

      let matchDate = true;
      if (dateFrom || dateTo) {
        try {
          const rowDate = parseISO(r.rawDate.replace(' ', 'T'));
          if (dateFrom && rowDate < startOfDay(dateFrom)) matchDate = false;
          if (dateTo && rowDate > endOfDay(dateTo)) matchDate = false;
        } catch {
          // ignore
        }
      }

      return matchUser && matchType && matchStatus && matchNte && matchNonCompliant && matchDate;
    });
  }, [rows, userName, filterDocType, filterStatus, filterNte, dateFrom, dateTo]);

  const docTypeOptions = useMemo(() => {
    const types = rows.filter(r => r.preparedBy === userName && r.adherenceStatus === 'Non-Compliant').map(r => r.docType);
    return [...new Set(types)].sort();
  }, [rows, userName]);

  const statusOptions = useMemo(() => {
    const statuses = rows.filter(r => r.preparedBy === userName && r.adherenceStatus === 'Non-Compliant').map(r => r.documentStatus);
    return [...new Set(statuses)].sort();
  }, [rows, userName]);

  const nteOptions = useMemo(() => {
    const ntes = rows.filter(r => r.preparedBy === userName && r.adherenceStatus === 'Non-Compliant' && r.nteNo).map(r => r.nteNo as string);
    return [...new Set(ntes)].sort();
  }, [rows, userName]);

  const nonCompliantCount = filtered.length;

  const [sortKey, setSortKey] = useState<SortKey>('daysElapsed');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [selectedRowIds, setSelectedRowIds]     = useState<Set<string>>(new Set());
  const [isNTEConfirmOpen, setIsNTEConfirmOpen] = useState(false);
  const [isCreatingNTE]                         = useState(false);
  const [remarksOpen, setRemarksOpen]           = useState(false);
  const [remarkTarget, setRemarkTarget]         = useState<{ docType: string; docNo: string } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen]       = useState(false);
  const [nteData, setNteData]                   = useState<{ 
    userName: string; 
    nteNo: string;
    rows: { docType: string; docNo: string; daysElapsed: number }[]; 
    remarks: string;
    recipientPosition?: string;
    recipientDepartment?: string;
  } | null>(null);

  const eligibleRows        = useMemo(() => filtered.filter(r => !r.nteNo), [filtered]);
  const allEligibleSelected = eligibleRows.length > 0 && eligibleRows.every(r => selectedRowIds.has(r.id));

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

  const [userProfile, setUserProfile] = useState<{ position: string; department: string } | null>(null);

  useEffect(() => {
    if (open && userName) {
      fetch(`/api/arf/document-adherance/user-profile?name=${encodeURIComponent(userName)}`)
        .then(res => res.json())
        .then(json => {
          if (json.ok) {
            setUserProfile({
              position: json.data.position,
              department: json.data.department
            });
          }
        })
        .catch(err => console.error("Failed to fetch user profile in modal", err));
    }
  }, [open, userName]);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setSelectedRowIds(new Set());
        setNteData(null);
        setUserProfile(null);
      }, 0);
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { 
        setSelectedRowIds(new Set()); 
        onOpenChange(false); 
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  const handleOpenPreview = (remarks: string) => {
    const selectedRows = filtered.filter(r => selectedRowIds.has(r.id));
    if (selectedRows.length === 0) return;

    const tempNteNo = `NTE-${Math.floor(10000000 + Math.random() * 90000000)}`;
    setNteData({
      userName,
      nteNo: tempNteNo,
      rows: selectedRows.map(r => ({ docType: r.docType, docNo: r.docNo, daysElapsed: r.daysElapsed })),
      remarks,
      recipientPosition: userProfile?.position,
      recipientDepartment: userProfile?.department
    });
    setIsNTEConfirmOpen(false);
    setIsPreviewOpen(true);
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => { setSelectedRowIds(new Set()); onOpenChange(false); }}
        />

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
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">{userName}</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    <span className="text-red-600 font-semibold">{nonCompliantCount} Non-Compliant</span> document{nonCompliantCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedRowIds.size > 0 && (
                  <Button size="sm" onClick={() => setIsNTEConfirmOpen(true)} disabled={isCreatingNTE}>
                    {isCreatingNTE && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create NTE ({selectedRowIds.size})
                  </Button>
                )}
                <button
                  onClick={() => { setSelectedRowIds(new Set()); onOpenChange(false); }}
                  className="p-1.5 rounded-md hover:bg-muted/60 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* In-modal Filters */}
            <div className="flex items-center gap-3 px-6 pb-3 overflow-x-auto no-scrollbar">
              <div className="w-[180px] shrink-0">
                <SearchableFilter
                  value={filterDocType}
                  onChange={setFilterDocType}
                  options={docTypeOptions}
                  placeholder="Doc Type"
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

              {/* From Date */}
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 h-8 shrink-0">
                <span className="text-[10px] font-medium text-muted-foreground shrink-0">From</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto border-0 p-0 text-[10px] focus-visible:ring-0 shadow-none w-[80px] bg-transparent font-normal"
                    >
                      <CalendarIcon className="w-3 h-3 mr-1 text-muted-foreground" />
                      {dateFrom ? format(dateFrom, 'MM/dd/yyyy') : 'mm/dd/yyyy'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      disabled={date => !!dateTo && date > dateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {dateFrom && (
                  <button onClick={() => setDateFrom(undefined)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {/* To Date */}
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 h-8 shrink-0">
                <span className="text-[10px] font-medium text-muted-foreground shrink-0">To</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto border-0 p-0 text-[10px] focus-visible:ring-0 shadow-none w-[80px] bg-transparent font-normal"
                    >
                      <CalendarIcon className="w-3 h-3 mr-1 text-muted-foreground" />
                      {dateTo ? format(dateTo, 'MM/dd/yyyy') : 'mm/dd/yyyy'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      disabled={date => !!dateFrom && date < dateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {dateTo && (
                  <button onClick={() => setDateTo(undefined)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {(filterDocType || filterStatus || filterNte || dateFrom || dateTo) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setFilterDocType('');
                    setFilterStatus('');
                    setFilterNte('');
                    setDateFrom(undefined);
                    setDateTo(undefined);
                  }}
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
                <col style={{ width: '4%'  }} />
                <col style={{ width: '9%'  }} />
                <col style={{ width: '9%'  }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '7%'  }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>

              <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
                <tr>
                  {/* Select-all checkbox */}
                  <th className="py-2.5 pl-6 border-b border-border/50">
                    <Checkbox
                      checked={allEligibleSelected}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedRowIds(new Set(eligibleRows.map(r => r.id)));
                        else         setSelectedRowIds(new Set());
                      }}
                    />
                  </th>
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
                    <td colSpan={COLUMNS.length + 1} className="text-center py-12 text-xs text-muted-foreground">
                      No records found for this user.
                    </td>
                  </tr>
                ) : (
                  sorted.map(row => (
                    <tr key={row.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 pl-6">
                        {!row.nteNo && (
                          <Checkbox
                            checked={selectedRowIds.has(row.id)}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(selectedRowIds);
                              if (checked) newSet.add(row.id);
                              else         newSet.delete(row.id);
                              setSelectedRowIds(newSet);
                            }}
                          />
                        )}
                      </td>
                      <td className="py-2.5 text-[10px] font-medium truncate">{row.docType}</td>
                      <td className="py-2.5 text-[10px] font-bold font-mono truncate">
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

      <NTEConfirmationDialog
        open={isNTEConfirmOpen}
        onOpenChange={setIsNTEConfirmOpen}
        selectedCount={selectedRowIds.size}
        preparedBy={userName}
        onConfirm={handleOpenPreview}
        isCreating={false}
      />

      {nteData && (
        <NTEPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          onSuccess={() => {
            setSelectedRowIds(new Set());
            onSuccess?.();
          }}
          data={nteData}
        />
      )}

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
