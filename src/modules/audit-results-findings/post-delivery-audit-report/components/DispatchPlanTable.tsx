import React from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostDeliveryAuditPlan } from "../types";

interface DispatchPlanTableProps {
  loading: boolean;
  plans: PostDeliveryAuditPlan[];
  hasMore: boolean;
  isFetchingMore: boolean;
  observerTarget: React.RefObject<HTMLTableRowElement | null>;
  handlePrint: (docNo: string) => void;
  isGenerating: boolean;
  currentGeneratingDocNo: string | null;
}

export function DispatchPlanTable({
  loading,
  plans,
  hasMore,
  isFetchingMore,
  observerTarget,
  handlePrint,
  isGenerating,
  currentGeneratingDocNo
}: DispatchPlanTableProps) {
  return (
    <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50">
            <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b">Dispatch No</th>
            <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b">Driver</th>
            <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b">Time of Dispatch</th>
            <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b">Status / Percentage</th>
            <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={5} className="p-8 text-center text-slate-400">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                Loading dispatch plans...
              </td>
            </tr>
          ) : plans.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-8 text-center text-slate-400">No posted dispatch plans found.</td>
            </tr>
          ) : (
            plans.map((plan) => (
              <tr key={plan.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 text-sm font-bold text-slate-800">{plan.dispatchNo}</td>
                <td className="p-4 text-sm text-slate-600">{plan.driver}</td>
                <td className="p-4 text-sm text-slate-500">{plan.tod ? new Date(plan.tod).toLocaleString() : 'N/A'}</td>
                <td className="p-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[100px]">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${plan.percentage}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">{plan.percentage}%</span>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <Button 
                    onClick={() => handlePrint(plan.dispatchNo)}
                    disabled={isGenerating}
                    className={`flex items-center gap-2 ml-auto rounded-xl font-bold transition-all ${
                      currentGeneratingDocNo === plan.dispatchNo 
                        ? 'bg-slate-200 text-slate-500' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100'
                    }`}
                    size="sm"
                  >
                    {currentGeneratingDocNo === plan.dispatchNo ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Printer size={16} />
                    )}
                    Print Report
                  </Button>
                </td>
              </tr>
            ))
          )}
          {hasMore && !loading && (
            <tr ref={observerTarget}>
              <td colSpan={5} className="p-8 text-center text-slate-400">
                {isFetchingMore ? (
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                ) : (
                  "Scroll down to load more..."
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
