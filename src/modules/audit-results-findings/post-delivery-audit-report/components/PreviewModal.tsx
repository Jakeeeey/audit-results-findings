import React from "react";
import { X, Loader2 } from "lucide-react";

interface PreviewModalProps {
  isPreviewOpen: boolean;
  setIsPreviewOpen: (val: boolean) => void;
  currentGeneratingDocNo: string | null;
  pdfUrl: string | null;
}

export function PreviewModal({
  isPreviewOpen,
  setIsPreviewOpen,
  currentGeneratingDocNo,
  pdfUrl
}: PreviewModalProps) {
  if (!isPreviewOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl h-full rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Report Preview</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">Doc No: <span className="text-blue-600 font-bold">{currentGeneratingDocNo}</span></p>
          </div>
          <button 
            onClick={() => setIsPreviewOpen(false)}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-red-500"
          >
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 bg-slate-100 p-4 md:p-8 flex items-center justify-center relative">
          {pdfUrl ? (
            <iframe 
              src={pdfUrl} 
              className="w-full h-full rounded-2xl shadow-lg border border-slate-200 bg-white"
              title="PDF Preview"
            />
          ) : (
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="h-16 w-16 bg-slate-200 rounded-full flex items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" size={32} />
              </div>
              <div className="text-sm font-medium text-slate-500">Generating Document...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
