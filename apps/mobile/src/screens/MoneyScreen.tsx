import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ArrowDownLeft from 'lucide-react-native/icons/arrow-down-left';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import TrendingDown from 'lucide-react-native/icons/trending-down';

import { useApp } from '../context/AppContext';
import { addMoneyMovement, MoneyKind, getCashTotal, getMoneyMovementsToday, MoneyMovementRow } from '../db/repo';
import { palette, RADIUS, SPACING, typo } from '../theme';
import { formatFcfa, formatTime } from '../format';
import { Button, Card, Field, Segmented } from '../components/ui';

const MODES: { value: MoneyKind; label: string }[] = [
  { value: 'income', label: 'Entrée' },
  { value: 'expense', label: 'Dépense' },
  { value: 'withdrawal', label: 'Retrait' },
];

const MODE_LABEL: Record<MoneyMovementRow['type'], string> = {
  sale: 'Encaissement',
  income: 'Entrée d’argent',
  expense: 'Dépense',
  withdrawal: 'Retrait',
};

const MODE_ICON: Record<MoneyMovementRow['type'], typeof ArrowDownLeft> = {
  sale: TrendingDown,
  income: ArrowDownLeft,
  expense: TrendingDown,
  withdrawal: ArrowUpRight,
};

export function MoneyScreen() {
  const { refreshKey, refresh } = useApp();
  const [mode, setMode] = useState<MoneyKind>('expense');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [last, setLast] = useState<MoneyMovementRow | null>(null);

  const cash = getCashTotal();
  const today = getMoneyMovementsToday();

  const amountNum = Number(amount);
  const valid = amount.trim() !== '' && Number.isFinite(amountNum) && amountNum > 0;

  const submit = () => {
    if (!valid) return;
    const row = addMoneyMovement(mode, amountNum, reason.trim() || null);
    if (row) {
      setLast(row);
      setAmount('');
      setReason('');
      refresh();
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[typo.title, { color: palette.surface }]}>Argent</Text>
      <Text style={styles.subtitle}>Caisse et sorties d’argent — chaque saisie est tracée.</Text>

      <Card>
        <Text style={typo.microLabel}>Caisse calculée</Text>
        <Text style={[typo.kpi, { marginVertical: SPACING.xs }]}>{formatFcfa(cash)}</Text>
        <Text style={typo.muted}>Recalculée depuis tous les événements enregistrés.</Text>
      </Card>

      <Card>
        <Text style={[typo.microLabel, { marginBottom: SPACING.sm }]}>Type de mouvement</Text>
        <Segmented options={MODES} value={mode} onChange={setMode} />

        <View style={styles.divider} />

        <Field
          label="Montant (FCFA)"
          keyboardType="number-pad"
          placeholder="ex. 25000"
          value={amount}
          onChangeText={setAmount}
        />
        <Field
          label={mode === 'expense' ? 'Motif de la dépense' : mode === 'withdrawal' ? 'Motif du retrait' : 'Source de l’entrée'}
          placeholder={mode === 'expense' ? 'ex. achat fournitures' : mode === 'withdrawal' ? 'ex. argent du patron' : 'ex. remboursement'}
          value={reason}
          onChangeText={setReason}
        />

        {last && (
          <View style={styles.successStrip}>
            <CheckCircle2 size={20} color={palette.success} />
            <Text style={styles.successText}>
              {MODE_LABEL[last.type]} de {formatFcfa(last.amount)} enregistrée.
            </Text>
          </View>
        )}

        <Button title="Enregistrer" variant="accent" onPress={submit} disabled={!valid} />
        {!valid && amount.trim() !== '' && (
          <Text style={[typo.muted, { marginTop: SPACING.sm }]}>Saisis un montant positif pour valider.</Text>
        )}
      </Card>

      <Text style={[typo.heading, { color: palette.surface, marginBottom: SPACING.md, marginTop: SPACING.sm }]}>
        Aujourd’hui
      </Text>
      {today.length === 0 ? (
        <Text style={{ color: palette.textMuted, fontFamily: typo.body.fontFamily }}>Aucun mouvement enregistré aujourd’hui.</Text>
      ) : (
        today.slice(0, 15).map((m) => {
          const Icon = MODE_ICON[m.type];
          return (
            <View key={m.client_uuid} style={styles.row}>
              <View style={styles.rowIcon}>
                <Icon size={18} color={m.amount < 0 ? palette.danger : palette.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typo.body, { fontSize: 15, color: palette.surface }]}>{MODE_LABEL[m.type]}</Text>
                {m.reason ? <Text style={{ color: palette.textMuted, fontFamily: typo.body.fontFamily, fontSize: 13 }}>{m.reason}</Text> : null}
                <Text style={{ color: palette.textMuted, fontFamily: typo.body.fontFamily, fontSize: 12 }}>{formatTime(m.created_at)}</Text>
              </View>
              <Text
                style={[
                  typo.kpi,
                  { fontSize: 16, color: m.amount < 0 ? palette.danger : palette.success },
                ]}
              >
                {m.amount < 0 ? '' : '+'}
                {formatFcfa(m.amount)}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  subtitle: { color: palette.textMuted, fontFamily: typo.body.fontFamily, marginBottom: SPACING.lg },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: SPACING.lg },
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
  rowIcon: { width: 36, height: 36, borderRadius: RADIUS.field, backgroundColor: '#F5F6FA', alignItems: 'center', justifyContent: 'center' },
});