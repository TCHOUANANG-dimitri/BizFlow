// Logique métier locale (SQLite) — offline-first comme avant, mais l'identité
// vient de la session (JWT), plus jamais d'ID en dur, et les payloads poussés
// ne contiennent plus business_id/user_id (dérivés du token côté serveur).

import * as Crypto from 'expo-crypto';

import { PaymentMethod } from '../config';
import { getSessionSync } from '../auth/session';
import { getDb, recomputeProductQuantities } from './database';

// ===== Types métier locaux =====

export interface ProductRow {
  id: string;
  business_id: string;
  name: string;
  base_quantity: number;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  minimum_stock: number;
  is_active: number;
  updated_at: string;
}

export interface SaleRow {
  client_uuid: string;
  server_id: string | null;
  business_id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_method: string;
  created_at: string;
}

export interface MoneyMovementRow {
  client_uuid: string;
  server_id: string | null;
  business_id: string;
  user_id: string;
  type: 'sale' | 'income' | 'expense' | 'withdrawal';
  amount: number;
  reason: string | null;
  sale_id: string | null;
  created_at: string;
}

export interface StockMovementRow {
  client_uuid: string;
  server_id: string | null;
  business_id: string;
  user_id: string;
  product_id: string;
  type: 'sale' | 'restock' | 'adjustment';
  quantity_delta: number;
  reason: string | null;
  sale_id: string | null;
  created_at: string;
}

export interface DailyClosingRow {
  client_uuid: string;
  server_id: string | null;
  business_id: string;
  user_id: string;
  closing_date: string;
  expected_cash: number;
  actual_cash: number;
  difference: number;
  note: string | null;
  created_at: string;
}

export type OutboxKind = 'sale' | 'money' | 'stock' | 'closing';
export type OutboxStatus = 'pending' | 'rejected';

export interface OutboxRow {
  client_uuid: string;
  kind: OutboxKind;
  payload: string;
  status: OutboxStatus;
  error: string | null;
  created_at: string;
}

export type MoneyKind = 'income' | 'expense' | 'withdrawal';
export type StockKind = 'restock' | 'adjustment';

// ===== Helpers =====

export function generateUuid(): string {
  return Crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function currentUser(): { business_id: string; user_id: string } {
  const s = getSessionSync();
  return { business_id: s?.business_id ?? '', user_id: s?.user_id ?? '' };
}

function currentRole(): string {
  return getSessionSync()?.role ?? 'employee';
}

// Isolation employé : un employé ne voit que SES ventes et SES mouvements
// d'argent (le propriétaire voit tout, le stock reste unifié — voir
// getStockMovementFeed). Renvoie l'user_id courant côté employé, null sinon.
function scopedUserId(): string | null {
  return currentRole() === 'employee' ? currentUser().user_id : null;
}

// ===== Utilisateur courant =====

export function saveCurrentUser(u: {
  id: string;
  business_id: string;
  full_name: string;
  role: 'owner' | 'employee';
  can_view_purchase_prices?: boolean;
  can_view_owner_dashboard?: boolean;
}): void {
  getDb().runSync(
    `INSERT OR REPLACE INTO users
      (id, business_id, full_name, role, can_view_purchase_prices, can_view_owner_dashboard, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [u.id, u.business_id, u.full_name, u.role, u.can_view_purchase_prices ? 1 : 0, u.can_view_owner_dashboard ? 1 : 0],
  );
}

// ===== Catalogue (synchronisé depuis GET /products) =====

// Mise à jour depuis la source de vérité serveur : on rétablit base_quantity
// telle que quantité = quantité serveur, sans décompter les mouvements déjà
// dans la table locale (on recale la base, pas la quantité directe).
export function upsertProductsFromServer(products: {
  id: string;
  name: string;
  quantity: number;
  selling_price: number;
  minimum_stock: number;
  is_active: boolean;
  purchase_price?: number;
}[]): void {
  const d = getDb();
  const biz = currentUser().business_id || 'unknown';
  d.withTransactionSync(() => {
    for (const p of products) {
      const delta = d.getFirstSync<{ s: number | null }>(
        'SELECT SUM(quantity_delta) AS s FROM stock_movements WHERE product_id = ?',
        [p.id],
      );
      const deltas = delta?.s ?? 0;
      d.runSync(
        `INSERT OR REPLACE INTO products
          (id, business_id, name, base_quantity, quantity, purchase_price, selling_price, minimum_stock, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, biz, p.name, p.quantity - deltas, p.quantity, p.purchase_price ?? 0, p.selling_price, p.minimum_stock, p.is_active ? 1 : 0, nowIso()],
      );
    }
    recomputeProductQuantities(d);
  });
}

