export interface TaxInput {
  vehiclePriceForeign: number;
  currencyRate: number;
  shippingCostForeign: number;
  localExpensesILS: number;
  customsRate: number;
  purchaseTaxRate: number;
  greenAdjustment: number; // negative = discount, positive = surcharge
  consumerPrice?: number;
}

export interface TaxResult {
  vehiclePriceILS: number;
  shippingCostILS: number;
  customsBase: number;
  customsFee: number;
  purchaseTaxBase: number;
  purchaseTaxBeforeAdjustment: number;
  greenAdjustment: number;
  purchaseTaxAfterGreen: number;
  luxuryTax: number;
  luxuryRate: number;
  purchaseTax: number;
  vatBase: number;
  vatAmount: number;
  totalCost: number;
  totalTaxes: number;
  taxPercent: number;
  luxuryApplies: boolean;
}

const LUXURY_THRESHOLD = 300000;

export function calculateImportTax(input: TaxInput): TaxResult {
  const vehiclePriceILS = input.vehiclePriceForeign * input.currencyRate;
  const shippingCostILS = input.shippingCostForeign * input.currencyRate;

  const customsBase = vehiclePriceILS + shippingCostILS + input.localExpensesILS;
  const customsFee = customsBase * input.customsRate;
  const purchaseTaxBase = customsBase + customsFee;

  const purchaseTaxBeforeAdjustment = purchaseTaxBase * input.purchaseTaxRate;
  const purchaseTaxAfterGreen = Math.max(0, purchaseTaxBeforeAdjustment + input.greenAdjustment);

  const luxuryApplies = !!input.consumerPrice && input.consumerPrice > LUXURY_THRESHOLD;
  // Formula: rate = 20% × (price − 300k) / price, applied to purchase-tax base
  const luxuryRate = luxuryApplies
    ? 0.20 * (input.consumerPrice! - LUXURY_THRESHOLD) / input.consumerPrice!
    : 0;
  const luxuryTax = luxuryApplies ? purchaseTaxBase * luxuryRate : 0;

  const purchaseTax = purchaseTaxAfterGreen + luxuryTax;
  const vatBase = purchaseTaxBase + purchaseTax;
  const vatAmount = vatBase * 0.18;
  const totalCost = vatBase + vatAmount;
  const totalTaxes = customsFee + purchaseTax + vatAmount;
  const taxPercent = vehiclePriceILS > 0 ? (totalTaxes / vehiclePriceILS) * 100 : 0;

  return {
    vehiclePriceILS, shippingCostILS, customsBase, customsFee,
    purchaseTaxBase, purchaseTaxBeforeAdjustment, greenAdjustment: input.greenAdjustment,
    purchaseTaxAfterGreen, luxuryTax, luxuryRate, purchaseTax,
    vatBase, vatAmount, totalCost, totalTaxes, taxPercent, luxuryApplies,
  };
}

export const ENGINE_TYPES = [
  { value: 0.83, label: 'בנזין רגיל',       sublabel: '83%' },
  { value: 0.72, label: 'היברידי (Mild/Full)', sublabel: '72%' },
  { value: 0.45, label: 'פלאג-אין (PHEV)',  sublabel: '45%' },
  { value: 0.52, label: 'חשמלי',            sublabel: '52%' },
  { value: 0.83, label: 'דיזל',             sublabel: '83%' },
];

export const CUSTOMS_OPTIONS = [
  { value: 0,     label: '0% — אירופה / הצהרת מקור' },
  { value: 0.065, label: '6.5% — קנדה' },
  { value: 0.07,  label: '7% — ארה״ב / יפן' },
];

// 15-group ציון ירוק system — enacted amounts for 2026 (Purchase Tax Order 2026)
// Group 15 is split into 3 sub-groups (introduced 2025, updated 2026).
// adjustment: negative = discount off purchase tax, positive = surcharge (ILS)
export const GREEN_GROUPS = [
  { group: 1,  label: '1',   score: '0–50',     adjustment: -13677, note: 'רכב חשמלי / אפס פליטות' },
  { group: 2,  label: '2',   score: '51–130',   adjustment: -13677, note: 'היברידי / PHEV' },
  { group: 3,  label: '3',   score: '131–150',  adjustment: -12142, note: '' },
  { group: 4,  label: '4',   score: '151–170',  adjustment: -9994,  note: '' },
  { group: 5,  label: '5',   score: '171–175',  adjustment: -8153,  note: '' },
  { group: 6,  label: '6',   score: '176–180',  adjustment: -6616,  note: '' },
  { group: 7,  label: '7',   score: '181–185',  adjustment: -5390,  note: '' },
  { group: 8,  label: '8',   score: '186–190',  adjustment: -4161,  note: '' },
  { group: 9,  label: '9',   score: '191–195',  adjustment: -3240,  note: '' },
  { group: 10, label: '10',  score: '196–200',  adjustment: -2016,  note: '' },
  { group: 11, label: '11',  score: '201–205',  adjustment: -1399,  note: '' },
  { group: 12, label: '12',  score: '206–210',  adjustment: -172,   note: '' },
  { group: 13, label: '13',  score: '211–220',  adjustment: 0,      note: '' },
  { group: 14, label: '14',  score: '221–250',  adjustment: 2285,   note: '' },
  { group: 15, label: '15א', score: '251–300',  adjustment: 3205,   note: '' },
  { group: 15, label: '15ב', score: '301–350',  adjustment: 5750,   note: '' },
  { group: 15, label: '15ג', score: '351+',     adjustment: 8690,   note: '' },
];

