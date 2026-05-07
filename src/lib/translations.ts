import type { Language } from "@/types";

// ─── 言語メタ情報 ────────────────────────────────────────
export interface LangMeta {
  name: string;
  flag: string;
  currency: { code: string; symbol: string; rate: number };
}

export const LANG_META: Record<Language, LangMeta> = {
  ja:  { name: "日本語",      flag: "🇯🇵", currency: { code: "JPY", symbol: "¥",   rate: 1      } },
  en:  { name: "English",     flag: "🇺🇸", currency: { code: "USD", symbol: "$",   rate: 0.0067 } },
  zh:  { name: "中文",        flag: "🇨🇳", currency: { code: "CNY", symbol: "¥",   rate: 0.048  } },
  ko:  { name: "한국어",      flag: "🇰🇷", currency: { code: "KRW", symbol: "₩",   rate: 9.1    } },
  vi:  { name: "Tiếng Việt",  flag: "🇻🇳", currency: { code: "VND", symbol: "₫",   rate: 164    } },
  ne:  { name: "नेपाली",     flag: "🇳🇵", currency: { code: "NPR", symbol: "रु",  rate: 0.89   } },
  pt:  { name: "Português",   flag: "🇧🇷", currency: { code: "BRL", symbol: "R$",  rate: 0.035  } },
  fil: { name: "Filipino",    flag: "🇵🇭", currency: { code: "PHP", symbol: "₱",   rate: 0.37   } },
};

export const LANGUAGES = Object.keys(LANG_META) as Language[];

// ─── ふりがな / カタカナ / ローマ字 ─────────────────────
export const PHONETICS: Record<string, { furigana: string; katakana: string; romaji: string }> = {
  rent_first:        { furigana: "まえやちん",                   katakana: "マエヤチン",                   romaji: "Mae-yachin" },
  deposit:           { furigana: "しききん",                     katakana: "シキキン",                     romaji: "Shiki-kin" },
  key_money:         { furigana: "れいきん",                     katakana: "レイキン",                     romaji: "Rei-kin" },
  agency_fee:        { furigana: "ちゅうかいてすうりょう",       katakana: "チュウカイテスウリョウ",       romaji: "Chukai-tesuryo" },
  guarantee_fee:     { furigana: "ほしょうがいしゃりようりょう", katakana: "ホショウガイシャリヨウリョウ", romaji: "Hosho-gaisha-riyo-ryo" },
  fire_insurance:    { furigana: "かさいほけんりょう",           katakana: "カサイホケンリョウ",           romaji: "Kasai-hoken-ryo" },
  key_exchange:      { furigana: "かぎこうかんひよう",           katakana: "カギコウカンヒヨウ",           romaji: "Kagi-kokan-hiyo" },
  cleaning:          { furigana: "しつないしょうどく・じょきん", katakana: "シツナイショウドク・ジョキン", romaji: "Shitsunai-shodo-jokin" },
  monthly_rent:      { furigana: "やちん",                       katakana: "ヤチン",                       romaji: "Ya-chin" },
  monthly_mgmt:      { furigana: "かんりひ",                     katakana: "カンリヒ",                     romaji: "Kanri-hi" },
  monthly_guarantee: { furigana: "げつがくほしょうりょう",       katakana: "ゲツガクホショウリョウ",       romaji: "Getsugaku-hosho-ryo" },
  monthly_total:     { furigana: "げつがくごうけい",             katakana: "ゲツガクゴウケイ",             romaji: "Getsugaku-gokei" },
};

// ─── 多言語テキスト型 ────────────────────────────────────
type ML = Record<Language, string>;

