import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';

import { palette, RADIUS, SPACING, typo } from '../theme';
import { Card } from './ui';

// Briques communes qui reprennent la structure des écrans web (titre + sous-titre,
// cartes KPI, sections, messages) pour que le contenu affiché soit identique.

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: SPACING.lg }}>
      <Text style={[typo.title, { color: palette.surface }]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      {icon}
      <Text style={[typo.heading, { color: palette.surface, fontSize: 16 }]}>{title}</Text>
    </View>
  );
}

export function EmptyText({ label }: { label: string }) {
  return <Text style={styles.empty}>{label}</Text>;
}

export function KpiCard({
  icon,
  label,
  value,
  tone,
  sub,
  compact,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone?: 'danger' | 'success' | 'warning';
  sub?: string;
  compact?: boolean;
}) {
  const color = tone ? palette[tone] : palette.text;
  return (
    <Card style={compact ? { ...styles.kpiCard, flexBasis: '30%', padding: SPACING.md } : styles.kpiCard}>
      <View style={styles.kpiHead}>
        {icon}
        <Text style={[typo.microLabel, { flexShrink: 1 }]}>{label}</Text>
      </View>
      <Text style={[typo.kpi, { fontSize: compact ? 14 : 20, marginTop: SPACING.xs, color }]}>{value}</Text>
      {sub ? <Text style={[typo.muted, { color: palette.danger, marginTop: 2 }]}>{sub}</Text> : null}
    </Card>
  );
}

const NOTICE = {
  success: { bg: '#F1F8F4', border: '#CBE6D7', fg: palette.text },
  warning: { bg: '#FCEBC8', border: '#F0D9A8', fg: '#7A5208' },
  danger: { bg: '#FBE2E2', border: '#F3C6C6', fg: '#8A1F1F' },
} as const;

export function Notice({ tone, children }: { tone: keyof typeof NOTICE; children: React.ReactNode }) {
  const t = NOTICE[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg, borderColor: t.border }]}>
      {tone === 'success' ? (
        <CheckCircle2 size={20} color={palette.success} />
      ) : (
        <AlertTriangle size={20} color={tone === 'danger' ? palette.danger : palette.warning} />
      )}
      <Text style={[styles.noticeText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

// Le code entreprise est ce que chaque employé saisit (avec son PIN) pour se
// connecter : affiché en permanence dans le menu et sur l'écran Équipe, comme sur
// le web. Appui long = copier (Text selectable, sans dépendance native en plus).
export function BusinessCodeCard({ code, hint }: { code: string; hint?: string }) {
  return (
    <View style={styles.codeCard}>
      <Text style={[typo.microLabel, { color: palette.textMuted }]}>{hint ?? 'Code entreprise'}</Text>
      <Text selectable style={styles.code}>
        {code}
      </Text>
      <Text style={[typo.muted, { fontSize: 11 }]}>Appui long pour copier</Text>
    </View>
  );
}

export function RestrictedNotice({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <View style={styles.restricted}>
      {icon}
      <Text style={[typo.muted, { flex: 1, fontSize: 14 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: palette.textMuted, fontFamily: typo.body.fontFamily, marginTop: SPACING.xs },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md, marginBottom: SPACING.md },
  empty: { color: palette.textMuted, fontFamily: typo.body.fontFamily, fontSize: 14, marginBottom: SPACING.md },
  kpiCard: { flexBasis: '47%', flexGrow: 1, marginBottom: 0 },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  noticeText: { fontFamily: typo.muted.fontFamily, fontSize: 13, flex: 1 },
  codeCard: {
    backgroundColor: '#15161A',
    borderRadius: RADIUS.field,
    borderWidth: 1,
    borderColor: '#22242A',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
  },
  code: { fontFamily: typo.kpi.fontFamily, fontSize: 22, letterSpacing: 2, color: palette.accent, marginVertical: 2 },
  restricted: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderRadius: RADIUS.field,
    borderWidth: 1,
    borderColor: '#22242A',
    backgroundColor: '#15161A',
    padding: SPACING.md,
  },
});