// Maps a ציון score to a group number (1–15)
export function zionToGroup(score: number): number {
  if (score <= 50)  return 1;
  if (score <= 130) return 2;
  if (score <= 150) return 3;
  if (score <= 170) return 4;
  if (score <= 175) return 5;
  if (score <= 180) return 6;
  if (score <= 185) return 7;
  if (score <= 190) return 8;
  if (score <= 195) return 9;
  if (score <= 200) return 10;
  if (score <= 205) return 11;
  if (score <= 210) return 12;
  if (score <= 220) return 13;
  if (score <= 250) return 14;
  return 15;
}

// Maps a ציון score to the index in GREEN_GROUPS (accounts for 15א/15ב/15ג sub-groups)
export function zionToGroupIdx(score: number): number {
  if (score <= 50)  return 0;
  if (score <= 130) return 1;
  if (score <= 150) return 2;
  if (score <= 170) return 3;
  if (score <= 175) return 4;
  if (score <= 180) return 5;
  if (score <= 185) return 6;
  if (score <= 190) return 7;
  if (score <= 195) return 8;
  if (score <= 200) return 9;
  if (score <= 205) return 10;
  if (score <= 210) return 11;
  if (score <= 220) return 12;
  if (score <= 250) return 13;
  if (score <= 300) return 14; // 15א
  if (score <= 350) return 15; // 15ב
  return 16;                   // 15ג
}

// Compute approximate ציון from EPA data (American-standard, g/mile from FTP-75 / HWFE cycles).
// Formula per 018/2014 Update 3, Appendix ג:
//   adapted_g_km = adaptation_factor × 0.62137 × (city × 0.34 + highway × 0.66)
//   ציון = round(0.81 × (140×CO₂_g_km + 128.176×NOx_mg_km + 6.839×HC_mg_km + 0.323×CO_mg_km + 497.676×PM_mg_km) / 100)
// When NOx/HC/CO/PM unavailable, compute CO₂-only lower bound and mark partial=true.
export interface EpaEmissions {
  co2_city_gpm: number;
  co2_hwy_gpm: number;
  nox_city_gpm?: number;
  nox_hwy_gpm?: number;
  thc_city_gpm?: number;
  thc_hwy_gpm?: number;
  co_city_gpm?: number;
  co_hwy_gpm?: number;
  pm_city_gpm?: number;
  pm_hwy_gpm?: number;
  isHybrid?: boolean;
}

function adaptToEuroGkm(city_gpm: number, hwy_gpm: number, isHybrid: boolean): number {
  const factor = isHybrid ? 1.374 : 1.481;
  return factor * 0.62137 * (city_gpm * 0.34 + hwy_gpm * 0.66);
}

export function computeZionFromEpa(e: EpaEmissions): { score: number; partial: boolean } {
  const isHybrid = e.isHybrid ?? false;
  const co2_gkm = adaptToEuroGkm(e.co2_city_gpm, e.co2_hwy_gpm, isHybrid);

  const hasNox = e.nox_city_gpm != null && e.nox_hwy_gpm != null;
  const hasThc = e.thc_city_gpm != null && e.thc_hwy_gpm != null;
  const hasCo  = e.co_city_gpm  != null && e.co_hwy_gpm  != null;
  const hasPm  = e.pm_city_gpm  != null && e.pm_hwy_gpm  != null;

  const nox_mgkm = hasNox ? adaptToEuroGkm(e.nox_city_gpm!, e.nox_hwy_gpm!, isHybrid) * 1000 : 0;
  const thc_mgkm = hasThc ? adaptToEuroGkm(e.thc_city_gpm!, e.thc_hwy_gpm!, isHybrid) * 1000 : 0;
  const co_mgkm  = hasCo  ? adaptToEuroGkm(e.co_city_gpm!,  e.co_hwy_gpm!,  isHybrid) * 1000 : 0;
  const pm_mgkm  = hasPm  ? adaptToEuroGkm(e.pm_city_gpm!,  e.pm_hwy_gpm!,  isHybrid) * 1000 : 0;

  const sum = 140 * co2_gkm
    + 128.176 * nox_mgkm
    + 6.839   * thc_mgkm
    + 0.323   * co_mgkm
    + 497.676 * pm_mgkm;

  const score = Math.round(0.81 * sum / 100);
  const partial = !hasNox || !hasThc || !hasCo;

  return { score, partial };
}

// Derive CO₂ g/mile from MPG (EPA standard: gasoline ≈8887 g/gallon, diesel ≈10147)
export function mpgToCo2Gpm(mpg: number, diesel = false): number {
  if (!mpg || mpg <= 0) return 0;
  return (diesel ? 10147 : 8887) / mpg;
}

export function formatILS(n: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency', currency: 'ILS',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}
