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

General rules:
- For dates use ISO format YYYY-MM-DD.
- For manufacture_month return a number 1-12.
- For manufacture_year: 2-digit year → add 2000. Examples: "24" → 2024, "25" → 2025, "26" → 2026, "27" → 2027.
- The VIN is ALWAYS exactly 17 alphanumeric characters (never contains letters I, O, or Q). Read each character very carefully — do not guess or abbreviate. If you cannot confidently read all 17 characters, return null rather than a partial VIN.
- Look carefully at all text including small print and barcodes.

Bill of Lading (B/L) rules — extract ALL of the following:
- bl_number: the "BL NO." field (e.g. "MEDURS213714"). NOT the HBL ID or ORDER ID numbers.
- carrier_booking_no: the "BOOKING NO." field (e.g. "EBKG15925224").
- container_number: from "CONTAINER NO." or "CONT:" field — the alphanumeric container code (e.g. "MSNU9587692"). Strip any "CONT:" prefix.
- vessel_name: from "VESSEL / VOYAGE NO." field — include both vessel name and voyage (e.g. "MSC RESILIENT III CG614A").
- shipping_company: the actual shipping LINE (carrier), not the freight forwarder. Identify from: (1) the vessel name prefix (e.g. "MSC RESILIENT" → "MSC", "EVER" prefix → "Evergreen"), (2) "MASTER: MSC" in the signature block, or (3) the company name on the B/L header logo. Return ONLY one of these exact values: "ZIM", "MSC", "Maersk", "CMA CGM", "Evergreen", "COSCO", "ONE", "Yang Ming". If none match, return null.
- port_of_loading: from "PORT OF LOADING" field (e.g. "MONTREAL").
- port_of_discharge: the FINAL delivery city — use "PLACE OF DELIVERY" if present, otherwise "PORT OF DISCHARGE" (e.g. "ASHDOD").
- release_agent: from "NOTIFY PARTY" — company name only (e.g. "TANKO INTERNATIONAL (97) LTD").
- vin: 17-char vehicle identification number from goods description (e.g. "W1NKJ4HB4TF563677").
- make + model + year: from goods description (e.g. "2026 MERCEDES GLC300" → year=2026, make="Mercedes-Benz", model="GLC300").

Door/VIN sticker rules:
- manufacture_month and manufacture_year come ONLY from door/VIN stickers (format MM/YY) or COC documents. Never from invoices.
- On door/VIN stickers the format is MM/YY — split into manufacture_month (1-12) and manufacture_year (add 2000).
- VIN on door stickers appears on the LAST line, often after "GWVR/PNBV" label or below a barcode.

COC rules:
- vin = field 0.10 "Fahrzeug-Identifizierungsnummer" (17-char).
- Manufacture date = field labeled "Datum der Herstellung des Fahrzeugs" OR "Produktionsdatum des Fahrzeugs" (both mean production date). Parse as manufacture_month + manufacture_year.
- make = field 0.1, model = field 0.2.
- year = manufacture_year (or model year if stated separately).

Invoice rules:
- dealer_name = company name (strip leading numbers/hyphens, e.g. "9113-9279 QUEBEC INC." → "QUEBEC INC.").
- invoice_number = Invoice #, purchase_price = total amount as number, purchase_currency = currency code.
- For model like "MERCEDES BENZ - CLE53": make="Mercedes-Benz", model="CLE53".
- Only extract "year" (model year) from invoices — never manufacture_month/manufacture_year.

Import license rules (Israeli מסלול יבוא / רישיון יבוא):
- import_license = "מספר אישור" field value (e.g. "9401261041").
- import_license_expiry = "סיום תוקף אישור" field, converted to ISO format YYYY-MM-DD.
- manufacture_year = "שנת ייצור" field (4-digit year, e.g. 2025). THIS IS THE MOST IMPORTANT FIELD — always extract it.
- manufacture_month = "חודש ייצור" field (number 1-12, e.g. 10). THIS IS THE MOST IMPORTANT FIELD — always extract it.
- vin = "מספר שלדה" field (17-char VIN, e.g. "WUAZZZGY0TA905451").
- make + model = from "תיאור טובין" field (e.g. "AUDI RS3" → make="Audi", model="RS3").
- dealer_name = "שם ספק" field.
- dealer_country = "ארץ ייצור" or "ארץ קניה" field.
- year = same as manufacture_year.
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
      model: 'claude-sonnet-4-6',
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
