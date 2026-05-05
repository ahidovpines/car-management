import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { VehicleDocument } from '@/lib/types';
import { readFile, unlink } from 'fs/promises';
import path from 'path';

export async function GET(_req: Request, ctx: RouteContext<'/api/vehicles/[id]/documents/[docId]'>) {
  const { docId } = await ctx.params;
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as VehicleDocument | undefined;
  if (!doc) return NextResponse.json({ error: 'מסמך לא נמצא' }, { status: 404 });

  // file_path is absolute when stored on persistent volume, relative otherwise
  const absPath = path.isAbsolute(doc.file_path)
    ? doc.file_path
    : path.join(process.cwd(), doc.file_path);

  try {
    const data = await readFile(absPath);
    const ext = doc.file_name.split('.').pop()?.toLowerCase();
    const contentType = ext === 'pdf' ? 'application/pdf'
      : ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : ext === 'gif' ? 'image/gif'
      : 'image/jpeg';

    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
      },
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json(
        { error: 'הקובץ לא נמצא בשרת. ייתכן שהועלה מסביבה אחרת — יש להעלותו מחדש.' },
        { status: 404 }
      );
    }
    console.error(e);
    return NextResponse.json({ error: 'שגיאה בטעינת הקובץ' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/vehicles/[id]/documents/[docId]'>) {
  try {
    const { docId } = await ctx.params;
    const db = getDb();
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as VehicleDocument | undefined;
    if (!doc) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 });

    const absPath = path.isAbsolute(doc.file_path)
      ? doc.file_path
      : path.join(process.cwd(), doc.file_path);
    await unlink(absPath).catch(() => {});
    db.prepare('DELETE FROM documents WHERE id = ?').run(docId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'שגיאה במחיקה' }, { status: 500 });
  }
}
