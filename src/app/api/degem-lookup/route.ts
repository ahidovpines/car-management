import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const RESOURCE_ID = '142afde2-6228-49f9-8a29-9b6c3a0cbe40';
const GOVIL_BASE  = 'https://data.gov.il/api/3/action';

export interface DegemRecord {
  tozeret_nm: string;
  kinuy_mishari: string;
  shnat_yitzur: number;
  madad_yarok: number | null;
  kvutzat_zihum: number | null;
  co2_wltp: number | null;
  nox_wltp: number | null;
  hc_wltp: number | null;
  pm_wltp: number | null;
  co_wltp: number | null;
}

function rowToRecord(r: Record<string, unknown>): DegemRecord {
  // Handles both data.gov.il (uppercase: CO2_WLTP) and SQLite cache (lowercase: co2_wltp)
  const n = (key: string, alt: string) => {
    const v = r[key] ?? r[alt];
    return v != null ? Number(v) : null;
  };
  return {
    tozeret_nm:    String(r.tozeret_nm   ?? ''),
    kinuy_mishari: String(r.kinuy_mishari ?? ''),
    shnat_yitzur:  Number(r.shnat_yitzur  ?? 0),
    madad_yarok:   r.madad_yarok   != null ? Number(r.madad_yarok)   : null,
    kvutzat_zihum: r.kvutzat_zihum != null ? Number(r.kvutzat_zihum) : null,
    co2_wltp: n('CO2_WLTP', 'co2_wltp'),
    nox_wltp: n('NOX_WLTP', 'nox_wltp'),
    hc_wltp:  n('HC_WLTP',  'hc_wltp'),
    pm_wltp:  n('PM_WLTP',  'pm_wltp'),
    co_wltp:  n('CO_WLTP',  'co_wltp'),
  };
}

async function fetchFromGovil(q: string, year?: number): Promise<DegemRecord[]> {
  const params = new URLSearchParams({
    resource_id: RESOURCE_ID,
    q,
    limit: '50',
    fields: 'tozeret_nm,kinuy_mishari,shnat_yitzur,madad_yarok,kvutzat_zihum,CO2_WLTP,NOX_WLTP,HC_WLTP,PM_WLTP,CO_WLTP',
  });
  if (year) params.set('filters', JSON.stringify({ shnat_yitzur: year }));

  const res = await fetch(`${GOVIL_BASE}/datastore_search?${params}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`data.gov.il error ${res.status}`);
  const data = await res.json();
  const records: Record<string, unknown>[] = data?.result?.records ?? [];
  return records.map(rowToRecord).filter(r => r.kinuy_mishari && r.madad_yarok != null);
}

function saveToCache(db: ReturnType<typeof getDb>, records: DegemRecord[]) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO degem_cache
      (tozeret_nm, kinuy_mishari, shnat_yitzur, madad_yarok, kvutzat_zihum,
       co2_wltp, nox_wltp, hc_wltp, pm_wltp, co_wltp, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const insertAll = db.transaction((list: DegemRecord[]) => {
    for (const r of list) {
      stmt.run(r.tozeret_nm, r.kinuy_mishari, r.shnat_yitzur, r.madad_yarok,
               r.kvutzat_zihum, r.co2_wltp, r.nox_wltp, r.hc_wltp, r.pm_wltp, r.co_wltp);
    }
  });
  insertAll(records);
}

function searchCache(db: ReturnType<typeof getDb>, q: string, year?: number): DegemRecord[] {
  const pattern = `%${q}%`;
  const rows = year
    ? db.prepare(`SELECT * FROM degem_cache WHERE kinuy_mishari LIKE ? AND shnat_yitzur = ? ORDER BY shnat_yitzur DESC LIMIT 50`).all(pattern, year)
    : db.prepare(`SELECT * FROM degem_cache WHERE kinuy_mishari LIKE ? ORDER BY shnat_yitzur DESC LIMIT 50`).all(pattern);
  return (rows as Record<string, unknown>[]).map(rowToRecord);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q    = (searchParams.get('q') ?? '').trim();
  const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;

  if (q.length < 2) {
    return NextResponse.json({ error: 'נדרשים לפחות 2 תווים' }, { status: 400 });
  }

  const db = getDb();

  // Ensure degem_cache table exists (guards against hot-reload with stale __dbMigrated flag)
  db.exec(`
    CREATE TABLE IF NOT EXISTS degem_cache (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      tozeret_nm   TEXT,
      kinuy_mishari TEXT NOT NULL,
      shnat_yitzur INTEGER NOT NULL,
      madad_yarok  INTEGER,
      kvutzat_zihum INTEGER,
      co2_wltp     REAL,
      nox_wltp     REAL,
      hc_wltp      REAL,
      pm_wltp      REAL,
      co_wltp      REAL,
      fetched_at   TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(kinuy_mishari, shnat_yitzur, tozeret_nm)
    );
    CREATE INDEX IF NOT EXISTS idx_degem_kinuy ON degem_cache(kinuy_mishari);
  `);

  try {
    // Try cache first
    const cached = searchCache(db, q, year);
    if (cached.length > 0) return NextResponse.json(cached);

    // Fetch from data.gov.il and cache
    const results = await fetchFromGovil(q, year);
    if (results.length > 0) saveToCache(db, results);
    return NextResponse.json(results);
  } catch (e) {
    console.error('[degem-lookup] error=%s', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
