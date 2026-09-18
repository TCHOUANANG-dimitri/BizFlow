import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Users from 'lucide-react-native/icons/users';

import { createEmployee } from '../api/authApi';
import { useApp } from '../context/AppContext';
import { PIN_MAX, PIN_MIN } from '../config';
import { palette, RADIUS, SPACING, typo } from '../theme';
import { Button, Card, Field } from './ui';

export function TeamCard() {
  const { refresh } = useApp();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [viewPrices, setViewPrices] = useState(false);
  const [viewDashboard, setViewDashboard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const valid =
    name.trim() !== '' &&
    pin.trim().length >= PIN_MIN &&
    pin.trim().length <= PIN_MAX;

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
      setCreated(pin.trim());
      setName('');
      setPhone('');
      setPin('');
      setViewPrices(false);
      setViewDashboard(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={styles.head}>
        <Users size={18} color={palette.primary} />
        <Text style={typo.microLabel}>Équipe — créer un employé</Text>
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
        onChangeText={setPin}
      />

      <ToggleRow label="Voir les prix d’achat" value={viewPrices} onChange={setViewPrices} />
      <ToggleRow label="Voir le dashboard patron" value={viewDashboard} onChange={setViewDashboard} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {created ? (
        <View style={styles.success}>
          <Check size={16} color={palette.success} />
          <Text style={styles.successText}>
            Employé créé. PIN à transmettre : {created}
          </Text>
        </View>
      ) : null}

      <Button title="Créer l’employé" variant="secondary" onPress={() => void submit()} disabled={busy || !valid} />
      <Text style={[typo.muted, styles.hint]}>
        La création est possible ici ; la liste et la gestion complète de l’équipe se font depuis le web.
      </Text>
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
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
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
  hint: { marginTop: SPACING.sm, fontSize: 12 },
});