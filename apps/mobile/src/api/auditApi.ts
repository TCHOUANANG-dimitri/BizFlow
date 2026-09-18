// Journal d'audit (GET /audit-log, propriétaire uniquement) — packages/shared/openapi.json.

import { apiFetch } from './client';

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

export function fetchAuditLog(limit = 200): Promise<AuditEntry[]> {
  return apiFetch<AuditEntry[]>(`/audit-log?limit=${limit}`);
}
