import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const currency = searchParams.get('currency') || 'USD';

  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${currency}&to=ILS`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    const rate = data.rates?.ILS;
    if (!rate) throw new Error('no ILS rate');
    return NextResponse.json({ rate, date: data.date, currency });
  } catch {
    return NextResponse.json({ error: 'לא ניתן לטעון שער חליפין' }, { status: 500 });
  }
}
