import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';

import { useApp } from '../context/AppContext';
import { addDailyClosing, getExpectedCashForDateLocal, getLastClosings, DailyClosingRow } from '../db/repo';
import { expectedCash as fetchExpectedCash } from '../api/closingApi';
import { formatDate, formatFcfa, todayKey } from '../format';
import { palette, RADIUS, SPACING, typo } from '../theme';
import { Button, Card, Field } from '../components/ui';
import { EmptyText, Notice, ScreenHeader, SectionTitle } from '../components/shared';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Même écran que « Clôture de fin de journée » du web : caisse attendue (calculée par
// le serveur, repli local hors-ligne) vs caisse comptée → écart, puis historique.
export function ClosingScreen() {
  const { refreshKey, refresh, syncNow } = useApp();
  const [dateKey, setDateKey] = useState(todayKey());
  const [expected, setExpected] = useState(0);
  const [source, setSource] = useState<'server' | 'local'>('local');
  const [actual, setActual] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<DailyClosingRow[]>([]);
  const [saved, setSaved] = useState<{ difference: number; actual: number } | null>(null);

  const dateValid = DATE_RE.test(dateKey);

  useEffect(() => {
    setHistory(getLastClosings(10));
    if (!dateValid) return;
    let alive = true;
    void fetchExpectedCash(dateKey)
      .then((res) => {
        if (!alive) return;
        setExpected(res.expected_cash);
        setSource('server');
      })
      .catch(() => {
        if (!alive) return;
        setExpected(getExpectedCashForDateLocal(dateKey));
        setSource('local');
      });
    return () => {
      alive = false;
    };
  }, [dateKey, dateValid, refreshKey]);

  const actualNum = Math.round(Number(actual));
  const valid = dateValid && actual.trim() !== '' && Number.isFinite(actualNum) && actualNum >= 0;
  const difference = valid ? actualNum - expected : 0;

  const submit = () => {
    if (!valid) return;
    const row = addDailyClosing(dateKey, expected, actualNum, note.trim() || null);
    if (row) {
      setSaved({ difference, actual: actualNum });
      setActual('');
      setNote('');
      refresh();
      void syncNow();
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader
        title="Clôture de fin de journée"
        subtitle="Caisse attendue (calculée) vs caisse réelle (comptée) → écart affiché."
      />

      <Card>
        <Field
          label="Journée concernée (AAAA-MM-JJ)"
          value={dateKey}
          onChangeText={setDateKey}
          placeholder="2026-09-18"
          autoCorrect={false}
          maxLength={10}
        />

        <Text style={typo.microLabel}>Caisse attendue</Text>
        <Text style={[typo.kpi, { fontSize: 30, marginVertical: SPACING.xs }]}>{formatFcfa(expected)}</Text>
        <View style={styles.sourceRow}>
          {source === 'server' ? (
            <>
              <CheckCircle2 size={14} color={palette.success} />
              <Text style={styles.sourceText}>Calculée par le serveur à partir des mouvements du jour.</Text>
            </>
          ) : (
            <>
              <AlertTriangle size={14} color={palette.warning} />
              <Text style={styles.sourceText}>Hors-ligne : calcul local temporaire, à réconcilier à la sync.</Text>
            </>
          )}
        </View>

        <Field
          label="Caisse réelle comptée (FCFA)"
          keyboardType="number-pad"
          placeholder="ex. 94000"
          value={actual}
          onChangeText={setActual}
        />

        {valid ? (
          <View
            style={[
              styles.diffBox,
              difference === 0
                ? { borderColor: '#CBE6D7', backgroundColor: '#F1F8F4' }
                : difference > 0
                  ? { borderColor: '#C7D0F0', backgroundColor: '#EEF1FB' }
                  : { borderColor: '#F3C6C6', backgroundColor: '#FBE2E2' },
            ]}
          >
            <Text style={typo.microLabel}>Écart</Text>
            <Text style={[typo.kpi, { fontSize: 22 }]}>
              {difference > 0 ? '+' : ''}
              {formatFcfa(difference)}
            </Text>
            <Text style={typo.muted}>
              {difference === 0 ? 'Caisse exacte.' : difference > 0 ? 'Excédent de caisse à expliquer.' : 'Manquant de caisse à expliquer.'}
            </Text>
          </View>
        ) : null}

        <Field
          label="Motif de l’écart (optionnel)"
          placeholder="ex. 6000 payés au fournisseur non saisi"
          value={note}
          onChangeText={setNote}
        />

        {saved ? (
          <Notice tone="success">
            Clôture enregistrée : comptée {formatFcfa(saved.actual)}, écart {saved.difference > 0 ? '+' : ''}
            {formatFcfa(saved.difference)}.
          </Notice>
        ) : null}

        <Button title="Valider la clôture (hors-ligne)" variant="accent" onPress={submit} disabled={!valid} />
      </Card>

      <SectionTitle title="Historique des clôtures" />
      {history.length === 0 ? (
        <EmptyText label="Aucune clôture enregistrée." />
      ) : (
        <Card>
          <View style={[styles.tr, { borderBottomWidth: 1, borderBottomColor: palette.border }]}>
            <Text style={[typo.microLabel, styles.cDay]}>Jour</Text>
            <Text style={[typo.microLabel, styles.cNum]}>Attendue</Text>
            <Text style={[typo.microLabel, styles.cNum]}>Comptée</Text>
            <Text style={[typo.microLabel, styles.cNum]}>Écart</Text>
          </View>
          {history.map((c) => (
            <View key={c.client_uuid} style={styles.tr}>
              <View style={styles.cDay}>
                <Text style={[typo.body, { fontSize: 13 }]}>{formatDate(c.closing_date)}</Text>
                {c.note ? <Text style={[typo.muted, { fontSize: 11 }]} numberOfLines={2}>{c.note}</Text> : null}
              </View>
              <Text style={[typo.body, styles.cNum, { fontSize: 13 }]}>{formatFcfa(c.expected_cash)}</Text>
              <Text style={[typo.body, styles.cNum, { fontSize: 13 }]}>{formatFcfa(c.actual_cash)}</Text>
              <Text
                style={[
                  typo.body,
                  styles.cNum,
                  { fontSize: 13, fontWeight: '700', color: c.difference === 0 ? palette.text : c.difference > 0 ? palette.primary : palette.danger },
                ]}
              >
                {c.difference > 0 ? '+' : ''}
                {formatFcfa(c.difference)}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.lg },
  sourceText: { fontFamily: typo.muted.fontFamily, fontSize: 12, color: palette.textMuted, flex: 1 },
  diffBox: { borderWidth: 1, borderRadius: RADIUS.field, padding: SPACING.md, marginBottom: SPACING.md },
  tr: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm },
  cDay: { flex: 2.2 },
  cNum: { flex: 2, textAlign: 'right' },
});
