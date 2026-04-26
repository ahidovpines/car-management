'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Vehicle, STATUS_COLORS, STATUS_PROGRESS, PIPELINE_STATUSES, getTrackingUrl } from '@/lib/types';
import { calculateAlerts, getRegistrationDeadline, getDaysToRegistration } from '@/lib/alerts';
import Image from 'next/image';
import { ExternalLink, Edit, AlertTriangle, ChevronLeft, ChevronRight, Ship, Car, Check } from 'lucide-react';
import DocumentsSection from '@/components/DocumentsSection';
import TrackingSection from '@/components/TrackingSection';

const PIPELINE_SET = new Set<string>(PIPELINE_STATUSES);

const STEP_CONFIG = [
  {
    label: 'נמל מקור',
    activeCls: 'bg-blue-600 border-blue-600 ring-4 ring-blue-100 shadow-lg shadow-blue-100',
    doneCls: 'bg-blue-500 border-blue-500',
    lineFill: 'bg-blue-400',
    labelActive: 'text-blue-600',
  },
  {
    label: 'בים',
    activeCls: 'bg-sky-500 border-sky-500 ring-4 ring-sky-100 shadow-lg shadow-sky-100',
    doneCls: 'bg-sky-400 border-sky-400',
    lineFill: 'bg-sky-400',
    labelActive: 'text-sky-600',
  },
  {
    label: 'הגיע לארץ',
    activeCls: 'bg-amber-500 border-amber-500 ring-4 ring-amber-100 shadow-lg shadow-amber-100',
    doneCls: 'bg-amber-400 border-amber-400',
    lineFill: 'bg-amber-300',
    labelActive: 'text-amber-600',
  },
];

