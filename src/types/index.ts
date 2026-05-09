export type Language = "ja" | "en" | "zh" | "zh-tw" | "ko" | "vi" | "ne" | "es" | "pt" | "id";

export interface ExtractedProperty {
  propertyName: string;
  address: string;
  addressRomaji: string;
  roomNumber?: string;
  rent: number;
  managementFee: number;
  deposit: number;
  keyMoney: number;
  floorPlan: string;
  area: number;
  fireInsuranceMonthly: number;
  guaranteeFeeMonthly: number;
}

export interface CustomerInfo {
  customerName: string;
}

export interface CostItem {
  id: string;
  category: string;
  label: string;
  amount: number;
  note: string;
  editable: boolean;
}

export interface MonthlyItem {
  id: string;
  label: string;
  amount: number;
  editable: boolean;
}

export interface AgentInfo {
  agentName: string;
  companyName: string;
  phone: string;
}

export interface AnalyzeResponse {
  extracted: ExtractedProperty;
  costs: CostItem[];
  totalCost: number;
  monthlyCosts: MonthlyItem[];
}

export interface SavedEstimate {
  id: string;
  name: string;
  savedAt: string;
  result: AnalyzeResponse;
  agentInfo: AgentInfo;
  customerInfo?: CustomerInfo;
  comment?: string;
}
