/**
 * - `default`: Mermaid's own look.
 * - `2d`: flat and crisp; Mermaid's drop shadows removed.
 * - `3d`: raised blocks. Each node gets a solid extruded edge in a darker
 *   shade of its border, a soft shadow and a top-lit gradient fill. Works on
 *   any shape (boxes, diamonds, circles, cylinders) and any theme.
 */
export type NodeStyle = 'default' | '2d' | '3d';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MARK = 'data-am-style';
const SHAPES = 'rect, path, polygon, circle, ellipse';

type RGB = [number, number, number];

function parseColor(c: string | null | undefined): RGB | undefined {
  if (!c) return undefined;
  const s = c.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (x) => x + x) : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i.exec(s);
  if (!rgb) return undefined;
  if (rgb[4] !== undefined && parseFloat(rgb[4]) === 0) return undefined; // fully transparent
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

const toHex = (c: RGB) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
/** `t` (0..1) of `a` over `b`. */
const blend = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] * t + b[i] * (1 - t)) as RGB;
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

/** The element that draws a node's outline/fill (not its label). */
function shapeOf(node: Element): Element | undefined {
  if (node.matches(SHAPES)) return node;
  const container = node.querySelector('.label-container, .outer-path');
  if (container && !container.closest('.label')) return container;
  for (const el of Array.from(node.querySelectorAll(SHAPES))) {
    if (el.closest('.label, foreignObject, .label-group, text')) continue;
    return el;
  }
  return undefined;
}

/** Filled pieces of a shape (a `<g>` from Mermaid's hand-drawn/neo looks holds a fill path and a stroke path). */
function fillParts(shape: Element): SVGGraphicsElement[] {
  const parts = shape.tagName.toLowerCase() === 'g' ? Array.from(shape.querySelectorAll<SVGGraphicsElement>(SHAPES)) : [shape as SVGGraphicsElement];
  return parts.filter((p) => parseColor(getComputedStyle(p).fill));
}

function strokeOf(shape: Element): RGB | undefined {
  const parts = shape.tagName.toLowerCase() === 'g' ? Array.from(shape.querySelectorAll(SHAPES)) : [shape];
  for (const p of parts) {
    const cs = getComputedStyle(p);
    const c = parseColor(cs.stroke);
    if (c && cs.strokeWidth !== '0px' && cs.strokeWidth !== '0') return c;
  }
  return undefined;
}

function el(tag: string, attrs: Record<string, string | number>, kids: Element[] = []): Element {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  kids.forEach((k) => e.appendChild(k));
  return e;
}

/** Extrude the shape `depth` units down with `color`, plus a soft drop shadow. */
function extrudeFilter(id: string, depth: number, color: string): Element {
  const steps = Math.max(2, Math.round(depth));
  const offsets: Element[] = [];
  const merge: Element[] = [el('feMergeNode', { in: 'shadow' })];
  for (let i = steps; i >= 1; i--) {
    offsets.push(el('feOffset', { in: 'solid', dx: 0, dy: (depth * i) / steps, result: `o${i}` }));
    merge.push(el('feMergeNode', { in: `o${i}` }));
  }
  merge.push(el('feMergeNode', { in: 'SourceGraphic' }));
  return el('filter', { id, x: '-25%', y: '-25%', width: '150%', height: '170%', 'color-interpolation-filters': 'sRGB' }, [
    el('feFlood', { 'flood-color': color, result: 'c' }),
    el('feComposite', { in: 'c', in2: 'SourceAlpha', operator: 'in', result: 'solid' }),
    ...offsets,
    el('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: depth * 0.9, result: 'blur' }),
    el('feOffset', { in: 'blur', dx: 0, dy: depth * 1.6, result: 'blurOff' }),
    el('feFlood', { 'flood-color': '#000', 'flood-opacity': 0.3, result: 'sc' }),
    el('feComposite', { in: 'sc', in2: 'blurOff', operator: 'in', result: 'shadow' }),
    el('feMerge', {}, merge),
  ]);
}

function topLitGradient(id: string, fill: RGB, dark: boolean): Element {
  const top = toHex(blend(WHITE, fill, dark ? 0.16 : 0.55));
  const bottom = toHex(blend(BLACK, fill, dark ? 0.12 : 0.04));
  return el('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, [
    el('stop', { offset: '0%', 'stop-color': top }),
    el('stop', { offset: '100%', 'stop-color': bottom }),
  ]);
}

