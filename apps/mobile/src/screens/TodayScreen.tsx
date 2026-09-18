import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import Banknote from 'lucide-react-native/icons/banknote';
import PackageSearch from 'lucide-react-native/icons/package-search';
import ReceiptText from 'lucide-react-native/icons/receipt-text';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import Users from 'lucide-react-native/icons/users';

import { useApp } from '../context/AppContext';
import {
  getExpectedCashForDateLocal,
  getLastClosings,
  getMoneyMovementsToday,
  getPendingOutbox,
  getProducts,
  getRejectedOutbox,
  getSalesToday,
  DailyClosingRow,
  MoneyMovementRow,
  ProductRow,
  SaleRow,
} from '../db/repo';
import { dailyDashboard, DashboardOut } from '../api/closingApi';
import { formatDate, formatFcfa, todayKey } from '../format';
import { palette, RADIUS, SPACING, typo } from '../theme';
import { Badge, Card } from '../components/ui';
import { EmptyText, KpiCard, Notice, ScreenHeader, SectionTitle } from '../components/shared';

interface LocalView {
  products: ProductRow[];
  sales: SaleRow[];
  movements: MoneyMovementRow[];
  expectedCash: number;
  closings: DailyClosingRow[];
}

function loadLocal(): LocalView {
  return {
    products: getProducts(),
    sales: getSalesToday(),
    movements: getMoneyMovementsToday(),
    expectedCash: getExpectedCashForDateLocal(todayKey()),
    closings: getLastClosings(5),
  };
}

