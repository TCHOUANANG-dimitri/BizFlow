import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Banknote from 'lucide-react-native/icons/banknote';
import Building from 'lucide-react-native/icons/building';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import Package from 'lucide-react-native/icons/package';
import PackageSearch from 'lucide-react-native/icons/package-search';
import ReceiptText from 'lucide-react-native/icons/receipt-text';
import Users from 'lucide-react-native/icons/users';

import { useApp } from '../context/AppContext';
import { fetchAuditLog, AuditEntry } from '../api/auditApi';
import { formatDate, formatTime } from '../format';
import { palette, RADIUS, SPACING, typo } from '../theme';
import { Card } from '../components/ui';
import { EmptyText, RestrictedNotice, ScreenHeader } from '../components/shared';

// Mêmes filtres, mêmes libellés et même regroupement par jour que le Journal du web.
const FILTERS = [
  { key: 'all', label: 'Tout' },
  { key: 'products', label: 'Produits' },
  { key: 'sales', label: 'Ventes' },
  { key: 'money', label: 'Argent' },
  { key: 'stock', label: 'Stock' },
  { key: 'team', label: 'Équipe' },
  { key: 'closing', label: 'Clôtures' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

const GROUP: Record<string, FilterKey> = {
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
  const color = palette.textMuted;
  switch (GROUP[action] ?? 'all') {
    case 'products':
      return <Package size={18} color={color} />;
    case 'sales':
      return <ReceiptText size={18} color={color} />;
    case 'money':
      return <Banknote size={18} color={color} />;
    case 'stock':
      return <PackageSearch size={18} color={color} />;
    case 'team':
      return <Users size={18} color={color} />;
    case 'closing':
      return <CheckCircle2 size={18} color={color} />;
    default:
      return <Building size={18} color={color} />;
  }
}

export function JournalScreen() {
  const { session, refreshKey } = useApp();
  const isOwner = session?.role === 'owner';
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    void fetchAuditLog(200)
      .then(setEntries)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Journal indisponible.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOwner) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, refreshKey]);

  const grouped = useMemo(() => {
    const visible = filter === 'all' ? entries : entries.filter((e) => (GROUP[e.action] ?? 'all') === filter);
    const byDay: { day: string; rows: AuditEntry[] }[] = [];
    for (const e of visible) {
      const day = formatDate(e.created_at);
      const last = byDay[byDay.length - 1];
      if (last && last.day === day) last.rows.push(e);
      else byDay.push({ day, rows: [e] });
    }
    return byDay;
  }, [entries, filter]);

  if (!isOwner) {
    return (
      <View style={styles.screen}>
        <View style={{ padding: SPACING.lg }}>
          <RestrictedNotice
            icon={<ClipboardList size={18} color={palette.textMuted} />}
            label="Le journal des actions est réservé au propriétaire."
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.surface} />}
    >
      <ScreenHeader title="Journal" subtitle="Qui a fait quoi, quand — toutes les actions sensibles, rien n’est édité." />

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && { color: palette.background }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && entries.length === 0 ? <EmptyText label="Chargement…" /> : null}
      {!loading && entries.length === 0 && !error ? <EmptyText label="Aucune action enregistrée pour l’instant." /> : null}

      {grouped.map((g) => (
        <View key={g.day} style={{ marginBottom: SPACING.lg }}>
          <Text style={[typo.microLabel, { marginBottom: SPACING.sm }]}>{g.day}</Text>
          {g.rows.map((e) => (
            <Card key={e.id} style={styles.entry}>
              <IconFor action={e.action} />
              <View style={{ flex: 1 }}>
                <View style={styles.entryHead}>
                  <Text style={[typo.body, { fontWeight: '700', fontSize: 14 }]}>{LABELS[e.action] ?? e.action}</Text>
                  <Text style={typo.muted}>{formatTime(e.created_at)}</Text>
                </View>
                {e.label ? <Text style={[typo.body, { fontSize: 14, marginTop: 2 }]}>{e.label}</Text> : null}
                <Text style={[typo.muted, { marginTop: 2 }]}>
                  par <Text style={{ fontWeight: '700', color: palette.text }}>{e.user_full_name}</Text>
                  {e.details ? ` · ${e.details}` : ''}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  chip: {
    borderRadius: RADIUS.field,
    borderWidth: 1,
    borderColor: '#22242A',
    backgroundColor: '#15161A',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  chipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  chipText: { fontFamily: typo.body.fontFamily, fontSize: 13, fontWeight: '600', color: palette.textMuted },
  entry: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.sm, padding: SPACING.md },
  entryHead: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm },
  error: { fontFamily: typo.body.fontFamily, fontSize: 13, color: palette.danger, marginBottom: SPACING.md },
});
