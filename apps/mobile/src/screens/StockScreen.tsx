import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import RotateCcwClock from 'lucide-react-native/icons/rotate-ccw-clock';
import Package from 'lucide-react-native/icons/package';
import X from 'lucide-react-native/icons/x';

import { useApp } from '../context/AppContext';
import { addStockMovement, getProducts, getStockMovementFeed, ProductRow, StockKind, StockMovementFeedRow } from '../db/repo';
import { formatTime } from '../format';
import { palette, RADIUS, SPACING, typo } from '../theme';
import { Button, Card, Field, Segmented, Stepper } from '../components/ui';

export function StockScreen() {
  const { refreshKey, refresh } = useApp();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [feed, setFeed] = useState<StockMovementFeedRow[]>([]);
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [kind, setKind] = useState<StockKind>('restock');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setProducts(getProducts());
    setFeed(getStockMovementFeed(30));
  }, [refreshKey]);

  const submit = () => {
    if (!selected) return;
    const delta = kind === 'restock' ? qty : -qty;
    const row = addStockMovement(selected.id, kind, delta, reason.trim() || null);
    if (row) {
      setDone(`${kind === 'restock' ? 'Entrée' : 'Ajustement'} de ${qty} sur ${selected.name}`);
      setSelected(null);
      setQty(1);
      setReason('');
      refresh();
    }
  };

  if (selected) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.rowBetween}>
          <Text style={[typo.title, { color: palette.surface, flex: 1 }]}>Stock</Text>
          <Pressable onPress={() => setSelected(null)} hitSlop={12}>
            <X size={22} color={palette.surface} />
          </Pressable>
        </View>

        <Card>
          <Text style={[typo.heading, { marginBottom: SPACING.xs }]}>{selected.name}</Text>
          <Text style={typo.muted}>Quantité actuelle : {selected.quantity} — seuil minimum : {selected.minimum_stock}</Text>
        </Card>

        <Card>
          <Text style={[typo.microLabel, { marginBottom: SPACING.sm }]}>Type de mouvement</Text>
          <Segmented
            options={[
              { value: 'restock', label: 'Réappro (entrée)' },
              { value: 'adjustment', label: 'Ajustement (perte/casse)' },
            ]}
            value={kind}
            onChange={setKind}
          />

          <View style={styles.divider} />

          <Text style={[typo.microLabel, { marginBottom: SPACING.sm }]}>Quantité</Text>
          <Stepper value={qty} onChange={setQty} min={1} />

          <View style={styles.divider} />

          <Field
            label="Motif (optionnel)"
            placeholder={kind === 'restock' ? 'ex. livraison fournisseur' : 'ex. casse'}
            value={reason}
            onChangeText={setReason}
          />

          <Button title="Enregistrer le mouvement" variant="accent" onPress={submit} />
        </Card>
      </ScrollView>
    );
  }

  const alerts = products.filter((p) => p.quantity <= p.minimum_stock);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[typo.title, { color: palette.surface }]}>Stock</Text>
      <Text style={styles.subtitle}>Entrées, ajustements et seuils.</Text>

      {done && (
        <View style={styles.successStrip}>
          <CheckCircle2 size={20} color={palette.success} />
          <Text style={styles.successText}>{done}</Text>
        </View>
      )}

      {alerts.length > 0 && (
        <View style={styles.alertStrip}>
          <AlertTriangle size={20} color={palette.warning} />
          <Text style={styles.alertText}>
            {alerts.length} produit{alerts.length > 1 ? 's' : ''} sous le seuil minimum.
          </Text>
        </View>
      )}

      {products.length === 0 ? (
        <Card>
          <Text style={typo.body}>
            Aucun produit connu. Le catalogue se remplit après une connexion réussie (propriété du patron, créé côté web).
          </Text>
        </Card>
      ) : (
        products.map((p) => {
          const low = p.quantity <= p.minimum_stock;
          return (
            <Pressable
              key={p.id}
              onPress={() => { setSelected(p); setKind('restock'); setQty(1); setReason(''); setDone(null); }}
              style={styles.productRow}
            >
              <View style={[styles.iconBox, low && { backgroundColor: '#FCEBC8' }]}>
                <Package size={20} color={low ? palette.warning : palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typo.body, { fontWeight: '600' }]}>{p.name}</Text>
                <Text style={typo.muted}>quantité {p.quantity} · seuil {p.minimum_stock}</Text>
              </View>
              {low ? (
                <View style={styles.lowBadge}>
                  <Text style={styles.lowBadgeText}>À VÉRIFIER</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })
      )}

      {feed.length > 0 && (
        <Card style={{ marginTop: SPACING.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
            <RotateCcwClock size={18} color={palette.primary} />
            <Text style={typo.microLabel}>Mouvements récents (tous employés)</Text>
          </View>
          {feed.map((m) => {
            const isSale = m.type === 'sale';
            const isRestock = m.type === 'restock';
            const deltaText = isSale ? `-${m.quantity_delta}` : isRestock ? `+${m.quantity_delta}` : `${m.quantity_delta}`;
            const deltaColor = isRestock ? palette.success : isSale ? palette.warning : palette.textMuted;
            return (
              <View key={m.client_uuid} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <Text style={[typo.body, { fontWeight: '600' }]} numberOfLines={1}>{m.product_name}</Text>
                  <Text style={typo.muted}>
                    Par {m.user_name} · {formatTime(m.created_at)}
                    {m.reason ? ` · ${m.reason}` : ''}
                  </Text>
                </View>
                <Text style={[typo.body, { fontWeight: '700', color: deltaColor }]}>{deltaText}</Text>
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  subtitle: { color: palette.textMuted, fontFamily: typo.body.fontFamily, marginBottom: SPACING.lg },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: SPACING.lg },
  productRow: {
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
  iconBox: { width: 40, height: 40, borderRadius: RADIUS.field, backgroundColor: '#EDF0FB', alignItems: 'center', justifyContent: 'center' },
  lowBadge: { backgroundColor: '#FCEBC8', borderRadius: RADIUS.field, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  lowBadgeText: { fontFamily: typo.microLabel.fontFamily, fontSize: 11, color: palette.warning, fontWeight: '600' },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  successStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F1F8F4',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: '#CBE6D7',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  successText: { fontFamily: typo.muted.fontFamily, fontSize: 13, color: palette.text, flex: 1 },
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
});