// ===== Lecture =====

export function getProducts(): ProductRow[] {
  return getDb().getAllSync<ProductRow>(
    'SELECT * FROM products WHERE is_active = 1 ORDER BY name COLLATE NOCASE',
  );
}

export function getSalesToday(): SaleRow[] {
  return getDb().getAllSync<SaleRow>(
    "SELECT * FROM sales WHERE substr(created_at, 1, 10) = ? ORDER BY created_at DESC",
    [nowIso().slice(0, 10)],
  );
}

export function getRecentSales(limit = 20): SaleRow[] {
  const d = getDb();
  const userId = scopedUserId();
  if (userId) {
    return d.getAllSync<SaleRow>(
      'SELECT * FROM sales WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit],
    );
  }
  return d.getAllSync<SaleRow>('SELECT * FROM sales ORDER BY created_at DESC LIMIT ?', [limit]);
}

export function getMoneyMovementsToday(): MoneyMovementRow[] {
  const d = getDb();
  const userId = scopedUserId();
  if (userId) {
    return d.getAllSync<MoneyMovementRow>(
      "SELECT * FROM money_movements WHERE substr(created_at, 1, 10) = ? AND user_id = ? ORDER BY created_at DESC",
      [nowIso().slice(0, 10), userId],
    );
  }
  return d.getAllSync<MoneyMovementRow>(
    "SELECT * FROM money_movements WHERE substr(created_at, 1, 10) = ? ORDER BY created_at DESC",
    [nowIso().slice(0, 10)],
  );
}

// Caisse calculée = somme des mouvements reçus + total des ventes en file locale.
// Côté employé : uniquement les mouvements/ventes de l'employé courant.
export function getCashTotal(): number {
  const d = getDb();
  const userId = scopedUserId();
  const row = userId
    ? d.getFirstSync<{ total: number | null }>(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM money_movements WHERE user_id = ?',
        [userId],
      )
    : d.getFirstSync<{ total: number | null }>(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM money_movements',
      );
  const base = row && row.total ? row.total : 0;
  const pending = userId
    ? d.getFirstSync<{ total: number | null }>(
        `SELECT COALESCE(SUM(s.total_amount), 0) AS total
           FROM sales s JOIN outbox o ON o.client_uuid = s.client_uuid
          WHERE o.status = 'pending' AND o.kind = 'sale' AND s.user_id = ?`,
        [userId],
      )
    : d.getFirstSync<{ total: number | null }>(
        `SELECT COALESCE(SUM(s.total_amount), 0) AS total
           FROM sales s JOIN outbox o ON o.client_uuid = s.client_uuid
          WHERE o.status = 'pending' AND o.kind = 'sale'`,
      );
  return base + (pending && pending.total ? pending.total : 0);
}

export function getPendingOutbox(): OutboxRow[] {
  return getDb().getAllSync<OutboxRow>(
    "SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC",
  );
}

export function getRejectedOutbox(): OutboxRow[] {
  return getDb().getAllSync<OutboxRow>(
    "SELECT * FROM outbox WHERE status = 'rejected' ORDER BY created_at DESC",
  );
}

export function getLastClosings(limit = 10): DailyClosingRow[] {
  return getDb().getAllSync<DailyClosingRow>(
    'SELECT * FROM daily_closings ORDER BY closing_date DESC, created_at DESC LIMIT ?',
    [limit],
  );
}

// ===== Vue unifiée du stock (tous les employés) =====

export interface StockMovementFeedRow {
  client_uuid: string;
  product_id: string;
  type: string;
  quantity_delta: number;
  reason: string | null;
  created_at: string;
  user_name: string;
  product_name: string;
}

// Le stock est UNIFIÉ : chaque employé voit tous les mouvements de stock du
// business et l'employeur voit bien qui a fait quoi. Jointure users (nom de
// l'auteur) + products (nom du produit).
export function getStockMovementFeed(limit = 20): StockMovementFeedRow[] {
  return getDb().getAllSync<StockMovementFeedRow>(
    `SELECT sm.client_uuid, sm.product_id, sm.type, sm.quantity_delta, sm.reason, sm.created_at,
            COALESCE(u.full_name, sm.user_id) AS user_name,
            COALESCE(p.name, sm.product_id) AS product_name
       FROM stock_movements sm
       LEFT JOIN users u ON u.id = sm.user_id
       LEFT JOIN products p ON p.id = sm.product_id
      ORDER BY sm.created_at DESC
      LIMIT ?`,
    [limit],
  );
}

