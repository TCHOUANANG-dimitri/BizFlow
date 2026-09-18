// Logique métier locale du web (IndexedDB). Miroir de la logique SQLite du
// mobile : même règles d'optimisme, de recalcul et d'outbox (SYNC_DESIGN).

import { PaymentMethod } from './config';
import { fetchProducts, ProductApi } from './api';
import { getSession } from './session';
import { deleteItem, getAll, getOne, kvGet, kvSet, put } from './db';

// ===== Types (un PK local normalisé `id` = client_uuid pour les événements) =====

export interface ProductRow {
  id: string;
  name: string;
  quantity: number;
  purchase_price: number | null;
  selling_price: number;
  minimum_stock: number;
  is_active: boolean;
}

export interface SaleRow {
  id: string; // = client_uuid généré sur l'appareil
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
  id: string;
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
  id: string;
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
  id: string;
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

export interface OutboxRow {
  id: string; // = client_uuid de l'événement
  kind: OutboxKind;
  payload: string;
  status: 'pending' | 'rejected';
  error: string | null;
  created_at: string;
}

export type MoneyKind = 'income' | 'expense' | 'withdrawal';
export type StockKind = 'restock' | 'adjustment';

// ===== Helpers =====

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const nowIso = (): string => new Date().toISOString();

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('Non connecté');
  return session;
}

// ===== Init + synchronisation catalogue produits =====

export async function initStore(): Promise<void> {
  await recomputeQuantities();
}

// Le catalogue produit vient du backend (`GET /products`), jamais de fixtures.
// Best-effort : si hors-ligne, on garde le cache local existant tel quel.
export async function syncProductsFromServer(): Promise<void> {
  let remote: ProductApi[];
  try {
    remote = await fetchProducts();
  } catch {
    return;
  }
  for (const p of remote) {
    await put<ProductRow>('products', {
      id: p.id,
      name: p.name,
      quantity: p.quantity,
      purchase_price: p.purchase_price ?? null,
      selling_price: p.selling_price,
      minimum_stock: p.minimum_stock,
      is_active: p.is_active,
    });
  }
  await recomputeQuantities();
}

// Stock affiché = dernière valeur connue du serveur − ventes locales encore en
// outbox (optimiste, jamais bloquant même si ça passe sous zéro — SYNC_DESIGN §6).
export async function recomputeQuantities(): Promise<void> {
  // Rien à recalculer depuis des mouvements locaux ici : la quantité de base
  // vient directement du serveur à chaque `syncProductsFromServer`. On ne
  // soustrait que l'optimiste des ventes pas encore synchronisées.
  const [outbox] = await Promise.all([getAll<OutboxRow>('outbox')]);
  const pendingByProduct = new Map<string, number>();
  for (const o of outbox) {
    if (o.kind !== 'sale' || o.status !== 'pending') continue;
    try {
      const payload = JSON.parse(o.payload) as { product_id: string; quantity: number };
      pendingByProduct.set(payload.product_id, (pendingByProduct.get(payload.product_id) ?? 0) + payload.quantity);
    } catch {
      /* ignore */
    }
  }
  if (pendingByProduct.size === 0) return;
  const products = await getAll<ProductRow>('products');
  for (const p of products) {
    const pending = pendingByProduct.get(p.id);
    if (pending) await put<ProductRow>('products', { ...p, quantity: p.quantity - pending });
  }
}

// ===== Lecture =====

export async function listProducts(): Promise<ProductRow[]> {
  const rows = await getAll<ProductRow>('products');
  return rows.filter((r) => r.is_active).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function getSalesToday(): Promise<SaleRow[]> {
  const rows = await getAll<SaleRow>('sales');
  return rows.filter((r) => r.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10));
}

export async function getMoneyMovementsToday(): Promise<MoneyMovementRow[]> {
  const rows = await getAll<MoneyMovementRow>('money_movements');
  return rows.filter((r) => r.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10));
}

