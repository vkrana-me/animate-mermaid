import { renderFrame } from './export';
import type { AnimationController } from './types';

export interface GifExportOptions {
  /** Frames per second. Default 20 (GIF timing is in 10 ms steps, so 10, 20, 25 and 50 are exact). */
  fps?: number;
  /** Pixel density multiplier. Default 1 (GIFs get large fast). */
  scale?: number;
  /** Cap the output width in px (scale is reduced to fit). Default 1200. */
  maxWidth?: number;
  /** Background fill. Default `'white'`. `'transparent'` gives 1-bit transparency. */
  background?: string;
  /** How long to hold the finished diagram before the GIF repeats (ms). Default 1500, or 0 when the animation already loops. */
  holdEnd?: number;
  /** Times to repeat: 0 = forever (default), -1 = play once. */
  repeat?: number;
  /** Length to capture (ms). Default: one full cycle of the animation. */
  duration?: number;
  /** Called with progress from 0 to 1 while frames render. */
  onProgress?: (progress: number) => void;
  /** Cancel a long export. */
  signal?: AbortSignal;
}

function isController(x: unknown): x is AnimationController {
  return !!x && typeof x === 'object' && 'svg' in x && 'period' in x;
}

/** Longest CSS animation cycle in the SVG. Used when given a bare <svg>. */
function measurePeriod(svg: SVGSVGElement): number {
  let max = 0;
  for (const a of svg.getAnimations({ subtree: true })) {
    const d = Number(a.effect?.getTiming().duration);
    if (Number.isFinite(d)) max = Math.max(max, d);
  }
  return max;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Record the whole animation as an animated GIF, frame by frame (not in real
 * time, so output is smooth even on slow machines). Pass the controller from
 * `animate()` / `renderAnimated()`, or an animated `<svg>`.
 */
export async function toGif(source: AnimationController | SVGSVGElement, options: GifExportOptions = {}): Promise<Blob> {
  const { quantize, applyPalette, GIFEncoder } = await import('gifenc');
  const svg = isController(source) ? source.svg : source;
  const loops = isController(source) ? source.period > source.duration + 1 : false;
  const duration = options.duration ?? (isController(source) ? source.period : measurePeriod(svg));
  const fps = Math.max(1, Math.min(50, options.fps ?? 20));
  const background = options.background ?? 'white';
  const transparent = background === 'transparent';
  const holdEnd = options.holdEnd ?? (loops ? 0 : 1500);

  const vb = svg.viewBox?.baseVal;
  const width = vb && vb.width ? vb.width : svg.getBoundingClientRect().width;
  const scale = Math.min(options.scale ?? 1, (options.maxWidth ?? 1200) / Math.max(1, width));

  const step = 1000 / fps;
  // With edge motion the finished diagram keeps moving, so the hold is real
  // frames (rounded to whole motion cycles) instead of one still frame.
  const motionCycle = isController(source) ? source.motionCycle : 0;
  const animatedHold = motionCycle > 0 && !loops && holdEnd > 0 && options.duration === undefined;
  const hold = animatedHold ? Math.max(1, Math.round(holdEnd / motionCycle)) * motionCycle : 0;
  const times: number[] = [];
  for (let t = 0; t < duration + hold; t += step) times.push(t);
  // Final frame: the finished diagram ('end') unless the animation loops back to empty.
  const last: number | 'end' = loops || animatedHold ? duration + hold : 'end';

  const grab = async (frame: number | 'end') => {
    const canvas = await renderFrame(svg, { frame, scale, background });
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, w: canvas.width, h: canvas.height };
  };

  // One palette for every frame, taken from the finished diagram (it has every
  // color), so colors don't shimmer between frames.
  const final = await grab('end');
  const format = transparent ? 'rgba4444' : 'rgb565';
  const palette = quantize(final.data, 256, transparent ? { format, oneBitAlpha: true } : { format });
  const transparentIndex = transparent ? palette.findIndex((c) => c[3] === 0) : -1;

  const gif = GIFEncoder();
  const total = times.length + 1;
  const write = (data: Uint8ClampedArray, w: number, h: number, delay: number, first: boolean) => {
    gif.writeFrame(applyPalette(data, palette, format), w, h, {
      palette: first ? palette : undefined,
      delay,
      repeat: first ? (options.repeat ?? 0) : undefined,
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
      dispose: transparent ? 2 : -1,
    });
  };

  for (let i = 0; i < times.length; i++) {
    if (options.signal?.aborted) throw Object.assign(new Error('animate-mermaid: GIF export aborted'), { name: 'AbortError' });
    const f = await grab(times[i]);
    write(f.data, f.w, f.h, step, i === 0);
    options.onProgress?.((i + 1) / total);
    if (i % 4 === 3) await tick(); // keep the page responsive
  }
  const end = last === 'end' ? final : await grab(last);
  write(end.data, end.w, end.h, animatedHold ? step : step + holdEnd, times.length === 0);
  options.onProgress?.(1);

  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}
