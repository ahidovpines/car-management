import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Vehicle } from '@/lib/types';
import { fetchTracking } from '@/lib/tracking';

const ISRAEL_PORTS = ['ashdod', 'haifa', 'israel'];

function guessStatusFromTracking(tracking: Awaited<ReturnType<typeof fetchTracking>>): string | null {
  if (!tracking) return null;

  const loc = tracking.location.toLowerCase();
  const status = tracking.status.toLowerCase();

  // NOTE: 'הגיע' (= picked up by us) is INTENTIONALLY never set automatically.
  // tracking.completed only means the carrier got the empty container back — it
  // does NOT mean we physically picked the vehicle up from port. The user
  // confirms that manually from the vehicle detail page.

  // Container reached Israel — discharged or empty returned counts.
  if (
    tracking.completed ||
    ISRAEL_PORTS.some(p => loc.includes(p)) ||
    status.includes('discharg') ||
    status.includes('arrived') ||
    status.includes('delivered') ||
    status.includes('empty returned')
  ) {
    return 'הגיע לארץ';
  }

  // Container is at sea (departed from origin)
  if (status.includes('departed') || status.includes('loaded on') || status.includes('on board')) {
    return 'בים';
  }

  // Container at origin port
  if (status.includes('gate in') || status.includes('gate out') || status.includes('received')) {
    return 'בנמל מקור';
  }

  return null;
}

export async function POST() {
  try {
    const db = getDb();
    const vehicles = db.prepare(
      // Skip vehicles already past port: 'הגיע' = user picked up, 'נמכר' = sold.
      // 'שולם וממתין לניירת' is pre-shipping so nothing to sync either.
      "SELECT * FROM vehicles WHERE container_number IS NOT NULL AND container_number != '' AND status NOT IN ('הגיע', 'נמכר', 'שולם וממתין לניירת')"
    ).all() as Vehicle[];

    const results: { id: number; make: string; model: string; updated: string[] }[] = [];

    for (const vehicle of vehicles) {
      const updated: string[] = [];
      try {
        const tracking = await fetchTracking(vehicle.container_number!);
        if (!tracking) continue;

        // Save ETA
        if (tracking.eta_raw) {
          try {
            const isoDate = new Date(tracking.eta_raw).toISOString().split('T')[0];
            if (isoDate && isoDate !== vehicle.eta) {
              db.prepare('UPDATE vehicles SET eta = ? WHERE id = ?').run(isoDate, vehicle.id);
              updated.push(`ETA: ${isoDate}`);
            }
          } catch {}
        }

        // Update status if tracking indicates a change
        const newStatus = guessStatusFromTracking(tracking);
        if (newStatus && newStatus !== vehicle.status) {
          db.prepare('UPDATE vehicles SET status = ? WHERE id = ?').run(newStatus, vehicle.id);
          updated.push(`סטטוס: ${vehicle.status} → ${newStatus}`);
        }

        if (updated.length > 0) {
          results.push({ id: vehicle.id, make: vehicle.make, model: vehicle.model, updated });
        }

        // Rate limit: 10 req / 10 sec
        await new Promise(r => setTimeout(r, 1100));
      } catch (e) {
        console.error(`sync error vehicle ${vehicle.id}:`, e);
      }
    }

    return NextResponse.json({ synced: vehicles.length, updated: results });
  } catch (e) {
    console.error('sync-all error:', e);
    return NextResponse.json({ error: 'שגיאה בסנכרון' }, { status: 500 });
  }
}
