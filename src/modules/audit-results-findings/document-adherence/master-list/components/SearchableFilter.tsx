'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  emptyText?: string;
  className?: string;
}

export function SearchableFilter({
  value,
  onChange,
  options,
  placeholder,
  emptyText = 'No results found.',
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = options.filter(opt =>
    !search || opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 w-full text-[10px] justify-between font-normal bg-background", className)}
        >
          <span className="truncate">{value || placeholder}</span>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {value && (
              <X 
                className="h-2.5 w-2.5 opacity-50 hover:opacity-100 transition-opacity" 
                onClick={(e) => { e.stopPropagation(); onChange(''); }}
              />
            )}
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command key={open.toString()} filter={() => 1}>
          <CommandInput
            placeholder={`Search ${placeholder.toLowerCase()}...`}
            className="text-[10px] h-8"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="text-[10px] py-3 text-center text-muted-foreground">
              {emptyText}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onChange('');
                  setOpen(false);
                  setSearch('');
                }}
                className="text-[10px]"
              >
                <Check className={cn('mr-2 h-3 w-3', !value ? 'opacity-100' : 'opacity-0')} />
                All {placeholder}s
              </CommandItem>
              {filteredOptions.map(opt => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt === value ? '' : opt);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="text-[10px]"
                >
                  <Check className={cn('mr-2 h-3 w-3', value === opt ? 'opacity-100' : 'opacity-0')} />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