// Même contenu que l'écran « Aujourd'hui » du web : KPI du jour, clôture, alertes
// stock, top produits, activité par employé — serveur d'abord, calcul local si hors-ligne.
export function TodayScreen() {
  const { refreshKey, syncNow, syncState } = useApp();
  const [remote, setRemote] = useState<DashboardOut | null>(null);
  const [local, setLocal] = useState<LocalView | null>(null);
  const [pending, setPending] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    setPending(getPendingOutbox().length);
    setRejected(getRejectedOutbox().length);
    setLocal(loadLocal());
    void dailyDashboard(todayKey())
      .then((d) => {
        if (!alive) return;
        setRemote(d);
        setOffline(false);
      })
      .catch(() => {
        if (!alive) return;
        setRemote(null);
        setOffline(true);
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (!local) return null;

  const salesTotal = remote ? remote.sales_total : local.sales.reduce((a, s) => a + s.total_amount, 0);
  const expenses = remote
    ? remote.expense_total + remote.withdrawal_total
    : local.movements.filter((m) => m.amount < 0).reduce((a, m) => a + m.amount, 0);
  const expected = remote ? remote.expected_cash : local.expectedCash;
  const alerts = remote
    ? remote.stock_alerts.map((a) => ({ id: a.product_id, name: a.name, quantity: a.quantity, minimum_stock: a.minimum_stock }))
    : local.products.filter((p) => p.quantity <= p.minimum_stock);

  const localClosing = local.closings.find((c) => c.closing_date === todayKey());
  const closing = remote?.latest_closing ?? (localClosing
    ? { actual_cash: localClosing.actual_cash, expected_cash: localClosing.expected_cash, difference: localClosing.difference, note: localClosing.note }
    : null);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={syncState.phase === 'syncing'} onRefresh={() => void syncNow()} tintColor={palette.surface} />}
    >
      <ScreenHeader
        title={`Aujourd’hui — ${formatDate(new Date().toISOString())}`}
        subtitle="Est-ce que l’argent et le stock correspondent à ce qu’il devrait y avoir ?"
      />
      {offline ? (
        <Notice tone="warning">Hors-ligne — vue calculée localement, en attente de synchronisation.</Notice>
      ) : null}

      <View style={styles.kpiGrid}>
        <KpiCard icon={<TrendingUp size={16} color={palette.textMuted} />} label="Ventes du jour" value={formatFcfa(salesTotal)} />
        <KpiCard icon={<ReceiptText size={16} color={palette.textMuted} />} label="Dépenses du jour" value={formatFcfa(expenses)} tone="danger" />
        <KpiCard icon={<Banknote size={16} color={palette.textMuted} />} label="Caisse attendue" value={formatFcfa(expected)} />
        <KpiCard
          icon={<PackageSearch size={16} color={palette.textMuted} />}
          label="En attente de sync"
          value={String(pending)}
          tone={rejected > 0 ? 'danger' : undefined}
          sub={rejected > 0 ? `${rejected} refusé(s)` : undefined}
        />
      </View>

      <Card style={{ marginTop: SPACING.md }}>
        {closing ? (
          <>
            <Text style={typo.microLabel}>Clôture du jour — attendue vs comptée</Text>
            <Text style={[typo.kpi, { fontSize: 20, marginVertical: SPACING.xs }]}>
              {formatFcfa(closing.actual_cash)} <Text style={{ color: palette.textMuted }}>vs</Text> {formatFcfa(closing.expected_cash)}
            </Text>
            <Badge
              label={`Écart ${closing.difference >= 0 ? '+' : ''}${formatFcfa(closing.difference)}`}
              tone={closing.difference === 0 ? 'success' : closing.difference > 0 ? 'primary' : 'danger'}
            />
            {closing.note ? <Text style={[typo.muted, { marginTop: SPACING.sm }]}>Note : {closing.note}</Text> : null}
          </>
        ) : (
          <>
            <Text style={typo.microLabel}>Clôture du jour</Text>
            <Text style={[typo.muted, { marginTop: SPACING.xs }]}>Pas encore clôturé. Va dans la section Clôture.</Text>
          </>
        )}
      </Card>

      <SectionTitle title="Alertes stock" icon={<AlertTriangle size={16} color={palette.surface} />} />
      {alerts.length === 0 ? (
        <EmptyText label="Aucune alerte. Tout le stock est au-dessus des seuils." />
      ) : (
        alerts.map((p) => (
          <View key={p.id} style={styles.alertRow}>
            <AlertTriangle size={16} color={palette.warning} />
            <Text style={styles.alertText}>
              <Text style={{ fontWeight: '700' }}>{p.name}</Text> — plus que {p.quantity} en stock (seuil : {p.minimum_stock})
            </Text>
          </View>
        ))
      )}

      {remote ? (
        <>
          <SectionTitle title="Top produits du jour" icon={<TrendingUp size={16} color={palette.surface} />} />
          {remote.top_products.length === 0 ? (
            <EmptyText label="Aucune vente enregistrée aujourd'hui." />
          ) : (
            <Card>
              <TableHead cols={['Produit', 'Unités', 'Chiffre']} />
              {remote.top_products.map((p) => (
                <TableRow key={p.product_id} cols={[p.name, String(p.quantity_sold), formatFcfa(p.revenue)]} />
              ))}
            </Card>
          )}

          <SectionTitle title="Activité par employé" icon={<Users size={16} color={palette.surface} />} />
          {remote.employee_activity.length === 0 ? (
            <EmptyText label="Aucune activité aujourd'hui." />
          ) : (
            <Card>
              <TableHead cols={['Employé', 'Ventes', 'Montant']} />
              {remote.employee_activity.map((a) => (
                <TableRow key={a.user_id} cols={[a.full_name, String(a.sales_count), formatFcfa(a.sales_total)]} />
              ))}
            </Card>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function TableHead({ cols }: { cols: [string, string, string] }) {
  return (
    <View style={[styles.tr, { borderBottomWidth: 1, borderBottomColor: palette.border }]}>
      <Text style={[typo.microLabel, { flex: 2 }]}>{cols[0]}</Text>
      <Text style={[typo.microLabel, { flex: 1, textAlign: 'right' }]}>{cols[1]}</Text>
      <Text style={[typo.microLabel, { flex: 2, textAlign: 'right' }]}>{cols[2]}</Text>
    </View>
  );
}

function TableRow({ cols }: { cols: [string, string, string] }) {
  return (
    <View style={styles.tr}>
      <Text style={[typo.body, { flex: 2, fontSize: 14 }]} numberOfLines={1}>{cols[0]}</Text>
      <Text style={[typo.body, { flex: 1, fontSize: 14, textAlign: 'right' }]}>{cols[1]}</Text>
      <Text style={[typo.body, { flex: 2, fontSize: 14, textAlign: 'right', fontWeight: '700' }]}>{cols[2]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  tr: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FCEBC8',
    borderRadius: RADIUS.field,
    borderWidth: 1,
    borderColor: '#F0D9A8',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  alertText: { fontFamily: typo.muted.fontFamily, fontSize: 13, color: '#7A5208', flex: 1 },
});
