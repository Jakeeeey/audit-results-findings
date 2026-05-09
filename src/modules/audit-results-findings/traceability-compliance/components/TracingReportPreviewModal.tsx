"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Printer, X, Eye, ChevronDown, Loader2 } from "lucide-react";
import { pdfTemplateService, PdfTemplate } from "@/components/pdf-layout-design/services/pdf-template";

interface CompanyData {
    company_name?: string;
    company_address?: string;
    company_brgy?: string;
    company_city?: string;
    company_province?: string;
    company_zipCode?: string;
    company_contact?: string;
    company_email?: string;
    company_logo?: string; // base64 data URI returned by /api/pdf/company
}

interface TracingReportPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    html: string;
    title: string;
    subtitle?: string;
}

/**
 * Builds a company header HTML block using real company data values
 * from /api/pdf/company, styled to match the template's visual intent.
 */
function buildCompanyHeaderHtml(company: CompanyData): string {
    const addressParts = [
        company.company_address,
        company.company_brgy,
        company.company_city,
        company.company_province,
        company.company_zipCode,
    ].filter(Boolean);

    const contactParts = [company.company_contact, company.company_email].filter(Boolean);

    const addressLine = addressParts.join(", ");
    const contactLine = contactParts.join("  |  ");

    return `
        <div style="display:flex;align-items:flex-start;gap:18px;margin-bottom:20px;padding-bottom:16px;border-bottom:2.5px solid #e2e8f0;">
            ${company.company_logo
                ? `<img src="${company.company_logo}" style="width:64px;height:64px;object-fit:contain;flex-shrink:0;border-radius:6px;" alt="Company Logo" />`
                : `<div style="width:64px;height:64px;background:#f1f5f9;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:1px solid #e2e8f0;font-size:9px;color:#94a3b8;text-align:center;">LOGO</div>`
            }
            <div style="flex:1;min-width:0;">
                ${company.company_name
                    ? `<div style="font-size:17px;font-weight:900;color:#0f172a;line-height:1.15;text-transform:uppercase;letter-spacing:-0.02em;margin-bottom:3px;">${company.company_name}</div>`
                    : ''
                }
                ${addressLine
                    ? `<div style="font-size:9px;color:#475569;font-weight:500;margin-bottom:2px;">${addressLine}</div>`
                    : ''
                }
                ${contactLine
                    ? `<div style="font-size:9px;color:#64748b;">${contactLine}</div>`
                    : ''
                }
            </div>
        </div>
    `;
}

/**
 * Injects the company header HTML into the generated report HTML,
 * right before the existing .header div.
 */
function injectHeaderIntoHtml(reportHtml: string, headerHtml: string): string {
    return reportHtml.replace(
        /<div class="header">/,
        `${headerHtml}<div class="header">`
    );
}

// Paper dimensions in pixels at 96 DPI (standard screen resolution)
const PAPER_PX: Record<string, { w: number; h: number }> = {
    'A4':     { w: 794,  h: 1123 },
    'Letter': { w: 816,  h: 1056 },
    'Legal':  { w: 816,  h: 1344 },
};

/**
 * Overrides the @page CSS rule with the template paper size/orientation,
 * AND injects @media screen styles that simulate the browser print-preview
 * appearance (gray background, white paper sheet, shadow, correct dimensions).
 */
function applyPageSettings(reportHtml: string, paperSize: string, orientation: string): string {
    const dims = PAPER_PX[paperSize] ?? PAPER_PX['A4'];
    const pageWidthPx  = orientation === 'landscape' ? dims.h : dims.w;

    const pageRule = `@page { size: ${paperSize} ${orientation}; margin: 10mm; }`;

    // @media screen overrides give the iframe a print-preview paper feel
    const screenCss = `
    @media screen {
        html {
            background: #525659;
            min-height: 100%;
        }
        body {
            width: ${pageWidthPx}px !important;
            max-width: ${pageWidthPx}px !important;
            margin: 24px auto 40px !important;
            padding: 20px !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            box-shadow: 0 4px 24px rgba(0,0,0,0.5) !important;
            overflow-x: hidden !important;
        }
        table {
            width: 100% !important;
            table-layout: fixed !important;
        }
        td, th {
            overflow: hidden !important;
            word-break: break-word !important;
        }
    }`;

    return reportHtml
        .replace(/@page\s*\{[^}]*\}/, pageRule)
        .replace('</style>', `${screenCss}\n    </style>`);
}

