"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { postDeliveryAuditReportService } from "./providers/fetchProvider";
import { generatePostDeliveryAuditPdf } from "./utils/pdfGenerator";
import { PostDeliveryAuditPlan } from "./types";
import { PdfTemplate, pdfTemplateService } from "@/components/pdf-layout-design/services/pdf-template";
import { CompanyData } from "@/components/pdf-layout-design/types";

import { HeaderSection } from "./components/HeaderSection";
import { FilterSection } from "./components/FilterSection";
import { DispatchPlanTable } from "./components/DispatchPlanTable";
import { PreviewModal } from "./components/PreviewModal";

export default function PostDeliveryAuditReportModule() {
  const [plans, setPlans] = useState<PostDeliveryAuditPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const observerTarget = React.useRef<HTMLTableRowElement>(null);

  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchDispatchNo, setSearchDispatchNo] = useState("");
  const [driverId, setDriverId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("percentage_desc");
  const [drivers, setDrivers] = useState<{id: number, first_name: string, last_name: string}[]>([]);
  const [currentGeneratingDocNo, setCurrentGeneratingDocNo] = useState<string | null>(null);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [compRes, tpls, plansRes, drvRes] = await Promise.all([
        fetch("/api/pdf/company"),
        pdfTemplateService.fetchTemplates(),
        postDeliveryAuditReportService.fetchDispatchPlans(1, 20), // Initial fetch
        fetch("/api/arf/post-delivery-audit?action=drivers")
      ]);

      if (compRes.ok) {
        const result = await compRes.json();
        const company = result.data?.[0] || (Array.isArray(result.data) ? null : result.data);
        setCompanyData(company);
      }

      setTemplates(tpls);
      if (tpls.length > 0) {
        setSelectedTemplateName(tpls[0].name);
      }

      if (drvRes.ok) {
        const d = await drvRes.json();
        setDrivers(d.data || []);
      }

      setPlans(plansRes.data || []);
      setPage(1);
      setHasMore(plansRes.meta?.hasMore ?? false);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      toast.error("Failed to load module data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isFetchingMore, loading, observerTarget.current]);

  const loadMore = async () => {
    try {
      setIsFetchingMore(true);
      const nextPage = page + 1;
      const params = new URLSearchParams();
      if (searchDispatchNo) params.append("dispatchNo", searchDispatchNo);
      if (driverId) params.append("driverId", driverId);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      if (sortBy) params.append("sortBy", sortBy);
      
      const res = await postDeliveryAuditReportService.fetchDispatchPlans(nextPage, 20, params);
      setPlans(prev => [...prev, ...(res.data || [])]);
      setPage(nextPage);
      setHasMore(res.meta?.hasMore ?? false);
    } catch {
      toast.error("Failed to load more dispatch plans.");
    } finally {
      setIsFetchingMore(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchDispatchNo) params.append("dispatchNo", searchDispatchNo);
      if (driverId) params.append("driverId", driverId);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      if (sortBy) params.append("sortBy", sortBy);
      
      const res = await postDeliveryAuditReportService.fetchDispatchPlans(1, 20, params);
      setPlans(res.data || []);
      setPage(1);
      setHasMore(res.meta?.hasMore ?? false);
    } catch {
      toast.error("Failed to search dispatch plans.");
    } finally {
      setLoading(false);
    }
  };

  const isFirstRender = React.useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, dateFrom, dateTo, sortBy]);

  const handlePrint = async (docNo: string) => {
    if (!selectedTemplateName) {
      toast.warning("Please select a template first.");
      return;
    }
    if (!companyData) {
      toast.warning("Company data is not loaded yet.");
      return;
    }

    setIsGenerating(true);
    setCurrentGeneratingDocNo(docNo);
    
    try {
      // 1. Fetch data from Spring Boot Proxy
      const reportData = await postDeliveryAuditReportService.fetchPdfData(docNo);
      
      // 2. Generate PDF
      const url = await generatePostDeliveryAuditPdf(selectedTemplateName, companyData, reportData);
      
      // 3. Show Preview
      setPdfUrl(url);
      setIsPreviewOpen(true);
    } catch {
      toast.error("Failed to generate PDF. Make sure the Spring Boot API is reachable and token is valid.");
    } finally {
      setIsGenerating(false);
      setCurrentGeneratingDocNo(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-slate-50">
      <HeaderSection 
        templates={templates} 
        selectedTemplateName={selectedTemplateName} 
        setSelectedTemplateName={setSelectedTemplateName} 
      />

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
        <FilterSection 
          searchDispatchNo={searchDispatchNo}
          setSearchDispatchNo={setSearchDispatchNo}
          handleSearch={handleSearch}
          driverId={driverId}
          setDriverId={setDriverId}
          drivers={drivers}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />
        
        <DispatchPlanTable 
          loading={loading}
          plans={plans}
          hasMore={hasMore}
          isFetchingMore={isFetchingMore}
          observerTarget={observerTarget}
          handlePrint={handlePrint}
          isGenerating={isGenerating}
          currentGeneratingDocNo={currentGeneratingDocNo}
        />
      </div>

      <PreviewModal 
        isPreviewOpen={isPreviewOpen}
        setIsPreviewOpen={setIsPreviewOpen}
        currentGeneratingDocNo={currentGeneratingDocNo}
        pdfUrl={pdfUrl}
      />
    </div>
  );
}
