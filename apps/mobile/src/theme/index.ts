import { TextStyle } from 'react-native';

import { palette, RADIUS, SPACING } from './tokens';

// Noms exacts exportés par @expo-google-fonts (chargés via useFonts dans App).
export const FONT = {
  heading: 'Manrope_800ExtraBold',
  kpi: 'Manrope_700Bold',
  body: 'Inter_400Regular',
  microLabel: 'Inter_500Medium',
} as const;

// Typographie DESIGN_SYSTEM §3 : titres Manrope 800, KPI Manrope 700,
// corps Inter 400, micro-labels Inter 500 majuscules avec letter-spacing.
export const typo: Record<'title' | 'heading' | 'kpi' | 'body' | 'muted' | 'microLabel', TextStyle> = {
  title: { fontFamily: FONT.heading, fontSize: 24, color: palette.text },
  heading: { fontFamily: FONT.heading, fontSize: 18, color: palette.text },
  kpi: { fontFamily: FONT.kpi, fontSize: 32, color: palette.text },
  body: { fontFamily: FONT.body, fontSize: 16, color: palette.text },
  muted: { fontFamily: FONT.body, fontSize: 13, color: palette.textMuted },
  microLabel: {
    fontFamily: FONT.microLabel,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: palette.textMuted,
  },
};

export { palette, SPACING, RADIUS };