// ─── コスト項目ラベル ────────────────────────────────────
export const COST_LABELS: Record<string, ML> = {
  rent_first:    { ja: "前家賃",         en: "Advance Rent",             zh: "预付房租",           ko: "선불 임차료",           vi: "Tiền thuê trước",        ne: "अग्रिम भाडा",           pt: "Aluguel antecipado",     fil: "Advance na Upa" },
  deposit:       { ja: "敷金",           en: "Security Deposit",         zh: "押金",               ko: "보증금",               vi: "Tiền đặt cọc",           ne: "धरौटी",                 pt: "Depósito caução",        fil: "Deposito" },
  key_money:     { ja: "礼金",           en: "Key Money",                zh: "礼金（谢礼金）",     ko: "사례금",               vi: "Tiền lễ (Rei-kin)",      ne: "सुविधा शुल्क",          pt: "Luva (não reembolsável)",fil: "Key Money" },
  agency_fee:    { ja: "仲介手数料",     en: "Agency Fee",               zh: "中介费",             ko: "중개 수수료",           vi: "Phí môi giới",           ne: "दलाली शुल्क",           pt: "Taxa de corretagem",     fil: "Bayad sa Ahensya" },
  guarantee_fee: { ja: "保証会社利用料", en: "Guarantor Fee (Initial)",  zh: "担保公司费（初次）", ko: "보증회사 이용료（초기）", vi: "Phí bảo lãnh (đầu tiên)",ne: "जमानत शुल्क (प्रारम्भिक)", pt: "Taxa de garantia (inicial)", fil: "Guarantor Fee (Unang)" },
  fire_insurance:{ ja: "火災保険料（2年）",en:"Fire Insurance (2 yrs)", zh: "火灾保险（2年）",   ko: "화재 보험료（2년）",    vi: "Bảo hiểm hỏa hoạn (2 năm)", ne: "आगो बीमा (२ वर्ष)",   pt: "Seguro incêndio (2 anos)", fil: "Fire Insurance (2 taon)" },
  key_exchange:  { ja: "鍵交換費用",     en: "Key Replacement",          zh: "换锁费用",           ko: "열쇠 교환 비용",         vi: "Phí thay chìa khóa",    ne: "साँचो परिवर्तन शुल्क",  pt: "Troca de chave",         fil: "Pagpapalit ng Susi" },
  cleaning:      { ja: "室内消毒・除菌", en: "Sanitization",             zh: "室内消毒除菌",       ko: "실내 소독·제균",         vi: "Khử trùng phòng",        ne: "कोठा सफाई",             pt: "Sanitização",            fil: "Sanitasyon" },
};

export const MONTHLY_LABELS: Record<string, ML> = {
  monthly_rent:      { ja: "家賃",       en: "Rent",                  zh: "房租",     ko: "임차료",      vi: "Tiền thuê",              ne: "भाडा",                  pt: "Aluguel",                fil: "Upa" },
  monthly_mgmt:      { ja: "管理費",     en: "Management Fee",        zh: "管理费",   ko: "관리비",      vi: "Phí quản lý",            ne: "व्यवस्थापन शुल्क",     pt: "Taxa de administração",  fil: "Bayad sa Pamamahala" },
  monthly_guarantee: { ja: "月額保証料", en: "Monthly Guarantor Fee", zh: "每月担保费",ko: "월별 보증료", vi: "Phí bảo lãnh hàng tháng",ne: "मासिक जमानत शुल्क",    pt: "Taxa mensal de garantia",fil: "Buwanang Guarantor Fee" },
  monthly_total:     { ja: "月額合計",   en: "Monthly Total",         zh: "每月合计", ko: "월별 합계",   vi: "Tổng hàng tháng",        ne: "मासिक जम्मा",           pt: "Total mensal",           fil: "Kabuuang Buwanang Bayad" },
};

export const CAT_LABELS: Record<string, ML> = {
  "家賃関連": { ja: "家賃関連", en: "Rent Related",        zh: "租金相关",  ko: "임차료 관련",   vi: "Liên quan tiền thuê",   ne: "भाडा सम्बन्धित",  pt: "Relacionado ao aluguel", fil: "Kaugnay ng Upa" },
  "仲介費用": { ja: "仲介費用", en: "Brokerage",            zh: "中介费用",  ko: "중개 비용",     vi: "Chi phí môi giới",      ne: "दलाली खर्च",      pt: "Corretagem",             fil: "Bayad sa Broker" },
  "保証・保険":{ ja: "保証・保険",en:"Guarantee / Insurance",zh: "担保・保险",ko: "보증・보험",    vi: "Bảo lãnh / Bảo hiểm",  ne: "जमानत / बीमा",    pt: "Garantia / Seguro",      fil: "Garantiya / Insurance" },
  "入居費用": { ja: "入居費用", en: "Move-in Costs",        zh: "入住费用",  ko: "입주 비용",     vi: "Chi phí dọn vào",       ne: "बसाई खर्च",       pt: "Custos de mudança",      fil: "Gastos sa Paglipat" },
};