export const TracingReportPreviewModal: React.FC<TracingReportPreviewModalProps> = ({
    isOpen,
    onClose,
    html,
    title,
    subtitle,
}) => {
    const iframeRef = React.useRef<HTMLIFrameElement>(null);

    // Templates & company data state
    const [templates, setTemplates] = React.useState<PdfTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = React.useState<number | "none" | null>(null);
    const [companyData, setCompanyData] = React.useState<CompanyData | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

    // Generated blob URL for the iframe
    const [blobUrl, setBlobUrl] = React.useState<string | null>(null);

    // Load templates and company data when modal opens
    React.useEffect(() => {
        if (!isOpen) return;

        setIsLoading(true);

        Promise.all([
            pdfTemplateService.fetchTemplates(),
            fetch("/api/pdf/company").then(r => r.json()).then(r => r?.data?.[0] as CompanyData ?? null).catch(() => null)
        ]).then(([tmplData, cData]) => {
            setTemplates(tmplData);
            setCompanyData(cData);
            // Auto-select first template
            if (tmplData.length > 0 && selectedTemplateId === null) {
                setSelectedTemplateId(tmplData[0].id);
            } else if (tmplData.length === 0) {
                setSelectedTemplateId("none");
            }
        }).finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const selectedTemplate = typeof selectedTemplateId === "number"
        ? templates.find(t => t.id === selectedTemplateId)
        : null;

    // Rebuild blob URL whenever html or template/company data changes
    React.useEffect(() => {
        if (!html) return;

        let finalHtml = html;

        // Only inject header if we have company data and a template is selected
        if (selectedTemplateId !== "none" && selectedTemplateId !== null && companyData) {
            const headerHtml = buildCompanyHeaderHtml(companyData);
            finalHtml = injectHeaderIntoHtml(finalHtml, headerHtml);
        }

        // Override @page CSS with the template's paper size and orientation
        const tplConfig = selectedTemplate?.config;
        const paperSize = tplConfig?.paperSize && tplConfig.paperSize !== 'Custom'
            ? tplConfig.paperSize   // e.g. "A4", "Letter", "Legal"
            : 'A4';
        const orientation = tplConfig?.orientation ?? 'landscape';
        finalHtml = applyPageSettings(finalHtml, paperSize, orientation);

        const blob = new Blob([finalHtml], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [html, selectedTemplateId, companyData, selectedTemplate]);

    const handlePrint = () => {
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.print();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/90 backdrop-blur-sm p-3 animate-in fade-in duration-300">
            <div className="w-full h-full flex flex-col bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-white/10">

                {/* ── Header Bar ── */}
                <div className="px-8 py-4 bg-white border-b flex flex-row items-center gap-4 shrink-0">
                    {/* Title */}
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Eye className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
                            {subtitle && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wider">{subtitle}</p>
                            )}
                        </div>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Template Selector */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap hidden md:block">
                            Document Header:
                        </span>
                        <div className="relative">
                            <button
                                onClick={() => setIsDropdownOpen(v => !v)}
                                disabled={isLoading}
                                className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 transition-colors text-sm font-semibold text-foreground min-w-[180px] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                    : null
                                }
                                <span className="flex-1 text-left truncate text-sm">
                                    {isLoading
                                        ? "Loading..."
                                        : selectedTemplateId === "none" || selectedTemplateId === null
                                            ? "No Header"
                                            : (selectedTemplate?.name ?? "Select Header")
                                    }
                                </span>
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            </button>

                            {isDropdownOpen && !isLoading && (
                                <>
                                    {/* Click-away backdrop */}
                                    <div className="fixed inset-0 z-[1]" onClick={() => setIsDropdownOpen(false)} />
                                    <div className="absolute top-full right-0 mt-1 min-w-[200px] bg-background border border-border rounded-xl shadow-2xl z-[2] overflow-hidden py-1">
                                        {/* No Header option */}
                                        <button
                                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors italic ${selectedTemplateId === "none" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                                            onClick={() => { setSelectedTemplateId("none"); setIsDropdownOpen(false); }}
                                        >
                                            No Header
                                        </button>

                                        {templates.length > 0 && (
                                            <div className="h-px bg-border mx-2 my-1" />
                                        )}

                                        {templates.map(t => (
                                            <button
                                                key={t.id}
                                                className={`w-full px-4 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors font-medium ${t.id === selectedTemplateId ? "bg-primary/10 text-primary" : "text-foreground"}`}
                                                onClick={() => { setSelectedTemplateId(t.id); setIsDropdownOpen(false); }}
                                            >
                                                {t.name}
                                            </button>
                                        ))}

                                        {templates.length === 0 && (
                                            <p className="px-4 py-3 text-xs text-muted-foreground italic text-center">
                                                No saved templates found.
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Close */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="rounded-full hover:bg-slate-100 transition-colors shrink-0"
                    >
                        <X className="h-5 w-5 text-slate-400" />
                    </Button>
                </div>

                {/* ── Preview Area ── */}
                <div className="flex-1 overflow-hidden" style={{ background: '#757575' }}>
                    <div className="w-full h-full relative">
                        {blobUrl ? (
                            <iframe
                                ref={iframeRef}
                                src={blobUrl}
                                className="w-full h-full border-none"
                                title="Report Preview"
                                scrolling="yes"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="h-6 w-6 animate-spin text-white/40" />
                                    <p className="font-bold tracking-widest uppercase text-xs text-white/40">
                                        Generating preview...
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="px-8 py-4 bg-slate-50 border-t flex items-center justify-between shrink-0">
                    <div className="hidden md:flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Ready for Printing
                        {selectedTemplate?.config && (
                            <span className="text-primary/80 font-black">
                                · {selectedTemplate.config.paperSize !== 'Custom' ? selectedTemplate.config.paperSize : 'Custom'} {selectedTemplate.config.orientation}
                            </span>
                        )}
                        {!selectedTemplate && (
                            <span className="opacity-50">· A4 landscape</span>
                        )}
                        {companyData?.company_name && (
                            <span className="text-primary/60 ml-2">· {companyData.company_name}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 ml-auto">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="rounded-xl font-bold uppercase tracking-wider text-[10px] px-6 h-11 border-slate-200 bg-white hover:bg-slate-100 transition-all active:scale-95"
                        >
                            Close Preview
                        </Button>
                        <Button
                            onClick={handlePrint}
                            className="rounded-xl font-black uppercase tracking-wider text-[10px] px-8 h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 gap-2 transition-all active:scale-95 active:shadow-none"
                        >
                            <Printer className="w-4 h-4" />
                            Print Report
                        </Button>
                    </div>
                </div>

            </div>
        </div>
    );
};
