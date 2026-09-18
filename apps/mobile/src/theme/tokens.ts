// Source unique des tokens (CLAUDE.md / DESIGN_SYSTEM.md §2) : on importe le
// fichier de packages/shared, on ne retranscrit jamais un hex à la main.
import tokens from '../../../../packages/shared/design-tokens.json';

export const palette = tokens.color;
export const radii = tokens.radius;
export const spacingScale = tokens.spacing as [number, number, number, number, number, number];

// Échelle stricte 4 / 8 / 12 / 16 / 24 / 32
export const SPACING = {
  xs: spacingScale[0],
  sm: spacingScale[1],
  md: spacingScale[2],
  lg: spacingScale[3],
  xl: spacingScale[4],
  xxl: spacingScale[5],
} as const;

export const RADIUS = {
  field: radii.field,
  card: radii.card,
  block: radii.block,
} as const;