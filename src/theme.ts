import type { MermaidConfig } from 'mermaid';

/**
 * Diagram colors. Only `bg` and `fg` are required; every other slot is
 * derived by mixing `fg` into `bg` when it is left out.
 */
export interface ThemeColors {
  /** Background. */
  bg: string;
  /** Text and the base color everything else is mixed from. */
  fg: string;
  /** Edges and connectors. */
  line?: string;
  /** Arrowheads, highlights and the `edgeMotion` color. */
  accent?: string;
  /** Secondary text (edge labels, notes). */
  muted?: string;
  /** Node fill. */
  surface?: string;
  /** Node and group borders. */
  border?: string;
}

/** Built-in palettes. */
export const THEMES = {
  'zinc-light': { bg: '#FFFFFF', fg: '#27272A' },
  'zinc-dark': { bg: '#18181B', fg: '#FAFAFA' },
  'tokyo-night': { bg: '#1a1b26', fg: '#a9b1d6', line: '#3d59a1', accent: '#7aa2f7', muted: '#565f89' },
  'tokyo-night-storm': { bg: '#24283b', fg: '#a9b1d6', line: '#3d59a1', accent: '#7aa2f7', muted: '#565f89' },
  'tokyo-night-light': { bg: '#d5d6db', fg: '#343b58', line: '#34548a', accent: '#34548a', muted: '#9699a3' },
  'catppuccin-mocha': { bg: '#1e1e2e', fg: '#cdd6f4', line: '#585b70', accent: '#cba6f7', muted: '#6c7086' },
  'catppuccin-latte': { bg: '#eff1f5', fg: '#4c4f69', line: '#9ca0b0', accent: '#8839ef', muted: '#9ca0b0' },
  nord: { bg: '#2e3440', fg: '#d8dee9', line: '#4c566a', accent: '#88c0d0', muted: '#616e88' },
  'nord-light': { bg: '#eceff4', fg: '#2e3440', line: '#aab1c0', accent: '#5e81ac', muted: '#7b88a1' },
  dracula: { bg: '#282a36', fg: '#f8f8f2', line: '#6272a4', accent: '#bd93f9', muted: '#6272a4' },
  'github-light': { bg: '#ffffff', fg: '#1f2328', line: '#d1d9e0', accent: '#0969da', muted: '#59636e' },
  'github-dark': { bg: '#0d1117', fg: '#e6edf3', line: '#3d444d', accent: '#4493f8', muted: '#9198a1' },
  'solarized-light': { bg: '#fdf6e3', fg: '#657b83', line: '#93a1a1', accent: '#268bd2', muted: '#93a1a1' },
  'solarized-dark': { bg: '#002b36', fg: '#839496', line: '#586e75', accent: '#268bd2', muted: '#586e75' },
  'one-dark': { bg: '#282c34', fg: '#abb2bf', line: '#4b5263', accent: '#c678dd', muted: '#5c6370' },
} as const satisfies Record<string, ThemeColors>;

export type ThemeName = keyof typeof THEMES;
export type Theme = ThemeName | ThemeColors;

type RGB = [number, number, number];

function parseHex(c: string): RGB | undefined {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return undefined;
  const h = m[1].length === 3 ? m[1].replace(/./g, (x) => x + x) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

const hex = (rgb: RGB) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** `pct`% of `fg` over `bg`. Falls back to `fg` for colors that aren't hex. */
export function mix(fg: string, bg: string, pct: number): string {
  const a = parseHex(fg);
  const b = parseHex(bg);
  if (!a || !b) return fg;
  const t = pct / 100;
  return hex([0, 1, 2].map((i) => a[i] * t + b[i] * (1 - t)) as RGB);
}

function isDark(c: string): boolean {
  const rgb = parseHex(c);
  if (!rgb) return false;
  const [r, g, b] = rgb.map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
}

export function resolveTheme(theme: Theme): Required<ThemeColors> {
  const t: ThemeColors = typeof theme === 'string' ? THEMES[theme] : theme;
  if (!t) throw new Error(`animate-mermaid: unknown theme "${String(theme)}"`);
  const { bg, fg } = t;
  return {
    bg,
    fg,
    line: t.line ?? mix(fg, bg, 50),
    accent: t.accent ?? mix(fg, bg, 85),
    muted: t.muted ?? mix(fg, bg, 60),
    surface: t.surface ?? mix(fg, bg, 6),
    border: t.border ?? mix(fg, bg, 30),
  };
}

/**
 * Mermaid config (`theme: 'base'` + `themeVariables` + `themeCSS`) for a
 * palette. Use it when you render with your own Mermaid pipeline:
 *
 *   mermaid.initialize({ startOnLoad: false, ...themeConfig('nord') })
 */
export function themeConfig(theme: Theme): MermaidConfig {
  const c = resolveTheme(theme);
  const soft = mix(c.fg, c.bg, 3);
  const vars = {
    darkMode: isDark(c.bg),
    background: c.bg,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    textColor: c.fg,
    titleColor: c.fg,
    primaryColor: c.surface,
    primaryTextColor: c.fg,
    primaryBorderColor: c.border,
    secondaryColor: soft,
    secondaryTextColor: c.fg,
    secondaryBorderColor: c.border,
    tertiaryColor: soft,
    tertiaryTextColor: c.fg,
    tertiaryBorderColor: c.border,
    mainBkg: c.surface,
    nodeBorder: c.border,
    nodeTextColor: c.fg,
    lineColor: c.line,
    arrowheadColor: c.accent,
    clusterBkg: soft,
    clusterBorder: c.border,
    edgeLabelBackground: c.bg,
    noteBkgColor: mix(c.fg, c.bg, 8),
    noteTextColor: c.fg,
    noteBorderColor: c.border,
    actorBkg: c.surface,
    actorBorder: c.border,
    actorTextColor: c.fg,
    actorLineColor: c.line,
    signalColor: c.line,
    signalTextColor: c.fg,
    labelBoxBkgColor: c.surface,
    labelBoxBorderColor: c.border,
    labelTextColor: c.fg,
    loopTextColor: c.fg,
    activationBkgColor: mix(c.fg, c.bg, 10),
    activationBorderColor: c.border,
    sequenceNumberColor: c.bg,
    labelColor: c.fg,
    altBackground: soft,
    classText: c.fg,
    transitionColor: c.line,
    transitionLabelColor: c.muted,
    stateLabelColor: c.fg,
    stateBkg: c.surface,
    specialStateColor: c.fg,
    attributeBackgroundColorOdd: c.surface,
    attributeBackgroundColorEven: soft,
  };
  // Arrowheads take the accent (Mermaid ties them to lineColor otherwise),
  // edge labels the muted color.
  const css = [
    `.marker,marker path,.arrowheadPath,.arrowMarkerPath{fill:${c.accent}!important;stroke:${c.accent}!important}`,
    `.marker.cross{fill:none!important}`,
    `.edgeLabel,.edgeLabel p,.edgeLabel span{color:${c.muted}!important}`,
    `.edgeLabel rect,.labelBkg{fill:${c.bg}!important;background-color:${c.bg}!important}`,
  ].join('');
  return { theme: 'base', themeVariables: vars, themeCSS: css };
}
