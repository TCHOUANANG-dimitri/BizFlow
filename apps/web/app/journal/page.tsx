'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardList,
  Package,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  Users,
} from 'lucide-react';

import { useData } from '../../lib/useData';
import { fetchAuditLog, AuditEntry } from '../../lib/api';
import { formatDate, formatTime } from '../../lib/format';
import { getSession } from '../../lib/session';

const FILTERS = [
  { key: 'all', label: 'Tout' },
  { key: 'products', label: 'Produits' },
  { key: 'sales', label: 'Ventes' },
  { key: 'money', label: 'Argent' },
  { key: 'stock', label: 'Stock' },
  { key: 'team', label: 'Équipe' },
  { key: 'closing', label: 'Clôtures' },
] as const;

const GROUP: Record<string, (typeof FILTERS)[number]['key']> = {
  'business.registered': 'all',
  'product.created': 'products',
  'product.updated': 'products',
  'sale.created': 'sales',
  'money_movement.created': 'money',
  'stock_movement.created': 'stock',
  'employee.created': 'team',
  'daily_closing.created': 'closing',
};

const LABELS: Record<string, string> = {
  'business.registered': 'Création de l’entreprise',
  'product.created': 'Produit créé',
  'product.updated': 'Produit modifié',
  'sale.created': 'Vente',
  'money_movement.created': 'Mouvement d’argent',
  'stock_movement.created': 'Mouvement de stock',
  'employee.created': 'Employé créé',
  'daily_closing.created': 'Clôture de journée',
};

function IconFor({ action }: { action: string }) {
  const group = GROUP[action] ?? 'all';
  const size = 18;
  const cls = 'mt-0.5 shrink-0 text-text-muted';
  switch (group) {
    case 'products':
      return <Package size={size} className={cls} />;
    case 'sales':
      return <ReceiptText size={size} className={cls} />;
    case 'money':
      return <Banknote size={size} className={cls} />;
    case 'stock':
      return <PackageSearch size={size} className={cls} />;
    case 'team':
      return <Users size={size} className={cls} />;
    case 'closing':
      return <CheckCircle2 size={size} className={cls} />;
    case 'all':
      return <Building2 size={size} className={cls} />;
    default:
      return <ClipboardList size={size} className={cls} />;
  }
}

export default function JournalPage() {
  const version = useData();
  const isOwner = getSession()?.role === 'owner';
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    void fetchAuditLog({ limit: 200 })
      .then(setEntries)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Journal indisponible.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const grouped = useMemo(() => {
    const visible = filter === 'all' ? entries : entries.filter((e) => (GROUP[e.action] ?? 'all') === filter);
    const byDay: { day: string; rows: AuditEntry[] }[] = [];
    for (const e of visible) {
      const day = formatDate(e.created_at);
      const last = byDay[byDay.length - 1];
      if (last && last.day === day) {
        last.rows.push(e);
      } else {
        byDay.push({ day, rows: [e] });
      }
    }
    return byDay;
  }, [entries, filter]);

  if (!isOwner) {
    return (
      <div className="mt-4 flex items-start gap-2 rounded-field border border-border bg-surface px-3 py-3 text-sm text-text-muted">
        <ClipboardList size={18} className="mt-0.5 shrink-0" />
        <span>Le journal des actions est réservé au propriétaire.</span>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-background">Journal</h1>
          <p className="text-sm text-text-muted">Qui a fait quoi, quand — toutes les actions sensibles, rien n&rsquo;est édité.</p>
        </div>
        <button type="button" className="btn-secondary !px-3 !py-2" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`rounded-field px-3 py-1.5 text-sm font-semibold ${
              filter === f.key ? 'bg-background text-white' : 'bg-surface text-text-muted hover:bg-[#F3F4F6]'
            }`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {loading && <p className="text-sm text-text-muted">Chargement…</p>}
      {!loading && entries.length === 0 && (
        <p className="text-sm text-text-muted">Aucune action enregistrée pour l&rsquo;instant.</p>
      )}

      <div className="space-y-5">
        {grouped.map((g) => (
          <section key={g.day}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">{g.day}</h2>
            <div className="space-y-2">
              {g.rows.map((e) => (
                <div key={e.id} className="kpi-card flex items-start gap-3">
                  <IconFor action={e.action} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <strong className="text-sm">{LABELS[e.action] ?? e.action}</strong>
                      <span className="text-xs text-text-muted">{formatTime(e.created_at)}</span>
                    </div>
                    {e.label && <p className="mt-0.5 text-sm text-text">{e.label}</p>}
                    <p className="mt-0.5 text-xs text-text-muted">
                      par <span className="font-semibold text-text">{e.user_full_name}</span>
                      {e.details ? ` · ${e.details}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}