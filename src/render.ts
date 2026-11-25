import type { MermaidConfig } from 'mermaid';
import { animate } from './animate';
import { resolveTheme, themeConfig, type Theme } from './theme';
import type { AnimateOptions, AnimationController } from './types';

type Mermaid = typeof import('mermaid').default;

export interface RenderOptions extends AnimateOptions {
  /** Pass your own Mermaid instance. Otherwise `mermaid` is imported lazily. */
  mermaid?: Mermaid;
  /** Passed to `mermaid.initialize()` before rendering. */
  mermaidConfig?: MermaidConfig;
  /**
   * Color theme: a built-in name (`'nord'`, `'tokyo-night'`, `'github-dark'`, ...,
   * see `THEMES`) or your own `{ bg, fg, line?, accent?, muted?, surface?, border? }`.
   * Values in `mermaidConfig.themeVariables` win over the theme's.
   */
  theme?: Theme;
  /** With `theme`, leave the SVG background transparent instead of painting `bg`. Default false. */
  transparent?: boolean;
  /** Abort a stale render (e.g. the chart changed). The container is left untouched. */
  signal?: AbortSignal;
}

/** True for the error `renderAnimated` throws when its `signal` aborts. */
export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error('animate-mermaid: render aborted');
    err.name = 'AbortError';
    throw err;
  }
}

let counter = 0;
/** Config last passed to the lazily imported Mermaid (it is global state). */
let lastKey: string | undefined;

function buildConfig(mermaidConfig: MermaidConfig | undefined, theme: Theme | undefined): MermaidConfig {
  const base: MermaidConfig = { startOnLoad: false };
  if (!theme) return { ...base, ...mermaidConfig };
  const t = themeConfig(theme);
  return {
    ...base,
    ...t,
    ...mermaidConfig,
    themeVariables: { ...t.themeVariables, ...mermaidConfig?.themeVariables },
    themeCSS: (t.themeCSS ?? '') + (mermaidConfig?.themeCSS ?? ''),
  };
}

/**
 * Render Mermaid source into `container` and animate it.
 * Browser-only: call it from an effect / onMount, never during SSR.
 */
export async function renderAnimated(
  container: Element,
  code: string,
  options: RenderOptions = {},
): Promise<AnimationController> {
  const { mermaid: provided, mermaidConfig, theme, transparent, signal, ...animOptions } = options;
  throwIfAborted(signal);
  const mermaid = provided ?? (await import('mermaid')).default;
  const config = buildConfig(mermaidConfig, theme);
  if (provided) {
    // Your instance, your config: only touch it when asked to.
    if (mermaidConfig || theme) mermaid.initialize(config);
  } else {
    // Re-initialize whenever the config changes, so a themed render
    // doesn't leak its theme into the next unthemed one.
    const key = JSON.stringify(config);
    if (key !== lastKey) {
      mermaid.initialize(config);
      lastKey = key;
    }
  }
  const id = `animate-mermaid-${++counter}`;
  const { svg, bindFunctions } = await mermaid.render(id, code);
  throwIfAborted(signal);
  container.innerHTML = svg;
  bindFunctions?.(container);
  const el = container.querySelector('svg');
  if (!el) throw new Error('animate-mermaid: Mermaid did not produce an <svg>');
  if (theme) {
    const c = resolveTheme(theme);
    if (!transparent) el.style.backgroundColor = c.bg;
    // Default color for `edgeMotion` overlays.
    el.style.setProperty('--am-motion', c.accent);
  }
  return animate(el, animOptions);
}
