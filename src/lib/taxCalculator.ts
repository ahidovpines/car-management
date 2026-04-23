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
  purchaseTax: number;
  vatBase: number;
  vatAmount: number;
  totalCost: number;
  totalTaxes: number;
  taxPercent: number;
  luxuryApplies: boolean;
}

const LUXURY_THRESHOLD = 302000;
const LUXURY_RATE = 0.0764;

export function calculateImportTax(input: TaxInput): TaxResult {
  const vehiclePriceILS = input.vehiclePriceForeign * input.currencyRate;
  const shippingCostILS = input.shippingCostForeign * input.currencyRate;

  // הוצאות מקומיות נכנסות לבסיס המכס (נוסחת רשות המסים)
  const customsBase = vehiclePriceILS + shippingCostILS + input.localExpensesILS;
  const customsFee = customsBase * input.customsRate;
  const purchaseTaxBase = customsBase + customsFee;

  const purchaseTaxBeforeAdjustment = purchaseTaxBase * input.purchaseTaxRate;
  const purchaseTaxAfterGreen = Math.max(0, purchaseTaxBeforeAdjustment + input.greenAdjustment);

  const luxuryApplies = !!input.consumerPrice && input.consumerPrice > LUXURY_THRESHOLD;
  const luxuryTax = luxuryApplies
    ? (input.consumerPrice! - LUXURY_THRESHOLD) * LUXURY_RATE
    : 0;

  const purchaseTax = purchaseTaxAfterGreen + luxuryTax;
  const vatBase = purchaseTaxBase + purchaseTax;
  const vatAmount = vatBase * 0.18;
  const totalCost = vatBase + vatAmount;
  const totalTaxes = customsFee + purchaseTax + vatAmount;
  const taxPercent = vehiclePriceILS > 0 ? (totalTaxes / vehiclePriceILS) * 100 : 0;

  return {
    vehiclePriceILS, shippingCostILS, customsBase, customsFee,
    purchaseTaxBase, purchaseTaxBeforeAdjustment, greenAdjustment: input.greenAdjustment,
    purchaseTaxAfterGreen, luxuryTax, purchaseTax,
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

// adjustment: שלילי = הנחה, חיובי = תוספת מס
export const GREEN_GROUPS = [
  { group: 1,  co2: '0–50',    adjustment: -25500 },
  { group: 2,  co2: '51–75',   adjustment: -20500 },
  { group: 3,  co2: '76–90',   adjustment: -15500 },
  { group: 4,  co2: '91–100',  adjustment: -10500 },
  { group: 5,  co2: '101–110', adjustment: -7000  },
  { group: 6,  co2: '111–120', adjustment: -4500  },
  { group: 7,  co2: '121–130', adjustment: -2500  },
  { group: 8,  co2: '131–140', adjustment: -1000  },
  { group: 9,  co2: '141–150', adjustment: 0      },
  { group: 10, co2: '151–165', adjustment: 0      },
  { group: 11, co2: '166–180', adjustment: 0      },
  { group: 12, co2: '181–195', adjustment: 0      },
  { group: 13, co2: '196–210', adjustment: 0      },
  { group: 14, co2: '211–230', adjustment: 0      },
  { group: 15, co2: '231–260', adjustment: 3349   },
  { group: 16, co2: '261–295', adjustment: 7000   },
  { group: 17, co2: '296–330', adjustment: 12000  },
  { group: 18, co2: '331–370', adjustment: 18000  },
  { group: 19, co2: '371–420', adjustment: 25000  },
  { group: 20, co2: '421+',    adjustment: 35000  },
];

export function formatILS(n: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency', currency: 'ILS',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}
