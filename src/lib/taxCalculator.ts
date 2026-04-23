export interface TaxInput {
  vehiclePriceForeign: number;
  currencyRate: number;
  shippingCostForeign: number;
  insuranceCostForeign: number;
  localExpensesILS: number;
  customsRate: number;
  purchaseTaxRate: number;
  greenDiscount: number;
}

export interface TaxResult {
  vehiclePriceILS: number;
  shippingCostILS: number;
  insuranceCostILS: number;
  cifValue: number;
  customsFee: number;
  purchaseTaxBase: number;
  purchaseTaxBeforeDiscount: number;
  purchaseTax: number;
  vatBase: number;
  vatAmount: number;
  totalCost: number;
  totalTaxes: number;
  taxPercent: number;
}

export function calculateImportTax(input: TaxInput): TaxResult {
  const vehiclePriceILS = input.vehiclePriceForeign * input.currencyRate;
  const shippingCostILS = input.shippingCostForeign * input.currencyRate;
  const insuranceCostILS = input.insuranceCostForeign * input.currencyRate;
  const cifValue = vehiclePriceILS + shippingCostILS + insuranceCostILS;

  const customsFee = cifValue * input.customsRate;
  const purchaseTaxBase = cifValue + customsFee + input.localExpensesILS;

  const purchaseTaxBeforeDiscount = purchaseTaxBase * input.purchaseTaxRate;
  const purchaseTax = Math.max(0, purchaseTaxBeforeDiscount - input.greenDiscount);

  const vatBase = purchaseTaxBase + purchaseTax;
  const vatAmount = vatBase * 0.18;

  const totalCost = vatBase + vatAmount;
  const totalTaxes = customsFee + purchaseTax + vatAmount;
  const taxPercent = vehiclePriceILS > 0 ? (totalTaxes / vehiclePriceILS) * 100 : 0;

  return {
    vehiclePriceILS,
    shippingCostILS,
    insuranceCostILS,
    cifValue,
    customsFee,
    purchaseTaxBase,
    purchaseTaxBeforeDiscount,
    purchaseTax,
    vatBase,
    vatAmount,
    totalCost,
    totalTaxes,
    taxPercent,
  };
}

export const ENGINE_TYPES = [
  { value: 0.83, label: 'בנזין רגיל', sublabel: '83%' },
  { value: 0.72, label: 'היברידי (Mild/Full)', sublabel: '72%' },
  { value: 0.45, label: 'פלאג-אין (PHEV)', sublabel: '45%' },
  { value: 0.52, label: 'חשמלי', sublabel: '52%' },
  { value: 0.83, label: 'דיזל', sublabel: '83%' },
];

export const CUSTOMS_OPTIONS = [
  { value: 0,     label: '0% — אירופה / הצהרת מקור' },
  { value: 0.065, label: '6.5% — קנדה' },
  { value: 0.07,  label: '7% — ארה״ב / יפן' },
];

export const GREEN_GROUPS = [
  { group: 1,  co2: '0–50',    discount: 25500 },
  { group: 2,  co2: '51–75',   discount: 20500 },
  { group: 3,  co2: '76–90',   discount: 15500 },
  { group: 4,  co2: '91–100',  discount: 10500 },
  { group: 5,  co2: '101–110', discount: 7000  },
  { group: 6,  co2: '111–120', discount: 4500  },
  { group: 7,  co2: '121–130', discount: 2500  },
  { group: 8,  co2: '131–140', discount: 1000  },
  { group: 9,  co2: '141–150', discount: 0     },
  { group: 10, co2: '151–165', discount: 0     },
  { group: 11, co2: '166–180', discount: 0     },
  { group: 12, co2: '181+',    discount: 0     },
];

export function formatILS(n: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}