export const SECTION: Record<string, ML> = {
  reportTitle:  { ja: "不動産初期費用計算書", en: "Real Estate Initial Cost Report",   zh: "房地产初期费用计算书",  ko: "부동산 초기 비용 계산서",    vi: "Bảng tính chi phí ban đầu",      ne: "घर भाडा खर्च गणना पत्र",        pt: "Relatório de Custos Iniciais",   fil: "Ulat ng Paunang Gastos" },
  propertyInfo: { ja: "物件情報",             en: "Property Info",                    zh: "物件信息",             ko: "물건 정보",                  vi: "Thông tin bất động sản",          ne: "सम्पत्ति जानकारी",               pt: "Informações do imóvel",           fil: "Impormasyon ng Ari-arian" },
  initialCosts: { ja: "初期費用",             en: "Initial Costs",                    zh: "初期费用",             ko: "초기 비용",                  vi: "Chi phí ban đầu",                 ne: "प्रारम्भिक खर्च",                pt: "Custos iniciais",                 fil: "Paunang Gastos" },
  monthlyCosts: { ja: "毎月の支払い",         en: "Monthly Payments",                 zh: "每月支付",             ko: "월별 납부",                  vi: "Thanh toán hàng tháng",           ne: "मासिक भुक्तानी",                  pt: "Pagamentos mensais",              fil: "Buwanang Bayad" },
  totalInitial: { ja: "初期費用合計",         en: "Total Initial Cost",               zh: "初期费用合计",         ko: "초기 비용 합계",              vi: "Tổng chi phí ban đầu",            ne: "कुल प्रारम्भिक खर्च",            pt: "Custo inicial total",             fil: "Kabuuang Paunang Gastos" },
  glossaryTitle:{ ja: "用語解説",             en: "Glossary",                         zh: "术语说明",             ko: "용어 설명",                  vi: "Giải thích thuật ngữ",            ne: "शब्द व्याख्या",                   pt: "Glossário",                       fil: "Talasalitaan" },
  createdDate:  { ja: "作成日",               en: "Date",                             zh: "制作日期",             ko: "작성일",                     vi: "Ngày tạo",                        ne: "मिति",                            pt: "Data",                            fil: "Petsa" },
  colItem:      { ja: "項目",                 en: "Item",                             zh: "项目",                 ko: "항목",                       vi: "Mục",                             ne: "विवरण",                           pt: "Item",                            fil: "Aytem" },
  colAmount:    { ja: "金額（円）",           en: "Amount (JPY)",                     zh: "金额（日元）",         ko: "금액（엔）",                  vi: "Số tiền (JPY)",                   ne: "रकम (येन)",                       pt: "Valor (JPY)",                     fil: "Halaga (JPY)" },
  colNote:      { ja: "備考",                 en: "Notes",                            zh: "备注",                 ko: "비고",                       vi: "Ghi chú",                         ne: "टिप्पणी",                         pt: "Observações",                     fil: "Tala" },
  taxIncluded:  { ja: "消費税込",             en: "incl. tax",                        zh: "含消费税",             ko: "소비세 포함",                vi: "Bao gồm thuế",                    ne: "कर सहित",                         pt: "incl. impostos",                  fil: "kasama ang buwis" },
  rent:         { ja: "家賃",                 en: "Rent",                             zh: "房租",                 ko: "임차료",                     vi: "Tiền thuê",                       ne: "भाडा",                            pt: "Aluguel",                         fil: "Upa" },
  managementFee:{ ja: "管理費",               en: "Management Fee",                   zh: "管理费",               ko: "관리비",                     vi: "Phí quản lý",                     ne: "व्यवस्थापन शुल्क",               pt: "Taxa de administração",           fil: "Bayad sa Pamamahala" },
  floorPlan:    { ja: "間取り",               en: "Floor Plan",                       zh: "户型",                 ko: "평면도",                     vi: "Sơ đồ tầng",                      ne: "कोठा विन्यास",                    pt: "Planta",                          fil: "Plano ng Sahig" },
  area:         { ja: "面積",                 en: "Area",                             zh: "面积",                 ko: "면적",                       vi: "Diện tích",                       ne: "क्षेत्रफल",                       pt: "Área",                            fil: "Sukat" },
  companyName:  { ja: "会社名",               en: "Company",                          zh: "公司名称",             ko: "회사명",                     vi: "Tên công ty",                     ne: "कम्पनी नाम",                      pt: "Empresa",                         fil: "Pangalan ng Kumpanya" },
  agentName:    { ja: "担当者",               en: "Agent",                            zh: "负责人",               ko: "담당자",                     vi: "Nhân viên",                       ne: "जिम्मेवार व्यक्ति",               pt: "Responsável",                     fil: "Ahente" },
  phone:        { ja: "電話",                 en: "Phone",                            zh: "电话",                 ko: "전화",                       vi: "Điện thoại",                      ne: "फोन",                             pt: "Telefone",                        fil: "Telepono" },
  validUntil:   { ja: "見積もり有効期限",     en: "Quote Valid Until",                zh: "报价有效期至",         ko: "견적 유효 기간",              vi: "Báo giá có hiệu lực đến",         ne: "अनुमान मान्य मिति",               pt: "Validade do orçamento",           fil: "Bisa Hanggang" },
  scheduleTitle:{ ja: "入居までのスケジュール",en: "Move-in Schedule",                zh: "入住时间表",           ko: "입주 일정",                  vi: "Lịch trình dọn vào",              ne: "सर्ने समय तालिका",                pt: "Cronograma de mudança",           fil: "Iskedyul ng Paglipat" },
  scheduleStep1:{ ja: "申込",                 en: "Application",                      zh: "申请",                 ko: "신청",                       vi: "Đăng ký",                         ne: "आवेदन",                           pt: "Pedido",                          fil: "Aplikasyon" },
  scheduleStep2:{ ja: "入居審査",             en: "Screening",                        zh: "审查",                 ko: "심사",                       vi: "Xét duyệt",                       ne: "जाँच",                            pt: "Análise",                         fil: "Pagsusuri" },
  scheduleStep2sub: { ja: "（1週間程度）",    en: "(~1 week)",                        zh: "（约1周）",            ko: "（1주 정도）",                vi: "(khoảng 1 tuần)",                 ne: "(१ हप्ता जति)",                   pt: "(~1 semana)",                     fil: "(~1 linggo)" },
  scheduleStep3:{ ja: "契約・費用支払い",     en: "Contract & Payment",               zh: "合同及费用支付",       ko: "계약・비용 납부",             vi: "Ký hợp đồng & Thanh toán",        ne: "सम्झौता र भुक्तानी",              pt: "Contrato & Pagamento",            fil: "Kontrata at Bayad" },
  scheduleStep4:{ ja: "鍵渡し・入居",         en: "Key Handover",                     zh: "交钥匙・入住",         ko: "열쇠 수령・입주",             vi: "Nhận chìa khóa & Dọn vào",       ne: "साँचो र सर्ने",                   pt: "Entrega & Mudança",               fil: "Susi at Paglipat" },
  roomNumber:   { ja: "部屋番号",             en: "Room No.",                         zh: "房间号",               ko: "호실",                       vi: "Số phòng",                        ne: "कोठा नम्बर",                      pt: "Nº do apartamento",               fil: "Numero ng Silid" },
  customerName: { ja: "お客様名",             en: "Customer Name",                    zh: "客户姓名",             ko: "고객명",                     vi: "Tên khách hàng",                  ne: "ग्राहकको नाम",                    pt: "Nome do cliente",                 fil: "Pangalan ng Customer" },
  customerNat:  { ja: "国籍",                 en: "Nationality",                      zh: "国籍",                 ko: "국적",                       vi: "Quốc tịch",                       ne: "राष्ट्रियता",                     pt: "Nacionalidade",                   fil: "Nasyonalidad" },
  agentComment: { ja: "担当者コメント",       en: "Agent's Note",                     zh: "负责人备注",           ko: "담당자 코멘트",               vi: "Ghi chú của nhân viên",           ne: "एजेन्टको टिप्पणी",               pt: "Nota do responsável",             fil: "Tala ng Ahente" },
};

