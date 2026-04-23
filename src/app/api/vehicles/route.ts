import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Vehicle } from '@/lib/types';

export async function GET() {
  try {
    const db = getDb();
    const vehicles = db.prepare(`
      SELECT v.*,
        (SELECT COUNT(*) FROM documents d WHERE d.vehicle_id = v.id) as doc_count
      FROM vehicles v ORDER BY v.created_at DESC
    `).all() as (Vehicle & { doc_count: number })[];
    return NextResponse.json(vehicles);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'שגיאה בטעינת הרכבים' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const data = await request.json();

    const stmt = db.prepare(`
      INSERT INTO vehicles (
        vin, make, model, year, manufacture_month, manufacture_year,
        color, dealer_name, dealer_country, purchase_price, purchase_date,
        status, license_type, bl_number, bl_tracking_url, import_license, import_license_expiry,
        assigned_to, shipping_company, vessel_name, container_number,
        port_of_loading, port_of_discharge, carrier_booking_no, release_agent, notes, eta,
        invoice_number, purchase_currency
      ) VALUES (
        @vin, @make, @model, @year, @manufacture_month, @manufacture_year,
        @color, @dealer_name, @dealer_country, @purchase_price, @purchase_date,
        @status, @license_type, @bl_number, @bl_tracking_url, @import_license, @import_license_expiry,
        @assigned_to, @shipping_company, @vessel_name, @container_number,
        @port_of_loading, @port_of_discharge, @carrier_booking_no, @release_agent, @notes, @eta,
        @invoice_number, @purchase_currency
      )
    `);

    const result = stmt.run({
      vin: data.vin || null,
      make: data.make,
      model: data.model,
      year: data.year || null,
      manufacture_month: data.manufacture_month || null,
      manufacture_year: data.manufacture_year || null,
      color: data.color || null,
      dealer_name: data.dealer_name || null,
      dealer_country: data.dealer_country || null,
      purchase_price: data.purchase_price || null,
      purchase_date: data.purchase_date || null,
      status: data.status || 'בנמל מקור',
      license_type: data.license_type || null,
      bl_number: data.bl_number || null,
      bl_tracking_url: data.bl_tracking_url || null,
      import_license: data.import_license || null,
      import_license_expiry: data.import_license_expiry || null,
      assigned_to: data.assigned_to || null,
      shipping_company: data.shipping_company || null,
      vessel_name: data.vessel_name || null,
      container_number: data.container_number || null,
      port_of_loading: data.port_of_loading || null,
      port_of_discharge: data.port_of_discharge || null,
      carrier_booking_no: data.carrier_booking_no || null,
      release_agent: data.release_agent || null,
      notes: data.notes || null,
      eta: data.eta || null,
      invoice_number: data.invoice_number || null,
      purchase_currency: data.purchase_currency || null,
    });

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(vehicle, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'שגיאה בהוספת הרכב' }, { status: 500 });
  }
}
