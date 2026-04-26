'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Vehicle, STATUSES } from '@/lib/types';
import { Save, Trash2, ArrowRight, ScanLine, Loader2, CheckCircle2 } from 'lucide-react';
import { DOC_CHECKLIST } from '@/lib/types';

type FormData = Omit<Vehicle, 'id' | 'created_at'>;

interface Props {
  initial?: Partial<FormData>;
  vehicleId?: number;
}

const empty: FormData = {
  make: '', model: '', status: 'בנמל מקור',
  license_type: undefined,
  vin: '', year: undefined, manufacture_month: undefined, manufacture_year: undefined,
  color: '', dealer_name: '', dealer_country: '', purchase_price: undefined,
  purchase_date: '', bl_number: '', bl_tracking_url: '',
  import_license: '', import_license_expiry: '', assigned_to: '',
  shipping_company: '', vessel_name: '', container_number: '',
  port_of_loading: '', port_of_discharge: '', carrier_booking_no: '', release_agent: '',
  notes: '', eta: '',
};

const SHIPPING_COMPANIES = ['ZIM', 'MSC', 'Maersk', 'CMA CGM', 'Evergreen', 'COSCO', 'ONE', 'Yang Ming', 'אחר'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";

export default function VehicleForm({ initial, vehicleId }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...empty, ...initial });
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [error, setError] = useState('');
  const [scannedFiles, setScannedFiles] = useState<Array<{ file: File; docType: string; label: string }>>([]);
  const [dupVehicle, setDupVehicle] = useState<{ id: number; make: string; model: string; year?: number; status: string } | null>(null);

  const set = (k: keyof FormData, v: string | number | undefined) =>
    setForm(f => ({ ...f, [k]: v }));

  async function checkDuplicateVin(vin: string) {
    if (!vin || vin.length !== 17) { setDupVehicle(null); return; }
    // Skip check when editing an existing vehicle with the same VIN
    if (vehicleId) { setDupVehicle(null); return; }
    const res = await fetch(`/api/vehicles?vin=${encodeURIComponent(vin)}`);
    if (res.ok) {
      const match = await res.json();
      setDupVehicle(match);
    }
  }

  async function uploadDocuments(vid: number) {
    const STATUS_TRIGGERS: Record<string, string> = {
      bl: 'בים', delivery_order: 'הגיע לארץ',
      customs_release: 'הגיע לארץ', noise_test: 'הגיע לארץ',
      inspection: 'הגיע לארץ', mandatory_ins: 'הגיע לארץ',
    };
    let finalStatus = '';
    for (const { file, docType } of scannedFiles) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', docType);
      await fetch(`/api/vehicles/${vid}/documents`, { method: 'POST', body: fd });
      if (STATUS_TRIGGERS[docType]) finalStatus = STATUS_TRIGGERS[docType];
    }
    if (finalStatus) {
      await fetch(`/api/vehicles/${vid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _statusOnly: true, status: finalStatus }),
      });
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.make || !form.model) { setError('יצרן ודגם הם שדות חובה'); return; }
    setSaving(true);
    setError('');
    const url = vehicleId ? `/api/vehicles/${vehicleId}` : '/api/vehicles';
    const method = vehicleId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) {
      const saved = await res.json();
      const vid = vehicleId || saved.id;
      if (scannedFiles.length > 0) await uploadDocuments(vid);
      router.push('/');
      router.refresh();
    } else {
      setError('שגיאה בשמירה. נסה שוב.');
      setSaving(false);
    }
  }

  async function scanDocument(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanMsg('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/parse-document', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setScanMsg(data.error || 'שגיאה בניתוח המסמך'); return; }
      const { _doc_type, ...fields } = data;
      const count = Object.keys(fields).length;
      if (count === 0) { setScanMsg('לא זוהו נתונים — נסה תמונה ברורה יותר'); return; }
      setForm(f => ({ ...f, ...fields }));
      if (fields.vin) await checkDuplicateVin(fields.vin as string);
      const docType = _doc_type || 'other';
      const docLabel = DOC_CHECKLIST.find(d => d.type === docType)?.label || file.name;
      setScannedFiles(prev => {
        const filtered = prev.filter(f => f.docType !== docType);
        return [...filtered, { file, docType, label: docLabel }];
      });
      setScanMsg(`✓ ${docLabel} — זוהו ${count} שדות`);
    } catch (err) {
      console.error(err);
      setScanMsg('שגיאת רשת — בדוק את הקונסול');
    } finally {
      setScanning(false);
      e.target.value = '';
    }
  }

  async function deleteVehicle() {
    if (!vehicleId || !confirm('למחוק את הרכב לצמיתות?')) return;
    await fetch(`/api/vehicles/${vehicleId}`, { method: 'DELETE' });
    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-800">סרוק מסמך אוטומטי</p>
          <p className="text-xs text-blue-600 mt-0.5">שטר מטען, רשיון ייבוא, מדבקת דלת/חלון — Claude יזין את הנתונים לבד</p>
          {scanMsg && <p className="text-xs mt-1 font-medium text-blue-700">{scanMsg}</p>}
          {scannedFiles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {scannedFiles.map(({ docType, label }) => (
                <span key={docType} className="flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> {label}
                </span>
              ))}
            </div>
          )}
        </div>
        <label className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-colors ${scanning ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
          {scanning ? 'סורק...' : 'סרוק מסמך'}
          <input type="file" accept="image/*,.pdf,application/pdf" className="hidden" disabled={scanning} onChange={scanDocument} />
        </label>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">פרטי הרכב</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="יצרן *">
            <input required className={inputCls} value={form.make} onChange={e => set('make', e.target.value)} placeholder="Toyota, BMW..." />
          </Field>
          <Field label="דגם *">
            <input required className={inputCls} value={form.model} onChange={e => set('model', e.target.value)} placeholder="Camry, X5..." />
          </Field>
          <Field label="חודש ייצור">
            <select className={inputCls} value={form.manufacture_month ?? ''} onChange={e => set('manufacture_month', e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">בחר חודש</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </Field>
          <Field label="שנת ייצור">
            <input type="number" className={inputCls} value={form.manufacture_year ?? ''} onChange={e => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              set('manufacture_year', val);
              set('year', val);
            }} placeholder="2025" />
          </Field>
          <Field label="צבע">
            <input className={inputCls} value={form.color ?? ''} onChange={e => set('color', e.target.value)} placeholder="לבן, שחור..." />
          </Field>
          <Field label="מספר שלדה (VIN)">
            <input className={`${inputCls} font-mono`} value={form.vin ?? ''} onChange={e => set('vin', e.target.value)} onBlur={e => checkDuplicateVin(e.target.value)} placeholder="1HGBH41JXMN109186" />
          </Field>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">פרטי קנייה</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="שם דילר">
            <input className={inputCls} value={form.dealer_name ?? ''} onChange={e => set('dealer_name', e.target.value)} placeholder="שם הדילר" />
          </Field>
          <Field label="מדינת דילר">
            <input className={inputCls} value={form.dealer_country ?? ''} onChange={e => set('dealer_country', e.target.value)} placeholder="גרמניה, יפן..." />
          </Field>
          <Field label="מספר חשבונית">
            <input className={`${inputCls} font-mono`} value={form.invoice_number ?? ''} onChange={e => set('invoice_number', e.target.value)} placeholder="TF110563" />
          </Field>
          <Field label="מחיר קנייה">
            <input type="number" className={inputCls} value={form.purchase_price ?? ''} onChange={e => set('purchase_price', e.target.value ? Number(e.target.value) : undefined)} placeholder="0" />
          </Field>
          <Field label="מטבע">
            <select className={inputCls} value={form.purchase_currency ?? ''} onChange={e => set('purchase_currency', e.target.value)}>
              <option value="">בחר</option>
              {['CAD','USD','EUR','GBP','JPY','AUD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="תאריך קנייה">
            <input type="date" className={inputCls} value={form.purchase_date ?? ''} onChange={e => set('purchase_date', e.target.value)} />
          </Field>
          <Field label="שויך ל">
            <input className={inputCls} value={form.assigned_to ?? ''} onChange={e => set('assigned_to', e.target.value)} placeholder="שם לקוח / עצמי" />
          </Field>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">רשיונות ומסמכים</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="סטטוס">
            <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="סוג רשיון ייבוא *">
            <select required className={inputCls} value={form.license_type ?? ''} onChange={e => set('license_type', e.target.value || undefined)}>
              <option value="" disabled>בחר סוג רשיון</option>
              <option value="זעיר">זעיר</option>
              <option value="עקיף">עקיף</option>
            </select>
          </Field>
          <Field label="מספר רישיון ייבוא">
            <input className={inputCls} value={form.import_license ?? ''} onChange={e => set('import_license', e.target.value)} />
          </Field>
          <Field label="תוקף רישיון ייבוא">
            <input type="date" className={inputCls} value={form.import_license_expiry ?? ''} onChange={e => set('import_license_expiry', e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">פרטי משלוח וספינה</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="חברת ספנות">
            <select className={inputCls} value={form.shipping_company ?? ''} onChange={e => set('shipping_company', e.target.value)}>
              <option value="">בחר חברה</option>
              {SHIPPING_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="מספר שטר מטען (B/L)">
            <input className={`${inputCls} font-mono`} value={form.bl_number ?? ''} onChange={e => set('bl_number', e.target.value)} placeholder="MSCUX1234567" />
          </Field>
          <Field label="קישור מעקב B/L">
            <input type="url" className={inputCls} value={form.bl_tracking_url ?? ''} onChange={e => set('bl_tracking_url', e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="מספר קונטיינר">
            <input className={`${inputCls} font-mono`} value={form.container_number ?? ''} onChange={e => set('container_number', e.target.value)} placeholder="JXLU6374163" />
          </Field>
          <Field label="שם הספינה / מסע">
            <input className={inputCls} value={form.vessel_name ?? ''} onChange={e => set('vessel_name', e.target.value)} placeholder="JAMAICA 124E" />
          </Field>
          <Field label="נמל יציאה">
            <input className={inputCls} value={form.port_of_loading ?? ''} onChange={e => set('port_of_loading', e.target.value)} placeholder="Savannah, Hamburg..." />
          </Field>
          <Field label="נמל יעד">
            <input className={inputCls} value={form.port_of_discharge ?? ''} onChange={e => set('port_of_discharge', e.target.value)} placeholder="אשדוד, חיפה..." />
          </Field>
          <Field label="מספר הזמנה (Booking)">
            <input className={`${inputCls} font-mono`} value={form.carrier_booking_no ?? ''} onChange={e => set('carrier_booking_no', e.target.value)} placeholder="ZIMUSAV9104314" />
          </Field>
          <Field label="סוכן שחרור">
            <input className={inputCls} value={form.release_agent ?? ''} onChange={e => set('release_agent', e.target.value)} placeholder="TANKO, שם הסוכן..." />
          </Field>
          <Field label="תאריך הגעה משוער (ETA)">
            <input type="date" className={inputCls} value={form.eta ?? ''} onChange={e => set('eta', e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">הערות</h2>
        <textarea
          className={`${inputCls} h-28 resize-none`}
          value={form.notes ?? ''}
          onChange={e => set('notes', e.target.value)}
          placeholder="הערות נוספות על הרכב..."
        />
      </section>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      {dupVehicle && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
          <span className="text-red-500 text-xl flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="text-red-800 font-bold text-sm">רכב עם שלדה זו כבר קיים במערכת!</p>
            <p className="text-red-600 text-sm mt-0.5">
              {dupVehicle.make} {dupVehicle.model}{dupVehicle.year ? ` ${dupVehicle.year}` : ''} — סטטוס: {dupVehicle.status}
            </p>
            <a href={`/vehicles/${dupVehicle.id}`} target="_blank" rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-red-700 underline font-semibold">
              לחץ לצפייה ברכב הקיים ←
            </a>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm"
        >
          <ArrowRight className="w-4 h-4" /> חזור
        </button>
        <div className="flex items-center gap-3">
          {vehicleId && (
            <button
              type="button"
              onClick={deleteVehicle}
              className="flex items-center gap-2 text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-4 py-2 rounded-lg text-sm"
            >
              <Trash2 className="w-4 h-4" /> מחק רכב
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'שומר...' : vehicleId
              ? `עדכן רכב${scannedFiles.length > 0 ? ` + ${scannedFiles.length} מסמכים` : ''}`
              : `הוסף רכב${scannedFiles.length > 0 ? ` + ${scannedFiles.length} מסמכים` : ''}`}
          </button>
        </div>
      </div>
    </form>
  );
}
