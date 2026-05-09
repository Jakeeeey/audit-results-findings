import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AdherenceRemarksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docType: string;
  docNo: string;
  onSuccess?: () => void;
}

export function AdherenceRemarksDialog({ open, onOpenChange, docType, docNo, onSuccess }: AdherenceRemarksDialogProps) {
  const [remarkId, setRemarkId] = useState<number | null>(null);
  const [remark, setRemark] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const fetchRemark = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ docType, docNumber: docNo });
      const res = await fetch(`/api/arf/document-adherance/remarks?${params}`);
      const json = await res.json();

      if (json.ok && json.data) {
        setRemarkId(json.data.id);
        setRemark(json.data.remark || "");
      } else {
        setRemarkId(null);
        setRemark("");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load remark.");
    } finally {
      setIsLoading(false);
    }
  }, [docType, docNo]);

  useEffect(() => {
    if (open && docType && docNo) {
      setIsEditing(false);
      fetchRemark();
    } else {
      // Reset state on close
      setRemarkId(null);
      setRemark("");
      setIsEditing(false);
    }
  }, [open, docType, docNo, fetchRemark]);

  const handleSave = async () => {
    if (!remark.trim()) {
      toast.error("Remark cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      let res;
      if (remarkId) {
        // Update existing
        res = await fetch(`/api/arf/document-adherance/remarks/${remarkId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remark: remark.trim() }),
        });
      } else {
        // Create new
        res = await fetch(`/api/arf/document-adherance/remarks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doc_type: docType, doc_number: docNo, remark: remark.trim() }),
        });
      }

      const json = await res.json();
      if (json.ok) {
        toast.success(remarkId ? "Remark updated successfully" : "Remark created successfully");
        if (onSuccess) onSuccess();
        onOpenChange(false);
      } else {
        toast.error(json.message || "Failed to save remark.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while saving the remark.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>View & Edit Remarks</DialogTitle>
          <DialogDescription>
            Document: <strong>{docType} - {docNo}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-2">
              <Textarea
                id="remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={isEditing ? "Enter your remarks here..." : "No remarks yet."}
                className={`min-h-[150px] resize-none ${!isEditing ? "focus-visible:ring-0 bg-muted/20" : ""}`}
                readOnly={!isEditing}
              />
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading || isSaving}>
            {isEditing ? "Cancel" : "Close"}
          </Button>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} disabled={isLoading}>
              Edit
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={isLoading || isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
