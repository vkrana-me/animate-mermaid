import { collectUnits, type Unit } from './graph';
import { schedule, type Slot } from './timeline';
import type { AnimateOptions, AnimationController, EdgeEffect, NodeEffect } from './types';

const DEFAULTS = {
  order: 'flow',
  nodeEffect: 'pop',
  edgeEffect: 'draw',
  nodeDuration: 450,
  edgeDuration: 500,
  stagger: 120,
  delay: 0,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  edgeEasing: 'cubic-bezier(0.65, 0, 0.35, 1)',
  loop: false,
  loopHold: 1500,
  autoplay: true,
  respectReducedMotion: true,
} satisfies Required<AnimateOptions>;

const FADE_OUT = 400;
/** Marks every element we animate; export uses it to freeze frames. */
export const UNIT_CLASS = 'am-u';
const WRAP_CLASS = 'am-w';
const STYLE_ATTR = 'data-animate-mermaid';

let instances = 0;

const HIDDEN: Record<Exclude<NodeEffect, 'none'>, string> = {
  fade: 'opacity:0',
  pop: 'opacity:0;transform:scale(0.6)',
  slide: 'opacity:0;transform:translateY(12px)',
};
const SHOWN = 'opacity:1;transform:none';

const pct = (ms: number, period: number) => `${Math.min(100, Math.max(0, (ms / period) * 100)).toFixed(3)}%`;

function isPatterned(el: Element, dash: string): boolean {
  const cls = el.getAttribute('class') ?? '';
  if (/dotted|dashed|edge-animation/.test(cls)) return true;
  if (/pattern-solid/.test(cls)) return false;
  // Mermaid 11+ puts `0 0 <len> <gap>` on solid edges to stop short of the arrowhead.
  return dash !== 'none' && !/^0(px)?,?\s+0(px)?[,\s]/.test(dash) && !/^0(px)?$/.test(dash);
}

/** Move a group's children into an inner <g> so CSS transforms don't clobber Mermaid's own `transform` attribute. */
function wrap(el: Element): Element {
  if (el.tagName.toLowerCase() !== 'g') return el;
  const w = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  w.setAttribute('class', WRAP_CLASS);
  while (el.firstChild) w.appendChild(el.firstChild);
  el.appendChild(w);
  return w;
}

function unwrap(w: Element) {
  const parent = w.parentNode;
  if (!parent) return;
  while (w.firstChild) parent.insertBefore(w.firstChild, w);
  w.remove();
}

interface Plan { target: Element; name: string; frames: string }

function nodeFrames(effect: Exclude<NodeEffect, 'none'>, s: Slot, period: number, easing: string, loopEnd?: number): string {
  const a = pct(s.start, period);
  const b = pct(s.start + s.dur, period);
  const tail = loopEnd !== undefined
    ? `${b},${pct(loopEnd, period)}{${SHOWN};animation-timing-function:ease-in}100%{opacity:0;transform:none}`
    : `${b},100%{${SHOWN}}`;
  return `0%,${a}{${HIDDEN[effect]};animation-timing-function:${easing}}${tail}`;
}

interface EdgeGeo { length: number; dash: string; offset: string }

function edgeFrames(s: Slot, period: number, easing: string, geo: EdgeGeo, markers: { start?: string; end?: string }, loopEnd?: number): string {
  const L = geo.length.toFixed(2);
  const a = pct(s.start, period);
  const b = pct(s.start + s.dur, period);
  const justBefore = pct(Math.max(s.start, s.start + s.dur - 1), period);
  const restore = pct(s.start + s.dur + 1, period);
  const mk = (v: (m: string) => string) =>
    [markers.start && `marker-start:${v(markers.start)}`, markers.end && `marker-end:${v(markers.end)}`].filter(Boolean).join(';');
  const hideMk = mk(() => 'none');
  const showMk = mk((m) => m);
  // Each property only interpolates between keyframes that mention it, so the
  // discrete switches (markers, original dash pattern) sit right at the end of the draw.
  let f = `0%,${a}{stroke-dasharray:${L} ${L};stroke-dashoffset:${L};animation-timing-function:${easing}}`;
  f += `${b}{stroke-dasharray:${L} ${L};stroke-dashoffset:0}`;
  f += `${restore},100%{stroke-dasharray:${geo.dash};stroke-dashoffset:${geo.offset}}`;
  if (hideMk) f += `0%,${justBefore}{${hideMk}}${b},100%{${showMk}}`;
  if (loopEnd !== undefined) f += `0%,${pct(loopEnd, period)}{opacity:1;animation-timing-function:ease-in}100%{opacity:0}`;
  return f;
}

