/**
 * Identité visuelle BPS — « le flash ».
 * Toutes les couleurs de l'app viennent d'ici : ne pas coder de couleur en dur
 * dans les écrans.
 */
export const palette = {
  flash: '#FF4D2E',
  flashPink: '#FF2E7E',
  night: '#6C5CE7',
  success: '#22C55E',
  danger: '#EF4444',
} as const;

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryAlt: string;
  onPrimary: string;
  accent: string;
  success: string;
  danger: string;
}

export const colors: Record<ColorScheme, ThemeColors> = {
  dark: {
    background: '#0B0B0F',
    surface: '#16161D',
    surfaceAlt: '#1F1F28',
    border: '#2A2A35',
    text: '#F5F5F7',
    textMuted: '#9A9AA8',
    primary: palette.flash,
    primaryAlt: palette.flashPink,
    onPrimary: '#FFFFFF',
    accent: '#8B7CF6',
    success: palette.success,
    danger: palette.danger,
  },
  light: {
    background: '#FAFAF7',
    surface: '#FFFFFF',
    surfaceAlt: '#F0F0EC',
    border: '#E3E3DE',
    text: '#111114',
    textMuted: '#6B6B76',
    primary: palette.flash,
    primaryAlt: palette.flashPink,
    onPrimary: '#FFFFFF',
    accent: palette.night,
    success: palette.success,
    danger: palette.danger,
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodyBold: 'Inter_700Bold',
} as const;

export const typography = {
  hero: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  subtitle: { fontFamily: fonts.displayMedium, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 20 },
} as const;

export type TypographyVariant = keyof typeof typography;
