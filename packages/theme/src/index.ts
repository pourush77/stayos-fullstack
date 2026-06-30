export * from './animations';
export * from './breakpoints';
export * from './colors';
export * from './radius';
export * from './shadows';
export * from './spacing';
export * from './typography';
export * from './zIndex';

import { animations } from './animations';
import { breakpoints } from './breakpoints';
import { colors } from './colors';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { typography } from './typography';
import { zIndex } from './zIndex';

export const stayosTheme = {
  animations,
  breakpoints,
  colors,
  radius,
  shadows,
  spacing,
  typography,
  zIndex,
} as const;