const luminance = (c: RGB) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

let styled = 0;

/**
 * Restyle the nodes of a rendered Mermaid SVG. Call it before `animate()`
 * (`renderAnimated` does this for you with the `nodeStyle` option).
 * Returns a function that restores the original look.
 */
export function styleNodes(svg: SVGSVGElement, style: NodeStyle): () => void {
  if (style === 'default') return () => {};
  const id = `am-s${++styled}`;
  const q = (sel: string) => Array.from(svg.querySelectorAll(sel)).filter((e) => !e.closest('defs, marker'));
  const nodes = [
    ...q('g.node, g.mindmap-node, g[data-node="true"]').filter((n) => !n.classList.contains('cluster')),
    ...q('rect.actor, rect.note'),
  ];
  const shapes = [...new Set(nodes.map(shapeOf).filter((s): s is Element => !!s))];

  const undo: (() => void)[] = [];
  const setStyle = (e: Element, prop: string, value: string) => {
    const s = (e as SVGElement).style;
    const prev = s.getPropertyValue(prop);
    const prio = s.getPropertyPriority(prop);
    s.setProperty(prop, value, 'important');
    undo.push(() => (prev ? s.setProperty(prop, prev, prio) : s.removeProperty(prop)));
  };
  const clearFilterAttr = (e: Element) => {
    const f = e.getAttribute('filter');
    if (f !== null) {
      e.removeAttribute('filter');
      undo.push(() => e.setAttribute('filter', f));
    }
  };

  let defs: Element | undefined;
  const filters = new Map<string, string>();
  const gradients = new Map<string, string>();
  const addDef = (node: Element) => {
    if (!defs) {
      defs = el('defs', { [MARK]: id });
      svg.insertBefore(defs, svg.firstChild);
    }
    defs.appendChild(node);
  };

  for (const shape of shapes) {
    const parts = shape.tagName.toLowerCase() === 'g' ? [shape, ...Array.from(shape.querySelectorAll(SHAPES))] : [shape];
    parts.forEach(clearFilterAttr);
    // Mermaid's neo look puts drop shadows on the shapes; both styles replace them.
    parts.forEach((p) => setStyle(p, 'filter', 'none'));
    if (style === '2d') continue;

    const fills = fillParts(shape);
    const fill = parseColor(fills[0] && getComputedStyle(fills[0]).fill);
    const box = (shape as SVGGraphicsElement).getBBox?.();
    const size = box ? Math.min(box.width, box.height) : 40;
    const depth = Math.round(Math.max(2, Math.min(6, size * 0.12)) * 2) / 2;
    const base = strokeOf(shape) ?? fill ?? [128, 128, 128];
    const dark = fill ? luminance(fill) < 0.45 : false;
    // Side face: a shade of the border. On dark themes keep it close to the
    // border so it still stands out from the background.
    const edge = toHex(dark ? blend(WHITE, base, 0.08) : blend(BLACK, base, 0.22));

    const fKey = `${depth}|${edge}`;
    let fid = filters.get(fKey);
    if (!fid) {
      fid = `${id}-f${filters.size}`;
      filters.set(fKey, fid);
      addDef(extrudeFilter(fid, depth, edge));
    }
    setStyle(shape, 'filter', `url(#${fid})`);

    if (fill) {
      const gKey = toHex(fill);
      let gid = gradients.get(gKey);
      if (!gid) {
        gid = `${id}-g${gradients.size}`;
        gradients.set(gKey, gid);
        addDef(topLitGradient(gid, fill, dark));
      }
      for (const p of fills) setStyle(p, 'fill', `url(#${gid})`);
    }
  }

  return () => {
    undo.reverse().forEach((f) => f());
    defs?.remove();
  };
}
