/* ── LinguoLab Glass Theme System ───────────────────────────────────────────
   Emerald accent. Pearl (light) + Nuar (dark).
   Adapted from FlowerShop glass-theme.store.ts
   ─────────────────────────────────────────────────────────────────────────── */

export type GlassThemeId = 'pearl' | 'nuar';

export interface GlassTheme {
  id: GlassThemeId;
  label: string;
  // Ambient glows
  g1: string;
  g2: string;
  g3: string;
  // Accent (emerald)
  accent: string;
  accentText: string;
  accentGlow: string;
  // TabBar
  tabbarBg: string;
  // Body & glass surfaces
  bodyBg: string;
  glassBg: string;
  glassCardBg: string;
  glassGreenBg: string;
  glassGreenBorder: string;
  glassBorder: string;
  // Text
  textColor: string;
  hintColor: string;
  // Dividers
  dividerColor: string;
}

export const GLASS_THEMES: GlassTheme[] = [
  // ── Pearl (Light) ─────────────────────────────────────────────────────────
  {
    id: 'pearl',
    label: 'Pearl',
    g1: 'rgba(16,185,129,0.12)',
    g2: 'rgba(5,150,105,0.08)',
    g3: 'rgba(52,211,153,0.07)',
    accent: '#059669',
    accentText: '#ffffff',
    accentGlow: 'rgba(5,150,105,0.38)',
    tabbarBg: 'rgba(215,230,220,0.80)',
    bodyBg: '#eef1f8',
    glassBg: 'rgba(255,255,255,0.60)',
    glassCardBg: 'rgba(255,255,255,0.55)',
    glassGreenBg: 'rgba(16,185,129,0.09)',
    glassGreenBorder: 'rgba(16,185,129,0.22)',
    glassBorder: 'rgba(0,0,0,0.10)',
    textColor: '#0f172a',
    hintColor: '#64748b',
    dividerColor: 'rgba(0,0,0,0.07)',
  },
  // ── Nuar (Dark) ───────────────────────────────────────────────────────────
  {
    id: 'nuar',
    label: 'Nuar',
    g1: 'rgba(16,185,129,0.20)',
    g2: 'rgba(5,150,105,0.14)',
    g3: 'rgba(52,211,153,0.10)',
    accent: '#10b981',
    accentText: '#ffffff',
    accentGlow: 'rgba(16,185,129,0.42)',
    tabbarBg: 'rgba(9,20,15,0.88)',
    bodyBg: '#09120e',
    glassBg: 'rgba(255,255,255,0.04)',
    glassCardBg: 'rgba(255,255,255,0.035)',
    glassGreenBg: 'rgba(16,185,129,0.10)',
    glassGreenBorder: 'rgba(16,185,129,0.22)',
    glassBorder: 'rgba(255,255,255,0.09)',
    textColor: '#f0fdf4',
    hintColor: '#6ee7b7',
    dividerColor: 'rgba(255,255,255,0.06)',
  },
];

export function applyGlassTheme(id: GlassThemeId) {
  const t = GLASS_THEMES.find((x) => x.id === id) ?? GLASS_THEMES[0];
  const r = document.documentElement;

  r.style.setProperty('--glass-g1', t.g1);
  r.style.setProperty('--glass-g2', t.g2);
  r.style.setProperty('--glass-g3', t.g3);

  r.style.setProperty('--glass-accent', t.accent);
  r.style.setProperty('--glass-accent-text', t.accentText);
  r.style.setProperty('--glass-accent-glow', t.accentGlow);

  r.style.setProperty('--glass-tabbar-bg', t.tabbarBg);

  r.style.setProperty('--glass-body-bg', t.bodyBg);
  r.style.setProperty('--glass-bg', t.glassBg);
  r.style.setProperty('--glass-card-bg', t.glassCardBg);
  r.style.setProperty('--glass-green-bg', t.glassGreenBg);
  r.style.setProperty('--glass-green-border', t.glassGreenBorder);
  r.style.setProperty('--glass-border', t.glassBorder);

  r.style.setProperty('--glass-text', t.textColor);
  r.style.setProperty('--glass-hint', t.hintColor);
  r.style.setProperty('--glass-divider', t.dividerColor);

  // data-theme attribute for CSS selectors
  r.setAttribute('data-theme', id);
}

export function getStoredTheme(): GlassThemeId {
  if (typeof window === 'undefined') return 'nuar';
  return (localStorage.getItem('linguolab-theme') as GlassThemeId) ?? 'nuar';
}

export function storeTheme(id: GlassThemeId) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('linguolab-theme', id);
}
