'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, Info } from 'lucide-react';
import {
  calculateImportTax,
  ENGINE_TYPES,
  CUSTOMS_OPTIONS,
  GREEN_GROUPS,
  formatILS,
} from '@/lib/taxCalculator';

function NumInput({
  label, value, onChange, prefix, hint,
}: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full border border-gray-200 rounded-xl py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${prefix ? 'pr-10 pl-3' : 'px-3'}`}
        />
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Row({ label, value, sub, bold, big, highlight }: {
  label: string; value: string; sub?: string; bold?: boolean; big?: boolean; highlight?: string;
}) {
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0 ${highlight ? `bg-${highlight}-50 -mx-4 px-4 rounded-lg` : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{label}</span>
      <div className="text-left">
        <span className={`font-semibold ${big ? 'text-xl text-blue-700' : bold ? 'text-gray-800' : 'text-gray-700'}`}>{value}</span>
        {sub && <span className="text-xs text-gray-400 mr-1">{sub}</span>}
      </div>
    </div>
  );
}

export default function CalculatorPage() {
  const [price, setPrice] = useState('');
  const [rate, setRate] = useState('3.65');
  const [shipping, setShipping] = useState('');
  const [insurance, setInsurance] = useState('');
  const [local, setLocal] = useState('');
  const [customsIdx, setCustomsIdx] = useState(2); // 7% default
  const [engineIdx, setEngineIdx] = useState(0);   // petrol default
  const [greenIdx, setGreenIdx] = useState(3);      // group 4 default

  const result = useMemo(() => {
    const p = parseFloat(price) || 0;
    if (p === 0) return null;
    return calculateImportTax({
      vehiclePriceForeign: p,
      currencyRate: parseFloat(rate) || 3.65,
      shippingCostForeign: parseFloat(shipping) || 0,
      insuranceCostForeign: parseFloat(insurance) || 0,
      localExpensesILS: parseFloat(local) || 0,
      customsRate: CUSTOMS_OPTIONS[customsIdx].value,
      purchaseTaxRate: ENGINE_TYPES[engineIdx].value,
      greenDiscount: GREEN_GROUPS[greenIdx].discount,
    });
  }, [price, rate, shipping, insurance, local, customsIdx, engineIdx, greenIdx]);

  return (
    <div dir="rtl" className="min-h-screen bg-[#f0f2f7]">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowRight className="w-5 h-5 text-gray-500" />
          </Link>
          <Calculator className="w-6 h-6 text-blue-600" />
          <h1 className="text-lg font-bold text-gray-900">מחשבון מיסי ייבוא</h1>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">M1 פרטי</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── INPUTS ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 mb-4 text-base">פרטי הרכב</h2>
            <div className="space-y-3">
              <NumInput label="מחיר הרכב (מטבע חוץ)" value={price} onChange={setPrice} prefix="$" />
              <NumInput label="שער חליפין ל-₪" value={rate} onChange={setRate} hint="שקלים לדולר (ברירת מחדל: 3.65)" />
              <NumInput label="עלות משלוח (מטבע חוץ)" value={shipping} onChange={setShipping} prefix="$" hint="עלות ה-shipping מחו״ל" />
              <NumInput label="עלות ביטוח (מטבע חוץ)" value={insurance} onChange={setInsurance} prefix="$" />
              <NumInput label="הוצאות מקומיות (₪)" value={local} onChange={setLocal} prefix="₪" hint="מכונאות, שחרור, בדיקות וכו'" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 mb-4 text-base">פרמטרי מיסוי</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">מכס לפי מדינת מקור</label>
                <div className="space-y-2">
                  {CUSTOMS_OPTIONS.map((opt, i) => (
                    <label key={i} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${customsIdx === i ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="customs" checked={customsIdx === i} onChange={() => setCustomsIdx(i)} className="accent-blue-600" />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">סוג מנוע</label>
                <div className="grid grid-cols-2 gap-2">
                  {ENGINE_TYPES.map((eng, i) => (
                    <label key={i} className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-colors ${engineIdx === i ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="engine" checked={engineIdx === i} onChange={() => setEngineIdx(i)} className="hidden" />
                      <span className="text-sm font-medium">{eng.label}</span>
                      <span className="text-xs text-gray-400">מס קנייה {eng.sublabel}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ציון ירוק (CO₂ g/km)
                  <span className="text-xs text-gray-400 mr-2">— מפחית ממס הקנייה</span>
                </label>
                <select
                  value={greenIdx}
                  onChange={e => setGreenIdx(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {GREEN_GROUPS.map((g, i) => (
                    <option key={i} value={i}>
                      קבוצה {g.group} ({g.co2} CO₂){g.discount > 0 ? ` — הנחה ${formatILS(g.discount)}` : ' — ללא הנחה'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── RESULTS ── */}
        <div className="space-y-4">
          {!result ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
              <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">הזן מחיר רכב כדי לראות חישוב</p>
            </div>
          ) : (
            <>
              {/* Summary card */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
                <p className="text-blue-200 text-sm mb-1">סה״כ עלות ייבוא</p>
                <p className="text-4xl font-black mb-4">{formatILS(result.totalCost)}</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white/10 rounded-xl p-2.5">
                    <p className="text-xs text-blue-200">מכס</p>
                    <p className="font-bold text-sm">{formatILS(result.customsFee)}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-2.5">
                    <p className="text-xs text-blue-200">מס קנייה</p>
                    <p className="font-bold text-sm">{formatILS(result.purchaseTax)}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-2.5">
                    <p className="text-xs text-blue-200">מע״מ</p>
                    <p className="font-bold text-sm">{formatILS(result.vatAmount)}</p>
                  </div>
                </div>
                <div className="mt-3 bg-white/10 rounded-xl p-2.5 text-center">
                  <span className="text-blue-200 text-xs">סה״כ מיסים: </span>
                  <span className="font-bold">{formatILS(result.totalTaxes)}</span>
                  <span className="text-blue-200 text-xs mr-2">({result.taxPercent.toFixed(1)}% ממחיר הרכב)</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-bold text-gray-800 mb-3 text-base">פירוט חישוב</h2>
                <div className="space-y-0">
                  <Row label="מחיר רכב (₪)" value={formatILS(result.vehiclePriceILS)} />
                  {result.shippingCostILS > 0 && <Row label="משלוח (₪)" value={formatILS(result.shippingCostILS)} />}
                  {result.insuranceCostILS > 0 && <Row label="ביטוח (₪)" value={formatILS(result.insuranceCostILS)} />}
                  <Row label="שווי CIF (₪)" value={formatILS(result.cifValue)} bold />
                  <Row
                    label={`מכס (${(CUSTOMS_OPTIONS[customsIdx].value * 100).toFixed(1)}%)`}
                    value={formatILS(result.customsFee)}
                  />
                  {parseFloat(local) > 0 && (
                    <Row label="הוצאות מקומיות" value={formatILS(parseFloat(local))} />
                  )}
                  <Row label="בסיס מס קנייה" value={formatILS(result.purchaseTaxBase)} bold />
                  <Row
                    label={`מס קנייה (${(ENGINE_TYPES[engineIdx].value * 100).toFixed(0)}%)`}
                    value={formatILS(result.purchaseTaxBeforeDiscount)}
                  />
                  {GREEN_GROUPS[greenIdx].discount > 0 && (
                    <Row
                      label={`הנחה ירוקה קבוצה ${GREEN_GROUPS[greenIdx].group}`}
                      value={`-${formatILS(GREEN_GROUPS[greenIdx].discount)}`}
                    />
                  )}
                  <Row label="מס קנייה לאחר הנחה" value={formatILS(result.purchaseTax)} bold />
                  <Row label={`מע״מ 18%`} value={formatILS(result.vatAmount)} bold />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  החישוב מבוסס על נוסחאות רשות המסים לרכב M1 פרטי. אינו כולל מס יוקרה, אגרות נמל, ריב״ח, ועלויות רישוי. לאישור סופי פנה לסוכן המכס שלך.
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
