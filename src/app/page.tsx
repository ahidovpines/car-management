'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Vehicle, STATUS_COLORS, STATUS_PROGRESS, STATUS_DOT, PIPELINE_STATUSES, getTrackingUrl } from '@/lib/types';
import { calculateAlerts, getDaysToRegistration } from '@/lib/alerts';
import Image from 'next/image';
import { AlertTriangle, Plus, Search, RefreshCw, Ship, ExternalLink, ChevronLeft, Car, ChevronDown, ChevronUp, Package, Truck, Clock, CheckCircle2, Calculator } from 'lucide-react';
import { Alert } from '@/lib/types';

function AlertsSection({ alerts }: { alerts: Alert[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? alerts : alerts.slice(0, 2);
  return (
    <div className="space-y-2">
      {visible.map((alert, i) => (
        <Link key={i} href={`/vehicles/${alert.vehicle_id}`}>
          <div className={`flex items-center gap-3 p-3.5 rounded-xl bg-white shadow-sm border border-gray-100 text-sm cursor-pointer hover:shadow-md transition-all border-r-4 ${
            alert.severity === 'critical' ? 'border-r-red-500' :
            alert.severity === 'warning'  ? 'border-r-orange-400' :
                                            'border-r-yellow-400'}`}>
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${
              alert.severity === 'critical' ? 'text-red-500' :
              alert.severity === 'warning'  ? 'text-orange-400' : 'text-yellow-500'
            }`} />
            <span className="font-semibold text-gray-900">{alert.vehicle_name}</span>
            <span className="text-gray-500">{alert.message}</span>
          </div>
        </Link>
      ))}
      {alerts.length > 2 && (
        <button onClick={() => setExpanded(v => !v)}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 px-1">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'הצג פחות' : `עוד ${alerts.length - 2} התראות`}
        </button>
      )}
    </div>
  );
}

const PIPELINE_SET = new Set<string>(PIPELINE_STATUSES);

type VehicleWithMeta = Vehicle & { doc_count?: number };

const STAGE_COLORS = ['bg-blue-500', 'bg-sky-400', 'bg-amber-400'];

function StageBar({ status }: { status: string }) {
  const progress = STATUS_PROGRESS[status] || 0;
  const total = PIPELINE_STATUSES.length;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-2 w-6 rounded-full transition-all ${i < progress ? STAGE_COLORS[i] : 'bg-gray-100'}`} />
      ))}
    </div>
  );
}

function VehicleRow({ v }: { v: VehicleWithMeta }) {
  const daysReg = getDaysToRegistration(v.manufacture_month, v.manufacture_year);
  const trackUrl = getTrackingUrl(v.shipping_company, v.container_number) || v.bl_tracking_url;

  return (
    <Link href={`/vehicles/${v.id}`} className="block hover:bg-blue-50/40 transition-colors cursor-pointer">
      {/* Mobile card */}
      <div className="md:hidden px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[v.status] || 'bg-gray-300'}`} />
          <div className="min-w-0">
            <div className="font-bold text-gray-900 text-sm truncate">{v.make} {v.model}</div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              {v.assigned_to && <span className="text-[11px] text-blue-500 font-medium">{v.assigned_to}</span>}
              {v.eta && <span className="text-[11px] text-gray-400">ETA: {v.eta.split('-').reverse().join('/')}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-600'}`}>
            {v.status}
          </span>
          <ChevronLeft className="w-4 h-4 text-gray-300" />
        </div>
      </div>

      {/* Desktop row */}
      <div className="hidden md:grid grid-cols-[2.2fr_1.4fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center group">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[v.status] || 'bg-gray-300'}`} />
            <span className="font-bold text-gray-900 text-[15px] truncate">{v.make} {v.model}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 pr-5 flex-wrap">
            {v.dealer_name && <span className="text-[12px] text-gray-400">{v.dealer_name}</span>}
            {v.assigned_to && <span className="text-[12px] text-blue-500 font-medium">· {v.assigned_to}</span>}
          </div>
          {(v.shipping_company || trackUrl) && (
            <div className="flex items-center gap-2 mt-0.5 pr-5">
              {v.shipping_company && <span className="flex items-center gap-1 text-[12px] text-gray-400"><Ship className="w-3 h-3" />{v.shipping_company}</span>}
              {trackUrl && <a href={trackUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[12px] text-blue-400 hover:text-blue-600 flex items-center gap-0.5"><ExternalLink className="w-3 h-3" />מעקב</a>}
            </div>
          )}
        </div>
        <div className="font-mono text-[12px] text-gray-600 tracking-wider truncate bg-gray-50 rounded-lg px-2.5 py-2 border border-gray-100">
          {v.vin || <span className="text-gray-300 font-sans">לא הוזן</span>}
        </div>
        <div>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-[12px] font-semibold ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-600'}`}>
            {v.status}
          </span>
        </div>
        <StageBar status={v.status} />
        <div className="text-sm text-center">
          {v.eta ? <span className="font-semibold text-blue-700">{v.eta.split('-').reverse().join('/')}</span> : <span className="text-gray-300">—</span>}
        </div>
        <div className="text-sm text-center">
          {daysReg !== null
            ? <span className={`font-semibold ${daysReg <= 0 ? 'text-red-600' : daysReg <= 14 ? 'text-red-500' : daysReg <= 30 ? 'text-orange-500' : 'text-gray-500'}`}>
                {daysReg <= 0 ? '⚠ עבר' : `${daysReg}י`}
              </span>
            : <span className="text-gray-300">—</span>}
        </div>
        <span className="flex items-center gap-1 text-sm text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          פתח <ChevronLeft className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}

function SectionTable({
  vehicles, title, headerColor, defaultOpen = true,
}: {
  vehicles: VehicleWithMeta[];
  title: string;
  headerColor: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (vehicles.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-5 py-3.5 border-b border-gray-100 ${headerColor} text-right`}
      >
        <span className="font-bold text-sm">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold opacity-70 bg-white/60 px-2.5 py-0.5 rounded-full">{vehicles.length} רכבים</span>
          {open ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
        </div>
      </button>
      {open && (
        <>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[2.2fr_1.4fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-2.5 bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <span>רכב</span><span>VIN</span><span>סטטוס</span>
                <span>שלב</span><span className="text-center">צפי הגעה</span><span className="text-center">רישום</span><span></span>
              </div>
              <div className="divide-y divide-gray-50">
                {vehicles.map(v => <VehicleRow key={v.id} v={v} />)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type LicenseTab = 'הכל' | 'זעיר' | 'עקיף';

export default function Dashboard() {
  const [vehicles, setVehicles] = useState<VehicleWithMeta[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [licenseTab, setLicenseTab] = useState<LicenseTab>('הכל');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/vehicles').then(r => r.json()).then(data => { setVehicles(data); setLoading(false); });
  }, []);

  const syncAll = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/sync-all', { method: 'POST' });
      const data = await res.json();
      const updatedCount = data.updated?.length ?? 0;
      setSyncResult(updatedCount > 0 ? `עודכנו ${updatedCount} רכבים` : 'אין עדכונים חדשים');
      load();
    } catch {
      setSyncResult('שגיאה בסנכרון');
    } finally {
      setSyncing(false);
    }
  }, [load]);

  useEffect(() => { load(); }, [load]);

  const alerts = calculateAlerts(vehicles);

  const q = search.toLowerCase();
  const matchSearch = (v: VehicleWithMeta) => !q ||
    `${v.make} ${v.model}`.toLowerCase().includes(q) ||
    (v.vin?.toLowerCase().includes(q)) ||
    (v.bl_number?.toLowerCase().includes(q)) ||
    (v.dealer_name?.toLowerCase().includes(q)) ||
    (v.assigned_to?.toLowerCase().includes(q));

  const waiting   = vehicles.filter(v => v.status === 'שולם וממתין לניירת' && matchSearch(v));
  const pipeline  = vehicles.filter(v => PIPELINE_SET.has(v.status));
  const zeir      = pipeline.filter(v => v.license_type === 'זעיר' && matchSearch(v));
  const akif      = pipeline.filter(v => v.license_type === 'עקיף' && matchSearch(v));
  const noLicense = pipeline.filter(v => !v.license_type && matchSearch(v));
  const arrived   = vehicles.filter(v => v.status === 'הגיע' && matchSearch(v));

  const pipelineZeirCount = pipeline.filter(v => v.license_type === 'זעיר').length;
  const pipelineAkifCount = pipeline.filter(v => v.license_type === 'עקיף').length;

  const stats = [
    { label: 'סה"כ פעיל',       value: vehicles.filter(v => v.status !== 'הגיע').length,                         color: 'text-gray-900',    iconBg: 'bg-gray-100',    Icon: Package,      iconColor: 'text-gray-600'   },
    { label: 'בדרך',             value: pipeline.length,                                                            color: 'text-blue-600',    iconBg: 'bg-blue-50',     Icon: Truck,        iconColor: 'text-blue-500'   },
    { label: 'ממתינים לניירת',   value: vehicles.filter(v => v.status === 'שולם וממתין לניירת').length,           color: 'text-amber-500',   iconBg: 'bg-amber-50',    Icon: Clock,        iconColor: 'text-amber-500'  },
    { label: 'הגיעו',            value: vehicles.filter(v => v.status === 'הגיע').length,                          color: 'text-emerald-600', iconBg: 'bg-emerald-50',  Icon: CheckCircle2, iconColor: 'text-emerald-500'},
  ];

  return (
    <div className="min-h-screen bg-[#f0f2f7]">
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Image src="/logo.jpg" alt="A.P Trade Cars" width={120} height={48} className="object-contain" />
          <div className="flex items-center gap-2">
            {syncResult && (
              <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">{syncResult}</span>
            )}
            <button onClick={syncAll} disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 shadow-sm">
              <Ship className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'מסנכרן...' : 'סנכרן הכל'}
            </button>
            <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link href="/calculator"
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-xl hover:bg-gray-50 text-sm font-medium shadow-sm">
              <Calculator className="w-4 h-4 text-blue-500" /> מחשבון
            </Link>
            <Link href="/vehicles/new"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 text-sm font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> הוסף רכב
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-5">

        {alerts.length > 0 && <AlertsSection alerts={alerts} />}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
                <s.Icon className={`w-6 h-6 ${s.iconColor}`} />
              </div>
              <div>
                <div className={`text-3xl font-black leading-none ${s.color}`}>{s.value}</div>
                <div className="text-sm text-gray-500 mt-1 font-medium">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search + License tabs */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            {(['הכל', 'זעיר', 'עקיף'] as LicenseTab[]).map(tab => (
              <button key={tab} onClick={() => setLicenseTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  licenseTab === tab
                    ? tab === 'זעיר' ? 'bg-blue-600 text-white shadow-sm'
                      : tab === 'עקיף' ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-gray-800 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                {tab === 'זעיר' ? `🔵 זעיר (${pipelineZeirCount})` :
                 tab === 'עקיף' ? `🟡 עקיף (${pipelineAkifCount})` : 'הכל'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="חיפוש לפי שם, VIN, B/L, דילר..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="pr-9 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white shadow-sm" />
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">טוען...</div>
        ) : (
          <>
            <SectionTable vehicles={waiting} title="📋 שולם וממתין לניירת" headerColor="bg-amber-50 text-amber-800" />

            {(licenseTab === 'הכל' || licenseTab === 'זעיר') && (
              <SectionTable
                vehicles={licenseTab === 'הכל' ? zeir : pipeline.filter(v => v.license_type === 'זעיר' && matchSearch(v))}
                title="🔵 בדרך — רשיון זעיר"
                headerColor="bg-blue-50 text-blue-800"
              />
            )}
            {(licenseTab === 'הכל' || licenseTab === 'עקיף') && (
              <SectionTable
                vehicles={licenseTab === 'הכל' ? akif : pipeline.filter(v => v.license_type === 'עקיף' && matchSearch(v))}
                title="🟡 בדרך — רשיון עקיף"
                headerColor="bg-amber-50 text-amber-800"
              />
            )}
            {licenseTab === 'הכל' && (
              <SectionTable vehicles={noLicense} title="⚫ בדרך — ללא רשיון" headerColor="bg-gray-50 text-gray-700" />
            )}

            {waiting.length === 0 && zeir.length === 0 && akif.length === 0 && noLicense.length === 0 && arrived.length === 0 && (
              <div className="py-20 text-center text-gray-400">
                <Car className="w-14 h-14 mx-auto mb-3 opacity-10" />
                <p className="text-sm">{vehicles.length === 0 ? 'אין רכבים. הוסף את הרכב הראשון!' : 'לא נמצאו רכבים'}</p>
              </div>
            )}

            <SectionTable vehicles={arrived} title="✅ הגיעו" headerColor="bg-emerald-50 text-emerald-800" defaultOpen={true} />
          </>
        )}
      </main>
    </div>
  );
}
