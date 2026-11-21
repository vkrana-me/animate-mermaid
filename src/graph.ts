export type UnitKind = 'node' | 'edge' | 'label' | 'cluster';

export interface Unit {
  el: SVGGraphicsElement;
  kind: UnitKind;
  /** Node id (nodes) or edge id (edges, labels). */
  key?: string;
  from?: string;
  to?: string;
}

const NODE_SEL = 'g.node, g.nodes > g, g.mindmap-node, g[data-node="true"]';
const EDGE_SEL = [
  'path.flowchart-link',
  'g.edgePaths > path',
  'g.edgePaths > g > path',
  'path[data-edge="true"]',
  'path.relation',
  'path.transition',
  'path.relationshipLine',
  'path.er.relationshipLine',
  'path.edge',
].join(', ');
const LABEL_SEL = 'g.edgeLabel';
const CLUSTER_SEL = 'g.cluster';

/** Extract the user-facing node id from a Mermaid node element. */
export function nodeKey(id: string | null, dataId: string | null): string | undefined {
  if (dataId) return dataId;
  if (!id) return undefined;
  const m = /(?:flowchart|state|classId|entity|node)-(.+)-\d+$/.exec(id);
  return m ? m[1] : id;
}

/**
 * Parse Mermaid edge ids like `L_A_B_0`, `L-A-B-0` or `mysvg-L_A_B_0` into
 * endpoints. Node ids can themselves contain the separator, so we split at
 * every candidate position and keep the one where both sides are known nodes.
 */
export function parseEdgeId(
  id: string | null | undefined,
  nodes: ReadonlySet<string>,
): { from: string; to: string } | undefined {
  if (!id) return undefined;
  const m = /(?:^|[-_])L([-_])(.+)\1\d+$/.exec(id);
  if (!m) return undefined;
  const sep = m[1];
  const mid = m[2];
  for (let i = mid.indexOf(sep); i !== -1; i = mid.indexOf(sep, i + 1)) {
    const from = mid.slice(0, i);
    const to = mid.slice(i + 1);
    if (nodes.has(from) && nodes.has(to)) return { from, to };
  }
  return undefined;
}

function uniq<T extends Element>(list: Iterable<T>): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const el of list) {
    if (seen.has(el)) continue;
    // Skip elements nested inside an element we already collected.
    let nested = false;
    for (const s of seen) if (s.contains(el)) { nested = true; break; }
    if (!nested) { seen.add(el); out.push(el); }
  }
  return out;
}

type Rect = { left: number; top: number; right: number; bottom: number };

function distToRect(x: number, y: number, r: Rect): number {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

function endpoints(el: SVGGraphicsElement): [DOMPoint, DOMPoint] | undefined {
  const geo = el as unknown as SVGGeometryElement;
  if (typeof geo.getTotalLength !== 'function') return undefined;
  const ctm = el.getScreenCTM();
  if (!ctm) return undefined;
  try {
    const len = geo.getTotalLength();
    const a = geo.getPointAtLength(0);
    const b = geo.getPointAtLength(len);
    return [
      new DOMPoint(a.x, a.y).matrixTransform(ctm),
      new DOMPoint(b.x, b.y).matrixTransform(ctm),
    ];
  } catch {
    return undefined;
  }
}

/** Find all animatable pieces of a rendered Mermaid SVG and link edges to nodes. */
export function collectUnits(svg: SVGSVGElement): Unit[] {
  const q = <T extends Element>(sel: string) => Array.from(svg.querySelectorAll<T>(sel));
  const inDefs = (el: Element) => !!el.closest('defs, marker');

  const clusters = uniq(q<SVGGElement>(CLUSTER_SEL).filter((e) => !inDefs(e)));
  const nodes = uniq(q<SVGGElement>(NODE_SEL).filter((e) => !inDefs(e) && !e.classList.contains('cluster')));
  const edges = uniq(q<SVGGraphicsElement>(EDGE_SEL).filter((e) => !inDefs(e)));
  const labels = uniq(q<SVGGElement>(LABEL_SEL).filter((e) => !inDefs(e) && (e.textContent ?? '').trim() !== ''));

  if (nodes.length === 0 && edges.length === 0) return fallbackUnits(svg);

  const nodeUnits: Unit[] = nodes.map((el) => ({
    el, kind: 'node', key: nodeKey(el.getAttribute('id'), el.getAttribute('data-id')),
  }));
  const keys = new Set(nodeUnits.map((n) => n.key!).filter(Boolean));
  const rects = nodeUnits.map((n) => n.el.getBoundingClientRect());

  const edgeUnits: Unit[] = edges.map((el) => {
    const id = el.getAttribute('data-id') ?? el.getAttribute('id');
    const unit: Unit = { el, kind: 'edge', key: id ?? undefined };
    const parsed = parseEdgeId(id, keys);
    if (parsed) return { ...unit, ...parsed };
    // Geometric fallback: nearest node to each end of the path.
    const pts = endpoints(el);
    if (pts && nodeUnits.length) {
      const nearest = (p: DOMPoint) => {
        let best = 0;
        let bestD = Infinity;
        rects.forEach((r, i) => {
          const d = distToRect(p.x, p.y, r);
          if (d < bestD) { bestD = d; best = i; }
        });
        return nodeUnits[best].key;
      };
      const from = nearest(pts[0]);
      const to = nearest(pts[1]);
      if (from && to && from !== to) return { ...unit, from, to };
    }
    return unit;
  });

  const labelUnits: Unit[] = labels.map((el) => {
    const inner = el.querySelector('[data-id]');
    return { el, kind: 'label', key: inner?.getAttribute('data-id') ?? el.getAttribute('data-id') ?? undefined };
  });

  return [
    ...clusters.map((el): Unit => ({ el, kind: 'cluster' })),
    ...edgeUnits,
    ...labelUnits,
    ...nodeUnits,
  ];
}

/** For diagrams without a node/edge graph: animate top-level drawing elements. */
function fallbackUnits(svg: SVGSVGElement): Unit[] {
  let root: Element = svg;
  // Descend through single wrapper groups.
  for (;;) {
    const kids = Array.from(root.children).filter((c) => !/^(defs|style|title|desc|marker)$/i.test(c.tagName));
    if (kids.length === 1 && kids[0].tagName.toLowerCase() === 'g') root = kids[0];
    else break;
  }
  const units: Unit[] = [];
  for (const c of Array.from(root.children)) {
    const tag = c.tagName.toLowerCase();
    if (/^(defs|style|title|desc|marker|script)$/.test(tag)) continue;
    const el = c as SVGGraphicsElement;
    const box = el.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;
    units.push({ el, kind: tag === 'path' || tag === 'line' || tag === 'polyline' ? 'edge' : 'node' });
  }
  return units;
}
