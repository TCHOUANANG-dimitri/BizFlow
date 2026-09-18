// Configuration applicative. L'identité (business/user) vient désormais du
// serveur via l'auth (JWT + session locale), plus aucun ID en dur.
export const API_BASE_URL = 'http://10.0.2.2:8000';

export const SYNC_INTERVAL_MS = 3 * 60 * 1000;
export const MAX_BACKOFF_MS = 2 * 60 * 1000;
export const PAYMENT_METHODS = ['cash', 'mobile_money'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PIN_MIN = 4;
export const PIN_MAX = 8;