// ===== Cursors =====

export function getCursor(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string | null }>('SELECT value FROM kv WHERE key = ?', [key]);
  return row ? row.value : null;
}

export function setCursor(key: string, value: string | null): void {
  getDb().runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value]);
}

// ===== Capture (hors-ligne d'abord : écriture locale + outbox) =====

export function addSale(
  productId: string,
  quantity: number,
  unitPrice: number,
  paymentMethod: PaymentMethod,
): SaleRow | null {
  if (quantity <= 0 || unitPrice < 0) return null;
  const { business_id, user_id } = currentUser();
  const client_uuid = generateUuid();
  const total = quantity * unitPrice;
  const created_at = nowIso();
  const row: SaleRow = {
    client_uuid,
    server_id: null,
    business_id,
    user_id,
    product_id: productId,
    quantity,
    unit_price: unitPrice,
    total_amount: total,
    payment_method: paymentMethod,
    created_at,
  };

  const d = getDb();
  d.withTransactionSync(() => {
    d.runSync(
      `INSERT INTO sales (client_uuid, server_id, business_id, user_id, product_id, quantity, unit_price, total_amount, payment_method, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.client_uuid, null, row.business_id, row.user_id, row.product_id, row.quantity, row.unit_price, row.total_amount, row.payment_method, row.created_at],
    );
    d.runSync(
      `INSERT INTO outbox (client_uuid, kind, payload, status, error, created_at) VALUES (?, 'sale', ?, 'pending', NULL, ?)`,
      [client_uuid, JSON.stringify({
        client_uuid,
        product_id: productId,
        quantity,
        unit_price: unitPrice,
        payment_method: paymentMethod,
      }), created_at],
    );
    recomputeProductQuantities(d);
  });
  return row;
}

export function addMoneyMovement(type: MoneyKind, amount: number, reason: string | null): MoneyMovementRow | null {
  if (amount <= 0) return null;
  const { business_id, user_id } = currentUser();
  const signed = type === 'income' ? amount : -amount;
  const client_uuid = generateUuid();
  const created_at = nowIso();
  const row: MoneyMovementRow = {
    client_uuid,
    server_id: null,
    business_id,
    user_id,
    type,
    amount: signed,
    reason,
    sale_id: null,
    created_at,
  };

  const d = getDb();
  d.withTransactionSync(() => {
    d.runSync(
      `INSERT INTO money_movements (client_uuid, server_id, business_id, user_id, type, amount, reason, sale_id, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, ?)`,
      [row.client_uuid, row.business_id, row.user_id, row.type, row.amount, row.reason, row.created_at],
    );
    d.runSync(
      `INSERT INTO outbox (client_uuid, kind, payload, status, error, created_at) VALUES (?, 'money', ?, 'pending', NULL, ?)`,
      [client_uuid, JSON.stringify({
        client_uuid,
        type,
        amount: signed,
        reason,
      }), created_at],
    );
  });
  return row;
}

export function addStockMovement(productId: string, type: StockKind, quantityDelta: number, reason: string | null): StockMovementRow | null {
  if (quantityDelta === 0) return null;
  const { business_id, user_id } = currentUser();
  const client_uuid = generateUuid();
  const created_at = nowIso();
  const row: StockMovementRow = {
    client_uuid,
    server_id: null,
    business_id,
    user_id,
    product_id: productId,
    type,
    quantity_delta: quantityDelta,
    reason,
    sale_id: null,
    created_at,
  };

  const d = getDb();
  d.withTransactionSync(() => {
    d.runSync(
      `INSERT INTO stock_movements (client_uuid, server_id, business_id, user_id, product_id, type, quantity_delta, reason, sale_id, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [row.client_uuid, row.business_id, row.user_id, row.product_id, row.type, row.quantity_delta, row.reason, row.created_at],
    );
    d.runSync(
      `INSERT INTO outbox (client_uuid, kind, payload, status, error, created_at) VALUES (?, 'stock', ?, 'pending', NULL, ?)`,
      [client_uuid, JSON.stringify({
        client_uuid,
        product_id: productId,
        type,
        quantity_delta: quantityDelta,
        reason,
      }), created_at],
    );
    recomputeProductQuantities(d);
  });
  return row;
}

export function addDailyClosing(
  closingDate: string,
  expectedCash: number,
  actualCash: number,
  note: string | null,
): DailyClosingRow | null {
  const { business_id, user_id } = currentUser();
  const client_uuid = generateUuid();
  const created_at = nowIso();
  const difference = actualCash - expectedCash;
  const row: DailyClosingRow = {
    client_uuid,
    server_id: null,
    business_id,
    user_id,
    closing_date: closingDate,
    expected_cash: expectedCash,
    actual_cash: actualCash,
    difference,
    note,
    created_at,
  };

  const d = getDb();
  d.withTransactionSync(() => {
    d.runSync(
      `INSERT INTO daily_closings (client_uuid, server_id, business_id, user_id, closing_date, expected_cash, actual_cash, difference, note, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.client_uuid, row.business_id, row.user_id, row.closing_date, row.expected_cash, row.actual_cash, row.difference, row.note, row.created_at],
    );
    d.runSync(
      `INSERT INTO outbox (client_uuid, kind, payload, status, error, created_at) VALUES (?, 'closing', ?, 'pending', NULL, ?)`,
      [client_uuid, JSON.stringify({
        client_uuid,
        closing_date: closingDate,
        actual_cash: actualCash,
        note,
      }), created_at],
    );
  });
  return row;
}

// ===== Application d'un pull (upsert par client_uuid, ignore si présent) =====

function str(v: unknown): string | null {
  return v == null || v === '' ? null : String(v);
}
function num(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function applyPullEvents(events: {
  sales?: Record<string, unknown>[];
  money_movements?: Record<string, unknown>[];
  stock_movements?: Record<string, unknown>[];
  daily_closings?: Record<string, unknown>[];
}): void {
  const d = getDb();
  d.withTransactionSync(() => {
    for (const e of events.sales ?? []) {
      d.runSync(
        `INSERT OR IGNORE INTO sales
          (client_uuid, server_id, business_id, user_id, product_id, quantity, unit_price, total_amount, payment_method, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [String(e.client_uuid), str(e.id), String(e.business_id), String(e.user_id), String(e.product_id), num(e.quantity), num(e.unit_price), num(e.total_amount), String(e.payment_method), str(e.created_at) ?? nowIso()],
      );
    }
    for (const e of events.money_movements ?? []) {
      d.runSync(
        `INSERT OR IGNORE INTO money_movements
          (client_uuid, server_id, business_id, user_id, type, amount, reason, sale_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [String(e.client_uuid), str(e.id), String(e.business_id), String(e.user_id), String(e.type), num(e.amount), str(e.reason), str(e.sale_id), str(e.created_at) ?? nowIso()],
      );
    }
    for (const e of events.stock_movements ?? []) {
      d.runSync(
        `INSERT OR IGNORE INTO stock_movements
          (client_uuid, server_id, business_id, user_id, product_id, type, quantity_delta, reason, sale_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [String(e.client_uuid), str(e.id), String(e.business_id), String(e.user_id), String(e.product_id), String(e.type), num(e.quantity_delta), str(e.reason), str(e.sale_id), str(e.created_at) ?? nowIso()],
      );
    }
    for (const e of events.daily_closings ?? []) {
      d.runSync(
        `INSERT OR IGNORE INTO daily_closings
          (client_uuid, server_id, business_id, user_id, closing_date, expected_cash, actual_cash, difference, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [String(e.client_uuid), str(e.id), String(e.business_id), String(e.user_id), String(e.closing_date), num(e.expected_cash), num(e.actual_cash), str(e.difference) == null ? num(e.actual_cash) - num(e.expected_cash) : num(e.difference), str(e.note), str(e.created_at) ?? nowIso()],
      );
    }
    recomputeProductQuantities(d);
  });
}

// ===== Outbox (après push) =====

export function markOutboxSynced(clientUuid: string): void {
  getDb().runSync('DELETE FROM outbox WHERE client_uuid = ?', [clientUuid]);
}

export function markOutboxRejected(clientUuid: string, detail: string): void {
  getDb().runSync(
    "UPDATE outbox SET status = 'rejected', error = ? WHERE client_uuid = ?",
    [detail, clientUuid],
  );
}