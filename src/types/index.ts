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
  // 2026-05-28 追加（比較表の多面化用）。古い保存データには存在しないので optional
  buildingAge?: string;
  nearestStation?: string;
  stationWalkMinutes?: number;
  facilities?: string[];
  recommendPoint?: string;
}

// generate-comment APIが返す周辺施設データ（保存時に流用して二重課金回避）
export interface NearbyPlace {
  name: string;
  minutes: number;
}

export interface NearbyResult {
  stations: NearbyPlace[];
  busStops: NearbyPlace[];
  supermarkets: NearbyPlace[];
  convenienceStores: NearbyPlace[];
  drugstores: NearbyPlace[];
  hundredYenShops: NearbyPlace[];
  clinics: NearbyPlace[];
  dentists: NearbyPlace[];
  parks: NearbyPlace[];
  nurseries: NearbyPlace[];
  kindergartens: NearbyPlace[];
  elementarySchools: NearbyPlace[];
  laundries: NearbyPlace[];
  postOffices: NearbyPlace[];
  atms: NearbyPlace[];
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
  // 担当者コメントAI生成時に取得した周辺施設データを流用（二重課金回避）
  nearby?: NearbyResult;
  // 同一物件の二重登録を防ぐためのキー（物件名|住所|部屋番号）。旧データには存在しないので optional
  slug?: string;
}
