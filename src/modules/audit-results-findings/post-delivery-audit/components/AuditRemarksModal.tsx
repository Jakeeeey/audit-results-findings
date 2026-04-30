import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Save, Terminal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditRemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (remarks: string) => Promise<void>;
  initialRemarks: string;
  dispatchNo: string;
}

export function AuditRemarksModal({
  isOpen,
  onClose,
  onSave,
  initialRemarks,
  dispatchNo,
}: AuditRemarksModalProps) {
  const [remarks, setRemarks] = useState(initialRemarks);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRemarks(initialRemarks);
  }, [initialRemarks, isOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(remarks);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] bg-background border-border shadow-2xl p-0 overflow-hidden">
        <div className="bg-muted p-6 border-b border-border space-y-4">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                <Terminal className="h-3 w-3" />
                Audit Logs System
              </div>
           </div>
           
           <div className="space-y-1">
              <DialogTitle className="text-2xl font-black tracking-tighter text-foreground uppercase italic flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-primary" />
                UPDATE REMARKS
              </DialogTitle>
              <div className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">
                Dispatch No: <span className="text-primary">{dispatchNo}</span>
              </div>
           </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/5 blur-xl group-focus-within:bg-primary/10 transition-colors pointer-events-none" />
            <Textarea
              placeholder="ENTER AUDIT REMARKS HERE..."
              className={cn(
                "min-h-[160px] bg-background border-border focus-visible:ring-primary/20",
                "text-xs font-bold uppercase tracking-wide placeholder:text-muted-foreground/30 leading-relaxed shrink-0",
                "rounded-2xl transition-all p-5"
              )}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
          
          <div className="flex items-start gap-3 bg-muted border border-border p-4 rounded-xl">
             <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Terminal className="w-4 h-4 text-primary" />
             </div>
             <p className="text-[9px] font-medium leading-relaxed text-muted-foreground uppercase">
                Note: Updating remarks will be visible to all auditors and system administrators. Ensure the info is accurate.
             </p>
          </div>
        </div>

        <DialogFooter className="bg-muted p-4 flex flex-row items-center justify-end gap-3 px-6">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-background h-11 px-6 rounded-xl"
          >
            Abort Action
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-black uppercase tracking-widest h-11 px-8 rounded-xl shadow-lg shadow-primary/20"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Commit Remarks
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
