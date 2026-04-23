import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'vehicles.db');

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (!global.__db) {
    global.__db = new Database(DB_PATH);
    global.__db.pragma('journal_mode = WAL');
    global.__db.pragma('foreign_keys = ON');
    initDb(global.__db);
  }
  return global.__db;
}

function initDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      doc_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vin TEXT,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER,
      manufacture_month INTEGER,
      manufacture_year INTEGER,
      color TEXT,
      dealer_name TEXT,
      dealer_country TEXT,
      purchase_price REAL,
      purchase_date TEXT,
      status TEXT DEFAULT 'יצא מהדילר',
      bl_number TEXT,
      bl_tracking_url TEXT,
      import_license TEXT,
      import_license_expiry TEXT,
      assigned_to TEXT,
      shipping_company TEXT,
      vessel_name TEXT,
      container_number TEXT,
      port_of_loading TEXT,
      port_of_discharge TEXT,
      carrier_booking_no TEXT,
      release_agent TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations for columns added after initial schema
  const cols = (db.prepare("PRAGMA table_info(vehicles)").all() as { name: string }[]).map(c => c.name);
  if (!cols.includes('invoice_number'))    db.exec("ALTER TABLE vehicles ADD COLUMN invoice_number TEXT");
  if (!cols.includes('purchase_currency')) db.exec("ALTER TABLE vehicles ADD COLUMN purchase_currency TEXT");
  if (!cols.includes('eta'))               db.exec("ALTER TABLE vehicles ADD COLUMN eta TEXT");
  if (!cols.includes('license_type'))      db.exec("ALTER TABLE vehicles ADD COLUMN license_type TEXT");
}