function PipelineStepper({ progress }: { progress: number }) {
  const circles = STEP_CONFIG.flatMap((step, i) => {
    const isActive = i + 1 === progress;
    const isDone = i + 1 < progress;
    const circle = (
      <div key={`circle-${i}`} className="flex flex-col items-center gap-2 flex-shrink-0">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
          ${isActive ? `${step.activeCls} text-white` :
            isDone   ? `${step.doneCls} text-white` :
            'bg-white border-gray-200 text-gray-400'}`}>
          {isDone ? <Check className="w-5 h-5" /> : <span>{i + 1}</span>}
        </div>
        <span className={`text-xs font-semibold text-center leading-tight ${
          isActive ? step.labelActive : isDone ? 'text-gray-700' : 'text-gray-400'}`}>
          {step.label}
        </span>
      </div>
    );
    if (i < STEP_CONFIG.length - 1) {
      const line = (
        <div key={`line-${i}`}
          className={`flex-1 h-0.5 mb-5 mx-1 rounded-full transition-all ${
            i + 1 < progress ? step.lineFill : 'bg-gray-200'}`} />
      );
      return [circle, line];
    }
    return [circle];
  });

  return (
    <div className="flex items-end w-full py-2">
      {circles}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900 text-left">{value}</span>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        {icon}
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/vehicles/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setVehicle(data);
        setLoading(false);
        if (data?.purchase_date && data?.purchase_currency && data.purchase_currency !== 'ILS') {
          fetch(`https://api.frankfurter.app/${data.purchase_date}?from=${data.purchase_currency}&to=ILS`)
            .then(r => r.ok ? r.json() : null)
            .then(fx => {
              if (fx?.rates?.ILS) setExchangeRate(`1 ${data.purchase_currency} = ${fx.rates.ILS.toFixed(3)} ₪ (${data.purchase_date})`);
            })
            .catch(() => {});
        }
      });
  }, [id]);

  async function recalcStatusFromDocs() {
    const STATUS_TRIGGERS: Record<string, string> = {
      bl: 'בים', delivery_order: 'הגיע לארץ',
      customs_release: 'הגיע לארץ', noise_test: 'הגיע לארץ',
      inspection: 'הגיע לארץ', mandatory_ins: 'הגיע לארץ',
    };
    const res = await fetch(`/api/vehicles/${id}/documents`);
    if (!res.ok) return;
    const docs: { doc_type: string }[] = await res.json();
    const STAGE_ORDER = ['bl', 'delivery_order', 'customs_release', 'noise_test', 'inspection', 'mandatory_ins'];
    let best = '';
    for (const stage of STAGE_ORDER) {
      if (docs.some(d => d.doc_type === stage)) best = STATUS_TRIGGERS[stage];
    }
    if (best && best !== vehicle?.status) {
      const r = await fetch(`/api/vehicles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _statusOnly: true, status: best }),
      });
      if (r.ok) setVehicle(await r.json());
    }
  }

  async function updateStatus(newStatus: string) {
    if (!vehicle) return;
    setUpdatingStatus(true);
    const res = await fetch(`/api/vehicles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...vehicle, status: newStatus }),
    });
    if (res.ok) setVehicle(await res.json());
    setUpdatingStatus(false);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">טוען...</div>;
  if (!vehicle) return <div className="min-h-screen flex items-center justify-center text-gray-400">רכב לא נמצא</div>;

  const alerts = calculateAlerts([vehicle]);
  const progress = STATUS_PROGRESS[vehicle.status] || 0;
  const inPipeline = PIPELINE_SET.has(vehicle.status);
  const pipelineIdx = PIPELINE_STATUSES.indexOf(vehicle.status as typeof PIPELINE_STATUSES[number]);
  const prevStage = inPipeline && pipelineIdx > 0 ? PIPELINE_STATUSES[pipelineIdx - 1] : null;
  const nextStage = inPipeline && pipelineIdx < PIPELINE_STATUSES.length - 1 ? PIPELINE_STATUSES[pipelineIdx + 1] : null;
  const regDeadline = getRegistrationDeadline(vehicle.manufacture_month, vehicle.manufacture_year);
  const daysReg = getDaysToRegistration(vehicle.manufacture_month, vehicle.manufacture_year);

  return (
    <div className="min-h-screen bg-[#f0f2f7]">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Image src="/logo.jpg" alt="A.P Trade Cars" width={90} height={36} className="object-contain" />
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900">{vehicle.make} {vehicle.model}</span>
          </div>
          <Link
            href={`/vehicles/${id}/edit`}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 text-sm font-semibold shadow-sm"
          >
            <Edit className="w-4 h-4" /> ערוך
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* Hero card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-2xl font-black text-gray-900">{vehicle.make} {vehicle.model}</h1>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {vehicle.year && <span className="text-gray-500 text-sm font-medium">{vehicle.year}</span>}
                  {vehicle.color && <span className="text-gray-500 text-sm">{vehicle.color}</span>}
                  {vehicle.vin && <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">{vehicle.vin}</span>}
                  {vehicle.license_type && (
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${vehicle.license_type === 'זעיר' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      רשיון {vehicle.license_type}
                    </span>
                  )}
                </div>
              </div>
              <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-bold ${STATUS_COLORS[vehicle.status] || 'bg-gray-100 text-gray-600'}`}>
                {vehicle.status}
              </span>
            </div>

            {/* Pipeline stepper */}
            {inPipeline && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">מסלול הרכב</span>
                  <span className="text-xs text-gray-400 font-medium">{progress} / {PIPELINE_STATUSES.length} שלבים</span>
                </div>
                <PipelineStepper progress={progress} />
              </div>
            )}

            {vehicle.status === 'הגיע' && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <span className="text-emerald-800 font-bold">הרכב הגיע בהצלחה</span>
              </div>
            )}

            {vehicle.status === 'שולם וממתין לניירת' && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <span className="text-2xl">📋</span>
                  <span className="text-amber-800 font-bold">שולם וממתין לניירת</span>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 px-6 py-3.5 bg-gray-50 border-t border-gray-100">
            {inPipeline && (
              <button onClick={recalcStatusFromDocs}
                className="text-xs text-purple-600 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-50 font-medium">
                ↻ עדכן לפי מסמכים
              </button>
            )}
            {inPipeline && <span className="text-sm text-gray-400 font-medium">עדכן שלב:</span>}
            {prevStage && (
              <button onClick={() => updateStatus(prevStage)} disabled={updatingStatus}
                className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-400 disabled:opacity-40 font-medium">
                <ChevronRight className="w-3 h-3" /> {prevStage}
              </button>
            )}
            {nextStage && (
              <button onClick={() => updateStatus(nextStage)} disabled={updatingStatus}
                className="flex items-center gap-1 text-xs text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 font-semibold">
                {nextStage} <ChevronLeft className="w-3 h-3" />
              </button>
            )}
            {inPipeline && (
              <button onClick={() => updateStatus('הגיע')} disabled={updatingStatus}
                className="flex items-center gap-1 text-xs text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40 font-semibold mr-auto">
                ✅ סמן כהגיע
              </button>
            )}
            {vehicle.status === 'שולם וממתין לניירת' && (
              <button onClick={() => updateStatus('יצא מהדילר')} disabled={updatingStatus}
                className="flex items-center gap-1 text-xs text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 font-semibold">
                העבר לרשימה הראשית <ChevronLeft className="w-3 h-3" />
              </button>
            )}
            {vehicle.status === 'הגיע' && (
              <button onClick={() => updateStatus('שוחרר')} disabled={updatingStatus}
                className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-400 disabled:opacity-40 font-medium">
                <ChevronRight className="w-3 h-3" /> החזר לשוחרר
              </button>
            )}
            {vehicle.status !== 'נמכר' && (
              <button onClick={() => updateStatus('נמכר')} disabled={updatingStatus}
                className="flex items-center gap-1 text-xs text-white bg-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-40 font-semibold mr-auto">
                🟣 סמן כנמכר
              </button>
            )}
            {vehicle.status === 'נמכר' && (
              <button onClick={() => updateStatus('הגיע')} disabled={updatingStatus}
                className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-400 disabled:opacity-40 font-medium">
                <ChevronRight className="w-3 h-3" /> בטל מכירה
              </button>
            )}
          </div>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className={`flex items-center gap-3 p-3.5 rounded-xl bg-white shadow-sm border border-gray-100 text-sm border-r-4 ${
                alert.severity === 'critical' ? 'border-r-red-500' :
                alert.severity === 'warning'  ? 'border-r-orange-400' : 'border-r-yellow-400'
              }`}>
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${
                  alert.severity === 'critical' ? 'text-red-500' :
                  alert.severity === 'warning'  ? 'text-orange-400' : 'text-yellow-500'}`} />
                <span className="text-gray-700 font-medium">{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          <SectionCard title="פרטי הרכב" icon={<Car className="w-4 h-4 text-blue-500" />}>
            <InfoRow label="יצרן" value={vehicle.make} />
            <InfoRow label="דגם" value={vehicle.model} />
            <InfoRow label="שנה" value={vehicle.year} />
            <InfoRow label="חודש/שנת ייצור" value={vehicle.manufacture_month && vehicle.manufacture_year ? `${vehicle.manufacture_month}/${vehicle.manufacture_year}` : undefined} />
            <InfoRow label="צבע" value={vehicle.color} />
            <InfoRow label="מספר שלדה" value={vehicle.vin} />
            <InfoRow label="סוג רשיון" value={vehicle.license_type} />
          </SectionCard>

          <SectionCard title="פרטי קנייה" icon={<span className="text-base">🛒</span>}>
            <InfoRow label="דילר" value={vehicle.dealer_name} />
            <InfoRow label="מדינה" value={vehicle.dealer_country} />
            <InfoRow label="מספר חשבונית" value={vehicle.invoice_number} />
            <InfoRow label="מחיר" value={vehicle.purchase_price ? `${vehicle.purchase_price.toLocaleString()} ${vehicle.purchase_currency || ''}`.trim() : undefined} />
            {exchangeRate && <InfoRow label="שער מטבע" value={exchangeRate} />}
            <InfoRow label="תאריך קנייה" value={vehicle.purchase_date} />
            <InfoRow label="שויך ל" value={vehicle.assigned_to} />
          </SectionCard>

          <SectionCard title="פרטי משלוח" icon={<Ship className="w-4 h-4 text-sky-500" />}>
            <InfoRow label="חברת ספנות" value={vehicle.shipping_company} />
            <InfoRow label="ספינה / מסע" value={vehicle.vessel_name} />
            <InfoRow label="מספר קונטיינר" value={vehicle.container_number} />
            <InfoRow label="נמל יציאה" value={vehicle.port_of_loading} />
            <InfoRow label="נמל יעד" value={vehicle.port_of_discharge} />
            <InfoRow label="מספר הזמנה" value={vehicle.carrier_booking_no} />
            <InfoRow label="סוכן שחרור" value={vehicle.release_agent} />
            <InfoRow label="מספר B/L" value={vehicle.bl_number} />
            <InfoRow label="רישיון ייבוא" value={vehicle.import_license} />
            <InfoRow label="תוקף רישיון ייבוא" value={vehicle.import_license_expiry} />
            <InfoRow label="צפי הגעה (ETA)" value={vehicle.eta ? vehicle.eta.split('-').reverse().join('/') : undefined} />
            {(() => {
              const trackUrl = getTrackingUrl(vehicle.shipping_company, vehicle.container_number);
              const displayUrl = trackUrl || vehicle.bl_tracking_url;
              if (!displayUrl) return null;
              return (
                <div className="mt-4">
                  <a href={displayUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 text-sm font-semibold shadow-sm">
                    <Ship className="w-4 h-4" />
                    עקוב אחרי הרכב — {vehicle.shipping_company || 'מעקב'}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              );
            })()}
          </SectionCard>

          <SectionCard title="מועדי רישום" icon={<span className="text-base">📅</span>}>
            {regDeadline ? (
              <>
                <InfoRow label="מועד רישום אחרון" value={regDeadline} />
                {daysReg !== null && (
                  <div className={`mt-4 text-center p-5 rounded-2xl ${
                    daysReg <= 0   ? 'bg-red-50 border border-red-200' :
                    daysReg <= 14  ? 'bg-red-50 border border-red-100' :
                    daysReg <= 30  ? 'bg-amber-50 border border-amber-100' :
                    'bg-emerald-50 border border-emerald-100'
                  }`}>
                    <div className={`text-5xl font-black leading-none ${
                      daysReg <= 0  ? 'text-red-600' :
                      daysReg <= 14 ? 'text-red-500' :
                      daysReg <= 30 ? 'text-amber-500' : 'text-emerald-600'
                    }`}>{Math.abs(daysReg)}</div>
                    <div className={`text-sm font-semibold mt-2 ${
                      daysReg <= 0  ? 'text-red-500' :
                      daysReg <= 14 ? 'text-red-400' :
                      daysReg <= 30 ? 'text-amber-500' : 'text-emerald-500'
                    }`}>{daysReg <= 0 ? 'ימים שעברו מהמועד' : 'ימים נותרו לרישום'}</div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 py-2">לא הוזן תאריך ייצור</p>
            )}
          </SectionCard>
        </div>

        <TrackingSection
          vehicleId={vehicle.id}
          shippingCompany={vehicle.shipping_company}
          containerNumber={vehicle.container_number}
          blNumber={vehicle.bl_number}
          blTrackingUrl={vehicle.bl_tracking_url}
        />

        <DocumentsSection
          vehicleId={vehicle.id}
          onStatusChange={(s) => setVehicle(v => v ? { ...v, status: s } : v)}
          onVehicleUpdate={(updated) => setVehicle(updated as unknown as Vehicle)}
        />

        {vehicle.notes && (
          <SectionCard title="הערות" icon={<span className="text-base">📝</span>}>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{vehicle.notes}</p>
          </SectionCard>
        )}
      </main>
    </div>
  );
}
