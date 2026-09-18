// En local (web ou desktop Tauri), le backend tourne sur localhost. Ailleurs
// (déploiement Vercel), on tape le backend FastAPI déployé séparément sur
// Vercel (voir backend/, connecté à Supabase).
export const API_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://biz-flow-ge7w.vercel.app';

export const SYNC_INTERVAL_MS = 60_000;
export const MAX_BACKOFF_MS = 2 * 60 * 1000;
export const PAYMENT_METHODS = ['cash', 'mobile_money'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
