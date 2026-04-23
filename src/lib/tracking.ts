export interface TrackingResult {
  status: string;
  location: string;
  eta?: string;
  eta_raw?: string;
  vessel?: string;
  from?: string;
  departure?: string;
  completed?: boolean;
  events: TrackingEvent[];
}

export interface TrackingEvent {
  date: string;
  location: string;
  description: string;
}

export async function fetchTracking(container: string): Promise<TrackingResult | null> {
  if (!container) return null;
  try {
    const apiKey = process.env.FINDTEU_API_KEY || '123456789';
    const res = await fetch(`https://api.findteu.com/container/${encodeURIComponent(container)}`, {
      method: 'POST',
      headers: {
        'X-Authorization-ApiKey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'use_webhook=false',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error('findteu error:', res.status, await res.text().catch(() => ''));
      return null;
    }

    const data = await res.json();
    return parseFindTEU(data);
  } catch (e) {
    console.error('findteu fetch error:', e);
    return null;
  }
}

// TrackingMore fallback — used when findteu has no data (e.g., ZIM B/L numbers)
export async function fetchTrackingMore(
  trackingNumber: string,
  courierCode = 'zim',
): Promise<TrackingResult | null> {
  const apiKey = process.env.TRACKINGMORE_API_KEY;
  if (!apiKey || !trackingNumber) return null;

  try {
    // Try to get existing tracking first; create it if not found
    const getRes = await fetch(
      `https://api.trackingmore.com/v4/trackings/${courierCode}/${encodeURIComponent(trackingNumber)}`,
      {
        headers: { 'Tracking-Api-Key': apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      },
    );

    let data: Record<string, unknown> | null = null;

    if (getRes.ok) {
      const json = await getRes.json() as Record<string, unknown>;
      data = (json?.data ?? json) as Record<string, unknown>;
    }

    // If not found (404 or empty), create the tracking entry first
    if (!data || getRes.status === 404) {
      const createRes = await fetch('https://api.trackingmore.com/v4/trackings/create', {
        method: 'POST',
        headers: {
          'Tracking-Api-Key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ tracking_number: trackingNumber, courier_code: courierCode }),
        signal: AbortSignal.timeout(15000),
      });

      if (!createRes.ok) {
        console.error('trackingmore create error:', createRes.status);
        return null;
      }
      const created = await createRes.json() as Record<string, unknown>;
      data = (created?.data ?? created) as Record<string, unknown>;
    }

    if (!data) return null;
    return parseTrackingMore(data);
  } catch (e) {
    console.error('trackingmore fetch error:', e);
    return null;
  }
}

function parseTrackingMore(d: Record<string, unknown>): TrackingResult | null {
  if (!d) return null;

  type TMEvent = {
    tracking_detail?: string;
    location?: string;
    tracking_time?: string;
  };

  const rawEvents = (d.origin_info as { trackinfo?: TMEvent[] })?.trackinfo ?? [];
  const events: TrackingEvent[] = rawEvents.map((e: TMEvent) => ({
    date: formatDate(e.tracking_time ?? ''),
    location: e.location ?? '',
    description: e.tracking_detail ?? '',
  })).filter((e: TrackingEvent) => e.description);

  const latest = rawEvents[0];
  const etaRaw = String(d.expected_delivery ?? d.estimated_delivery_date ?? '');

  return {
    status: String(d.latest_event ?? latest?.tracking_detail ?? d.tag ?? ''),
    location: String(d.latest_checkpoint_location ?? latest?.location ?? d.destination_country ?? ''),
    eta: etaRaw ? formatDate(etaRaw) : undefined,
    eta_raw: etaRaw || undefined,
    vessel: String(d.ship_name ?? d.vessel_name ?? ''),
    from: String(d.origin_country ?? ''),
    departure: undefined,
    completed: d.tag === 'Delivered',
    events: events.slice(0, 12),
  };
}

function parseFindTEU(raw: Record<string, unknown>): TrackingResult | null {
  // Response: { success, data: { pol, pod, container, events, ... } }
  const d = (raw?.data ?? raw) as Record<string, unknown>;
  if (!d) return null;

  const pod = d.pod as Record<string, unknown> | undefined;
  const pol = d.pol as Record<string, unknown> | undefined;
  const containerInfo = d.container as Record<string, unknown> | undefined;

  // ETA from pod.eta_date
  const etaRaw = String(pod?.eta_date ?? pod?.eta ?? d.eta ?? '');
  const etaFormatted = etaRaw ? formatDate(etaRaw) : undefined;

  // Parse events
  type RawEvent = {
    event_date?: string;
    location?: { port?: string; country?: string; terminal?: string };
    action?: { action_name?: string };
    mode?: { transport_mode?: string; vessel?: { vessel_name?: string } };
    event_type?: string;
    event_recent?: boolean;
  };

  const rawEvents = (d.events ?? []) as RawEvent[];
  const events: TrackingEvent[] = rawEvents.map(e => ({
    date: formatDate(e.event_date ?? ''),
    location: [e.location?.port, e.location?.country].filter(Boolean).join(', '),
    description: e.action?.action_name ?? '',
    vessel: e.mode?.vessel?.vessel_name ?? '',
    type: e.event_type ?? '',
  })).filter(e => e.description);

  // Most recent actual event, fall back to most recent expected event
  const actualEvents = rawEvents.filter(e => e.event_type === 'actual');
  const recentEvent = actualEvents[actualEvents.length - 1]
    ?? rawEvents.filter(e => e.event_type === 'expected')[0];
  const recentLocation = recentEvent?.location
    ? [recentEvent.location.port, recentEvent.location.country].filter(Boolean).join(', ')
    : '';
  const recentAction = recentEvent?.action?.action_name ?? '';

  // Active vessel — actual first, then expected
  const vesselEvent = [...rawEvents].reverse().find(e => e.mode?.vessel?.vessel_name && e.event_type === 'actual')
    ?? rawEvents.find(e => e.mode?.vessel?.vessel_name);
  const vessel = vesselEvent?.mode?.vessel?.vessel_name ?? '';

  return {
    status: recentAction,
    location: recentLocation || String(pod?.port ?? ''),
    eta: etaFormatted,
    eta_raw: etaRaw || undefined,
    vessel,
    from: String(pol?.port ?? d.origin ? (d.origin as Record<string,unknown>)?.port ?? '' : ''),
    departure: pol?.etd_date ? formatDate(String(pol.etd_date)) : undefined,
    completed: containerInfo?.completed === true,
    events: events.slice(0, 12),
  };
}

function formatDate(d: string): string {
  if (!d) return '';
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return d; }
}
