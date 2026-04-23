'use client';

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Calculator, Info, RefreshCw, Search, CheckCircle2, Leaf } from 'lucide-react';
import {
  calculateImportTax,
  ENGINE_TYPES,
  GREEN_GROUPS,
  formatILS,
  zionToGroupIdx,
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

const CURRENCIES = ['USD', 'EUR', 'CAD'] as const;
type Currency = typeof CURRENCIES[number];

function greenGroupLabel(g: typeof GREEN_GROUPS[number]) {
  if (g.adjustment < 0) return `הנחה ${formatILS(Math.abs(g.adjustment))}`;
  if (g.adjustment > 0) return `תוספת ${formatILS(g.adjustment)}`;
  return 'ללא שינוי';
}

function CalculatorInner() {
  const searchParams = useSearchParams();
  const [price, setPrice] = useState(() => searchParams.get('price') || '');
  const [currency, setCurrency] = useState<Currency>(() => {
    const c = searchParams.get('currency');
    return (c && (CURRENCIES as readonly string[]).includes(c)) ? c as Currency : 'USD';
  });
  const [vehicleLabel] = useState(() => searchParams.get('label') || '');
  const [rate, setRate] = useState('');
  const [rateDate, setRateDate] = useState('');
  const [rateLoading, setRateLoading] = useState(false);
  const [shipping, setShipping] = useState('');
  const [local, setLocal] = useState('');
  const [consumerPrice, setConsumerPrice] = useState('');
  const [hasOrigin, setHasOrigin] = useState(false);
  const [engineIdx, setEngineIdx] = useState(0);
  const [greenIdx, setGreenIdx] = useState(12); // default: group 13 (ציון 211–220, zero adjustment)
  const [vehicleType, setVehicleType] = useState<'m1' | 'n2'>('m1');
  const [weightCategory, setWeightCategory] = useState<'under_3500' | 'between_3500_4500' | 'over_4500'>('under_3500');

  // Israeli degem lookup (data.gov.il — primary, accurate)
  type DegemResult = {
    tozeret_nm: string; kinuy_mishari: string; shnat_yitzur: number;
    madad_yarok: number | null; kvutzat_zihum: number | null;
    co2_wltp: number | null; nox_wltp: number | null;
  };
  const [degemQ, setDegemQ] = useState('');
  const [degemYear, setDegemYear] = useState('');
  const [degemResults, setDegemResults] = useState<DegemResult[]>([]);
  const [degemLoading, setDegemLoading] = useState(false);
  const [degemError, setDegemError] = useState<string | null>(null);
  const [degemSelected, setDegemSelected] = useState<DegemResult | null>(null);

  const searchDegem = useCallback(async (q: string, year: string) => {
    if (q.length < 2) return;
    setDegemLoading(true); setDegemError(null); setDegemResults([]);
    try {
      const params = new URLSearchParams({ q });
      if (year) params.set('year', year);
      const r = await fetch(`/api/degem-lookup?${params}`);
      const data = await r.json();
      if (Array.isArray(data)) {
        setDegemResults(data);
        if (data.length === 0) setDegemError('לא נמצאו תוצאות');
      } else {
        setDegemError(data?.error || 'שגיאה בחיפוש');
      }
    } catch (e) {
      setDegemError(String(e));
    } finally {
      setDegemLoading(false);
    }
  }, []);

  const applyDegemResult = useCallback((rec: DegemResult) => {
    setDegemSelected(rec);
    if (rec.madad_yarok != null) {
      setGreenIdx(zionToGroupIdx(rec.madad_yarok));
    } else if (rec.kvutzat_zihum != null) {
      setGreenIdx(rec.kvutzat_zihum - 1);
    }
  }, []);

  // EPA vehicle lookup (fallback for non-Israeli-registered models)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => currentYear - i);
  const [lookupYear, setLookupYear] = useState(String(currentYear));
  const [lookupMake, setLookupMake] = useState('');
  const [lookupModel, setLookupModel] = useState('');
  const [lookupOptionId, setLookupOptionId] = useState('');
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [lookupResult, setLookupResult] = useState<{ co2gkm: number; group: number; zion: number | null; partial: boolean } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const fetchMakes = useCallback(async (year: string) => {
    setMakes([]); setModels([]); setOptions([]); setLookupMake(''); setLookupModel(''); setLookupOptionId('');
    setLookupError(null);
    try {
      const r = await fetch(`/api/vehicle-lookup?action=makes&year=${year}`);
      const data = await r.json();
      if (Array.isArray(data)) {
        setMakes(data);
      } else {
        setLookupError(data?.error || `שגיאה ${r.status}`);
        setMakes([]);
      }
    } catch (e) {
      setLookupError(String(e));
      setMakes([]);
    }
  }, []);

  const fetchModels = useCallback(async (year: string, make: string) => {
    setModels([]); setOptions([]); setLookupModel(''); setLookupOptionId('');
    try {
      const r = await fetch(`/api/vehicle-lookup?action=models&year=${year}&make=${encodeURIComponent(make)}`);
      const data = await r.json();
      setModels(Array.isArray(data) ? data : []);
    } catch { setModels([]); }
  }, []);

  const fetchOptions = useCallback(async (year: string, make: string, model: string) => {
    setOptions([]); setLookupOptionId('');
    try {
      const r = await fetch(`/api/vehicle-lookup?action=options&year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
      const data = await r.json();
      setOptions(Array.isArray(data) ? data : []);
    } catch { setOptions([]); }
  }, []);

  const fetchCo2 = useCallback(async (id: string) => {
    setLookupLoading(true);
    try {
      const r = await fetch(`/api/vehicle-lookup?action=co2&id=${id}`);
      const data = await r.json();
      if (data.group) {
        setLookupResult({ co2gkm: data.co2gkm, group: data.group, zion: data.zion ?? null, partial: !!data.partial });
        setGreenIdx(data.zion != null ? zionToGroupIdx(data.zion) : data.group - 1);
      }
    } finally {
      setLookupLoading(false);
    }
  }, []);

  const fetchRate = useCallback(async (cur: Currency) => {
    setRateLoading(true);
    try {
      const res = await fetch(`/api/exchange-rate?currency=${cur}`);
      const data = await res.json();
      if (data.rate) {
        setRate(data.rate.toFixed(4));
        setRateDate(data.date);
      }
    } finally {
      setRateLoading(false);
    }
  }, []);

  useEffect(() => { fetchRate(currency); }, [currency, fetchRate]);
  useEffect(() => { fetchMakes(lookupYear); }, []);  // load makes on mount

  const result = useMemo(() => {
    const p = parseFloat(price) || 0;
    if (p === 0) return null;
    const cp = parseFloat(consumerPrice) || undefined;
    return calculateImportTax({
      vehiclePriceForeign: p,
      currencyRate: parseFloat(rate) || 3.65,
      shippingCostForeign: parseFloat(shipping) || 0,
      localExpensesILS: parseFloat(local) || 0,
      customsRate: vehicleType === 'n2' ? (hasOrigin ? 0 : 0.07) : (hasOrigin ? 0 : 0.07),
      purchaseTaxRate: vehicleType === 'n2'
        ? (weightCategory === 'under_3500' ? 0.83 : weightCategory === 'between_3500_4500' ? 0.72 : 0)
        : ENGINE_TYPES[engineIdx].value,
      greenAdjustment: vehicleType === 'n2' ? 0 : GREEN_GROUPS[greenIdx].adjustment,
      consumerPrice: vehicleType === 'm1' ? cp : undefined,
    });
  }, [price, rate, shipping, local, consumerPrice, hasOrigin, engineIdx, greenIdx, vehicleType, weightCategory]);

  const purchaseTaxRateLabel = vehicleType === 'n2'
    ? (weightCategory === 'under_3500' ? '83' : weightCategory === 'between_3500_4500' ? '72' : '0')
    : (ENGINE_TYPES[engineIdx].value * 100).toFixed(0);

  return (
    <div dir="rtl" className="min-h-screen bg-[#f0f2f7]">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowRight className="w-5 h-5 text-gray-500" />
          </Link>
          <Calculator className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">מחשבון מיסי ייבוא</h1>
            {vehicleLabel && <p className="text-xs text-blue-500 font-medium">{vehicleLabel}</p>}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── INPUTS ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 mb-4 text-base">פרטי הרכב</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מחיר הרכב</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number" min="0" value={price} onChange={e => setPrice(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl py-2.5 pr-3 pl-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value as Currency)}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  שער חליפין ל-₪
                  {rateDate && <span className="text-xs text-gray-400 mr-2">עודכן: {rateDate}</span>}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number" step="0.0001" value={rate} onChange={e => setRate(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl py-2.5 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => fetchRate(currency)}
                    disabled={rateLoading}
                    className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${rateLoading ? 'animate-spin' : ''}`} />
                    עדכן
                  </button>
                </div>
              </div>

              <NumInput label={`עלות משלוח (${currency})`} value={shipping} onChange={setShipping} prefix={currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'C$'} hint="עלות ה-shipping מחו״ל" />
              <NumInput label="הוצאות מקומיות (₪)" value={local} onChange={setLocal} prefix="₪" hint="מכונאות, שחרור, בדיקות וכו'" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 mb-4 text-base">פרמטרי מיסוי</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">סוג ייבוא</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex flex-col items-center gap-1 p-3 rounded-xl border cursor-pointer transition-colors ${vehicleType === 'm1' ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="vtype" checked={vehicleType === 'm1'} onChange={() => setVehicleType('m1')} className="hidden" />
                    <span className="text-sm font-bold">M1 פרטי</span>
                    <span className="text-xs text-gray-400">רכב נוסעים</span>
                  </label>
                  <label className={`flex flex-col items-center gap-1 p-3 rounded-xl border cursor-pointer transition-colors ${vehicleType === 'n2' ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="vtype" checked={vehicleType === 'n2'} onChange={() => setVehicleType('n2')} className="hidden" />
                    <span className="text-sm font-bold">N1/N2 מסחרי</span>
                    <span className="text-xs text-gray-400">טנדר / משאית</span>
                  </label>
                </div>
              </div>

              {vehicleType === 'm1' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">מכס</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`flex flex-col items-center gap-1 p-3 rounded-xl border cursor-pointer transition-colors ${!hasOrigin ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="origin" checked={!hasOrigin} onChange={() => setHasOrigin(false)} className="hidden" />
                      <span className="text-lg font-black text-gray-800">7%</span>
                      <span className="text-xs text-gray-500 text-center">אין הצהרת מקור</span>
                    </label>
                    <label className={`flex flex-col items-center gap-1 p-3 rounded-xl border cursor-pointer transition-colors ${hasOrigin ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="origin" checked={hasOrigin} onChange={() => setHasOrigin(true)} className="hidden" />
                      <span className="text-lg font-black text-green-700">0%</span>
                      <span className="text-xs text-gray-500 text-center">יש הצהרת מקור</span>
                    </label>
                  </div>
                </div>
              )}

              {vehicleType === 'n2' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">קטגוריית משקל הרכב</label>
                    <div className="space-y-2">
                      {[
                        { val: 'under_3500',        label: 'מתחת ל-3.5 טון',    sub: 'מס קנייה 83%' },
                        { val: 'between_3500_4500', label: 'בין 3.5 ל-4.5 טון', sub: 'מס קנייה 72%' },
                        { val: 'over_4500',          label: 'מעל 4.5 טון',        sub: 'מע״מ בלבד (ללא מס קנייה)' },
                      ].map(opt => (
                        <label key={opt.val} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${weightCategory === opt.val ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                          <input type="radio" name="weight" checked={weightCategory === opt.val} onChange={() => setWeightCategory(opt.val as typeof weightCategory)} className="hidden" />
                          <span className="text-sm font-medium">{opt.label}</span>
                          <span className={`text-xs font-semibold ${opt.val === 'over_4500' ? 'text-green-600' : 'text-blue-600'}`}>{opt.sub}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">מכס</label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={`flex flex-col items-center gap-1 p-3 rounded-xl border cursor-pointer transition-colors ${!hasOrigin ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input type="radio" name="origin_n2" checked={!hasOrigin} onChange={() => setHasOrigin(false)} className="hidden" />
                        <span className="text-lg font-black text-gray-800">7%</span>
                        <span className="text-xs text-gray-500 text-center">אין הצהרת מקור</span>
                      </label>
                      <label className={`flex flex-col items-center gap-1 p-3 rounded-xl border cursor-pointer transition-colors ${hasOrigin ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input type="radio" name="origin_n2" checked={hasOrigin} onChange={() => setHasOrigin(true)} className="hidden" />
                        <span className="text-lg font-black text-green-700">0%</span>
                        <span className="text-xs text-gray-500 text-center">יש הצהרת מקור</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {vehicleType === 'm1' && (
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
              )}

              {vehicleType === 'm1' && (
                <div className="space-y-3">
                  {/* ── Israeli degem lookup ── */}
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-green-800">
                      <Leaf className="w-4 h-4 text-green-600" />
                      חיפוש ציון ירוק — מאגר משרד התחבורה
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={degemQ}
                        onChange={e => setDegemQ(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && searchDegem(degemQ, degemYear)}
                        placeholder="שם מסחרי באנגלית (GLC 300, Camry...)"
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <input
                        type="number"
                        value={degemYear}
                        onChange={e => setDegemYear(e.target.value)}
                        placeholder="שנה"
                        className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <button
                        onClick={() => searchDegem(degemQ, degemYear)}
                        disabled={degemLoading || degemQ.length < 2}
                        className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-40"
                      >
                        <Search className="w-4 h-4" />
                        {degemLoading ? '...' : 'חפש'}
                      </button>
                    </div>

                    {degemError && <p className="text-xs text-red-600">{degemError}</p>}

                    {degemResults.length > 0 && !degemSelected && (
                      <div className="border border-green-200 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                        {degemResults.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => applyDegemResult(r)}
                            className="w-full text-right px-3 py-2 text-sm hover:bg-green-50 border-b border-gray-100 last:border-0 flex justify-between items-center"
                          >
                            <span className="text-gray-700 font-medium">{r.kinuy_mishari} {r.shnat_yitzur}</span>
                            <span className="text-xs text-gray-400">{r.tozeret_nm}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {degemSelected && (
                      <div className="flex items-start gap-2 bg-white border border-green-300 rounded-xl p-3">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-green-800">
                            {degemSelected.kinuy_mishari} {degemSelected.shnat_yitzur}
                          </p>
                          <p className="text-xs text-green-700">
                            ציון ירוק: <strong>{degemSelected.madad_yarok}</strong> — קבוצה {degemSelected.madad_yarok != null ? GREEN_GROUPS[zionToGroupIdx(degemSelected.madad_yarok)].label : degemSelected.kvutzat_zihum}
                            {degemSelected.co2_wltp && <span className="mr-2 text-gray-500">CO₂: {degemSelected.co2_wltp} g/km</span>}
                          </p>
                        </div>
                        <button onClick={() => { setDegemSelected(null); setDegemResults([]); setDegemQ(''); }}
                          className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                    )}
                  </div>

                  {/* ── EPA fallback lookup ── */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Search className="w-4 h-4 text-blue-500" />
                      חיפוש חלופי — EPA (רכב אמריקאי)
                    </label>
                    <div className="space-y-2">
                      <select value={lookupYear} onChange={e => { setLookupYear(e.target.value); fetchMakes(e.target.value); }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select value={lookupMake} disabled={makes.length === 0}
                        onChange={e => { setLookupMake(e.target.value); fetchModels(lookupYear, e.target.value); }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40">
                        <option value="">בחר יצרן...</option>
                        {makes.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select value={lookupModel} disabled={models.length === 0}
                        onChange={e => { setLookupModel(e.target.value); fetchOptions(lookupYear, lookupMake, e.target.value); }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40">
                        <option value="">בחר דגם...</option>
                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {options.length > 0 && (
                        <select value={lookupOptionId}
                          onChange={e => { setLookupOptionId(e.target.value); if (e.target.value) fetchCo2(e.target.value); }}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">בחר גרסה...</option>
                          {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                      )}
                      {lookupError && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{lookupError}</p>}
                    {lookupLoading && <p className="text-xs text-blue-500 text-center">טוען נתוני פליטות...</p>}
                      {lookupResult && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span className="text-sm text-green-800 font-medium">
                              {lookupResult.zion != null
                                ? <>ציון ירוק: <strong>{lookupResult.zion}</strong>{lookupResult.partial ? '*' : ''} — קבוצה {lookupResult.group}</>
                                : <>{lookupResult.co2gkm} g/km CO₂ — קבוצה {lookupResult.group}</>
                              }
                            </span>
                          </div>
                          {lookupResult.partial && (
                            <p className="text-xs text-amber-600 pr-6">
                              * ציון משוערך לפי CO₂ בלבד — נתוני NOx/HC/CO אינם זמינים ב-EPA. הציון האמיתי עשוי להיות גבוה יותר.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <button onClick={() => fetchMakes(lookupYear)}
                      className="mt-2 text-xs text-blue-500 hover:text-blue-700 underline">
                      {makes.length === 0 ? 'טען רשימת יצרנים' : `${makes.length} יצרנים נטענו`}
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      קבוצת מיסוי ירוק (ציון ירוק)
                    </label>
                    <select value={greenIdx} onChange={e => { setGreenIdx(Number(e.target.value)); setLookupResult(null); }}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {GREEN_GROUPS.map((g, i) => (
                        <option key={i} value={i}>
                          קבוצה {g.label} (ציון {g.score}) — {greenGroupLabel(g)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <NumInput
                    label="מחיר צרכני משוער (₪)"
                    value={consumerPrice}
                    onChange={setConsumerPrice}
                    prefix="₪"
                    hint="לחישוב מס יוקרה — רכב מעל ₪300,000"
                  />
                </div>
              )}
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

              {result.luxuryApplies && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-3">
                  <Info className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-700 leading-relaxed font-medium">
                    מס יוקרה חל ({(result.luxuryRate * 100).toFixed(1)}%) — מחיר צרכני מעל ₪300,000. תוספת: {formatILS(result.luxuryTax)}
                  </p>
                </div>
              )}

              {/* Breakdown */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-bold text-gray-800 mb-3 text-base">פירוט חישוב</h2>
                <div className="space-y-0">
                  <Row label="מחיר רכב (₪)" value={formatILS(result.vehiclePriceILS)} />
                  {result.shippingCostILS > 0 && <Row label="משלוח (₪)" value={formatILS(result.shippingCostILS)} />}
                  {parseFloat(local) > 0 && (
                    <Row label="הוצאות מקומיות (₪)" value={formatILS(parseFloat(local))} />
                  )}
                  <Row label="בסיס מכס (CIF + הוצאות)" value={formatILS(result.customsBase)} bold />
                  {result.customsFee > 0 && <Row label={`מכס (${hasOrigin ? '0' : '7'}%)`} value={formatILS(result.customsFee)} />}
                  <Row label="בסיס מס קנייה" value={formatILS(result.purchaseTaxBase)} bold />
                  {(vehicleType === 'm1' || (vehicleType === 'n2' && weightCategory !== 'over_4500')) && (
                    <>
                      <Row
                        label={`מס קנייה לפני ירוק (${purchaseTaxRateLabel}%)`}
                        value={formatILS(result.purchaseTaxBeforeAdjustment)}
                      />
                      {vehicleType === 'm1' && result.greenAdjustment !== 0 && (
                        <Row
                          label={`${result.greenAdjustment < 0 ? 'הנחה' : 'תוספת'} ירוקה — קבוצה ${GREEN_GROUPS[greenIdx].label} (ציון ${GREEN_GROUPS[greenIdx].score})`}
                          value={`${result.greenAdjustment < 0 ? '-' : '+'}${formatILS(Math.abs(result.greenAdjustment))}`}
                        />
                      )}
                      <Row label="מס קנייה לאחר ירוק" value={formatILS(result.purchaseTaxAfterGreen)} bold />
                      {result.luxuryApplies && (
                        <Row label={`מס יוקרה (${(result.luxuryRate * 100).toFixed(1)}% × בסיס מס קנייה)`} value={formatILS(result.luxuryTax)} />
                      )}
                      {result.luxuryApplies && (
                        <Row label="סה״כ מס קנייה" value={formatILS(result.purchaseTax)} bold />
                      )}
                    </>
                  )}
                  <Row label="מע״מ 18%" value={formatILS(result.vatAmount)} bold />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  החישוב מבוסס על נוסחאות רשות המסים. אינו כולל אגרות נמל, ריב״ח ועלויות רישוי. לאישור סופי פנה לסוכן המכס שלך.
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function CalculatorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f0f2f7] flex items-center justify-center text-gray-400">טוען...</div>}>
      <CalculatorInner />
    </Suspense>
  );
}
