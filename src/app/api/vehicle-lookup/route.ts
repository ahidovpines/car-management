import { NextResponse } from 'next/server';

const EPA = 'https://www.fueleconomy.gov/ws/rest';

async function fetchEpa(path: string) {
  const res = await fetch(`${EPA}${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`EPA error ${res.status}`);
  return res.json();
}

// CO2 g/mile → g/km, then map to Israeli green group
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

  try {
    if (action === 'makes') {
      const year = searchParams.get('year');
      const data = await fetchEpa(`/vehicle/menu/make?year=${year}`);
      const items = Array.isArray(data?.menuItem) ? data.menuItem : data?.menuItem ? [data.menuItem] : [];
      return NextResponse.json(items.map((i: { value: string }) => i.value));
    }

    if (action === 'models') {
      const year = searchParams.get('year');
      const make = searchParams.get('make');
      const data = await fetchEpa(`/vehicle/menu/model?year=${year}&make=${encodeURIComponent(make!)}`);
      const items = Array.isArray(data?.menuItem) ? data.menuItem : data?.menuItem ? [data.menuItem] : [];
      return NextResponse.json(items.map((i: { value: string }) => i.value));
    }

    if (action === 'options') {
      const year = searchParams.get('year');
      const make = searchParams.get('make');
      const model = searchParams.get('model');
      const data = await fetchEpa(`/vehicle/menu/options?year=${year}&make=${encodeURIComponent(make!)}&model=${encodeURIComponent(model!)}`);
      const items = Array.isArray(data?.menuItem) ? data.menuItem : data?.menuItem ? [data.menuItem] : [];
      return NextResponse.json(items.map((i: { value: string; text: string }) => ({ id: i.value, label: i.text })));
    }

    if (action === 'co2') {
      const id = searchParams.get('id');
      const data = await fetchEpa(`/vehicle/${id}`);
      const co2 = parseFloat(data?.co2TailpipeGpm);
      if (!co2 || isNaN(co2)) return NextResponse.json({ error: 'אין נתוני CO₂' }, { status: 404 });
      const co2gkm = Math.round(co2 * 0.62137);
      const group = co2ToGreenGroup(co2);
      return NextResponse.json({ co2gkm, group, make: data.make, model: data.model, year: data.year });
    }

    return NextResponse.json({ error: 'פרמטר action חסר' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
