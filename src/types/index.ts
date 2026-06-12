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
  // 火災保険料が「2年契約 18,000円」のように総額・一括で書いてある場合の金額（円）。月額しか無い／不明なら0。古い保存データには無いので optional
  fireInsuranceTotal?: number;
  // マイソクの「諸費用 / 初期費用」欄に書いてあって、定番項目（敷金・礼金・前家賃・仲介手数料・保証会社・火災保険・鍵交換）に当てはまらない費用（例：修理分担金）
  otherInitialCosts?: { label: string; amount: number }[];
  // 家賃・管理費・共益費・月額保証料以外で毎月かかる費用（例：CATV費用・水道料金・駆け付けサービス）
  otherMonthlyCosts?: { label: string; amount: number }[];
  // 2026-05-28 追加（比較表の多面化用）。古い保存データには存在しないので optional
  buildingAge?: string;
  nearestStation?: string;
  stationWalkMinutes?: number;
  facilities?: string[];
  recommendPoint?: string;
  // 2026-06-06 追加（第2弾）。入居者の金銭メリット・強いアピールになる特徴で、マイソクに明記されているものだけ
  // 例：インターネット無料 / 敷金なし / 礼金なし / フリーレント1ヶ月 / 更新料なし。旧データには無いので optional
  salesPoints?: string[];
  // 物件の取得元。Instagram 投稿番号の記号に使う（realpro=R / ATBB=A / イタンジBB=I）。
  // 未指定なら I（イタンジBB）扱い。将来は解析画面のUIで選べるようにする想定（今は手動設定なし）。
  source?: "R" | "A" | "I" | string;
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
