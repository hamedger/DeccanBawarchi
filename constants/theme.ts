export const colors = {
  background: '#0c0a08',
  backgroundSecondary: '#0e0c07',
  backgroundCard: '#141109',
  gold: '#d4af37',
  goldLight: '#e8cc6a',
  goldBright: '#f0d060',
  goldDark: '#a88920',
  white: '#f5efe6',
  whiteMuted: 'rgba(245, 239, 230, 0.45)',
  green: '#43a047',
  greenLight: '#66bb6a',
  border: 'rgba(212, 175, 55, 0.15)',
  borderStrong: 'rgba(212, 175, 55, 0.35)',
  error: '#ef5350',
  success: '#66bb6a',
  overlay: 'rgba(12, 10, 8, 0.85)',
}

export const fonts = {
  serif: 'PlayfairDisplay_700Bold',
  serifRegular: 'PlayfairDisplay_400Regular',
  display: 'CormorantGaramond_600SemiBold',
  displayLight: 'CormorantGaramond_400Regular',
  sans: 'Jost_400Regular',
  sansMedium: 'Jost_500Medium',
  sansBold: 'Jost_700Bold',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const borderRadius = {
  sm: 2,
  md: 4,
  lg: 8,
  xl: 12,
  full: 9999,
}

export const typography = {
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: 0.5,
    color: colors.white,
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 28,
    color: colors.white,
  },
  tagline: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 3,
    color: colors.gold,
    textTransform: 'uppercase' as const,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.whiteMuted,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.white,
  },
}
