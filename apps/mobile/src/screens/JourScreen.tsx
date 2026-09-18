import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Clock from 'lucide-react-native/icons/clock';
import FileCheck2 from 'lucide-react-native/icons/file-check';
import LogOut from 'lucide-react-native/icons/log-out';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Users from 'lucide-react-native/icons/users';

import { useApp } from '../context/AppContext';
import {
  addDailyClosing,
  getCashTotal,
  getLastClosings,
  getMoneyMovementsToday,
  getProducts,
  getRecentSales,
  getRejectedOutbox,
  DailyClosingRow,
  MoneyMovementRow,
  ProductRow,
  SaleRow,
} from '../db/repo';
import { expectedCash, dailyDashboard, DashboardOut } from '../api/closingApi';
import { formatFcfa, formatTime, todayKey } from '../format';
import { palette, RADIUS, SPACING, typo } from '../theme';
import { Button, Card, Field } from '../components/ui';
import { TeamCard } from '../components/TeamCard';

export function JourScreen() {
  const { session, syncState, syncNow, refreshKey, refresh, logout, apiBaseUrl } = useApp();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [movements, setMovements] = useState<MoneyMovementRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [closings, setClosings] = useState<DailyClosingRow[]>([]);
  const [rejected, setRejected] = useState(0);
  const [cash, setCash] = useState(0);

  const [expected, setExpected] = useState<number | null>(null);
  const [expectedError, setExpectedError] = useState<string | null>(null);
  const [actual, setActual] = useState('');
  const [note, setNote] = useState('');
  const [closingSaved, setClosingSaved] = useState<number | null>(null);
  const [dashboard, setDashboard] = useState<DashboardOut | null>(null);

  const canViewDashboard = session?.can_view_owner_dashboard ?? false;
  const isOwner = session?.role === 'owner';

  useEffect(() => {
    setSales(getRecentSales(50));
    setMovements(getMoneyMovementsToday());
    setProducts(getProducts());
    setClosings(getLastClosings(3));
    setRejected(getRejectedOutbox().length);
    setCash(getCashTotal());
  }, [refreshKey]);

  // Caisse attendue du jour : TOUJOURS calculée par le serveur (CLAUDE.md).
  useEffect(() => {
    if (!canViewDashboard) return;
    let alive = true;
    setExpectedError(null);
    void expectedCash(todayKey())
      .then((res) => {
        if (alive) setExpected(res.expected_cash);
      })
      .catch((err: Error) => {
        if (alive) setExpectedError(err.message);
      });
    void dailyDashboard(todayKey())
      .then((res) => {
        if (alive) setDashboard(res);
      })
      .catch(() => {
        /* vue locale si indisponible */
      });
    return () => {
      alive = false;
    };
  }, [canViewDashboard, refreshKey, syncState.phase]);

  const todaySalesTotal = sales.filter((s) => s.created_at.slice(0, 10) === todayKey()).reduce((a, s) => a + s.total_amount, 0);
  const todayOutflows = movements.filter((m) => m.amount < 0).reduce((a, m) => a + m.amount, 0);
  const lowStock = products.filter((p) => p.quantity <= p.minimum_stock);

  const actualNum = Number(actual);
  const actualValid = actual.trim() !== '' && Number.isFinite(actualNum) && actualNum >= 0;

  const submitClosing = () => {
    if (!actualValid || expected === null) return;
    const row = addDailyClosing(todayKey(), expected, actualNum, note.trim() || null);
    if (row) {
      setClosingSaved(row.difference);
      setActual('');
      setNote('');
      refresh();
      void syncNow();
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={syncState.phase === 'syncing'} onRefresh={() => void syncNow()} tintColor={palette.surface} />}
    >
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={[typo.title, { color: palette.surface }]}>Aujourd’hui</Text>
          <Text style={styles.subtitle}>
            {session?.full_name} · {isOwner ? 'Propriétaire' : 'Employé'} · {session?.business_code}
          </Text>
        </View>
        <Pressable onPress={() => void logout()} hitSlop={12} style={styles.logout}>
          <LogOut size={20} color={palette.surface} />
        </Pressable>
      </View>

      <SyncStatusCard />

      <View style={styles.kpiRow}>
        <Card style={styles.kpiCard}>
          <Text style={typo.microLabel}>Ventes du jour</Text>
          <Text style={[typo.kpi, { fontSize: 22, marginTop: SPACING.xs }]}>{formatFcfa(todaySalesTotal)}</Text>
          <Text style={typo.muted}>{sales.filter((s) => s.created_at.slice(0, 10) === todayKey()).length} vente(s)</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Text style={typo.microLabel}>Caisse calculée</Text>
          <Text style={[typo.kpi, { fontSize: 22, marginTop: SPACING.xs }]}>{formatFcfa(cash)}</Text>
          <Text style={typo.muted}>{formatFcfa(todayOutflows)} sortis</Text>
        </Card>
      </View>

      {lowStock.length > 0 && (
        <View style={styles.alertStrip}>
          <AlertTriangle size={20} color={palette.warning} />
          <Text style={styles.alertText}>
            {lowStock.length} produit(s) sous le seuil : {lowStock.slice(0, 3).map((p) => p.name).join(', ')}
            {lowStock.length > 3 ? '…' : ''}
          </Text>
        </View>
      )}

      {rejected > 0 && (
        <View style={[styles.alertStrip, { backgroundColor: '#FBE2E2', borderColor: '#F3C6C6' }]}>
          <AlertTriangle size={20} color={palette.danger} />
          <Text style={[styles.alertText, { color: '#8A1F1F' }]}>
            {rejected} saisie(s) refusée(s) par le serveur. Vérifie-les avant de continuer.
          </Text>
        </View>
      )}

      {canViewDashboard && (
        <>
          <Text style={[typo.heading, { color: palette.surface, marginTop: SPACING.md, marginBottom: SPACING.md }]}>
            Vue patron
          </Text>
          <Card>
            <Text style={typo.microLabel}>Caisse attendue (calcul serveur)</Text>
            {expected !== null ? (
              <Text style={[typo.kpi, { fontSize: 26, marginVertical: SPACING.xs }]}>{formatFcfa(expected)}</Text>
            ) : expectedError ? (
              <Text style={[typo.muted, { marginVertical: SPACING.xs }]}>{expectedError}</Text>
            ) : (
              <ActivityIndicator color={palette.primary} style={{ alignSelf: 'flex-start', marginVertical: SPACING.sm }} />
            )}

            <View style={styles.divider} />

            <Text style={[typo.microLabel, { marginBottom: SPACING.sm }]}>Caisse comptée (FCFA)</Text>
            <Field keyboardType="number-pad" placeholder="ex. 94000" value={actual} onChangeText={setActual} />
            <Field label="Motif de l’écart (optionnel)" placeholder="ex. 6000 fournisseur non saisi" value={note} onChangeText={setNote} />

            {closingSaved !== null && (
              <View style={styles.successStrip}>
                <CheckCircle2 size={20} color={palette.success} />
                <Text style={styles.successText}>
                  Clôture enregistrée, écart {closingSaved > 0 ? '+' : ''}{formatFcfa(closingSaved)}.
                </Text>
              </View>
            )}

            <Button
              title="Valider la clôture"
              variant="accent"
              onPress={submitClosing}
              disabled={!actualValid || expected === null}
            />
          </Card>

          {dashboard && dashboard.top_products.length > 0 && (
            <Card>
              <Text style={[typo.microLabel, { marginBottom: SPACING.sm }]}>Top produits du jour</Text>
              {dashboard.top_products.slice(0, 5).map((p) => (
                <View key={p.product_id} style={styles.line}>
                  <Text style={[typo.body, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={typo.body}>{p.quantity_sold}</Text>
                  <Text style={[typo.body, { fontWeight: '700', minWidth: 90, textAlign: 'right' }]}>{formatFcfa(p.revenue)}</Text>
                </View>
              ))}
            </Card>
          )}

          {dashboard && dashboard.employee_activity.length > 0 && (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
                <Users size={18} color={palette.primary} />
                <Text style={typo.microLabel}>Activité employés</Text>
              </View>
              {dashboard.employee_activity.map((e) => (
                <View key={e.user_id} style={styles.line}>
                  <Text style={[typo.body, { flex: 1 }]} numberOfLines={1}>{e.full_name}</Text>
                  <Text style={typo.muted}>{e.sales_count} vente(s)</Text>
                  <Text style={[typo.body, { fontWeight: '700', minWidth: 90, textAlign: 'right' }]}>{formatFcfa(e.sales_total)}</Text>
                </View>
              ))}
            </Card>
          )}
        </>
      )}

      {isOwner && <TeamCard />}

      <Text style={[typo.heading, { color: palette.surface, marginTop: SPACING.md, marginBottom: SPACING.md }]}>
        Dernières ventes
      </Text>
      {sales.length === 0 ? (
        <Text style={{ color: palette.textMuted, fontFamily: typo.body.fontFamily }}>Aucune vente enregistrée.</Text>
      ) : (
        sales.slice(0, 12).map((s) => {
          const p = products.find((x) => x.id === s.product_id);
          return (
            <View key={s.client_uuid} style={styles.saleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typo.body, { color: palette.surface, fontSize: 15 }]} numberOfLines={1}>
                  {p?.name ?? 'Produit'}
                </Text>
                <Text style={{ color: palette.textMuted, fontFamily: typo.body.fontFamily, fontSize: 12 }}>
                  {formatTime(s.created_at)} · {s.payment_method === 'cash' ? 'Cash' : 'Mobile Money'}
                </Text>
              </View>
              <Text style={[typo.kpi, { fontSize: 16, color: palette.surface }]}>{formatFcfa(s.total_amount)}</Text>
            </View>
          );
        })
      )}

      <Text style={[typo.heading, { color: palette.surface, marginTop: SPACING.md, marginBottom: SPACING.md }]}>
        Clôtures récentes
      </Text>
      {closings.length === 0 ? (
        <Text style={{ color: palette.textMuted, fontFamily: typo.body.fontFamily }}>Aucune clôture enregistrée.</Text>
      ) : (
        closings.map((c) => (
          <View key={c.client_uuid} style={styles.saleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typo.body, { color: palette.surface, fontSize: 15 }]}>{c.closing_date}</Text>
              {c.note ? (
                <Text style={{ color: palette.textMuted, fontFamily: typo.body.fontFamily, fontSize: 12 }}>{c.note}</Text>
              ) : null}
            </View>
            <Text style={[typo.kpi, { fontSize: 16, color: diffTone(c.difference) }]}>
              {c.difference > 0 ? '+' : ''}{formatFcfa(c.difference)}
            </Text>
          </View>
        ))
      )}

      <Text style={[typo.muted, { textAlign: 'center', marginTop: SPACING.lg, fontSize: 12 }]}>{apiBaseUrl}</Text>
    </ScrollView>
  );
}

