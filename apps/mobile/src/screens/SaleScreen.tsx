import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import X from 'lucide-react-native/icons/x';

import { useApp } from '../context/AppContext';
import { addSale, getProducts, ProductRow, SaleRow } from '../db/repo';
import { PAYMENT_METHODS, PaymentMethod } from '../config';
import { palette, RADIUS, SPACING, typo } from '../theme';
import { formatFcfa, formatTime } from '../format';
import { Button, Card, Field, Segmented, Stepper } from '../components/ui';
import { ScreenHeader } from '../components/shared';

export function SaleScreen() {
  const { refreshKey, refresh } = useApp();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [qty, setQty] = useState(1);
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [customPrice, setCustomPrice] = useState('');
  const [lastSale, setLastSale] = useState<SaleRow | null>(null);

  useEffect(() => {
    setProducts(getProducts());
  }, [refreshKey]);

  const parsedPrice = Number(customPrice);
  const price =
    customPrice.trim() === ''
      ? selected?.selling_price ?? 0
      : Number.isFinite(parsedPrice) && parsedPrice > 0
        ? parsedPrice
        : 0;
  const total = selected ? qty * price : 0;

  const confirm = () => {
    if (!selected || total <= 0 || lastSale) return;
    const sale = addSale(selected.id, qty, price, payment);
    if (sale) {
      setLastSale(sale);
      refresh();
    }
  };

  const closeLastSale = () => {
    setLastSale(null);
    setSelected(null);
    setQty(1);
    setCustomPrice('');
  };

  // ---------- Écran 1 : catalogue ----------
  if (!selected) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Vente rapide"
          subtitle="Touchez un produit : la vente met à jour ventes, caisse et stock en un seul geste."
        />

        {products.length === 0 ? (
          <Card>
            <Text style={typo.body}>
              Aucun produit disponible — ajoute des produits depuis le web.
            </Text>
          </Card>
        ) : (
          products.map((p) => (
            <PressableCard key={p.id} onPress={() => { setSelected(p); setQty(1); setCustomPrice(''); setLastSale(null); }}>
              <View style={styles.rowBetween}>
                <Text style={[typo.body, { flex: 1, fontWeight: '600' }]}>{p.name}</Text>
                <Text style={[typo.kpi, { fontSize: 18, color: palette.primary }]}>{formatFcfa(p.selling_price)}</Text>
              </View>
              <Text style={typo.muted}>
                stock {p.quantity} · seuil {p.minimum_stock}
              </Text>
            </PressableCard>
          ))
        )}

        {lastSale && (
          <View style={styles.successStrip}>
            <CheckCircle2 size={20} color={palette.success} />
            <Text style={styles.successText}>
              Vente enregistrée hors-ligne : {lastSale.quantity} × {formatFcfa(lastSale.unit_price)} = {formatFcfa(lastSale.total_amount)} ({lastSale.payment_method === 'cash' ? 'cash' : 'Mobile Money'})
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // ---------- Écran 2 : quantification + encaissement ----------
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.rowBetween}>
        <Text style={[typo.title, { color: palette.surface, flex: 1 }]}>Vente</Text>
        <PressableIcon onPress={() => setSelected(null)}>
          <X size={22} color={palette.surface} />
        </PressableIcon>
      </View>

      <Card>
        <Text style={[typo.heading, { marginBottom: SPACING.xs }]}>{selected.name}</Text>
        <Text style={typo.muted}>Stock : {selected.quantity} — une vente n’est jamais bloquée pour un stock insuffisant.</Text>
      </Card>

      <Card>
        <Text style={[typo.microLabel, { marginBottom: SPACING.sm }]}>Quantité</Text>
        <Stepper value={qty} onChange={setQty} />

        <View style={styles.divider} />

        <Text style={[typo.microLabel, { marginBottom: SPACING.sm }]}>Paiement</Text>
        <Segmented
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'mobile_money', label: 'Mobile Money' },
          ]}
          value={payment}
          onChange={setPayment}
        />

        <View style={styles.divider} />

        <Text style={[typo.microLabel, { marginBottom: SPACING.sm }]}>Prix unitaire (optionnel, sinon prix catalogue)</Text>
        <Field
          keyboardType="number-pad"
          placeholder="laisser vide = prix du produit"
          value={customPrice}
          onChangeText={setCustomPrice}
        />

        <View style={styles.divider} />

        <Text style={typo.microLabel}>Total à encaisser</Text>
        <Text style={[typo.kpi, { fontSize: 36, marginVertical: SPACING.sm }]}>{formatFcfa(total)}</Text>

        <Button title="Encaisser (hors-ligne)" variant="accent" onPress={confirm} disabled={total <= 0 || !!lastSale} />
      </Card>

      {lastSale && (
        <Card style={{ backgroundColor: '#F1F8F4', borderColor: '#CBE6D7' }}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
              <CheckCircle2 size={22} color={palette.success} />
              <View style={{ flex: 1 }}>
                <Text style={[typo.body, { fontWeight: '700', color: palette.text }]}>Vente enregistrée</Text>
                <Text style={typo.muted}>{formatFcfa(lastSale.total_amount)} · {formatTime(lastSale.created_at)}</Text>
              </View>
            </View>
            <Button title="Nouvelle vente" variant="secondary" onPress={closeLastSale} />
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

function PressableCard({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <View style={[styles.card, styles.cardPressable]}>
      <Pressable onPress={onPress}>
        {children}
      </Pressable>
    </View>
  );
}

function PressableIcon({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12}>{children}</Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  card: {
    backgroundColor: palette.surface,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: palette.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardPressable: {},
  divider: { height: 1, backgroundColor: palette.border, marginVertical: SPACING.lg },
  successStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F1F8F4',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: '#CBE6D7',
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  successText: { fontFamily: typo.muted.fontFamily, fontSize: 13, color: palette.text, flex: 1 },
});