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
  edgeMotion: 'none',
  edgeMotionDuration: 0,
  edgeMotionColor: '',
  autoplay: true,
  respectReducedMotion: true,
} satisfies Required<AnimateOptions>;

const FADE_OUT = 400;
/** Marks every element we animate; export uses it to freeze frames. */
export const UNIT_CLASS = 'am-u';
const WRAP_CLASS = 'am-w';
const MOTION_CLASS = 'am-m';
const SVG_NS = 'http://www.w3.org/2000/svg';
const MOTION_FADE_IN = 200;
/** Dash pattern for `edgeMotion: 'dash'`, in multiples of the overlay stroke width. */
const DASH = 2;
const GAP = 3.5;
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
  const w = document.createElementNS(SVG_NS, 'g');
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

/** Overlay shown on top of an edge once it has appeared: keyframes for its visibility. */
function motionFrames(appear: number, period: number, loopEnd?: number): string {
  const a = pct(appear, period);
  const b = pct(appear + MOTION_FADE_IN, period);
  const tail = loopEnd !== undefined
    ? `${b},${pct(loopEnd, period)}{opacity:1;animation-timing-function:ease-in}100%{opacity:0}`
    : `${b},100%{opacity:1}`;
  return `0%,${a}{opacity:0}${tail}`;
}

/**
 * Build the motion overlay for one edge path: a <g> (carries the path's own
 * transform and the visibility animation) holding marching dashes or a dot.
 */
function motionOverlay(path: SVGGeometryElement, kind: 'dash' | 'dot', color: string, cls: { group: string; item: string }): Element | undefined {
  const d = path.getAttribute('d');
  if (!d || !path.parentNode) return undefined;
  const cs = getComputedStyle(path);
  // A bit bolder than the edge itself so the motion reads on top of it.
  const width = Math.max(2, (parseFloat(cs.strokeWidth) || 1) * 1.5);
  const stroke = color || (cs.stroke && cs.stroke !== 'none' ? cs.stroke : 'currentColor');

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', `${MOTION_CLASS} ${cls.group}`);
  g.setAttribute('pointer-events', 'none');
  g.setAttribute('aria-hidden', 'true');
  const t = path.getAttribute('transform');
  if (t) g.setAttribute('transform', t);

  let item: Element;
  if (kind === 'dash') {
    item = document.createElementNS(SVG_NS, 'path');
    item.setAttribute('d', d);
    item.setAttribute('fill', 'none');
    item.setAttribute('stroke-width', String(width));
    item.setAttribute('stroke-linecap', 'round');
    item.setAttribute('style', `stroke:${stroke};stroke-dasharray:${width * DASH} ${width * GAP}`);
  } else {
    item = document.createElementNS(SVG_NS, 'circle');
    item.setAttribute('r', String(width * 1.75));
    item.setAttribute('style', `fill:${stroke};offset-path:path('${d.replace(/'/g, '')}');offset-rotate:0deg`);
  }
  item.setAttribute('class', cls.item);
  g.appendChild(item);
  path.parentNode.insertBefore(g, path.nextSibling);
  return g;
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
  const overlays: Element[] = [];
  const motion = o.edgeMotion;
  const motionCycle = motion === 'none' ? 0 : o.edgeMotionDuration || (motion === 'dash' ? 1000 : 2000);
  // Explicit color, else the theme accent (renderAnimated sets --am-motion), else each edge's own stroke.
  const motionColor = o.edgeMotionColor || (svg.style.getPropertyValue('--am-motion') ? 'var(--am-motion)' : '');
  const motionItem = `${id}-mi`;

  units.forEach((u: Unit, i) => {
    const s = slots[i];
    const name = `${id}-k${i}`;
    if (u.kind === 'edge') {
      let effect: EdgeEffect = o.edgeEffect;
      if (motion !== 'none' && typeof (u.el as unknown as SVGGeometryElement).getTotalLength === 'function') {
        const group = `${id}-mg${overlays.length}`;
        const g = motionOverlay(u.el as unknown as SVGGeometryElement, motion, motionColor, { group, item: motionItem });
        if (g) {
          overlays.push(g);
          const appear = effect === 'none' ? 0 : s.start + s.dur;
          plans.push({ target: g, name: `${id}-mv${overlays.length}`, frames: motionFrames(appear, period, loopEnd) });
        }
      }
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
  if (motionCycle > 0) {
    for (const g of overlays) g.firstElementChild?.classList.add(UNIT_CLASS);
    if (motion === 'dash') {
      // Shift by exactly one dash+gap so the loop is seamless; the pattern is in stroke-width units.
      const w = (g: Element) => Math.max(1, parseFloat(g.firstElementChild?.getAttribute('stroke-width') ?? '1'));
      const widths = [...new Set(overlays.map(w))];
      widths.forEach((wd, i) => {
        css += `@keyframes ${id}-md${i}{from{stroke-dashoffset:${wd * (DASH + GAP)}}to{stroke-dashoffset:0}}`;
        overlays.forEach((g) => { if (w(g) === wd) g.firstElementChild?.classList.add(`${id}-md${i}`); });
        css += `.${motionItem}.${id}-md${i}{animation:${id}-md${i} ${motionCycle}ms linear 0ms infinite}`;
      });
    } else {
      css += `@keyframes ${id}-mdot{0%{offset-distance:0%;opacity:0}12%,85%{opacity:1}100%{offset-distance:100%;opacity:0}}`;
      css += `.${motionItem}{animation:${id}-mdot ${motionCycle}ms ease-in-out 0ms infinite}`;
    }
  }
  css += `.${id}-paused .${UNIT_CLASS}{animation-play-state:paused}`;
  if (o.respectReducedMotion) {
    css += `@media (prefers-reduced-motion: reduce){.${UNIT_CLASS}{animation:none!important}.${MOTION_CLASS}{display:none}}`;
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
    motionCycle,
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
      overlays.forEach((g) => g.remove());
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
