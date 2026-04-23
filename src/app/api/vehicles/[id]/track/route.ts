import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Vehicle } from '@/lib/types';
import { fetchTracking, fetchTrackingMore, TrackingResult } from '@/lib/tracking';

export async function GET(_req: Request, ctx: RouteContext<'/api/vehicles/[id]/track'>) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as Vehicle | undefined;
    if (!vehicle) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 });

    const hasContainer = !!vehicle.container_number;
    const hasBl = !!vehicle.bl_number;

    if (!hasContainer && !hasBl) {
      return NextResponse.json({ error: 'אין מספר קונטיינר או B/L' }, { status: 400 });
    }

    let tracking: TrackingResult | null = null;
    let source = '';

    const isEmpty = (t: TrackingResult | null) =>
      !t || (!t.eta && t.events.length === 0);

    // 1. findteu by container number (primary)
    if (hasContainer) {
      tracking = await fetchTracking(vehicle.container_number!);
      if (tracking && !isEmpty(tracking)) source = 'findteu';
      else tracking = null;
    }

    // 2. findteu by B/L number (fallback)
    if (!tracking && hasBl) {
      tracking = await fetchTracking(vehicle.bl_number!);
      if (tracking && !isEmpty(tracking)) source = 'findteu-bl';
      else tracking = null;
    }

    // 3. TrackingMore by container number (last resort — requires TRACKINGMORE_API_KEY)
    if (!tracking && hasContainer) {
      const company = (vehicle.shipping_company ?? '').toLowerCase();
      const courierCode = company.includes('zim') ? 'zim'
        : company.includes('msc') ? 'msc'
        : company.includes('maersk') ? 'maersk'
        : company.includes('cma') ? 'cma-cgm'
        : 'zim';
      tracking = await fetchTrackingMore(vehicle.container_number!, courierCode);
      if (tracking) source = 'trackingmore';
    }

    if (!tracking) {
      return NextResponse.json({ error: 'לא נמצא מידע — findteu ו-TrackingMore לא החזירו תוצאות' }, { status: 404 });
    }

    // Auto-save ETA to vehicle if found
    if (tracking.eta_raw) {
      try {
        const isoDate = new Date(tracking.eta_raw).toISOString().split('T')[0];
        if (isoDate && isoDate !== vehicle.eta) {
          db.prepare('UPDATE vehicles SET eta = ? WHERE id = ?').run(isoDate, id);
        }
      } catch {}
    }

    return NextResponse.json({ ...tracking, source, updated_at: new Date().toISOString() });
  } catch (e) {
    console.error('track route error:', e);
    return NextResponse.json({ error: 'שגיאת מעקב' }, { status: 500 });
  }
}
