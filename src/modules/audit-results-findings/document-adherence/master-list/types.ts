// ─── Raw API Response ─────────────────────────────────────────────────────────

export interface SubsystemAdherenceRecord {
  docType?:        string;
  doctype?:        string;
  docNumber:       string;
  preparedBy:      string;
  dateCreated:     string;
  updatedDate:     string;
  dateToday:       string;
  daysElapsed:     number;
  adherenceStatus: string;
  subsystem:       string;
  category:        string;
  documentStatus: string;
  nteNo?:          string | null;
  nteStatus?:      string | null;
  nteRemarks?:     string | null;
  nteFileId?:      string | null;
  hasRemarks?:     boolean;
}

export interface SubsystemApiResponse {
  data:  SubsystemAdherenceRecord[];
  total: number;
}

// ─── Filter State ─────────────────────────────────────────────────────────────

export interface SubsystemFilters {
  docType:  string;
  dateFrom: Date | undefined;
  dateTo:   Date | undefined;
  user:     string;
  search?:  string;
}

// ─── Derived Display Types ────────────────────────────────────────────────────

export type AdherenceStatus =
  | 'Compliant'
  | 'Non-Compliant';

export type DocumentStatus =
  | 'Approved'
  | 'Rejected'
  | 'For Review'
  | 'Draft'
  | 'Open';

export interface SubsystemTableRow {
  id:              string;
  docType:         string;
  docNo:           string;
  preparedBy:      string;
  dateCreated:     string;
  updatedDate:     string;
  rawDate:         string;
  daysElapsed:     number;
  adherenceStatus: string;
  documentStatus:  string;
  nteNo?:          string | null;
  nteFileId?:      string | null;
  hasRemarks?:     boolean;
  subsystem?:      string;
}

// ─── Chart ────────────────────────────────────────────────────────────────────

export interface DocTypeChartDatum {
  name:         string;
  compliant:    number;
  nonCompliant: number;
}

export interface SubsystemChartDatum {
  name:         string;
  total:        number;
  compliant:    number;
  nonCompliant: number;
}

export interface UserChartDatum {
  name:  string;
  value: number;
}

export interface PerDayChartDatum {
  date:         string;
  compliant:    number;
  nonCompliant: number;
}

export interface AdherenceRateTrendDatum {
  date:           string;
  adherenceRate:  number;    // percentage 0–100
}

export interface CompliancePieDatum {
  name:  string;
  value: number;
}

export interface AgingBucket {
  label: string;
  count: number;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface SummaryCard {
  label:    string;
  value:    number | string;
  color:    string;
  bg:       string;
  icon:     'total' | 'nonCompliant' | 'highest' | 'average' | 'users';
  subtitle: string;
}
