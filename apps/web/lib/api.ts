// Client REST du contrat publié dans packages/shared/openapi.json.
// Toutes les routes protégées exigent un Bearer token — business_id/user_id
// sont dérivés du token côté serveur, jamais envoyés par le client.

import { API_BASE_URL } from './config';
import { getSession, Session } from './session';

export interface PushResult {
  client_uuid: string;
  status: 'accepted' | 'duplicate' | 'rejected';
  detail?: string | null;
}

export interface PushResponse {
  sales: PushResult[];
  money_movements: PushResult[];
  stock_movements: PushResult[];
  daily_closings: PushResult[];
}

export interface PullResponse {
  sales: Record<string, unknown>[];
  money_movements: Record<string, unknown>[];
  stock_movements: Record<string, unknown>[];
  daily_closings: Record<string, unknown>[];
  cursors: Record<string, string | null>;
}

export interface PushBody {
  sales: Record<string, unknown>[];
  money_movements: Record<string, unknown>[];
  stock_movements: Record<string, unknown>[];
  daily_closings: Record<string, unknown>[];
}

export interface ProductApi {
  id: string;
  name: string;
  quantity: number;
  purchase_price?: number;
  selling_price: number;
  minimum_stock: number;
  is_active: boolean;
}

export interface ExpectedCashApi {
  closing_date: string;
  expected_cash: number;
  sales_total: number;
  income_total: number;
  expense_total: number;
  withdrawal_total: number;
}

export interface DashboardApi {
  day: string;
  sales_total: number;
  expense_total: number;
  income_total: number;
  withdrawal_total: number;
  expected_cash: number;
  latest_closing: {
    actual_cash: number;
    expected_cash: number;
    difference: number;
    note: string | null;
    created_at: string;
  } | null;
  stock_alerts: { product_id: string; name: string; quantity: number; minimum_stock: number }[];
  top_products: { product_id: string; name: string; quantity_sold: number; revenue: number }[];
  employee_activity: { user_id: string; full_name: string; sales_count: number; sales_total: number }[];
}

const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (auth) {
    const session = getSession();
    if (!session) throw new ApiError('Non connecté', 401);
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, signal: controller.signal });
  } catch {
    throw new ApiError(`Backend injoignable (${API_BASE_URL})`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (body && body.detail) detail = JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(`Erreur ${res.status}: ${detail}`, res.status);
  }
  return (await res.json()) as T;
}

// ===== Auth =====

export async function registerBusiness(input: {
  business_name: string;
  sector?: string;
  owner_full_name: string;
  owner_phone?: string;
  pin: string;
}): Promise<Session> {
  return request<Session>('/auth/register-business', { method: 'POST', body: JSON.stringify(input) }, false);
}

export async function login(input: { business_code: string; pin: string }): Promise<Session> {
  return request<Session>('/auth/login', { method: 'POST', body: JSON.stringify(input) }, false);
}

// ===== Sync =====

export async function push(body: PushBody): Promise<PushResponse> {
  return request<PushResponse>('/sync/push', { method: 'POST', body: JSON.stringify(body) });
}

export interface PullParams {
  since_sales?: string | null;
  since_money_movements?: string | null;
  since_stock_movements?: string | null;
  since_daily_closings?: string | null;
}

export async function pull(params: PullParams): Promise<PullResponse> {
  const qs = new URLSearchParams();
  if (params.since_sales) qs.set('since_sales', params.since_sales);
  if (params.since_money_movements) qs.set('since_money_movements', params.since_money_movements);
  if (params.since_stock_movements) qs.set('since_stock_movements', params.since_stock_movements);
  if (params.since_daily_closings) qs.set('since_daily_closings', params.since_daily_closings);
  const query = qs.toString();
  return request<PullResponse>(`/sync/pull${query ? `?${query}` : ''}`, { method: 'GET' });
}

// ===== Produits =====

export async function fetchProducts(): Promise<ProductApi[]> {
  return request<ProductApi[]>('/products', { method: 'GET' });
}

export interface ProductCreateInput {
  name: string;
  quantity?: number;
  purchase_price?: number;
  selling_price?: number;
  minimum_stock?: number;
}

export interface ProductUpdateInput {
  name?: string;
  purchase_price?: number;
  selling_price?: number;
  minimum_stock?: number;
  is_active?: boolean;
}

export async function createProduct(input: ProductCreateInput): Promise<ProductApi> {
  return request<ProductApi>('/products', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateProduct(productId: string, patch: ProductUpdateInput): Promise<ProductApi> {
  return request<ProductApi>(`/products/${productId}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

// ===== Équipe =====

export interface EmployeeApi {
  id: string;
  business_id: string;
  full_name: string;
  phone: string | null;
  role: 'owner' | 'employee';
  can_view_purchase_prices: boolean;
  can_view_owner_dashboard: boolean;
  is_active: boolean;
}

export async function createEmployee(input: {
  full_name: string;
  phone?: string | null;
  pin: string;
  can_view_purchase_prices?: boolean;
  can_view_owner_dashboard?: boolean;
}): Promise<EmployeeApi> {
  return request<EmployeeApi>('/auth/employees', { method: 'POST', body: JSON.stringify(input) });
}

export async function listEmployees(): Promise<EmployeeApi[]> {
  return request<EmployeeApi[]>('/auth/employees', { method: 'GET' });
}

// ===== Journal d'audit =====

export interface AuditEntry {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string | null;
  user_id: string;
  user_full_name: string;
  label: string | null;
}

export async function fetchAuditLog(params: { limit?: number; action?: string } = {}): Promise<AuditEntry[]> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.action) qs.set('action', params.action);
  const query = qs.toString();
  return request<AuditEntry[]>(`/audit-log${query ? `?${query}` : ''}`, { method: 'GET' });
}

// ===== Clôture & dashboard =====

export async function fetchExpectedCash(closingDate: string): Promise<ExpectedCashApi> {
  return request<ExpectedCashApi>(`/closing/expected-cash?closing_date=${closingDate}`, { method: 'GET' });
}

export async function fetchDashboard(day: string): Promise<DashboardApi> {
  return request<DashboardApi>(`/dashboard/daily?day=${day}`, { method: 'GET' });
}
