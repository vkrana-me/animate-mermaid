import type { Order } from './types';
import type { UnitKind } from './graph';

export interface Box { left: number; top: number; right: number; bottom: number }

export interface SchedItem {
  kind: UnitKind;
  key?: string;
  from?: string;
  to?: string;
  rect: Box;
}

export interface Timing {
  order: Order;
  nodeDuration: number;
  edgeDuration: number;
  stagger: number;
  delay: number;
}

export interface Slot { start: number; dur: number }

const cx = (r: Box) => (r.left + r.right) / 2;
const cy = (r: Box) => (r.top + r.bottom) / 2;

/** Decide when each item starts and how long it animates. Pure: no DOM access. */
export function schedule(items: SchedItem[], t: Timing): Slot[] {
  const durOf = (it: SchedItem) => (it.kind === 'edge' ? t.edgeDuration : t.nodeDuration);
  let slots: Slot[];

  const hasGraph = items.some((i) => i.kind === 'edge' && i.from && i.to);
  if (t.order === 'together') {
    slots = items.map((it) => ({ start: 0, dur: durOf(it) }));
  } else if (t.order === 'flow' && hasGraph) {
    slots = flow(items, t);
  } else {
    slots = byPosition(items, t);
  }
  return slots.map((s) => ({ start: s.start + t.delay, dur: s.dur }));
}

function byPosition(items: SchedItem[], t: Timing): Slot[] {
  const order = items
    .map((it, i) => i)
    .sort((a, b) => {
      const ra = items[a].rect;
      const rb = items[b].rect;
      // Row tolerance so items on the same visual line go left-to-right.
      if (Math.abs(ra.top - rb.top) > 4) return ra.top - rb.top;
      return ra.left - rb.left;
    });
  const slots: Slot[] = new Array(items.length);
  order.forEach((idx, n) => {
    const it = items[idx];
    slots[idx] = { start: n * t.stagger, dur: it.kind === 'edge' ? t.edgeDuration : t.nodeDuration };
  });
  return slots;
}

function flow(items: SchedItem[], t: Timing): Slot[] {
  const lead = t.nodeDuration * 0.5; // edge starts once its source is half visible
  const step = lead + t.edgeDuration; // spacing between graph levels

  const nodeIdx = new Map<string, number>();
  items.forEach((it, i) => { if (it.kind === 'node' && it.key) nodeIdx.set(it.key, i); });

  // Adjacency + indegree among known nodes.
  const out = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const k of nodeIdx.keys()) { out.set(k, []); indeg.set(k, 0); }
  for (const it of items) {
    if (it.kind !== 'edge' || !it.from || !it.to) continue;
    if (!nodeIdx.has(it.from) || !nodeIdx.has(it.to)) continue;
    out.get(it.from)!.push(it.to);
    indeg.set(it.to, (indeg.get(it.to) ?? 0) + 1);
  }

  // BFS levels. Roots first; then any unreached component (cycles) in reading order.
  const level = new Map<string, number>();
  const visit = (roots: string[]) => {
    const queue = [...roots];
    roots.forEach((r) => level.set(r, 0));
    while (queue.length) {
      const u = queue.shift()!;
      for (const v of out.get(u)!) {
        if (!level.has(v)) { level.set(v, level.get(u)! + 1); queue.push(v); }
      }
    }
  };
  const readingOrder = [...nodeIdx.keys()].sort((a, b) => {
    const ra = items[nodeIdx.get(a)!].rect;
    const rb = items[nodeIdx.get(b)!].rect;
    return ra.top - rb.top || ra.left - rb.left;
  });
  visit(readingOrder.filter((k) => indeg.get(k) === 0));
  for (const k of readingOrder) if (!level.has(k)) visit([k]);

  const slots: Slot[] = new Array(items.length);
  const nodeStart = (k: string) => level.get(k)! * step;

  items.forEach((it, i) => {
    if (it.kind === 'node') {
      slots[i] = { start: it.key && level.has(it.key) ? nodeStart(it.key) : 0, dur: t.nodeDuration };
    }
  });
  const lastNode = Math.max(0, ...slots.filter(Boolean).map((s) => s.start));

  // Edges.
  const edgeSlot = new Map<string, Slot>();
  const edgeOrder: number[] = [];
  items.forEach((it, i) => {
    if (it.kind !== 'edge') return;
    edgeOrder.push(i);
    let start: number;
    if (it.from && it.to && level.has(it.from) && level.has(it.to)) {
      const lf = level.get(it.from)!;
      const lt = level.get(it.to)!;
      start = lt > lf
        ? nodeStart(it.from) + lead
        // Back/cross edge: draw once both ends exist.
        : Math.max(nodeStart(it.from), nodeStart(it.to)) + t.nodeDuration;
    } else {
      start = lastNode + t.nodeDuration;
    }
    slots[i] = { start, dur: t.edgeDuration };
    if (it.key) edgeSlot.set(it.key, slots[i]);
  });

  // Edge labels: pop in as their edge is half drawn. Match by id, else by order.
  let labelN = 0;
  items.forEach((it, i) => {
    if (it.kind !== 'label') return;
    const byKey = it.key ? edgeSlot.get(it.key) : undefined;
    const e = byKey ?? (edgeOrder[labelN] !== undefined ? slots[edgeOrder[labelN]] : undefined);
    labelN++;
    slots[i] = e
      ? { start: e.start + e.dur * 0.5, dur: t.nodeDuration * 0.7 }
      : { start: lastNode + t.nodeDuration, dur: t.nodeDuration };
  });

  // Clusters: fade in just before the first node inside them.
  items.forEach((it, i) => {
    if (it.kind !== 'cluster') return;
    let first = Infinity;
    items.forEach((n, j) => {
      if (n.kind !== 'node') return;
      const x = cx(n.rect);
      const y = cy(n.rect);
      if (x >= it.rect.left && x <= it.rect.right && y >= it.rect.top && y <= it.rect.bottom) {
        first = Math.min(first, slots[j].start);
      }
    });
    const start = first === Infinity ? 0 : Math.max(0, first - t.nodeDuration * 0.4);
    slots[i] = { start, dur: t.nodeDuration };
  });

  return slots;
}
