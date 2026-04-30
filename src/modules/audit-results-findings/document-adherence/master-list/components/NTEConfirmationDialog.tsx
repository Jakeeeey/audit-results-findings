import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface NTEConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  preparedBy: string;
  onConfirm: (remarks: string) => void;
  isCreating: boolean;
}

export function NTEConfirmationDialog({
  open,
  onOpenChange,
  selectedCount,
  preparedBy,
  onConfirm,
  isCreating,
}: NTEConfirmationDialogProps) {
  const [remarks, setRemarks] = useState('');

  const handleConfirm = () => {
    onConfirm(remarks);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" key={String(open)}>
        <DialogHeader>
          <DialogTitle>Confirm NTE Creation</DialogTitle>
          <DialogDescription>
            You are about to issue a Notice to Explain (NTE) to <span className="font-semibold text-foreground">{preparedBy}</span> for {selectedCount} selected document{selectedCount !== 1 && 's'}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="remarks" className="text-sm font-medium">
              Remarks (Optional)
            </label>
            <Textarea
              id="remarks"
              placeholder="Enter remarks for this NTE..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={isCreating}
              className="resize-none h-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Creation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
