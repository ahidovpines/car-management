import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Vehicle } from '@/lib/types';

export async function GET(_req: Request, ctx: RouteContext<'/api/vehicles/[id]'>) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as Vehicle | undefined;
    if (!vehicle) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 });
    return NextResponse.json(vehicle);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'שגיאה' }, { status: 500 });
  }
}

export async function PUT(request: Request, ctx: RouteContext<'/api/vehicles/[id]'>) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    const data = await request.json();

    if (data._statusOnly) {
      db.prepare('UPDATE vehicles SET status = ? WHERE id = ?').run(data.status, id);
      const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
      return NextResponse.json(vehicle);
    }

    if (data._mergeOnly) {
      // Only update fields that are explicitly provided (don't overwrite existing data)
      const { _mergeOnly, ...fields } = data;
      void _mergeOnly;
      const setClauses = Object.keys(fields).map(k => `${k} = @${k}`).join(', ');
      if (setClauses) {
        db.prepare(`UPDATE vehicles SET ${setClauses} WHERE id = @id`).run({ ...fields, id });
      }
      const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
      return NextResponse.json(vehicle);
    }

    db.prepare(`
      UPDATE vehicles SET
        vin = @vin, make = @make, model = @model, year = @year,
        manufacture_month = @manufacture_month, manufacture_year = @manufacture_year,
        color = @color, dealer_name = @dealer_name, dealer_country = @dealer_country,
        purchase_price = @purchase_price, purchase_date = @purchase_date,
        status = @status, license_type = @license_type,
        bl_number = @bl_number, bl_tracking_url = @bl_tracking_url,
        import_license = @import_license, import_license_expiry = @import_license_expiry,
        assigned_to = @assigned_to, shipping_company = @shipping_company,
        vessel_name = @vessel_name, container_number = @container_number,
        port_of_loading = @port_of_loading, port_of_discharge = @port_of_discharge,
        carrier_booking_no = @carrier_booking_no, release_agent = @release_agent,
        notes = @notes, eta = @eta,
        invoice_number = @invoice_number, purchase_currency = @purchase_currency,
        importer = @importer
      WHERE id = @id
    `).run({
      id,
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
      importer: data.importer || 'AP',
    });

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
    return NextResponse.json(vehicle);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'שגיאה בעדכון' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/vehicles/[id]'>) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'שגיאה במחיקה' }, { status: 500 });
  }
}
