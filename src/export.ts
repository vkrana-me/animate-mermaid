import { UNIT_CLASS } from './animate';

/** A point in the animation: ms from start, or `'end'` for the finished diagram. */
export type Frame = number | 'end';

export interface SvgExportOptions {
  /** Freeze at this frame. Omit to keep the animation (self-playing SVG file). */
  frame?: Frame;
  /** Write explicit pixel width/height (needed when rasterizing). */
  scale?: number;
  /** Fill color behind the diagram, e.g. `'white'`. */
  background?: string;
}

export interface PngExportOptions {
  /** Which frame to capture. Default `'end'`. */
  frame?: Frame;
  /** Pixel density multiplier. Default 2. */
  scale?: number;
  /** Background fill. Default `'white'`; pass `'transparent'` for none. */
  background?: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function size(svg: SVGSVGElement): { width: number; height: number } {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width && vb.height) return { width: vb.width, height: vb.height };
  const r = svg.getBoundingClientRect();
  return { width: r.width || 800, height: r.height || 600 };
}

/**
 * Serialize an animated diagram to a standalone SVG string. Without `frame`
 * the file keeps its CSS animation and plays when opened in a browser,
 * `<img>` tag, GitHub README, etc.
 */
export function toSvgString(svg: SVGSVGElement, options: SvgExportOptions = {}): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  // Exported files always play (drop any "paused, waiting for play()" class).
  for (const c of Array.from(clone.classList)) if (/^am\d+-paused$/.test(c)) clone.classList.remove(c);

  if (options.scale !== undefined) {
    const { width, height } = size(svg);
    clone.setAttribute('width', String(width * options.scale));
    clone.setAttribute('height', String(height * options.scale));
    clone.style.removeProperty('max-width');
  }

  if (options.background && options.background !== 'transparent') {
    clone.style.backgroundColor = options.background;
  }

  if (options.frame !== undefined) {
    const freeze = document.createElementNS(SVG_NS, 'style');
    freeze.textContent = options.frame === 'end'
      ? `.${UNIT_CLASS}{animation:none!important}`
      : `.${UNIT_CLASS}{animation-delay:${-Math.max(0, options.frame)}ms!important;animation-play-state:paused!important}`;
    clone.appendChild(freeze);
  }

  return new XMLSerializer().serializeToString(clone);
}

/** Render one frame onto a canvas. Use it to build GIF/APNG/video frames. */
export async function renderFrame(svg: SVGSVGElement, options: PngExportOptions = {}): Promise<HTMLCanvasElement> {
  const scale = options.scale ?? 2;
  const background = options.background ?? 'white';
  const { width, height } = size(svg);
  const str = toSvgString(svg, { frame: options.frame ?? 'end', scale });

  const img = new Image();
  img.decoding = 'sync';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(str)}`;
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('animate-mermaid: 2D canvas unavailable');
  if (background !== 'transparent') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Export one frame (default: the finished diagram) as a PNG blob. */
export async function toPng(svg: SVGSVGElement, options: PngExportOptions = {}): Promise<Blob> {
  const canvas = await renderFrame(svg, options);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('animate-mermaid: PNG encoding failed'))), 'image/png'),
  );
}

/** Animated SVG as a Blob, ready for download or upload. */
export function toSvgBlob(svg: SVGSVGElement, options: SvgExportOptions = {}): Blob {
  return new Blob([toSvgString(svg, options)], { type: 'image/svg+xml' });
}

/** Trigger a browser download. */
export function download(data: Blob | string, filename: string): void {
  const blob = typeof data === 'string' ? new Blob([data], { type: 'image/svg+xml' }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
