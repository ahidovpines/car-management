import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Vehicle } from '@/lib/types';
import { fetchTracking } from '@/lib/tracking';

export async function GET(_req: Request, ctx: RouteContext<'/api/vehicles/[id]/track'>) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as Vehicle | undefined;
    if (!vehicle) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 });

    if (!vehicle.container_number) {
      return NextResponse.json({ error: 'אין מספר קונטיינר' }, { status: 400 });
    }

    const tracking = await fetchTracking(vehicle.container_number);
    if (!tracking) {
      return NextResponse.json({ error: 'לא נמצא מידע — בדוק שמספר הקונטיינר נכון' }, { status: 404 });
    }

    // Auto-save ETA to vehicle if found and not already set
    if (tracking.eta_raw) {
      try {
        const isoDate = new Date(tracking.eta_raw).toISOString().split('T')[0];
        if (isoDate && isoDate !== vehicle.eta) {
          db.prepare('UPDATE vehicles SET eta = ? WHERE id = ?').run(isoDate, id);
        }
      } catch {}
    }

    return NextResponse.json({ ...tracking, updated_at: new Date().toISOString() });
  } catch (e) {
    console.error('track route error:', e);
    return NextResponse.json({ error: 'שגיאת מעקב' }, { status: 500 });
  }
}
