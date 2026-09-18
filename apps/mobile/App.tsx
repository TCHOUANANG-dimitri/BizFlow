import React, { useState } from 'react';
import {
  Image,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useFonts } from 'expo-font';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { AppProvider, useApp } from './src/context/AppContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { SaleScreen } from './src/screens/SaleScreen';
import { MoneyScreen } from './src/screens/MoneyScreen';
import { StockScreen } from './src/screens/StockScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { ClosingScreen } from './src/screens/ClosingScreen';
import { TeamScreen } from './src/screens/TeamScreen';
import { JournalScreen } from './src/screens/JournalScreen';
import { Drawer, Screen, TopBar } from './src/components/Navigation';
import { palette, RADIUS } from './src/theme';

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
  const { session } = useApp();
  const [screen, setScreen] = useState<Screen>('today');
  const [menuOpen, setMenuOpen] = useState(false);

  const select = (next: Screen) => {
    setScreen(next);
    setMenuOpen(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar onOpenMenu={() => setMenuOpen(true)} />
      <View style={styles.body}>
        {screen === 'today' && <TodayScreen />}
        {screen === 'sale' && <SaleScreen />}
        {screen === 'money' && <MoneyScreen />}
        {screen === 'closing' && <ClosingScreen />}
        {screen === 'stock' && <StockScreen />}
        {screen === 'team' && <TeamScreen />}
        {screen === 'journal' && <JournalScreen />}
      </View>
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} active={screen} onSelect={select} session={session} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' },
  splashIcon: { width: 96, height: 96, borderRadius: RADIUS.card },
  safe: { flex: 1, backgroundColor: palette.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 },
  body: { flex: 1 },
});