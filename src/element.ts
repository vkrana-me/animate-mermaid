import { isAbortError, renderAnimated } from './render';
import { toPng, toSvgString, type Frame } from './export';
import { toGif, type GifExportOptions } from './gif';
import type { RenderOptions } from './render';
import type { ThemeName } from './theme';
import type { AnimationController } from './types';

/**
 * `<animated-mermaid>` custom element. Works in any framework (Vue, Angular,
 * Solid, Astro, plain HTML). Diagram source goes in the element's text or the
 * `chart` property.
 *
 *   <animated-mermaid order="flow" loop>
 *     flowchart LR
 *       A --> B
 *   </animated-mermaid>
 */
// Importing on the server (SSR) must not crash: HTMLElement only exists in browsers.
const Base = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

export class AnimatedMermaidElement extends Base {
  static observedAttributes = ['order', 'node-effect', 'edge-effect', 'node-duration', 'edge-duration', 'stagger', 'loop', 'autoplay', 'theme', 'transparent', 'edge-motion', 'edge-motion-duration', 'edge-motion-color'];

  controller: AnimationController | null = null;
  private _chart: string | null = null;
  private host: HTMLDivElement;
  private abort?: AbortController;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>:host{display:block}svg{max-width:100%;height:auto}</style><div part="diagram"></div>';
    this.host = root.querySelector('div')!;
  }

  get chart(): string { return this._chart ?? this.textContent ?? ''; }
  set chart(v: string) { this._chart = v; this.render(); }

  connectedCallback() { this.render(); }
  attributeChangedCallback() { if (this.isConnected) this.render(); }
  disconnectedCallback() { this.abort?.abort(); this.controller?.destroy(); this.controller = null; }

  private options(): RenderOptions {
    const num = (n: string) => (this.hasAttribute(n) ? Number(this.getAttribute(n)) : undefined);
    const autoplay = this.getAttribute('autoplay');
    return {
      order: (this.getAttribute('order') as RenderOptions['order']) ?? undefined,
      nodeEffect: (this.getAttribute('node-effect') as RenderOptions['nodeEffect']) ?? undefined,
      edgeEffect: (this.getAttribute('edge-effect') as RenderOptions['edgeEffect']) ?? undefined,
      edgeMotion: (this.getAttribute('edge-motion') as RenderOptions['edgeMotion']) ?? undefined,
      edgeMotionDuration: num('edge-motion-duration'),
      edgeMotionColor: this.getAttribute('edge-motion-color') ?? undefined,
      theme: (this.getAttribute('theme') as ThemeName) || undefined,
      transparent: this.hasAttribute('transparent'),
      nodeDuration: num('node-duration'),
      edgeDuration: num('edge-duration'),
      stagger: num('stagger'),
      loop: this.hasAttribute('loop'),
      autoplay: autoplay === null ? true : autoplay === 'visible' ? 'visible' : autoplay !== 'false',
    };
  }

  private async render() {
    const src = this.chart.trim();
    if (!src) return;
    this.abort?.abort();
    const mine = (this.abort = new AbortController());
    try {
      const c = await renderAnimated(this.host, src, { ...this.options(), signal: mine.signal });
      this.controller?.destroy();
      this.controller = c;
      this.dispatchEvent(new CustomEvent('ready', { detail: c }));
    } catch (error) {
      if (!mine.signal.aborted && !isAbortError(error)) this.dispatchEvent(new CustomEvent('error', { detail: error }));
    }
  }

  play() { this.controller?.play(); }
  pause() { this.controller?.pause(); }
  restart() { this.controller?.restart(); }
  seek(ms: number) { this.controller?.seek(ms); }
  toSvg(frame?: Frame) { return this.controller ? toSvgString(this.controller.svg, { frame }) : ''; }
  toPng(frame: Frame = 'end') {
    if (!this.controller) return Promise.reject(new Error('animate-mermaid: not rendered yet'));
    return toPng(this.controller.svg, { frame });
  }
  toGif(options?: GifExportOptions) {
    if (!this.controller) return Promise.reject(new Error('animate-mermaid: not rendered yet'));
    return toGif(this.controller, options);
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('animated-mermaid')) {
  customElements.define('animated-mermaid', AnimatedMermaidElement);
}

declare global {
  interface HTMLElementTagNameMap { 'animated-mermaid': AnimatedMermaidElement }
}
