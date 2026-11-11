import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DeliveryProof } from "../types";
import { 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  CheckCircle2, 
  Clock, 
  Calendar,
  Image as ImageIcon,
  AlertTriangle,
  Loader2
} from "lucide-react";

interface DeliveryProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  proof: DeliveryProof | null | undefined;
  receiptNo: string;
  orderNo?: string | null;
  customerName?: string | null;
}

export function DeliveryProofModal({
  isOpen,
  onClose,
  proof,
  receiptNo,
  orderNo,
  customerName,
}: DeliveryProofModalProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [imageError, setImageError] = useState<boolean>(false);

  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Reset controls when modal reopens or proof changes
  React.useEffect(() => {
    if (isOpen) {
      setZoomLevel(100);
      setRotation(0);
      setImageError(false);
      setIsDownloading(false);
    }
  }, [isOpen, proof]);

  if (!proof) return null;

  const directusBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  const imageUrl = `${directusBase}/assets/${proof.photo_file_id}`;

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 25, 250));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 25, 50));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = async () => {
    if (!proof.photo_file_id || isDownloading) return;
    setIsDownloading(true);
    const fileName = `Proof_${receiptNo || "delivery"}.jpg`;

    try {
      // Fetch via internal API proxy which sets Content-Disposition: attachment
      const downloadEndpoint = `/api/arf/post-delivery-audit?action=download-proof&fileId=${proof.photo_file_id}&filename=${encodeURIComponent(fileName)}`;
      const response = await fetch(downloadEndpoint);
      if (!response.ok) throw new Error("Download request failed");

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Direct download failed, falling back to direct blob fetch:", err);
      try {
        const directRes = await fetch(imageUrl);
        const directBlob = await directRes.blob();
        const directBlobUrl = window.URL.createObjectURL(directBlob);
        const link = document.createElement("a");
        link.href = directBlobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(directBlobUrl);
      } catch (fallbackErr) {
        console.error("Fallback download also failed:", fallbackErr);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "---";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        showCloseButton={false}
        className="sm:max-w-[860px] w-[95vw] max-h-[94vh] flex flex-col p-0 overflow-hidden bg-background border border-border shadow-2xl rounded-2xl"
      >
        {/* Header matching exact layout */}
        <div className="p-6 pb-4 border-b border-border/80 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-900/60 shadow-sm">
            <ImageIcon className="w-6 h-6 stroke-[1.8]" />
          </div>

          <div className="space-y-1 flex-1 min-w-0">
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Proof of Delivery
            </DialogTitle>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                Invoice: <span className="font-semibold text-foreground">{receiptNo}</span>
              </span>
              {orderNo && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span>
                    Order: <span className="font-semibold text-foreground">{orderNo}</span>
                  </span>
                </>
              )}
              {customerName && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span>
                    Customer: <span className="font-semibold text-foreground">{customerName}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Inner Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Top Control Bar matching image */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground tracking-wide">
              Delivery Photo
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isDownloading}
                className="h-8 px-3 rounded-lg border-border text-xs font-medium text-foreground hover:bg-muted gap-1.5 shadow-sm"
              >
                {isDownloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {isDownloading ? "Downloading..." : "Download"}
              </Button>

              <div className="flex items-center border border-border rounded-lg bg-background p-0.5 shadow-sm">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 50}
                  className="h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>

                <span className="text-[11px] font-medium text-muted-foreground px-2 min-w-[42px] text-center select-none">
                  {zoomLevel}%
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 250}
                  className="h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>

                <div className="h-4 w-[1px] bg-border mx-0.5" />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleRotate}
                  className="h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Rotate"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Photo Viewport matching image */}
          <div className="relative rounded-xl border border-border/80 bg-background overflow-hidden flex items-center justify-center min-h-[380px] max-h-[520px]">
            {imageError ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2">
                <ImageIcon className="w-12 h-12 stroke-[1.5] text-muted-foreground/40" />
                <p className="text-xs font-bold text-foreground">Image Not Available</p>
                <p className="text-[11px] text-muted-foreground">Unable to load delivery photo.</p>
              </div>
            ) : (
              <div className="w-full h-full p-4 flex items-center justify-center overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={`Delivery proof for Invoice ${receiptNo}`}
                  style={{
                    transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                    transition: "transform 0.2s ease-in-out",
                  }}
                  className="max-h-[480px] w-auto max-w-full object-contain rounded-lg shadow-sm"
                  onError={() => setImageError(true)}
                />
              </div>
            )}
          </div>

          {/* Bottom 3 Meta Cards matching image */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Outcome */}
            <div className="rounded-xl border border-border/80 bg-background p-3.5 flex flex-col justify-center space-y-1 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {proof.outcome === "Fulfilled" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                )}
                OUTCOME
              </div>
              <div className="text-sm font-semibold text-foreground">
                {proof.outcome || "Fulfilled"}
              </div>
            </div>

            {/* Captured At */}
            <div className="rounded-xl border border-border/80 bg-background p-3.5 flex flex-col justify-center space-y-1 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                CAPTURED AT
              </div>
              <div className="text-sm font-semibold text-foreground">
                {formatDate(proof.captured_at)}
              </div>
            </div>

            {/* Received At */}
            <div className="rounded-xl border border-border/80 bg-background p-3.5 flex flex-col justify-center space-y-1 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                RECEIVED AT
              </div>
              <div className="text-sm font-semibold text-foreground">
                {formatDate(proof.received_at)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Close Button */}
        <div className="p-4 px-6 border-t border-border flex justify-end bg-background">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="px-5 h-9 rounded-lg text-xs font-semibold text-foreground border-border hover:bg-muted"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