// ─── 用語解説 ────────────────────────────────────────────
export interface GlossaryItem {
  term: string;
  furigana: string;
  romaji: string;
  explanation: string;
}

export const GLOSSARY: Record<Language, GlossaryItem[]> = {
  ja: [
    { term: "敷金",       furigana: "しききん",                 romaji: "Shiki-kin",       explanation: "入居前に大家さんへ支払う保証金。退去時に修繕費を差し引いて返還される。" },
    { term: "礼金",       furigana: "れいきん",                 romaji: "Rei-kin",         explanation: "大家さんへの「お礼」として支払う金銭。返還されない日本独自の慣習。" },
    { term: "仲介手数料", furigana: "ちゅうかいてすうりょう",   romaji: "Chukai-tesuryo",  explanation: "不動産会社に支払う手数料。法律上の上限は家賃1ヶ月分＋消費税10%。" },
    { term: "保証会社",   furigana: "ほしょうがいしゃ",         romaji: "Hosho-gaisha",    explanation: "日本人の保証人がいない場合に利用する会社。大家さんへの家賃支払いを保証する。" },
    { term: "火災保険",   furigana: "かさいほけん",             romaji: "Kasai-hoken",     explanation: "賃貸物件に加入必須の保険。火災・水漏れ・盗難などを補償する。通常2年契約で一括払い。" },
  ],
  en: [
    { term: "敷金",       furigana: "しききん",                 romaji: "Shiki-kin",       explanation: "Security Deposit: A refundable deposit paid before moving in (usually 1–2 months' rent). Returned when you move out, minus repair costs." },
    { term: "礼金",       furigana: "れいきん",                 romaji: "Rei-kin",         explanation: "Key Money: A non-refundable 'thank-you' payment to the landlord (usually 1–2 months' rent). A unique Japanese custom — it will NOT be returned." },
    { term: "仲介手数料", furigana: "ちゅうかいてすうりょう",   romaji: "Chukai-tesuryo",  explanation: "Agency Fee: Paid to the real estate agency. By law, the maximum is 1 month's rent + 10% consumption tax." },
    { term: "保証会社",   furigana: "ほしょうがいしゃ",         romaji: "Hosho-gaisha",    explanation: "Guarantor Company: Required when you have no Japanese guarantor. They guarantee your rent to the landlord. Initial fee is usually 0.5 months' rent." },
    { term: "火災保険",   furigana: "かさいほけん",             romaji: "Kasai-hoken",     explanation: "Fire Insurance: Mandatory insurance covering fire, water damage, and theft. Typically a 2-year contract paid upfront." },
  ],
  zh: [
    { term: "敷金",       furigana: "しききん",                 romaji: "Shiki-kin",       explanation: "押金：搬入前支付给房东的可退还保证金（通常1-2个月租金）。退房时扣除修缮费后返还。" },
    { term: "礼金",       furigana: "れいきん",                 romaji: "Rei-kin",         explanation: "谢礼金：支付给房东的不可退还的感谢金（通常1-2个月租金）。日本独特习俗，不予退还。" },
    { term: "仲介手数料", furigana: "ちゅうかいてすうりょう",   romaji: "Chukai-tesuryo",  explanation: "中介费：支付给房产中介公司。法律规定最高为1个月租金+10%消费税。" },
    { term: "保証会社",   furigana: "ほしょうがいしゃ",         romaji: "Hosho-gaisha",    explanation: "担保公司：没有日本担保人时需要使用。向房东保证您的租金支付。初始费用约0.5个月租金。" },
    { term: "火災保険",   furigana: "かさいほけん",             romaji: "Kasai-hoken",     explanation: "火灾保险：租赁物业必须购买的保险，涵盖火灾、漏水和盗窃。通常为2年合同预付款。" },
  ],
  ko: [
    { term: "敷金",       furigana: "しききん",                 romaji: "Shiki-kin",       explanation: "보증금: 입주 전 지불하는 환불 가능한 보증금(보통 임차료 1-2개월). 퇴거 시 수리비 공제 후 반환됩니다." },
    { term: "礼金",       furigana: "れいきん",                 romaji: "Rei-kin",         explanation: "사례금: 집주인에게 지불하는 비환불 '감사' 금액(보통 임차료 1-2개월). 일본 특유의 관습으로 반환되지 않습니다." },
    { term: "仲介手数料", furigana: "ちゅうかいてすうりょう",   romaji: "Chukai-tesuryo",  explanation: "중개 수수료: 부동산 중개업소에 지불합니다. 법적 최대 금액은 임차료 1개월 + 소비세 10%입니다." },
    { term: "保証会社",   furigana: "ほしょうがいしゃ",         romaji: "Hosho-gaisha",    explanation: "보증 회사: 일본인 보증인이 없을 때 필요합니다. 집주인에게 임차료 지불을 보증합니다. 초기 비용은 보통 0.5개월분입니다." },
    { term: "火災保険",   furigana: "かさいほけん",             romaji: "Kasai-hoken",     explanation: "화재 보험: 임대 부동산에 필수 보험입니다. 화재, 수해, 도난을 보장합니다. 보통 2년 계약으로 선불 지급합니다." },
  ],
  vi: [
    { term: "敷金",       furigana: "しききん",                 romaji: "Shiki-kin",       explanation: "Tiền đặt cọc: Tiền đặt cọc hoàn lại trả trước khi dọn vào (thường 1-2 tháng tiền thuê). Được hoàn trả khi dọn ra, trừ chi phí sửa chữa." },
    { term: "礼金",       furigana: "れいきん",                 romaji: "Rei-kin",         explanation: "Tiền lễ: Khoản tiền 'cảm ơn' không hoàn lại cho chủ nhà (thường 1-2 tháng tiền thuê). Phong tục riêng của Nhật Bản, sẽ không được hoàn trả." },
    { term: "仲介手数料", furigana: "ちゅうかいてすうりょう",   romaji: "Chukai-tesuryo",  explanation: "Phí môi giới: Trả cho công ty bất động sản. Theo luật, tối đa bằng 1 tháng tiền thuê + 10% thuế tiêu thụ." },
    { term: "保証会社",   furigana: "ほしょうがいしゃ",         romaji: "Hosho-gaisha",    explanation: "Công ty bảo lãnh: Cần thiết khi không có người bảo lãnh Nhật Bản. Bảo đảm thanh toán tiền thuê cho chủ nhà. Phí ban đầu thường 0.5 tháng." },
    { term: "火災保険",   furigana: "かさいほけん",             romaji: "Kasai-hoken",     explanation: "Bảo hiểm hỏa hoạn: Bảo hiểm bắt buộc cho bất động sản thuê, bao gồm hỏa hoạn, thiệt hại nước và trộm cắp. Thường hợp đồng 2 năm trả trước." },
  ],
  ne: [
    { term: "敷金",       furigana: "しききん",                 romaji: "Shiki-kin",       explanation: "धरौटी: सर्ने अघि तिर्ने फिर्ता हुने रकम (सामान्यतया १-२ महिनाको भाडा)। निस्कँदा मर्मत खर्च कटाएर फिर्ता पाइन्छ।" },
    { term: "礼金",       furigana: "れいきん",                 romaji: "Rei-kin",         explanation: "सुविधा शुल्क: घरधनीलाई दिइने फिर्ता नहुने 'धन्यवाद' रकम (सामान्यतया १-२ महिनाको भाडा)। जापानको विशेष प्रथा — फिर्ता हुँदैन।" },
    { term: "仲介手数料", furigana: "ちゅうかいてすうりょう",   romaji: "Chukai-tesuryo",  explanation: "दलाली शुल्क: अचल सम्पत्ति कम्पनीलाई तिर्ने। कानून अनुसार अधिकतम १ महिनाको भाडा + १०% उपभोग कर।" },
    { term: "保証会社",   furigana: "ほしょうがいしゃ",         romaji: "Hosho-gaisha",    explanation: "जमानत कम्पनी: जापानी जमानी नभएमा आवश्यक। घरधनीलाई भाडा भुक्तानी ग्यारेन्टी दिन्छ। प्रारम्भिक शुल्क सामान्यतया ०.५ महिना।" },
    { term: "火災保険",   furigana: "かさいほけん",             romaji: "Kasai-hoken",     explanation: "आगो बीमा: भाडाको सम्पत्तिको लागि अनिवार्य बीमा, आगो, पानीको क्षति र चोरी समावेश। सामान्यतया २ वर्षको अग्रिम सम्झौता।" },
  ],
  pt: [
    { term: "敷金",       furigana: "しききん",                 romaji: "Shiki-kin",       explanation: "Depósito caução: Depósito reembolsável pago antes da mudança (geralmente 1-2 meses de aluguel). Devolvido na saída, descontando reparos." },
    { term: "礼金",       furigana: "れいきん",                 romaji: "Rei-kin",         explanation: "Luva: Pagamento não reembolsável de 'gratidão' ao proprietário (geralmente 1-2 meses). Costume único do Japão — não será devolvido." },
    { term: "仲介手数料", furigana: "ちゅうかいてすうりょう",   romaji: "Chukai-tesuryo",  explanation: "Taxa de corretagem: Paga à imobiliária. Por lei, o máximo é 1 mês de aluguel + 10% de imposto sobre consumo." },
    { term: "保証会社",   furigana: "ほしょうがいしゃ",         romaji: "Hosho-gaisha",    explanation: "Empresa garantidora: Necessária sem fiador japonês. Garante o pagamento do aluguel ao proprietário. Taxa inicial geralmente 0,5 meses." },
    { term: "火災保険",   furigana: "かさいほけん",             romaji: "Kasai-hoken",     explanation: "Seguro contra incêndio: Obrigatório para o imóvel alugado, cobrindo incêndio, danos por água e roubo. Contrato de 2 anos pago antecipadamente." },
  ],
  fil: [
    { term: "敷金",       furigana: "しききん",                 romaji: "Shiki-kin",       explanation: "Deposito: Deposito na ibabalik na binabayad bago lumipat (karaniwang 1-2 buwang upa). Ibabalik kapag lumipat na, ibabawas ang gastos sa pagkukumpuni." },
    { term: "礼金",       furigana: "れいきん",                 romaji: "Rei-kin",         explanation: "Key Money: Hindi maibabalik na bayad na 'pasasalamat' sa may-ari (karaniwang 1-2 buwang upa). Kaugalian sa Japan — hindi ibabalik." },
    { term: "仲介手数料", furigana: "ちゅうかいてすうりょう",   romaji: "Chukai-tesuryo",  explanation: "Bayad sa Ahensya: Binabayad sa real estate company. Sa batas, maximum ay 1 buwang upa + 10% consumption tax." },
    { term: "保証会社",   furigana: "ほしょうがいしゃ",         romaji: "Hosho-gaisha",    explanation: "Guarantor Company: Kailangan kung walang Japanese guarantor. Ginagarantiyahan ang bayad ng upa sa may-ari. Unang bayad karaniwang 0.5 buwang upa." },
    { term: "火災保険",   furigana: "かさいほけん",             romaji: "Kasai-hoken",     explanation: "Fire Insurance: Sapilitan na insurance para sa inupahang ari-arian, sumasaklaw sa sunog, water damage, at pagnanakaw. 2-taong kontrata na bayad nang maaga." },
  ],
};

// ─── ヘルパー関数 ────────────────────────────────────────

/** 金額をJPY + 現地通貨換算で返す */
export function formatAmount(amount: number, lang: Language): { jpy: string; local: string | null } {
  const meta = LANG_META[lang];
  const jpy = `¥${amount.toLocaleString("ja-JP")}`;
  if (lang === "ja") return { jpy, local: null };
  const converted = Math.round(amount * meta.currency.rate);
  return {
    jpy,
    local: `≈ ${meta.currency.symbol}${converted.toLocaleString()} ${meta.currency.code}`,
  };
}

/** セクションラベル: 日本語 / 訳語（ja のみ日本語のみ） */
export function sectionLabel(key: string, lang: Language): string {
  const s = SECTION[key];
  if (!s) return key;
  if (lang === "ja") return s.ja;
  return `${s.ja} / ${s[lang]}`;
}
