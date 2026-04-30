// src/modules/audit-results-findings/document-adherence/cafeteria/providers/fetchProviders.ts

import type { SubsystemApiResponse, SubsystemAdherenceRecord, SubsystemFilters } from "../types";
import { format } from "date-fns";

export async function fetchSubsystemRecords(
  filters: Pick<SubsystemFilters, "docType" | "dateFrom" | "dateTo" | "user">
): Promise<SubsystemAdherenceRecord[]> {
  const docType   = filters.docType ?? '';
  const user      = filters.user ?? '';
  const startDate = filters.dateFrom ? format(filters.dateFrom, "yyyy-MM-dd") : "";
  const endDate   = filters.dateTo   ? format(filters.dateTo,   "yyyy-MM-dd") : "";

  const params = new URLSearchParams();
  params.set("subsystem", "cafeteria");          // ← always filter to Cafeteria
  if (docType)   params.set("docType",    docType);
  if (user)      params.set("preparedBy", user);
  if (startDate) params.set("startDate",  startDate);
  if (endDate)   params.set("endDate",    endDate);

  const url = `/api/cafeteria/document-adherance/cafeteria?${params}`;

  const clientToken =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('token') ?? localStorage.getItem('token')
      : null;

  const headers: HeadersInit = clientToken
    ? { Authorization: `Bearer ${clientToken}` }
    : {};

  const res = await fetch(url, { cache: "no-store", credentials: "include", headers });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  const json = (await res.json()) as SubsystemApiResponse;
  return json.data ?? [];
}