/**
 * Animate an already-rendered Mermaid SVG (it must be in the document so
 * layout can be measured). Returns a controller for play/pause/seek.
 */
export function animate(svg: SVGSVGElement, options: AnimateOptions = {}): AnimationController {
  const o = { ...DEFAULTS, ...stripUndefined(options) };
  const id = `am${++instances}`;
  const units = collectUnits(svg);

  const slots = schedule(
    units.map((u) => ({ kind: u.kind, key: u.key, from: u.from, to: u.to, rect: u.el.getBoundingClientRect() })),
    o,
  );
  const duration = Math.max(0, ...slots.map((s) => s.start + s.dur));
  const loopEnd = o.loop ? duration + o.loopHold : undefined;
  const period = o.loop ? duration + o.loopHold + FADE_OUT : Math.max(duration, 1);

  const plans: Plan[] = [];
  const wrappers: Element[] = [];

  units.forEach((u: Unit, i) => {
    const s = slots[i];
    const name = `${id}-k${i}`;
    if (u.kind === 'edge') {
      let effect: EdgeEffect = o.edgeEffect;
      if (effect === 'none') return;
      const cs = getComputedStyle(u.el);
      const geom = u.el as unknown as SVGGeometryElement;
      if (effect === 'draw' && (isPatterned(u.el, cs.strokeDasharray) || typeof geom.getTotalLength !== 'function')) effect = 'fade';
      if (effect === 'draw') {
        const geo: EdgeGeo = { length: geom.getTotalLength() + 1, dash: cs.strokeDasharray || 'none', offset: cs.strokeDashoffset || '0' };
        const markers = {
          start: u.el.getAttribute('marker-start') ?? undefined,
          end: u.el.getAttribute('marker-end') ?? undefined,
        };
        plans.push({ target: u.el, name, frames: edgeFrames(s, period, o.edgeEasing, geo, markers, loopEnd) });
      } else {
        plans.push({ target: u.el, name, frames: nodeFrames('fade', s, period, o.easing, loopEnd) });
      }
      return;
    }
    const effect = u.kind === 'cluster' && o.nodeEffect === 'pop' ? 'fade' : o.nodeEffect;
    if (effect === 'none') return;
    const target = wrap(u.el);
    if (target !== u.el) wrappers.push(target);
    plans.push({ target, name, frames: nodeFrames(effect, s, period, o.easing, loopEnd) });
  });

  const iter = o.loop ? 'infinite' : '1';
  let css = `.${WRAP_CLASS},.${UNIT_CLASS}{transform-box:fill-box;transform-origin:center}`;
  plans.forEach((p, i) => {
    const cls = `${id}-u${i}`;
    p.target.classList.add(UNIT_CLASS, cls);
    css += `@keyframes ${p.name}{${p.frames}}`;
    css += `.${cls}{animation:${p.name} ${period}ms linear 0ms ${iter} both}`;
  });
  css += `.${id}-paused .${UNIT_CLASS}{animation-play-state:paused}`;
  if (o.respectReducedMotion) {
    css += `@media (prefers-reduced-motion: reduce){.${UNIT_CLASS}{animation:none!important}}`;
  }

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.setAttribute(STYLE_ATTR, id);
  style.textContent = css;
  svg.appendChild(style);

  const pausedClass = `${id}-paused`;
  if (o.autoplay !== true) svg.classList.add(pausedClass);

  const anims = (): Animation[] =>
    svg.getAnimations({ subtree: true }).filter(
      (a) => typeof (a as CSSAnimation).animationName === 'string' && (a as CSSAnimation).animationName.startsWith(`${id}-`),
    );

  let observer: IntersectionObserver | undefined;

  const ctrl: AnimationController = {
    svg,
    duration,
    period,
    play() {
      svg.classList.remove(pausedClass);
      anims().forEach((a) => a.play());
    },
    pause() {
      anims().forEach((a) => a.pause());
    },
    restart() {
      ctrl.seek(0);
      ctrl.play();
    },
    seek(ms: number) {
      const t = o.loop ? ((ms % period) + period) % period : Math.min(Math.max(ms, 0), period);
      anims().forEach((a) => { a.currentTime = t; });
    },
    destroy() {
      observer?.disconnect();
      style.remove();
      svg.classList.remove(pausedClass);
      plans.forEach((p, i) => p.target.classList.remove(UNIT_CLASS, `${id}-u${i}`));
      wrappers.forEach(unwrap);
    },
  };

  if (o.autoplay === 'visible' && typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer?.disconnect();
        ctrl.restart();
      }
    }, { threshold: 0.25 });
    observer.observe(svg);
  }

  return ctrl;
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
