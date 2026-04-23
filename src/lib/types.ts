export interface Vehicle {
  id: number;
  vin?: string;
  make: string;
  model: string;
  year?: number;
  manufacture_month?: number;
  manufacture_year?: number;
  color?: string;
  dealer_name?: string;
  dealer_country?: string;
  purchase_price?: number;
  purchase_date?: string;
  status: string;
  license_type?: 'זעיר' | 'עקיף';
  bl_number?: string;
  bl_tracking_url?: string;
  import_license?: string;
  import_license_expiry?: string;
  assigned_to?: string;
  shipping_company?: string;
  vessel_name?: string;
  container_number?: string;
  port_of_loading?: string;
  port_of_discharge?: string;
  carrier_booking_no?: string;
  release_agent?: string;
  invoice_number?: string;
  purchase_currency?: string;
  notes?: string;
  eta?: string;
  created_at: string;
}

const TRACKING_URLS: Record<string, string> = {
  'ZIM': 'https://www.zim.com/tools/track-a-shipment?consnumber=',
  'MSC': 'https://www.msc.com/track-a-shipment?query=',
  'Maersk': 'https://www.maersk.com/tracking/',
  'CMA CGM': 'https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&Reference=',
  'Evergreen': 'https://www.shipmentlink.com/servlet/TDB1_CargoTracking.do?BOL=&CNTR=',
  'COSCO': 'https://elines.coscoshipping.com/ebusiness/cargoTracking?trackingType=CONTAINER&number=',
  'ONE': 'https://ecomm.one-line.com/ecom/CUP_HOM_3301GS.do?f_cmd=121&cntr_no=',
  'Yang Ming': 'https://www.yangming.com/e-service/track_trace/track_trace_cargo_tracking.aspx?searchType=CNTR_NO&cntrNO=',
};

export function getTrackingUrl(company?: string, container?: string): string | null {
  if (!company || !container) return null;
  const base = TRACKING_URLS[company];
  if (!base) return null;
  return base + container;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType = 'import_license' | 'registration' | 'waiting_docs';

export interface Alert {
  vehicle_id: number;
  vehicle_name: string;
  vin?: string;
  type: AlertType;
  message: string;
  days_remaining: number;
  severity: AlertSeverity;
}

export interface VehicleDocument {
  id: number;
  vehicle_id: number;
  doc_type: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  uploaded_at: string;
  notes?: string;
}

export interface DocChecklistItem {
  type: string;
  label: string;
  stage: 'purchase' | 'shipping' | 'customs' | 'licensing';
  required: boolean;
}

export const DOC_CHECKLIST: DocChecklistItem[] = [
  { type: 'invoice',        label: 'חשבונית קנייה',          stage: 'purchase',  required: true },
  { type: 'title',          label: 'טייטל',                   stage: 'purchase',  required: true },
  { type: 'door_sticker',   label: 'מדבקת שלדה',             stage: 'purchase',  required: true },
  { type: 'window_sticker', label: 'מדבקת חלון',             stage: 'purchase',  required: false },
  { type: 'carfax',         label: 'CARFAX',                  stage: 'purchase',  required: false },
  { type: 'bl',             label: 'שטר מטען (B/L)',          stage: 'shipping',  required: true },
  { type: 'delivery_order', label: 'פקודת מסירה',             stage: 'shipping',  required: true },
  { type: 'import_license', label: 'רשיון ייבוא',             stage: 'customs',   required: true },
  { type: 'customs_release',label: 'אישור שחרור מכס',         stage: 'customs',   required: true },
  { type: 'import_tax',     label: 'תשלום מיסי יבוא',        stage: 'customs',   required: true },
  { type: 'vehicle_file',   label: 'תיק רכבית',              stage: 'licensing', required: true },
  { type: 'noise_test',     label: 'אישור בדיקת רועש',        stage: 'licensing', required: true },
  { type: 'inspection',     label: 'בדיקת מכון בחינות',       stage: 'licensing', required: true },
  { type: 'mandatory_ins',  label: 'ביטוח חובה',              stage: 'licensing', required: true },
  { type: 'coc',            label: 'תעודת התאמה (COC)',          stage: 'purchase',  required: false },
  { type: 'other',          label: 'אחר',                      stage: 'purchase',  required: false },
];

export const DOC_STAGE_LABELS: Record<DocChecklistItem['stage'], string> = {
  purchase:  'מסמכי קנייה',
  shipping:  'מסמכי משלוח',
  customs:   'מסמכי מכס',
  licensing: 'מסמכי רישוי',
};

export function calcDocProgress(docs: VehicleDocument[]): { total: number; done: number; pct: number } {
  const required = DOC_CHECKLIST.filter(d => d.required);
  const uploadedTypes = new Set(docs.map(d => d.doc_type));
  const done = required.filter(d => uploadedTypes.has(d.type)).length;
  return { total: required.length, done, pct: Math.round((done / required.length) * 100) };
}

export const PIPELINE_STATUSES = [
  'בנמל מקור',
  'בים',
  'הגיע לארץ',
] as const;

export const STATUSES = [
  'שולם וממתין לניירת',
  'בנמל מקור',
  'בים',
  'הגיע לארץ',
  'הגיע',
] as const;

export const STATUS_PROGRESS: Record<string, number> = {
  'בנמל מקור': 1,
  'בים':        2,
  'הגיע לארץ': 3,
};

export const STATUS_COLORS: Record<string, string> = {
  'בנמל מקור':  'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  'בים':         'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
  'הגיע לארץ':  'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  'הגיע':        'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  'שולם וממתין לניירת':'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200',
};

export const STATUS_DOT: Record<string, string> = {
  'בנמל מקור':  'bg-blue-400',
  'בים':         'bg-cyan-400',
  'הגיע לארץ':  'bg-orange-400',
  'הגיע':        'bg-green-400',
  'שולם וממתין לניירת':'bg-gray-300',
};
