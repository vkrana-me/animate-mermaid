import type { MermaidConfig } from 'mermaid';
import { animate } from './animate';
import type { AnimateOptions, AnimationController } from './types';

type Mermaid = typeof import('mermaid').default;

export interface RenderOptions extends AnimateOptions {
  /** Pass your own Mermaid instance. Otherwise `mermaid` is imported lazily. */
  mermaid?: Mermaid;
  /** Passed to `mermaid.initialize()` before rendering. */
  mermaidConfig?: MermaidConfig;
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
let initialized = false;

/**
 * Render Mermaid source into `container` and animate it.
 * Browser-only: call it from an effect / onMount, never during SSR.
 */
export async function renderAnimated(
  container: Element,
  code: string,
  options: RenderOptions = {},
): Promise<AnimationController> {
  const { mermaid: provided, mermaidConfig, signal, ...animOptions } = options;
  throwIfAborted(signal);
  const mermaid = provided ?? (await import('mermaid')).default;
  if (mermaidConfig || (!provided && !initialized)) {
    mermaid.initialize({ startOnLoad: false, ...mermaidConfig });
    initialized = true;
  }
  const id = `animate-mermaid-${++counter}`;
  const { svg, bindFunctions } = await mermaid.render(id, code);
  throwIfAborted(signal);
  container.innerHTML = svg;
  bindFunctions?.(container);
  const el = container.querySelector('svg');
  if (!el) throw new Error('animate-mermaid: Mermaid did not produce an <svg>');
  return animate(el, animOptions);
}
