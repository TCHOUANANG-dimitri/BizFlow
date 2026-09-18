import * as SQLite from 'expo-sqlite';

export const DB_NAME = 'korah.db';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
  }
  return db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  base_quantity INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  purchase_price INTEGER NOT NULL DEFAULT 0,
  selling_price INTEGER NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  can_view_purchase_prices INTEGER NOT NULL DEFAULT 0,
  can_view_owner_dashboard INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sales (
  client_uuid TEXT PRIMARY KEY,
  server_id TEXT,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS money_movements (
  client_uuid TEXT PRIMARY KEY,
  server_id TEXT,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  sale_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  client_uuid TEXT PRIMARY KEY,
  server_id TEXT,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL,
  reason TEXT,
  sale_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_closings (
  client_uuid TEXT PRIMARY KEY,
  server_id TEXT,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  closing_date TEXT NOT NULL,
  expected_cash INTEGER NOT NULL,
  actual_cash INTEGER NOT NULL,
  difference INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  client_uuid TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

export function initDatabase(): void {
  getDb().execSync(SCHEMA);
  recomputeProductQuantities(getDb());
}

// Le stock de chaque produit est TOUJOURS recalculé à partir de la base
// (dernière quantité serveur connue) + l'ensemble des mouvements reçus, moins
// les ventes encore en file locale (optimiste, SYNC_DESIGN §4).
export function recomputeProductQuantities(d: SQLite.SQLiteDatabase): void {
  d.runSync(`
    UPDATE products SET quantity = base_quantity
      + COALESCE((
          SELECT SUM(quantity_delta) FROM stock_movements
          WHERE stock_movements.product_id = products.id
        ), 0)
      - COALESCE((
          SELECT SUM(s.quantity) FROM sales s
          JOIN outbox o ON o.client_uuid = s.client_uuid
          WHERE o.status = 'pending' AND o.kind = 'sale' AND s.product_id = products.id
        ), 0)
  `);
}