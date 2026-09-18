// Côté web/desktop (navigateur), le backend tourne en local : localhost.
export const API_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'http://localhost:8000';

export const SYNC_INTERVAL_MS = 60_000;
export const MAX_BACKOFF_MS = 2 * 60 * 1000;
export const PAYMENT_METHODS = ['cash', 'mobile_money'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
