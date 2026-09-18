import React, { useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFonts } from 'expo-font';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import Banknote from 'lucide-react-native/icons/banknote';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Package from 'lucide-react-native/icons/package';
import PlusCircle from 'lucide-react-native/icons/circle-plus';

import { AppProvider, useApp } from './src/context/AppContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { SaleScreen } from './src/screens/SaleScreen';
import { MoneyScreen } from './src/screens/MoneyScreen';
import { StockScreen } from './src/screens/StockScreen';
import { JourScreen } from './src/screens/JourScreen';
import { palette, RADIUS, SPACING, typo } from './src/theme';

type Tab = 'sale' | 'money' | 'stock' | 'jour';

const TABS: { key: Tab; label: string; Icon: typeof PlusCircle }[] = [
  { key: 'sale', label: 'Vendre', Icon: PlusCircle },
  { key: 'money', label: 'Argent', Icon: Banknote },
  { key: 'stock', label: 'Stock', Icon: Package },
  { key: 'jour', label: 'Jour', Icon: CalendarDays },
];

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_800ExtraBold,
    Manrope_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <StatusBar barStyle="light-content" backgroundColor={palette.background} />
        <Image source={require('./assets/brand/bizflow-icon.png')} style={styles.splashIcon} resizeMode="contain" />
      </View>
    );
  }

  return (
    <AppProvider>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />
      <Root />
    </AppProvider>
  );
}

function Root() {
  const { status, ready } = useApp();

  if (!ready || status === 'loading') {
    return (
      <View style={styles.splash}>
        <Image source={require('./assets/brand/bizflow-icon.png')} style={styles.splashIcon} resizeMode="contain" />
      </View>
    );
  }

  if (status === 'loggedOut') return <AuthScreen />;
  return <Shell />;
}

function Shell() {
  const [tab, setTab] = useState<Tab>('sale');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        {tab === 'sale' && <SaleScreen />}
        {tab === 'money' && <MoneyScreen />}
        {tab === 'stock' && <StockScreen />}
        {tab === 'jour' && <JourScreen />}
      </View>
      <View style={styles.tabBar}>
        {TABS.map(({ key, label, Icon }) => {
          const active = key === tab;
          const color = active ? palette.accentLight : palette.textMuted;
          return (
            <Pressable key={key} style={styles.tab} onPress={() => setTab(key)} hitSlop={8}>
              <Icon size={22} color={color} />
              <Text style={[styles.tabLabel, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' },
  splashIcon: { width: 96, height: 96, borderRadius: RADIUS.card },
  safe: { flex: 1, backgroundColor: palette.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: palette.background,
    borderTopWidth: 1,
    borderTopColor: '#22242A',
    paddingTop: SPACING.sm,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xl : SPACING.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabLabel: { fontFamily: typo.microLabel.fontFamily, fontSize: 11, letterSpacing: 0.4 },
});