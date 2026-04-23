import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { computeZionFromEpa, mpgToCo2Gpm, zionToGroup } from '@/lib/taxCalculator';

const EPA = 'https://www.fueleconomy.gov/ws/rest';

async function fetchEpa(path: string) {
  const res = await fetch(`${EPA}${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`EPA error ${res.status}`);
  return res.json();
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

      // Return cached result if available
      const cached = db.prepare(
        'SELECT co2gkm, green_group, zion_score, partial_zion, make, model, year FROM epa_co2 WHERE vehicle_id = ?'
      ).get(id) as { co2gkm: number; green_group: number; zion_score: number | null; partial_zion: number; make: string; model: string; year: number } | undefined;

      if (cached) {
        return NextResponse.json({
          co2gkm: cached.co2gkm,
          group: cached.green_group,
          zion: cached.zion_score,
          partial: !!cached.partial_zion,
          make: cached.make,
          model: cached.model,
          year: cached.year,
        });
      }

      // Fetch full vehicle data from EPA
      const data = await fetchEpa(`/vehicle/${id}`);

      // CO₂ tailpipe in g/mile (combined, from EPA)
      const co2Combined = parseFloat(data?.co2TailpipeGpm) || parseFloat(data?.co2) || 0;
      if (!co2Combined) return NextResponse.json({ error: 'אין נתוני CO₂' }, { status: 404 });

      // Derive city/highway CO₂ from MPG (more accurate than combined alone)
      const city08  = parseFloat(data?.city08)  || 0;
      const hwy08   = parseFloat(data?.highway08) || 0;
      const isDiesel = (data?.fuelType1 ?? '').toLowerCase().includes('diesel');
      const co2_city_gpm = city08 > 0 ? mpgToCo2Gpm(city08, isDiesel) : co2Combined;
      const co2_hwy_gpm  = hwy08  > 0 ? mpgToCo2Gpm(hwy08,  isDiesel) : co2Combined;

      // Determine hybrid status from EPA atvType field
      const atvType = (data?.atvType ?? '').toLowerCase();
      const isHybrid = atvType.includes('hybrid') || atvType.includes('phev') || atvType.includes('plug');

      // NOx, THC, CO, PM in g/mile — available only if EPA exposes them
      const noxCity = parseFloat(data?.noxCity)   || undefined;
      const noxHwy  = parseFloat(data?.noxHwy)    || undefined;
      const thcCity = parseFloat(data?.thcCity)   || undefined;
      const thcHwy  = parseFloat(data?.thcHwy)    || undefined;
      const coCity  = parseFloat(data?.coCity)    || undefined;
      const coHwy   = parseFloat(data?.coHwy)     || undefined;
      const pmCity  = parseFloat(data?.pmCity)    || undefined;
      const pmHwy   = parseFloat(data?.pmHwy)     || undefined;

      // Compute ציון ירוק (may be partial if pollutant data unavailable)
      const { score: zionScore, partial } = computeZionFromEpa({
        co2_city_gpm,
        co2_hwy_gpm,
        nox_city_gpm: noxCity,
        nox_hwy_gpm:  noxHwy,
        thc_city_gpm: thcCity,
        thc_hwy_gpm:  thcHwy,
        co_city_gpm:  coCity,
        co_hwy_gpm:   coHwy,
        pm_city_gpm:  pmCity,
        pm_hwy_gpm:   pmHwy,
        isHybrid,
      });

      const group = zionToGroup(zionScore);

      // co2gkm: adapted combined CO₂ in g/km (for display)
      const adaptFactor = isHybrid ? 1.374 : 1.481;
      const co2gkm = Math.round(adaptFactor * 0.62137 * (co2_city_gpm * 0.34 + co2_hwy_gpm * 0.66));

      db.prepare(
        'INSERT OR REPLACE INTO epa_co2 (vehicle_id, co2gkm, green_group, zion_score, partial_zion, make, model, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, co2gkm, group, zionScore, partial ? 1 : 0, data.make, data.model, data.year);

      return NextResponse.json({
        co2gkm,
        group,
        zion: zionScore,
        partial,
        make: data.make,
        model: data.model,
        year: data.year,
      });
    }

    return NextResponse.json({ error: 'פרמטר action חסר' }, { status: 400 });
  } catch (e) {
    console.error('[vehicle-lookup] action=%s error=%s', action, e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
