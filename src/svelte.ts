import { isAbortError, renderAnimated, type RenderOptions } from './render';
import type { AnimationController } from './types';

export type { AnimationController, RenderOptions };

export interface AnimatedMermaidParams extends RenderOptions {
  chart: string;
  onReady?: (controller: AnimationController) => void;
  onError?: (error: Error) => void;
}

/**
 * Svelte action (Svelte 3, 4 and 5, SvelteKit):
 *
 *   <div use:animatedMermaid={{ chart, loop: true }} />
 *
 * No Svelte import needed, so it ships as plain JS.
 */
export function animatedMermaid(node: HTMLElement, params: AnimatedMermaidParams) {
  let ctrl: AnimationController | undefined;
  let abort: AbortController | undefined;

  const run = async (p: AnimatedMermaidParams) => {
    abort?.abort();
    const mine = (abort = new AbortController());
    const { chart, onReady, onError, ...options } = p;
    try {
      const c = await renderAnimated(node, chart, { ...options, signal: mine.signal });
      ctrl?.destroy();
      ctrl = c;
      onReady?.(c);
      node.dispatchEvent(new CustomEvent('ready', { detail: c }));
    } catch (e) {
      if (!mine.signal.aborted && !isAbortError(e)) onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  };

  run(params);
  return {
    update(next: AnimatedMermaidParams) { run(next); },
    destroy() { abort?.abort(); ctrl?.destroy(); ctrl = undefined; },
  };
}
