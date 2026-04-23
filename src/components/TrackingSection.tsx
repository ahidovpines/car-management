'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrackingResult } from '@/lib/tracking';
import { Ship, RefreshCw, MapPin, Clock, ExternalLink, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { getTrackingUrl } from '@/lib/types';

interface Props {
  vehicleId: number;
  shippingCompany?: string;
  containerNumber?: string;
  blNumber?: string;
  blTrackingUrl?: string;
}

export default function TrackingSection({ vehicleId, shippingCompany, containerNumber, blNumber, blTrackingUrl }: Props) {
  const [tracking, setTracking] = useState<TrackingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showEvents, setShowEvents] = useState(false);

  const fetchData = useCallback(async () => {
    if (!containerNumber) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/track`);
      const data = await res.json();
      if (!res.ok) setError(data.error || 'שגיאת מעקב');
      else { setTracking(data); setLastUpdated(new Date()); }
    } catch {
      setError('שגיאת רשת');
    } finally {
      setLoading(false);
    }
  }, [vehicleId, containerNumber]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!containerNumber && !blNumber && !blTrackingUrl && !shippingCompany) return null;

  const manualUrl = getTrackingUrl(shippingCompany, containerNumber) || blTrackingUrl;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <Ship className="w-4 h-4 text-sky-500" /> מעקב משלוח
        </h2>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-400 font-medium">
              עודכן {lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {containerNumber && (
            <button onClick={fetchData} disabled={loading}
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {manualUrl && (
            <a href={manualUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 font-semibold">
              <ExternalLink className="w-3 h-3" /> פתח באתר
            </a>
          )}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Info chips */}
        <div className="flex gap-2 flex-wrap">
          {containerNumber && (
            <div className="bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100 flex-1 min-w-[120px]">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">קונטיינר</p>
              <p className="font-mono text-sm font-bold text-gray-900">{containerNumber}</p>
            </div>
          )}
          {blNumber && (
            <div className="bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100 flex-1 min-w-[120px]">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">B/L</p>
              <p className="font-mono text-sm font-bold text-gray-900">{blNumber}</p>
            </div>
          )}
          {shippingCompany && (
            <div className="bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100 flex-1 min-w-[120px]">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">חברה</p>
              <p className="text-sm font-bold text-gray-900">{shippingCompany}</p>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> מושך נתוני מעקב...
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {tracking && !loading && (
          <div className="space-y-3">
            {tracking.completed && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> הקונטיינר הגיע ליעד הסופי
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {tracking.status && (
                <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100">
                  <p className="text-[11px] font-bold text-sky-500 uppercase tracking-wider mb-1">סטטוס</p>
                  <p className="text-sm font-bold text-sky-900">{tracking.status}</p>
                </div>
              )}
              {tracking.location && (
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                  <p className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> מיקום
                  </p>
                  <p className="text-sm font-bold text-blue-900">{tracking.location}</p>
                </div>
              )}
              {tracking.eta && (
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                  <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> ETA
                  </p>
                  <p className="text-sm font-bold text-emerald-900">{tracking.eta}</p>
                  <p className="text-[11px] text-emerald-500 mt-0.5">נשמר אוטומטית לרכב</p>
                </div>
              )}
              {tracking.vessel && (
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">ספינה</p>
                  <p className="text-sm font-bold text-gray-900">{tracking.vessel}</p>
                </div>
              )}
              {tracking.from && (
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">יציאה מ</p>
                  <p className="text-sm font-bold text-gray-900">{tracking.from}</p>
                  {tracking.departure && <p className="text-xs text-gray-400 mt-0.5">{tracking.departure}</p>}
                </div>
              )}
            </div>

            {tracking.events.length > 0 && (
              <div>
                <button onClick={() => setShowEvents(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-semibold py-1">
                  {showEvents ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  היסטוריית אירועים ({tracking.events.length})
                </button>
                {showEvents && (
                  <div className="mt-3 space-y-3 border-r-2 border-gray-100 pr-4">
                    {tracking.events.map((e, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -right-[17px] top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-300" />
                        <p className="text-xs text-gray-400 font-medium">{e.date}</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{e.description}</p>
                        {e.location && <p className="text-xs text-gray-400">{e.location}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
