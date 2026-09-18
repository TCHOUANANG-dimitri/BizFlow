import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ArrowDownCircle from 'lucide-react-native/icons/circle-arrow-down';
import ArrowUpCircle from 'lucide-react-native/icons/circle-arrow-up';
import Wallet from 'lucide-react-native/icons/wallet';

import { useApp } from '../context/AppContext';
import { addMoneyMovement, MoneyKind, getMoneyMovementsToday, MoneyMovementRow } from '../db/repo';
import { palette, RADIUS, SPACING, typo } from '../theme';
import { formatFcfa, formatTime } from '../format';
import { Button, Card, Field, Segmented } from '../components/ui';
import { EmptyText, KpiCard, Notice, ScreenHeader, SectionTitle } from '../components/shared';

// Mêmes types, libellés et exemples de motif que l'écran « Argent » du web.
const KINDS: { value: MoneyKind; label: string; hint: string }[] = [
  { value: 'income', label: 'Entrée', hint: 'ex. apport personnel, remboursement' },
  { value: 'expense', label: 'Dépense', hint: 'ex. achat de sachets, transport' },
  { value: 'withdrawal', label: 'Retrait', hint: 'ex. retrait du patron pour lui-même' },
];

const labelOf = (type: MoneyMovementRow['type']) => KINDS.find((k) => k.value === type)?.label ?? type;

export function MoneyScreen() {
  const { refreshKey, refresh } = useApp();
  const [kind, setKind] = useState<MoneyKind>('expense');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const [today, setToday] = useState<MoneyMovementRow[]>([]);

  const reload = () => setToday(getMoneyMovementsToday().filter((r) => r.type !== 'sale'));

  useEffect(() => {
    reload();
  }, [refreshKey]);

  const n = Math.round(Number(amount));
  const valid = Number.isFinite(n) && n > 0;

  const submit = () => {
    if (!valid) return;
    const row = addMoneyMovement(kind, n, reason.trim() || null);
    if (row) {
      setAmount('');
      setReason('');
      reload();
      refresh();
      setFlash(`${labelOf(kind)} enregistrée : ${formatFcfa(n)}`);
      setTimeout(() => setFlash(null), 4000);
    }
  };

  const total = (type: MoneyKind) =>
    today.filter((r) => r.type === type).reduce((a, r) => a + Math.abs(r.amount), 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader
        title="Argent"
        subtitle="Entrée, dépense ou retrait — hors ventes, qui alimentent la caisse automatiquement."
      />

      <View style={styles.kpiRow}>
        <KpiCard icon={<ArrowUpCircle size={14} color={palette.textMuted} />} label="Entrées" compact value={formatFcfa(total('income'))} tone="success" />
        <KpiCard icon={<ArrowDownCircle size={14} color={palette.textMuted} />} label="Dépenses" compact value={formatFcfa(total('expense'))} tone="danger" />
        <KpiCard icon={<Wallet size={14} color={palette.textMuted} />} label="Retraits" compact value={formatFcfa(total('withdrawal'))} tone="danger" />
      </View>

      {flash ? <Notice tone="success">{flash}</Notice> : null}

      <Card>
        <Segmented options={KINDS} value={kind} onChange={setKind} />

        <View style={styles.divider} />

        <Field
          label="Montant (FCFA)"
          keyboardType="number-pad"
          placeholder="ex. 2000"
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
        />
        <Field
          label="Motif"
          placeholder={KINDS.find((k) => k.value === kind)?.hint}
          value={reason}
          onChangeText={setReason}
        />

        <Button title="Enregistrer (hors-ligne)" variant="accent" onPress={submit} disabled={!valid} />
      </Card>

      <SectionTitle title="Mouvements du jour" />
      {today.length === 0 ? (
        <EmptyText label="Aucun mouvement manuel aujourd’hui." />
      ) : (
        today.slice(0, 30).map((m) => (
          <View key={m.client_uuid} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[typo.body, { fontSize: 15, fontWeight: '600' }]}>{labelOf(m.type)}</Text>
              {m.reason ? <Text style={typo.muted}>{m.reason}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[typo.kpi, { fontSize: 16, color: m.amount >= 0 ? palette.success : palette.danger }]}>
                {m.amount >= 0 ? '+' : ''}
                {formatFcfa(m.amount)}
              </Text>
              <Text style={typo.muted}>{formatTime(m.created_at)}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  kpiRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: SPACING.lg },
  row: {
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
