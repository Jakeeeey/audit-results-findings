import React from "react";
import { Layout } from "lucide-react";
import { PdfTemplate } from "@/components/pdf-layout-design/services/pdf-template";

interface HeaderSectionProps {
  templates: PdfTemplate[];
  selectedTemplateName: string;
  setSelectedTemplateName: (val: string) => void;
}

export function HeaderSection({ templates, selectedTemplateName, setSelectedTemplateName }: HeaderSectionProps) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <Layout className="text-blue-600" size={32} />
          Post Delivery Audit Report
        </h1>
        <p className="text-slate-500 mt-2 font-medium">Generate formatted PDFs for posted dispatch plans.</p>
      </div>
      
      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 w-full md:w-auto">
        <div className="flex flex-col gap-1 w-full md:w-auto">
          <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PDF Header Template</label>
          <select 
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none min-w-[200px]"
            value={selectedTemplateName}
            onChange={(e) => setSelectedTemplateName(e.target.value)}
          >
            {templates.length === 0 && <option>No templates found</option>}
            {templates.map(t => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
