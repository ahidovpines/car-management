import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a vehicle import document parser. Extract structured data from images or PDFs of:
- Supplier invoices (e.g. Quebec Inc., US dealers) / חשבוניות ספק
- Bill of Lading (B/L) / שטר מטען
- Door stickers / מדבקת דלת
- Window stickers / מדבקת חלון
- Import licenses / רשיון ייבוא
- Certificate of Conformity (COC) / תעודת התאמה אירופאית

Return ONLY a valid JSON object with these fields (use null for missing values):
{
  "_doc_type": "invoice" | "bl" | "import_license" | "door_sticker" | "title" | "coc" | "other",
  "make": string | null,
  "model": string | null,
  "year": number | null,
  "vin": string | null,
  "manufacture_month": number | null,
  "manufacture_year": number | null,
  "color": string | null,
  "dealer_name": string | null,
  "dealer_country": string | null,
  "purchase_price": number | null,
  "purchase_currency": string | null,
  "purchase_date": string | null,
  "invoice_number": string | null,
  "shipping_company": string | null,
  "vessel_name": string | null,
  "container_number": string | null,
  "port_of_loading": string | null,
  "port_of_discharge": string | null,
  "carrier_booking_no": string | null,
  "release_agent": string | null,
  "bl_number": string | null,
  "import_license": string | null,
  "import_license_expiry": string | null
}

Rules for _doc_type:
- "invoice" if it's a supplier/dealer invoice with invoice number and price
- "bl" if it's a Bill of Lading / שטר מטען
- "import_license" if it's an Israeli import license (רשיון יבוא / מסלול יבוא)
- "door_sticker" if it's a vehicle door/VIN sticker with manufacture date MM/YY
- "title" if it's a vehicle title/ownership certificate
- "coc" if it's a European Certificate of Conformity (COC / Übereinstimmungsbescheinigung) — typically a multi-page German/EU document with fields like "Fahrzeug-Identifizierungsnummer" and "Datum der Herstellung"
- "other" for anything else

Other rules:
- For dates use ISO format YYYY-MM-DD.
- For manufacture_month return a number 1-12.
- For manufacture_year: 2-digit year "25" → 2025, "24" → 2024.
- manufacture_month and manufacture_year come ONLY from door/VIN stickers (format MM/YY) or COC documents. Never extract them from invoices — on invoices only extract "year" (model year).
- On door/VIN stickers the format is MM/YY — split into manufacture_month and manufacture_year.
- For COC documents (European Certificate of Conformity): vin = field 0.10 "Fahrzeug-Identifizierungsnummer" (17-char code). Manufacture date = "Datum der Herstellung des Fahrzeugs" — may appear as YYYY-MM-DD, DD.MM.YY, or DD.MM.YYYY. Parse it into manufacture_month (number) and manufacture_year (4-digit). Also extract make (field 0.1 Hersteller) and model (field 0.2/0.2.1).
- The VIN is the 17-character alphanumeric code (Serial #).
- For supplier invoices: dealer_name = company name at top (letters only, strip leading numbers and hyphens, e.g. "9113-9279 QUEBEC INC." → "QUEBEC INC."), invoice_number = Invoice #, purchase_price = total/subtotal amount as a number, purchase_currency = currency code (CAD/USD/EUR etc).
- For Israeli import licenses (רישיון יבוא / מסלול יבוא): import_license = מספר האישור (e.g. "1304260102"), import_license_expiry = סיום תוקף האישור in ISO format (e.g. "15/11/2026" → "2026-11-15"). Also extract vin (מספר שלדה), model (from שורות האישור description), dealer_name (שם ספק), manufacture_year (שנת ייצור), manufacture_month (חודש ייצור) from this document type only.
- For the vehicle model on invoices like "MERCEDES BENZ - CLE53": make = "Mercedes-Benz", model = "CLE53" (just the model code after the dash).
- port_of_discharge = Final Destination city (e.g. "ASHDOD").
- Look carefully at all text including small print and barcodes.
Return ONLY the JSON object, no explanation, no markdown.`;

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'לא נשלח קובץ' }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = SUPPORTED_IMAGE_TYPES.includes(file.type) ||
      /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);

    if (!isPdf && !isImage) {
      return NextResponse.json({ error: 'פורמט לא נתמך. השתמש בתמונה (JPG/PNG) או PDF' }, { status: 400 });
    }

    type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    type ContentBlock =
      | { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }
      | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
      | { type: 'text'; text: string };

    const imageMediaType: ImageMediaType =
      SUPPORTED_IMAGE_TYPES.includes(file.type) ? (file.type as ImageMediaType) : 'image/jpeg';

    const docBlock: ContentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: imageMediaType, data: base64 } };

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }] as Parameters<typeof client.messages.create>[0]['system'],
      messages: [{
        role: 'user',
        content: [
          docBlock,
          { type: 'text', text: 'Extract all vehicle and shipping data from this document. Return only the JSON.' },
        ] as ContentBlock[],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    console.log('Claude response:', text.substring(0, 200));

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON in response:', text);
      return NextResponse.json({ error: 'לא נמצאו נתונים במסמך', raw: text.substring(0, 100) }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== null && v !== '' && v !== undefined) clean[k] = v;
    }

    return NextResponse.json(clean);
  } catch (e) {
    console.error('parse-document error:', e);
    const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
    return NextResponse.json({ error: `שגיאה בניתוח המסמך: ${msg}` }, { status: 500 });
  }
}
