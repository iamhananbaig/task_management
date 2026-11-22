import { useColorScheme } from 'react-native';

/**
 * Colours matched to the web app's theme tokens (frontend/src/index.css), light and dark.
 * Status / tag colours mirror the web's swatches.
 */
const light = {
  background: '#ffffff',
  surface: '#f6f6f7',
  card: '#ffffff',
  text: '#18181b',
  textMuted: '#71717a',
  border: '#e4e4e7',
  primary: '#2547d0',
  primaryText: '#f2f5ff',
  danger: '#d92d20',
  dangerSoft: '#fdecea',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  success: '#047857',
  overlay: 'rgba(0,0,0,0.45)',
};

const dark: typeof light = {
  background: '#0a0a0b',
  surface: '#18181b',
  card: '#1f1f23',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  border: 'rgba(255,255,255,0.12)',
  primary: '#3a5be0',
  primaryText: '#f2f5ff',
  danger: '#f97066',
  dangerSoft: 'rgba(249,112,102,0.15)',
  warning: '#fbbf24',
  warningSoft: 'rgba(251,191,36,0.15)',
  success: '#34d399',
  overlay: 'rgba(0,0,0,0.6)',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Soft background + readable text for a named colour (status, tag, project). */
const swatches: Record<string, { light: [string, string]; dark: [string, string]; dot: string }> = {
  gray: { light: ['#f4f4f5', '#52525b'], dark: ['#27272a', '#d4d4d8'], dot: '#a1a1aa' },
  blue: { light: ['#dbeafe', '#1d4ed8'], dark: ['rgba(59,130,246,0.2)', '#93c5fd'], dot: '#3b82f6' },
  sky: { light: ['#e0f2fe', '#0369a1'], dark: ['rgba(14,165,233,0.2)', '#7dd3fc'], dot: '#0ea5e9' },
  green: { light: ['#d1fae5', '#047857'], dark: ['rgba(16,185,129,0.2)', '#6ee7b7'], dot: '#10b981' },
  amber: { light: ['#fef3c7', '#92400e'], dark: ['rgba(245,158,11,0.2)', '#fcd34d'], dot: '#f59e0b' },
  orange: { light: ['#ffedd5', '#c2410c'], dark: ['rgba(249,115,22,0.2)', '#fdba74'], dot: '#f97316' },
  red: { light: ['#fee2e2', '#b91c1c'], dark: ['rgba(239,68,68,0.2)', '#fca5a5'], dot: '#ef4444' },
  purple: { light: ['#ede9fe', '#6d28d9'], dark: ['rgba(139,92,246,0.2)', '#c4b5fd'], dot: '#8b5cf6' },
  pink: { light: ['#fce7f3', '#be185d'], dark: ['rgba(236,72,153,0.2)', '#f9a8d4'], dot: '#ec4899' },
};

export function useSwatch(color: string | null | undefined) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const swatch = swatches[color ?? 'gray'] ?? swatches.gray;
  const [background, text] = swatch[scheme];
  return { background, text, dot: swatch.dot };
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 6, md: 10, lg: 14 } as const;
