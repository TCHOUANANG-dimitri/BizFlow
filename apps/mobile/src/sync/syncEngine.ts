// Ordonnanceur de synchro (SYNC_DESIGN section 8) : push outbox -> pull des
// faits -> rafraîchissement du catalogue. Backoff exponentiel, jamais agressif.

import * as Network from 'expo-network';

import { API_BASE_URL, MAX_BACKOFF_MS } from '../config';
import { listProducts } from '../api/productsApi';
import {
  applyPullEvents,
  getCursor,
  getPendingOutbox,
  markOutboxRejected,
  markOutboxSynced,
  setCursor,
  upsertProductsFromServer,
} from '../db/repo';
import { push as apiPush, pull as apiPull } from './api';

export type SyncState =
  | { phase: 'idle' }
  | { phase: 'syncing' }
  | { phase: 'ok'; lastSyncAt: string; pushed: number; pulled: number; newProducts: number }
  | { phase: 'error'; message: string; nextRetryAt: Date | null };

export type SyncListener = (state: SyncState) => void;

const CURSOR_KEYS: Record<string, string> = {
  sales: 'sync_cursor_sales',
  money_movements: 'sync_cursor_money_movements',
  stock_movements: 'sync_cursor_stock_movements',
  daily_closings: 'sync_cursor_daily_closings',
} as const;

class SyncEngine {
  private syncing = false;
  private listeners = new Set<SyncListener>();
  private backoffMs = 2_000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(state: SyncState): void {
    this.listeners.forEach((l) => l(state));
  }

  async isNetworkReachable(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      return state.isConnected !== false && state.isInternetReachable !== false;
    } catch {
      return true;
    }
  }

  async syncNow(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    this.emit({ phase: 'syncing' });

    try {
      const pushed = await this.pushOutbox();
      const pulled = await this.doPull();
      const newProducts = await this.refreshCatalog();
      this.backoffMs = 2_000;
      this.emit({ phase: 'ok', lastSyncAt: new Date().toISOString(), pushed, pulled, newProducts });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de synchronisation';
      const nextRetryAt = new Date(Date.now() + this.backoffMs);
      this.emit({ phase: 'error', message, nextRetryAt });
      this.scheduleRetry();
    } finally {
      this.syncing = false;
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    const wait = Math.min(this.backoffMs, MAX_BACKOFF_MS);
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.syncNow();
    }, wait);
  }

  private async pushOutbox(): Promise<number> {
    const pending = getPendingOutbox();
    if (pending.length === 0) return 0;

    const byKind = (kind: string) =>
      kind === 'money' ? 'money_movements' : kind === 'stock' ? 'stock_movements' : kind === 'closing' ? 'daily_closings' : 'sales';

    const body = {
      sales: [] as Record<string, unknown>[],
      money_movements: [] as Record<string, unknown>[],
      stock_movements: [] as Record<string, unknown>[],
      daily_closings: [] as Record<string, unknown>[],
    };
    for (const item of pending) {
      try {
        body[byKind(item.kind) as keyof typeof body].push(JSON.parse(item.payload) as Record<string, unknown>);
      } catch {
        markOutboxRejected(item.client_uuid, 'Payload local illisible');
      }
    }

    const res = await apiPush(body);
    const all = [...res.sales, ...res.money_movements, ...res.stock_movements, ...res.daily_closings];
    let pushed = 0;
    for (const r of all) {
      if (r.status === 'accepted' || r.status === 'duplicate') {
        markOutboxSynced(r.client_uuid);
        pushed += 1;
      } else if (r.status === 'rejected') {
        markOutboxRejected(r.client_uuid, r.detail ?? 'Rejeté par le serveur');
      }
    }
    return pushed;
  }

  private async doPull(): Promise<number> {
    const res = await apiPull({
      since_sales: getCursor(CURSOR_KEYS.sales),
      since_money_movements: getCursor(CURSOR_KEYS.money_movements),
      since_stock_movements: getCursor(CURSOR_KEYS.stock_movements),
      since_daily_closings: getCursor(CURSOR_KEYS.daily_closings),
    });

    applyPullEvents({
      sales: res.sales,
      money_movements: res.money_movements,
      stock_movements: res.stock_movements,
      daily_closings: res.daily_closings,
    });

    let pulled = 0;
    for (const [entity, key] of Object.entries(CURSOR_KEYS)) {
      const value = res.cursors?.[entity];
      if (value !== undefined) {
        setCursor(key, value ?? '');
        if (value) pulled += 1;
      }
    }
    return pulled;
  }

  // Catalogue depuis GET /products. Un échec ici n'échoue pas le sync complet.
  private async refreshCatalog(): Promise<number> {
    try {
      const products = await listProducts();
      upsertProductsFromServer(products.map((p) => ({
        id: p.id,
        name: p.name,
        quantity: p.quantity,
        selling_price: p.selling_price,
        minimum_stock: p.minimum_stock,
        is_active: p.is_active,
        purchase_price: p.purchase_price,
      })));
      return products.length;
    } catch {
      return 0;
    }
  }

  getApiBaseUrl(): string {
    return API_BASE_URL;
  }
}

export const syncEngine = new SyncEngine();