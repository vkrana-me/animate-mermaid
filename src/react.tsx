import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import { isAbortError, renderAnimated, type RenderOptions } from './render';
import type { AnimationController } from './types';

export type { AnimationController, RenderOptions };

/** Stable key for options so inline objects don't re-render the diagram every time. */
function optionsKey(o: RenderOptions): string {
  const { mermaid: _m, signal: _s, ...rest } = o;
  return JSON.stringify(rest);
}

/**
 * Hook: render + animate `chart` into the returned ref.
 * Works with Next.js (App Router: file is marked "use client"), TanStack Start, Vite, CRA.
 */
export function useAnimatedMermaid(chart: string, options: RenderOptions = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [controller, setController] = useState<AnimationController | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const key = optionsKey(options);
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const abort = new AbortController();
    let ctrl: AnimationController | null = null;
    renderAnimated(el, chart, { ...latest.current, signal: abort.signal }).then(
      (c) => {
        ctrl = c;
        setController(c);
        setError(null);
      },
      (e: unknown) => {
        if (!abort.signal.aborted && !isAbortError(e)) setError(e instanceof Error ? e : new Error(String(e)));
      },
    );
    return () => {
      abort.abort();
      ctrl?.destroy();
      setController(null);
    };
  }, [chart, key]);

  return { ref, controller, error };
}

export interface AnimatedMermaidProps extends RenderOptions {
  chart: string;
  className?: string;
  style?: CSSProperties;
  onReady?: (controller: AnimationController) => void;
  onError?: (error: Error) => void;
}

/** `<AnimatedMermaid chart={src} loop />`. The ref gives you the AnimationController. */
export const AnimatedMermaid = forwardRef<AnimationController | null, AnimatedMermaidProps>(function AnimatedMermaid(
  { chart, className, style, onReady, onError, ...options },
  forwarded,
) {
  const { ref, controller, error } = useAnimatedMermaid(chart, options);
  useImperativeHandle(forwarded, () => controller as AnimationController, [controller]);

  const cb = useRef({ onReady, onError });
  cb.current = { onReady, onError };
  useEffect(() => { if (controller) cb.current.onReady?.(controller); }, [controller]);
  useEffect(() => { if (error) cb.current.onError?.(error); }, [error]);

  return <div ref={ref} className={className} style={style} data-animate-mermaid="" />;
});
