import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { VehicleDocument } from '@/lib/types';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function GET(_req: Request, ctx: RouteContext<'/api/vehicles/[id]/documents'>) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    const docs = db.prepare('SELECT * FROM documents WHERE vehicle_id = ? ORDER BY uploaded_at DESC').all(id) as VehicleDocument[];
    return NextResponse.json(docs);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'שגיאה' }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: RouteContext<'/api/vehicles/[id]/documents'>) {
  try {
    const { id } = await ctx.params;
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const doc_type = formData.get('doc_type') as string || 'other';
    const notes = formData.get('notes') as string || null;

    if (!file) return NextResponse.json({ error: 'לא נשלח קובץ' }, { status: 400 });

    const baseDir = process.env.DATABASE_PATH
      ? path.join(path.dirname(process.env.DATABASE_PATH), 'uploads')
      : path.join(process.cwd(), 'data', 'uploads');
    const uploadDir = path.join(baseDir, id);
    await mkdir(uploadDir, { recursive: true });

    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._\u0590-\u05FF-]/g, '_')}`;
    const filePath = path.join(uploadDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const relPath = process.env.DATABASE_PATH
      ? path.join(path.dirname(process.env.DATABASE_PATH), 'uploads', id, safeName)
      : path.join('data', 'uploads', id, safeName);

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO documents (vehicle_id, doc_type, file_name, file_path, file_size, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, doc_type, file.name, relPath, file.size, notes);

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(doc, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'שגיאה בהעלאה' }, { status: 500 });
  }
}