export async function getLastClosings(limit = 10): Promise<DailyClosingRow[]> {
  const rows = await getAll<DailyClosingRow>('daily_closings');
  return rows
    .sort((a, b) => b.closing_date.localeCompare(a.closing_date) || b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

// Caisse attendue locale (hors-ligne uniquement) = flux net d'argent du jour
// civil + ventes locales encore en outbox. Utilisée seulement en secours quand
// `GET /closing/expected-cash` est injoignable — sinon la valeur serveur prime.
export async function getExpectedCashForDateLocal(dateKey: string): Promise<number> {
  const [movements, sales, outbox] = await Promise.all([
    getAll<MoneyMovementRow>('money_movements'),
    getAll<SaleRow>('sales'),
    getAll<OutboxRow>('outbox'),
  ]);
  const base = movements
    .filter((m) => m.created_at.slice(0, 10) === dateKey)
    .reduce((a, m) => a + m.amount, 0);
  const pending = new Set(outbox.filter((o) => o.kind === 'sale' && o.status === 'pending').map((o) => o.id));
  const optimistic = sales
    .filter((s) => pending.has(s.id) && s.created_at.slice(0, 10) === dateKey)
    .reduce((a, s) => a + s.total_amount, 0);
  return base + optimistic;
}

export async function getCashTotal(): Promise<number> {
  const [movements, sales, outbox] = await Promise.all([
    getAll<MoneyMovementRow>('money_movements'),
    getAll<SaleRow>('sales'),
    getAll<OutboxRow>('outbox'),
  ]);
  const base = movements.reduce((a, m) => a + m.amount, 0);
  const pending = new Set(outbox.filter((o) => o.kind === 'sale' && o.status === 'pending').map((o) => o.id));
  const optimistic = sales.filter((s) => pending.has(s.id)).reduce((a, s) => a + s.total_amount, 0);
  return base + optimistic;
}

// ===== Cursors =====

export async function getCursor(key: string): Promise<string | null> {
  return kvGet(key);
}
export async function setCursor(key: string, value: string | null): Promise<void> {
  await kvSet(key, value ?? '');
}

// ===== Capture (hors-ligne d'abord) =====

export async function addSale(
  productId: string,
  quantity: number,
  unitPrice: number,
  paymentMethod: PaymentMethod,
): Promise<SaleRow | null> {
  if (quantity <= 0 || unitPrice < 0) return null;
  const session = requireSession();
  const id = generateUuid();
  const row: SaleRow = {
    id,
    server_id: null,
    business_id: session.business_id,
    user_id: session.user_id,
    product_id: productId,
    quantity,
    unit_price: unitPrice,
    total_amount: quantity * unitPrice,
    payment_method: paymentMethod,
    created_at: nowIso(),
  };
  await put('sales', row);
  await put<OutboxRow>('outbox', {
    id,
    kind: 'sale',
    payload: JSON.stringify({
      client_uuid: id,
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      payment_method: paymentMethod,
    }),
    status: 'pending',
    error: null,
    created_at: row.created_at,
  });
  await recomputeQuantities();
  return row;
}

export async function addMoneyMovement(type: MoneyKind, amount: number, reason: string | null): Promise<MoneyMovementRow | null> {
  if (amount <= 0) return null;
  const session = requireSession();
  const id = generateUuid();
  const signed = type === 'income' ? amount : -amount;
  const row: MoneyMovementRow = {
    id,
    server_id: null,
    business_id: session.business_id,
    user_id: session.user_id,
    type,
    amount: signed,
    reason,
    sale_id: null,
    created_at: nowIso(),
  };
  await put('money_movements', row);
  await put<OutboxRow>('outbox', {
    id,
    kind: 'money',
    payload: JSON.stringify({ client_uuid: id, type, amount: signed, reason }),
    status: 'pending',
    error: null,
    created_at: row.created_at,
  });
  return row;
}

export async function addStockMovement(productId: string, type: StockKind, quantityDelta: number, reason: string | null): Promise<StockMovementRow | null> {
  if (quantityDelta === 0) return null;
  const session = requireSession();
  const id = generateUuid();
  const row: StockMovementRow = {
    id,
    server_id: null,
    business_id: session.business_id,
    user_id: session.user_id,
    product_id: productId,
    type,
    quantity_delta: quantityDelta,
    reason,
    sale_id: null,
    created_at: nowIso(),
  };
  await put('stock_movements', row);
  await put<OutboxRow>('outbox', {
    id,
    kind: 'stock',
    payload: JSON.stringify({ client_uuid: id, product_id: productId, type, quantity_delta: quantityDelta, reason }),
    status: 'pending',
    error: null,
    created_at: row.created_at,
  });
  return row;
}

export async function addDailyClosing(closingDate: string, expectedCash: number, actualCash: number, note: string | null): Promise<DailyClosingRow | null> {
  const session = requireSession();
  const id = generateUuid();
  const row: DailyClosingRow = {
    id,
    server_id: null,
    business_id: session.business_id,
    user_id: session.user_id,
    closing_date: closingDate,
    expected_cash: expectedCash,
    actual_cash: actualCash,
    difference: actualCash - expectedCash,
    note,
    created_at: nowIso(),
  };
  await put('daily_closings', row);
  await put<OutboxRow>('outbox', {
    id,
    kind: 'closing',
    // `expected_cash` n'est jamais envoyé au serveur (calculé côté serveur,
    // voir SYNC_DESIGN.md) — gardé seulement localement pour l'affichage optimiste.
    payload: JSON.stringify({ client_uuid: id, closing_date: closingDate, actual_cash: actualCash, note }),
    status: 'pending',
    error: null,
    created_at: row.created_at,
  });
  return row;
}

// ===== Appliquer un pull (upsert par client_uuid) =====

function toStr(v: unknown): string | null {
  return v == null || v === '' ? null : String(v);
}
function toNum(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export async function applyPullEvents(events: {
  sales?: Record<string, unknown>[];
  money_movements?: Record<string, unknown>[];
  stock_movements?: Record<string, unknown>[];
  daily_closings?: Record<string, unknown>[];
}): Promise<void> {
  for (const e of events.sales ?? []) {
    const id = String(e.client_uuid);
    const existing = await getOne('sales', id);
    if (!existing) {
      const created_at = toStr(e.created_at) ?? nowIso();
      await put<SaleRow>('sales', {
        id,
        server_id: toStr(e.id),
        business_id: String(e.business_id),
        user_id: String(e.user_id),
        product_id: String(e.product_id),
        quantity: toNum(e.quantity),
        unit_price: toNum(e.unit_price),
        total_amount: toNum(e.total_amount),
        payment_method: String(e.payment_method),
        created_at,
      });
    }
  }
  for (const e of events.money_movements ?? []) {
    const id = String(e.client_uuid);
    const existing = await getOne('money_movements', id);
    if (!existing) {
      await put<MoneyMovementRow>('money_movements', {
        id,
        server_id: toStr(e.id),
        business_id: String(e.business_id),
        user_id: String(e.user_id),
        type: e.type as MoneyMovementRow['type'],
        amount: toNum(e.amount),
        reason: toStr(e.reason),
        sale_id: toStr(e.sale_id),
        created_at: toStr(e.created_at) ?? nowIso(),
      });
    }
  }
  for (const e of events.stock_movements ?? []) {
    const id = String(e.client_uuid);
    const existing = await getOne('stock_movements', id);
    if (!existing) {
      await put<StockMovementRow>('stock_movements', {
        id,
        server_id: toStr(e.id),
        business_id: String(e.business_id),
        user_id: String(e.user_id),
        product_id: String(e.product_id),
        type: e.type as StockMovementRow['type'],
        quantity_delta: toNum(e.quantity_delta),
        reason: toStr(e.reason),
        sale_id: toStr(e.sale_id),
        created_at: toStr(e.created_at) ?? nowIso(),
      });
    }
  }
  for (const e of events.daily_closings ?? []) {
    const id = String(e.client_uuid);
    const existing = await getOne('daily_closings', id);
    if (!existing) {
      const expected = toNum(e.expected_cash);
      const actual = toNum(e.actual_cash);
      await put<DailyClosingRow>('daily_closings', {
        id,
        server_id: toStr(e.id),
        business_id: String(e.business_id),
        user_id: String(e.user_id),
        closing_date: String(e.closing_date),
        expected_cash: expected,
        actual_cash: actual,
        difference: toStr(e.difference) == null ? actual - expected : toNum(e.difference),
        note: toStr(e.note),
        created_at: toStr(e.created_at) ?? nowIso(),
      });
    }
  }

  await syncProductsFromServer();
}

// ===== Outbox =====

export async function getPendingOutbox(): Promise<OutboxRow[]> {
  const rows = await getAll<OutboxRow>('outbox');
  return rows.filter((r) => r.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getRejectedOutbox(): Promise<OutboxRow[]> {
  const rows = await getAll<OutboxRow>('outbox');
  return rows.filter((r) => r.status === 'rejected').sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function markOutboxSynced(id: string): Promise<void> {
  await deleteItem('outbox', id);
}

export async function markOutboxRejected(id: string, detail: string): Promise<void> {
  const row = await getOne<OutboxRow>('outbox', id);
  if (row) await put<OutboxRow>('outbox', { ...row, status: 'rejected', error: detail });
}
