export interface AssetAuditItem {
  id: number;
  rfid_code: string | null;
  barcode: string | null;
  serial: string | null;
  quantity: number | null;
  cost_per_item: number | null;
  total: number | null;
  condition: "Good" | "Bad" | "Under Maintenance" | "Discontinued" | null;
  date_acquired: string | null;
  is_active_warning: number;
  // Joined from items
  item_name: string | null;
  // Joined from item_classification
  classification_name: string | null;
  // Joined from item_type
  type_name: string | null;
  // Joined from user/employee
  employee_id: number | null;
  employee_name: string | null;
}

export interface MissingAsset {
  asset_id: number;
  item_name: string | null;
  rfid_code: string | null;
  serial: string | null;
  accountable_user_id: number | null;
  accountable_user_name: string | null;
}

export interface MissingAuditRecord {
  asset_id: number;
  accountable_user_id: number | null;
  reported_by: number | null;
}

export interface SubmitAuditPayload {
  records: MissingAuditRecord[];
}

export interface SubmitAuditResponse {
  ok: boolean;
  message?: string;
}

export interface ScanLogEntry {
  code: string;
  time: Date;
}

export interface AuditCurrentUser {
  id: number;
  name: string;
  email: string;
}

export interface GetAssetsResponse {
  ok: boolean;
  assets: AssetAuditItem[];
  current_user: AuditCurrentUser;
  message?: string;
}
