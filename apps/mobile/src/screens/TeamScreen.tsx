import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Crown from 'lucide-react-native/icons/crown';
import UserPlus from 'lucide-react-native/icons/user-plus';
import Users from 'lucide-react-native/icons/users';

import { useApp } from '../context/AppContext';
import { createEmployee, listEmployees, UserOut } from '../api/authApi';
import { PIN_MAX, PIN_MIN } from '../config';
import { palette, RADIUS, SPACING, typo } from '../theme';
import { Badge, Button, Card, Field } from '../components/ui';
import { BusinessCodeCard, EmptyText, RestrictedNotice, ScreenHeader } from '../components/shared';

// Même écran « Équipe » que le web : code entreprise à donner aux employés,
// création d'un employé (PIN + permissions), liste des comptes. Propriétaire uniquement.
export function TeamScreen() {
  const { session, refreshKey } = useApp();
  const isOwner = session?.role === 'owner';
  const [employees, setEmployees] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    void listEmployees()
      .then(setEmployees)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Liste indisponible.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOwner) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, refreshKey]);

  if (!isOwner) {
    return (
      <View style={styles.screen}>
        <View style={{ padding: SPACING.lg }}>
          <RestrictedNotice
            icon={<Users size={18} color={palette.textMuted} />}
            label="L’équipe est gérée par le propriétaire. Connecte-toi avec le compte patron pour voir et créer des employés."
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={palette.surface} />}
    >
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <ScreenHeader
            title="Équipe"
            subtitle="Employés, rôles et permissions — chaque action sensible est tracée (Journal)."
          />
        </View>
      </View>

      {session ? (
        <BusinessCodeCard code={session.business_code} hint="Code entreprise — à donner à chaque employé pour se connecter" />
      ) : null}

      <View style={{ marginVertical: SPACING.md }}>
        <Button
          title={open ? 'Fermer' : 'Ajouter un employé'}
          variant="accent"
          onPress={() => setOpen((v) => !v)}
        />
      </View>

      {open ? <CreateEmployeeForm onCreated={() => { setOpen(false); load(); }} /> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && employees.length === 0 && !error ? (
        <EmptyText label="Aucun employé — ajoute ton premier collaborateur." />
      ) : null}

      {employees.map((e) => {
        const isOwnerUser = e.role === 'owner';
        return (
          <Card key={e.id} style={{ marginBottom: SPACING.sm }}>
            <View style={styles.nameRow}>
              {isOwnerUser ? <Crown size={16} color={palette.warning} /> : <Users size={16} color={palette.textMuted} />}
              <Text style={[typo.body, { fontWeight: '700', flexShrink: 1 }]} numberOfLines={1}>{e.full_name}</Text>
              <Badge label={isOwnerUser ? 'propriétaire' : 'employé'} tone={isOwnerUser ? 'primary' : 'success'} />
            </View>
            <View style={styles.badgeRow}>
              {e.phone ? <Text style={typo.muted}>{e.phone}</Text> : null}
              {e.can_view_purchase_prices ? <Badge label="prix d’achat" tone="warning" /> : null}
              {e.can_view_owner_dashboard ? <Badge label="dashboard patron" tone="primary" /> : null}
              {!isOwnerUser && !e.can_view_purchase_prices && !e.can_view_owner_dashboard ? (
                <Text style={typo.muted}>permissions restreintes</Text>
              ) : null}
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

function CreateEmployeeForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [viewPrices, setViewPrices] = useState(false);
  const [viewDashboard, setViewDashboard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPin, setCreatedPin] = useState<string | null>(null);

  const valid = name.trim() !== '' && pin.trim().length >= PIN_MIN && pin.trim().length <= PIN_MAX;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await createEmployee({
        full_name: name.trim(),
        phone: phone.trim() || null,
        pin: pin.trim(),
        can_view_purchase_prices: viewPrices,
        can_view_owner_dashboard: viewDashboard,
      });
      setCreatedPin(pin.trim());
      setName('');
      setPhone('');
      setPin('');
      setViewPrices(false);
      setViewDashboard(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={styles.formHead}>
        <UserPlus size={18} color={palette.primary} />
        <Text style={typo.heading}>Créer un employé</Text>
      </View>

      <Field label="Nom complet" placeholder="ex. Marc Eyenga" value={name} onChangeText={setName} />
      <Field label="Téléphone (optionnel)" placeholder="ex. 6 90 00 00 00" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Field
        label="PIN (4 à 8 chiffres, à remettre à l’employé)"
        placeholder="ex. 1234"
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_MAX}
        value={pin}
        onChangeText={(v) => setPin(v.replace(/[^0-9]/g, ''))}
      />

      <ToggleRow label="Voir les prix d’achat" value={viewPrices} onChange={setViewPrices} />
      <ToggleRow label="Voir le dashboard patron" value={viewDashboard} onChange={setViewDashboard} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {createdPin ? (
        <View style={styles.success}>
          <CheckCircle2 size={16} color={palette.success} />
          <Text style={styles.successText}>Employé créé — PIN à transmettre : {createdPin}</Text>
        </View>
      ) : null}

      <Button title={busy ? 'Création…' : 'Créer l’employé'} variant="accent" onPress={() => void submit()} disabled={busy || !valid} />
    </Card>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)} hitSlop={8}>
      <Text style={[typo.body, { flex: 1, fontSize: 15 }]}>{label}</Text>
      <View style={[styles.checkbox, value && { backgroundColor: palette.primary, borderColor: palette.primary }]}>
        {value ? <Check size={14} color={palette.surface} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  headRow: { flexDirection: 'row', alignItems: 'flex-start' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { fontFamily: typo.body.fontFamily, fontSize: 13, color: palette.danger, marginBottom: SPACING.md },
  success: {
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
  successText: { fontFamily: typo.body.fontFamily, fontSize: 13, color: palette.text, flex: 1 },
});
