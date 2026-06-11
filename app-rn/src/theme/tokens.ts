/**
 * Design tokens — port of /tmp/chatapp_design/design_handoff_meyou/styles.css.
 * Source of truth: design handoff README §"Design Tokens".
 *
 * Note: React Native StyleSheet does not support oklch() — values below are
 * the sRGB equivalents pre-computed from the oklch() declarations in the spec.
 */

export const colors = {
  // foundation (light theme)
  bg: '#FAFAFC',
  surface: '#FFFFFF',
  surface2: '#F4F4F8',
  line: '#E6E5EC',
  text: '#1F1E29',
  text2: '#605F70',
  muted: '#8E8DA0',

  // brand sweep — the 4 stops that define the gradient
  brandBlue: '#4F8FE8',
  brandPurple: '#8B5CD8',
  brandPink: '#E25CAE',
  brandOrange: '#F08A4A',

  // primary resolves to brand-pink for solid surfaces
  primary: '#E25CAE',
  primarySoft: '#FCE3F0',
  primaryDeep: '#B23D87',

  // functional
  accentRose: '#E25CAE',
  accentRoseSoft: '#FCE3F0',
  online: '#3CC479',
  danger: '#E14B5C',
  like: '#3CC479',
  nope: '#E8607C',

  // semantic aliases — PREFER these in new code (stable names, fixed meaning).
  // They intentionally resolve to the same hexes as the older functional keys.
  secondary: '#8B5CD8', // = brandPurple
  success: '#3CC479', // = online
  error: '#E14B5C', // = danger
  warning: '#F0A23C',
  info: '#4F8FE8', // = brandBlue
  textMuted: '#8E8DA0', // = muted

  // Plaza role dots (Phase 3) — a single coloured dot next to a name signals
  // the user's standing. Server sends a `roleTag`; the client maps it here.
  roleColors: {
    admin: '#A855F7', // 🟣 official / staff
    vip: '#FBBF24', // 🟡 active Premium / VIP
    veteran: '#3B82F6', // 🔵 level ≥ 10
    new: '#22C55E', // 🟢 account < 7 days
    normal: '#9CA3AF', // ⚪ default
  },

  // chat
  bubbleMeBg: '#E25CAE',
  bubbleMeText: '#FFFFFF',
  bubbleThemBg: '#FFFFFF',
  bubbleThemText: '#1F1E29',

  // dark theme (placeholders — not used in v2 launch)
  dark: {
    bg: '#1B1820',
    surface: '#26222C',
    surface2: '#2E2934',
    line: '#3A353F',
    text: '#F2F0F5',
    text2: '#B9B6C2',
    muted: '#8D8A95',
  },
} as const;

/** Linear gradient — the 4-stop brand sweep matching the logo. */
export const brandGradient = {
  // For LinearGradient component (expo-linear-gradient)
  colors: [colors.brandBlue, colors.brandPurple, colors.brandPink, colors.brandOrange] as const,
  locations: [0, 0.33, 0.67, 1] as const,
  // 135deg = top-left → bottom-right
  start: { x: 0, y: 0 } as const,
  end: { x: 1, y: 1 } as const,
};

export const typography = {
  // CJK uses the platform default — PingFang SC on iOS, Noto Sans CJK SC
  // on Android — which avoids bundling ~30 MB of CJK glyphs. The system
  // string maps to whatever RN picks by default.
  fontZh: 'System',
  fontEn: 'System', // Helvetica Neue on iOS, system on Android
  fontDisplay: 'Fraunces', // italic 400; load via expo-font (see theme/fonts.ts)
  size: {
    display: 48,
    displayLg: 64,
    h1: 26,
    h2: 28,
    h3: 18, // section / sheet headings
    cardName: 22,
    body: 15,
    bodySm: 14,
    caption: 13,
    captionSm: 12,
    eyebrow: 12,
    label: 11, // ALL-CAPS micro labels / badges
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  letterSpacing: {
    tight: -0.4,
    normal: 0,
    eyebrow: 0.72, // 0.06em at 12px
  },
};

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  // common compounds
  cardPadding: 18,
  fieldPaddingV: 14,
  fieldPaddingH: 16,
  topbarV: 8,
  topbarH: 20,
};

export const radius = {
  s: 10,
  m: 14,
  l: 16,
  xl: 22,
  xxl: 28,
  pill: 999,
};

export const shadows = {
  soft: {
    shadowColor: '#3C285A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 2,
  },
  card: {
    shadowColor: '#3C285A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 4,
  },
  pop: {
    shadowColor: '#3C285A',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.16,
    shadowRadius: 60,
    elevation: 8,
  },
  cta: {
    // Coloured shadow for primary buttons.
    shadowColor: '#4F8FE8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
};

/** Canonical lucide-icon sizes. Use instead of hardcoding `size={18}` etc. */
export const iconSize = {
  xs: 14, // inline w/ caption text
  s: 16, // dense rows, chips
  m: 20, // default action / list icon
  l: 24, // primary header actions
  xl: 28, // hero / empty-state glyphs
};

export const layout = {
  tabBarHeight: 84,
  ctaHeight: 52,
  ctaHeightSm: 48,
  cardMaxWidth: 390,
};

/** Animation curves — used by Reanimated where appropriate. */
export const motion = {
  /** Standard ease for pop-ins / sheet slides. */
  easeOut: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
  durationPop: 280,
  durationSheet: 320,
  durationFade: 250,
  /** Swipe-card fling threshold (px) */
  swipeThreshold: 100,
  /** Off-screen target after release (px). */
  swipeFlyDistance: 600,
  swipeFlyDuration: 250,
};

/** Avatar gradient pairs — keyed by `avatarIdx` (% length). */
export const avatarGradients: [string, string][] = [
  ['#7AB6F5', '#4F8FE8'], // blue
  ['#F4B393', '#ED8A5C'], // orange
  ['#C9A7F5', '#8B5CD8'], // purple
  ['#F8C8B8', '#E25CAE'], // pink
  ['#FFD7A0', '#F39B5C'], // amber
  ['#A8E0D0', '#5DB8A0'], // mint
  ['#F2A8B7', '#C76B8A'], // rose
  ['#FFCBA4', '#E89066'], // peach
  ['#A7C4F0', '#5C7BD8'], // cobalt
  ['#FAD0C9', '#E76F8E'], // coral
];

export type ColorKey = keyof typeof colors;
