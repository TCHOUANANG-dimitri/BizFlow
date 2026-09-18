import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import ClipboardCheck from 'lucide-react-native/icons/clipboard-check';
import House from 'lucide-react-native/icons/house';
import LogOut from 'lucide-react-native/icons/log-out';
import Menu from 'lucide-react-native/icons/menu';
import Package from 'lucide-react-native/icons/package';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import ScrollText from 'lucide-react-native/icons/scroll-text';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Users from 'lucide-react-native/icons/users';
import Wallet from 'lucide-react-native/icons/wallet';

import { useApp } from '../context/AppContext';
import { Session } from '../auth/session';
import { palette, RADIUS, SPACING, typo } from '../theme';
import { BusinessCodeCard } from './shared';

// Mêmes sections, mêmes libellés et même ordre que la sidebar du web
// (apps/web/app/components/Sidebar.tsx) ; Équipe et Journal réservés au propriétaire.
export type Screen = 'today' | 'sale' | 'money' | 'closing' | 'stock' | 'team' | 'journal';

interface NavLink {
  key: Screen;
  label: string;
  Icon: typeof House;
}

const LINKS: NavLink[] = [
  { key: 'today', label: 'Aujourd’hui', Icon: House },
  { key: 'sale', label: 'Vente', Icon: ShoppingCart },
  { key: 'money', label: 'Argent', Icon: Wallet },
  { key: 'closing', label: 'Clôture', Icon: ClipboardCheck },
  { key: 'stock', label: 'Stock', Icon: Package },
];

const OWNER_LINKS: NavLink[] = [
  { key: 'team', label: 'Équipe', Icon: Users },
  { key: 'journal', label: 'Journal', Icon: ScrollText },
];

const DRAWER_WIDTH = Math.min(288, Dimensions.get('window').width * 0.82);

export function Drawer({
  open,
  onClose,
  active,
  onSelect,
  session,
}: {
  open: boolean;
  onClose: () => void;
  active: Screen;
  onSelect: (screen: Screen) => void;
  session: Session | null;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: open ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [open, progress]);

  const links = session?.role === 'owner' ? [...LINKS, ...OWNER_LINKS] : LINKS;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_WIDTH, 0] }) }] },
        ]}
      >
        <Pressable onPress={onClose} style={styles.brand} accessibilityLabel="Réduire le menu">
          <Image source={require('../../assets/brand/bizflow-icon.png')} style={styles.brandIcon} resizeMode="contain" />
          <Text style={[typo.heading, { color: palette.surface }]}>BizFlow</Text>
        </Pressable>

        <View style={styles.links}>
          {links.map(({ key, label, Icon }) => {
            const isActive = key === active;
            const color = isActive ? palette.background : 'rgba(255,255,255,0.7)';
            return (
              <Pressable
                key={key}
                onPress={() => onSelect(key)}
                style={[styles.link, isActive && { backgroundColor: palette.accent }]}
              >
                <Icon size={20} color={color} />
                <Text style={[styles.linkText, { color }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {session ? (
          <View style={styles.footer}>
            <Text style={[typo.body, { color: palette.surface, fontWeight: '600', fontSize: 14 }]} numberOfLines={1}>
              {session.full_name}
            </Text>
            <Text style={[typo.muted, { fontSize: 12 }]}>{session.role === 'owner' ? 'Propriétaire' : 'Employé'}</Text>
            <BusinessCodeCard code={session.business_code} />
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { syncState, syncNow, logout } = useApp();

  let SyncIcon = RefreshCw;
  let syncColor: string = palette.textMuted;
  if (syncState.phase === 'ok') {
    SyncIcon = CheckCircle2;
    syncColor = palette.success;
  } else if (syncState.phase === 'error') {
    SyncIcon = TriangleAlert;
    syncColor = palette.danger;
  } else if (syncState.phase === 'syncing') {
    syncColor = palette.primary;
  }

  return (
    <View style={styles.topBar}>
      <Pressable onPress={onOpenMenu} style={styles.topBrand} hitSlop={8} accessibilityLabel="Ouvrir le menu">
        <Menu size={22} color={palette.surface} />
        <Image source={require('../../assets/brand/bizflow-icon.png')} style={styles.topIcon} resizeMode="contain" />
        <Text style={[typo.heading, { color: palette.surface, fontSize: 16 }]}>BizFlow</Text>
      </Pressable>
      <View style={styles.topActions}>
        <SyncIcon size={18} color={syncColor} />
        <Pressable onPress={() => void syncNow()} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Synchroniser maintenant">
          <RefreshCw size={16} color={palette.surface} />
        </Pressable>
        <Pressable onPress={() => void logout()} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Se déconnecter">
          <LogOut size={16} color={palette.surface} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...(StyleSheet.absoluteFill as object), backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#15161A',
    borderRightWidth: 1,
    borderRightColor: '#22242A',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#22242A',
  },
  brandIcon: { width: 36, height: 36, borderRadius: 8 },
  links: { flex: 1, padding: SPACING.md, gap: SPACING.xs },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderRadius: RADIUS.field,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  linkText: { fontFamily: typo.body.fontFamily, fontSize: 14, fontWeight: '600' },
  footer: { borderTopWidth: 1, borderTopColor: '#22242A', padding: SPACING.lg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#22242A',
    backgroundColor: palette.background,
  },
  topBrand: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  topIcon: { width: 26, height: 26, borderRadius: 6 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.field,
    borderWidth: 1,
    borderColor: '#22242A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