function diffTone(diff: number): string {
  if (diff === 0) return palette.success;
  if (diff < 0) return palette.danger;
  return palette.warning;
}

function SyncStatusCard() {
  const { syncState, syncNow } = useApp();
  let icon = <Clock size={20} color={palette.textMuted} />;
  let label = 'En attente de la première synchronisation.';
  let tone = palette.textMuted;
  let detail: string | null = null;

  if (syncState.phase === 'syncing') {
    icon = <RefreshCw size={20} color={palette.primary} />;
    label = 'Synchronisation en cours…';
    tone = palette.primary;
  } else if (syncState.phase === 'ok') {
    icon = <CheckCircle2 size={20} color={palette.success} />;
    label = 'Tout est synchronisé';
    tone = palette.success;
    detail = `${formatTime(syncState.lastSyncAt)} · ${syncState.pushed} envoyé(s) · ${syncState.pulled} reçu(s) · ${syncState.newProducts} produit(s)`;
  } else if (syncState.phase === 'error') {
    icon = <AlertTriangle size={20} color={palette.danger} />;
    label = 'Hors-ligne — les saisies restent sur cet appareil';
    tone = palette.danger;
    detail = syncState.nextRetryAt
      ? `Nouvel essai vers ${formatTime(syncState.nextRetryAt.toISOString())}`
      : null;
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        {icon}
        <Text style={[typo.body, { fontWeight: '600', color: tone, flex: 1 }]}>{label}</Text>
        <Pressable onPress={() => void syncNow()} hitSlop={12}>
          <RefreshCw size={18} color={palette.primary} />
        </Pressable>
      </View>
      {detail ? <Text style={[typo.muted, { marginTop: SPACING.xs }]}>{detail}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm }}>
        <FileCheck2 size={14} color={palette.textMuted} />
        <Text style={[typo.muted, { fontSize: 12 }]}>Chaque vente part une seule fois — jamais de double saisie.</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  subtitle: { color: palette.textMuted, fontFamily: typo.body.fontFamily, marginTop: SPACING.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.md, marginBottom: SPACING.lg },
  logout: { width: 40, height: 40, borderRadius: RADIUS.field, borderWidth: 1, borderColor: palette.textMuted, alignItems: 'center', justifyContent: 'center' },
  kpiRow: { flexDirection: 'row', gap: SPACING.md },
  kpiCard: { flex: 1, marginBottom: SPACING.md },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: SPACING.lg },
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.xs },
  alertStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FCEBC8',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: '#F0D9A8',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  alertText: { fontFamily: typo.muted.fontFamily, fontSize: 13, color: '#7A5208', flex: 1 },
  successStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F1F8F4',
    borderRadius: RADIUS.field,
    borderWidth: 1,
    borderColor: '#CBE6D7',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  successText: { fontFamily: typo.muted.fontFamily, fontSize: 13, color: palette.text, flex: 1 },
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: palette.surface,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: palette.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
});