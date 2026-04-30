'use client';

import { useState } from 'react';
import { CalendarIcon, X, Check, ChevronsUpDown, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Command, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import type { SubsystemFilters } from '../types';

interface Props {
  filters:    SubsystemFilters;
  setFilters: React.Dispatch<React.SetStateAction<SubsystemFilters>>;
  docTypes:   string[];
  userNames:  string[];
  onClear:    () => void;
}

export function SubsystemFilterBar({ filters, setFilters, docTypes, userNames, onClear }: Props) {
  const [userOpen,      setUserOpen]      = useState(false);
  const [docTypeOpen,   setDocTypeOpen]   = useState(false);
  const [userSearch,    setUserSearch]    = useState('');
  const [docTypeSearch, setDocTypeSearch] = useState('');
  const [localFrom,     setLocalFrom]     = useState<Date | undefined>(filters.dateFrom);
  const [localTo,       setLocalTo]       = useState<Date | undefined>(filters.dateTo);

  function patch<K extends keyof SubsystemFilters>(key: K, value: SubsystemFilters[K]) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function handleFromSelect(date: Date | undefined) {
    setLocalFrom(date);
    if (!date) {
      setLocalTo(undefined);
      setFilters(prev => ({ ...prev, dateFrom: undefined, dateTo: undefined }));
    } else if (localTo) {
      setFilters(prev => ({ ...prev, dateFrom: date, dateTo: localTo }));
    }
  }

  function handleToSelect(date: Date | undefined) {
    setLocalTo(date);
    if (!date) {
      setFilters(prev => ({ ...prev, dateTo: undefined }));
    } else if (localFrom) {
      setFilters(prev => ({ ...prev, dateFrom: localFrom, dateTo: date }));
    }
  }

  function handleClear() {
    setLocalFrom(undefined);
    setLocalTo(undefined);
    setUserSearch('');
    setDocTypeSearch('');
    setFilters(prev => ({
      ...prev,
      search:   '',
      dateFrom: undefined,
      dateTo:   undefined,
      docType:  '',
      user:     '',
    }));
    onClear?.();
  }

  const hasActiveFilters =
    !!localFrom       || !!localTo        ||
    !!filters.docType || !!filters.user   ||
    !!filters.search;

  const filteredDocTypes = docTypes
    .filter(d => d?.trim())
    .filter(d => !docTypeSearch || d.toLowerCase().includes(docTypeSearch.toLowerCase()));

  const filteredUserNames = userNames
    .filter(u => u?.trim())
    .filter(u => !userSearch || u.toLowerCase().includes(userSearch.toLowerCase()));

  return (
    <>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search doc no, name…"
          className="h-9 pl-8 w-52 text-xs"
          value={filters.search ?? ''}
          onChange={e => patch('search', e.target.value)}
        />
      </div>

      {/* From Date */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 h-9">
        <span className="text-xs font-medium text-muted-foreground shrink-0">From</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto border-0 p-0 text-xs focus-visible:ring-0 shadow-none w-[110px] bg-transparent font-normal"
            >
              <CalendarIcon className="w-3 h-3 mr-1" />
              {localFrom ? format(localFrom, 'MM/dd/yyyy') : 'mm/dd/yyyy'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={localFrom}
              onSelect={handleFromSelect}
              disabled={date => !!localTo && date > localTo}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {localFrom && (
          <button onClick={() => handleFromSelect(undefined)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* To Date */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 h-9">
        <span className="text-xs font-medium text-muted-foreground shrink-0">To</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto border-0 p-0 text-xs focus-visible:ring-0 shadow-none w-[110px] bg-transparent font-normal"
            >
              <CalendarIcon className="w-3 h-3 mr-1" />
              {localTo ? format(localTo, 'MM/dd/yyyy') : 'mm/dd/yyyy'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={localTo}
              onSelect={handleToSelect}
              disabled={date => !!localFrom && date < localFrom}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {localTo && (
          <button onClick={() => handleToSelect(undefined)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Doc Type */}
      <Popover
        open={docTypeOpen}
        onOpenChange={open => { setDocTypeOpen(open); if (!open) setDocTypeSearch(''); }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={docTypeOpen}
            className="h-9 w-[160px] text-xs justify-between font-normal"
          >
            <span className="truncate">{filters.docType || 'All Doc Types'}</span>
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          {/* ✅ key forces remount on each open, clearing Command's internal filter state */}
          <Command key={docTypeOpen.toString()} filter={() => 1}>
            <CommandInput
              placeholder="Search doc type..."
              className="text-xs h-8"
              value={docTypeSearch}
              onValueChange={setDocTypeSearch}
            />
            <CommandList>
              <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">
                No doc type found.
              </CommandEmpty>
              <CommandGroup>
                {(!docTypeSearch || 'all doc types'.includes(docTypeSearch.toLowerCase())) && (
                  <CommandItem
                    value="__all__"
                    onSelect={() => {
                      patch('docType', '');
                      setDocTypeOpen(false);
                      setDocTypeSearch('');
                    }}
                    className="text-xs"
                  >
                    <Check className={cn('mr-2 h-3.5 w-3.5', !filters.docType ? 'opacity-100' : 'opacity-0')} />
                    All Doc Types
                  </CommandItem>
                )}
                {filteredDocTypes.map(d => (
                  <CommandItem
                    key={d}
                    value={d}
                    onSelect={() => {
                      patch('docType', d === filters.docType ? '' : d);
                      setDocTypeOpen(false);
                      setDocTypeSearch('');
                    }}
                    className="text-xs"
                  >
                    <Check className={cn('mr-2 h-3.5 w-3.5', filters.docType === d ? 'opacity-100' : 'opacity-0')} />
                    {d}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* User */}
      <Popover
        open={userOpen}
        onOpenChange={open => { setUserOpen(open); if (!open) setUserSearch(''); }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={userOpen}
            className="h-9 w-[180px] text-xs justify-between font-normal"
          >
            <span className="truncate">{filters.user || 'All Users'}</span>
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          {/* ✅ key forces remount on each open, clearing Command's internal filter state */}
          <Command key={userOpen.toString()} filter={() => 1}>
            <CommandInput
              placeholder="Search user..."
              className="text-xs h-8"
              value={userSearch}
              onValueChange={setUserSearch}
            />
            <CommandList>
              <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">
                No user found.
              </CommandEmpty>
              <CommandGroup>
                {(!userSearch || 'all users'.includes(userSearch.toLowerCase())) && (
                  <CommandItem
                    value="all-users"
                    onSelect={() => {
                      patch('user', '');
                      setUserOpen(false);
                      setUserSearch('');
                    }}
                    className="text-xs"
                  >
                    <Check className={cn('mr-2 h-3.5 w-3.5', !filters.user ? 'opacity-100' : 'opacity-0')} />
                    All Users
                  </CommandItem>
                )}
                {filteredUserNames.map(u => (
                  <CommandItem
                    key={u}
                    value={u}
                    onSelect={() => {
                      patch('user', u === filters.user ? '' : u);
                      setUserOpen(false);
                      setUserSearch('');
                    }}
                    className="text-xs"
                  >
                    <Check className={cn('mr-2 h-3.5 w-3.5', filters.user === u ? 'opacity-100' : 'opacity-0')} />
                    {u}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Clear */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          <X className="w-3 h-3" />
          Clear
        </Button>
      )}
    </>
  );
}