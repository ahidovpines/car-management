import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const EPA = 'https://www.fueleconomy.gov/ws/rest';

async function fetchEpa(path: string) {
  const res = await fetch(`${EPA}${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`EPA error ${res.status}`);
  return res.json();
}

function co2ToGreenGroup(gpm: number): number {
  const gkm = Math.round(gpm * 0.62137);
  if (gkm <= 50)  return 1;
  if (gkm <= 75)  return 2;
  if (gkm <= 90)  return 3;
  if (gkm <= 100) return 4;
  if (gkm <= 110) return 5;
  if (gkm <= 120) return 6;
  if (gkm <= 130) return 7;
  if (gkm <= 140) return 8;
  if (gkm <= 150) return 9;
  if (gkm <= 165) return 10;
  if (gkm <= 180) return 11;
  if (gkm <= 195) return 12;
  if (gkm <= 210) return 13;
  if (gkm <= 230) return 14;
  if (gkm <= 260) return 15;
  if (gkm <= 295) return 16;
  if (gkm <= 330) return 17;
  if (gkm <= 370) return 18;
  if (gkm <= 420) return 19;
  return 20;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const db = getDb();

  try {
    if (action === 'makes') {
      const year = Number(searchParams.get('year'));
      const cached = db.prepare('SELECT make FROM epa_makes WHERE year = ? ORDER BY make').all(year) as { make: string }[];
      if (cached.length > 0) return NextResponse.json(cached.map(r => r.make));

      const data = await fetchEpa(`/vehicle/menu/make?year=${year}`);
      const raw = data?.menuItem;
      const items: { value: string }[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const makes = items.map(i => i.value);

      const insert = db.prepare('INSERT OR IGNORE INTO epa_makes (year, make) VALUES (?, ?)');
      const insertAll = db.transaction((list: string[]) => { for (const m of list) insert.run(year, m); });
      insertAll(makes);

      return NextResponse.json(makes);
    }

    if (action === 'models') {
      const year = Number(searchParams.get('year'));
      const make = searchParams.get('make')!;
      const cached = db.prepare('SELECT model FROM epa_models WHERE year = ? AND make = ? ORDER BY model').all(year, make) as { model: string }[];
      if (cached.length > 0) return NextResponse.json(cached.map(r => r.model));

      const data = await fetchEpa(`/vehicle/menu/model?year=${year}&make=${encodeURIComponent(make)}`);
      const items = Array.isArray(data?.menuItem) ? data.menuItem : data?.menuItem ? [data.menuItem] : [];
      const models = items.map((i: { value: string }) => i.value);

      const insert = db.prepare('INSERT OR IGNORE INTO epa_models (year, make, model) VALUES (?, ?, ?)');
      const insertAll = db.transaction((list: string[]) => { for (const m of list) insert.run(year, make, m); });
      insertAll(models);

      return NextResponse.json(models);
    }

    if (action === 'options') {
      const year = Number(searchParams.get('year'));
      const make = searchParams.get('make')!;
      const model = searchParams.get('model')!;
      const cached = db.prepare('SELECT option_id, label FROM epa_options WHERE year = ? AND make = ? AND model = ?').all(year, make, model) as { option_id: string; label: string }[];
      if (cached.length > 0) return NextResponse.json(cached.map(r => ({ id: r.option_id, label: r.label })));

      const data = await fetchEpa(`/vehicle/menu/options?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
      const items = Array.isArray(data?.menuItem) ? data.menuItem : data?.menuItem ? [data.menuItem] : [];
      const options = items.map((i: { value: string; text: string }) => ({ id: i.value, label: i.text }));

      const insert = db.prepare('INSERT OR IGNORE INTO epa_options (option_id, year, make, model, label) VALUES (?, ?, ?, ?, ?)');
      const insertAll = db.transaction((list: { id: string; label: string }[]) => {
        for (const o of list) insert.run(o.id, year, make, model, o.label);
      });
      insertAll(options);

      return NextResponse.json(options);
    }

    if (action === 'co2') {
      const id = searchParams.get('id')!;
      const cached = db.prepare('SELECT co2gkm, green_group, make, model, year FROM epa_co2 WHERE vehicle_id = ?').get(id) as { co2gkm: number; green_group: number; make: string; model: string; year: number } | undefined;
      if (cached) return NextResponse.json({ co2gkm: cached.co2gkm, group: cached.green_group, make: cached.make, model: cached.model, year: cached.year });

      const data = await fetchEpa(`/vehicle/${id}`);
      const co2 = parseFloat(data?.co2TailpipeGpm);
      if (!co2 || isNaN(co2)) return NextResponse.json({ error: 'אין נתוני CO₂' }, { status: 404 });
      const co2gkm = Math.round(co2 * 0.62137);
      const group = co2ToGreenGroup(co2);

      db.prepare('INSERT OR IGNORE INTO epa_co2 (vehicle_id, co2gkm, green_group, make, model, year) VALUES (?, ?, ?, ?, ?, ?)').run(id, co2gkm, group, data.make, data.model, data.year);

      return NextResponse.json({ co2gkm, group, make: data.make, model: data.model, year: data.year });
    }

    return NextResponse.json({ error: 'פרמטר action חסר' }, { status: 400 });
  } catch (e) {
    console.error('[vehicle-lookup] action=%s error=%s', action, e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
