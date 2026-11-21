import { describe, expect, it } from 'vitest';
import { parseEdgeId, nodeKey } from '../src/graph';
import { schedule, type SchedItem } from '../src/timeline';

const nodes = new Set(['A', 'B', 'my_node', 'x_y']);

describe('parseEdgeId', () => {
  it('parses v11 underscore ids', () => {
    expect(parseEdgeId('L_A_B_0', nodes)).toEqual({ from: 'A', to: 'B' });
  });
  it('parses legacy dash ids with svg prefix', () => {
    expect(parseEdgeId('mysvg-L-A-B-2', nodes)).toEqual({ from: 'A', to: 'B' });
  });
  it('handles node ids containing the separator', () => {
    expect(parseEdgeId('L_my_node_x_y_0', nodes)).toEqual({ from: 'my_node', to: 'x_y' });
  });
  it('returns undefined for unknown shapes', () => {
    expect(parseEdgeId('edge12', nodes)).toBeUndefined();
  });
});

describe('nodeKey', () => {
  it('prefers data-id', () => expect(nodeKey('svg-flowchart-A-0', 'A')).toBe('A'));
  it('parses flowchart dom ids', () => expect(nodeKey('svg-flowchart-my-node-12', null)).toBe('my-node'));
});

const box = (top: number, left = 0) => ({ top, left, right: left + 10, bottom: top + 10 });
const timing = { order: 'flow' as const, nodeDuration: 400, edgeDuration: 600, stagger: 100, delay: 0 };

describe('schedule (flow)', () => {
  const items: SchedItem[] = [
    { kind: 'node', key: 'A', rect: box(0) },
    { kind: 'node', key: 'B', rect: box(50) },
    { kind: 'node', key: 'C', rect: box(100) },
    { kind: 'edge', key: 'L_A_B_0', from: 'A', to: 'B', rect: box(25) },
    { kind: 'edge', key: 'L_B_C_0', from: 'B', to: 'C', rect: box(75) },
    { kind: 'edge', key: 'L_C_A_0', from: 'C', to: 'A', rect: box(50) },
    { kind: 'label', key: 'L_A_B_0', rect: box(25) },
  ];
  const s = schedule(items, timing);

  it('reveals nodes level by level', () => {
    expect(s[0].start).toBe(0);
    expect(s[1].start).toBe(800); // 400*0.5 + 600
    expect(s[2].start).toBe(1600);
  });
  it('draws an edge after its source appears and finishes when target starts', () => {
    expect(s[3].start).toBe(200);
    expect(s[3].start + s[3].dur).toBe(s[1].start);
  });
  it('draws back edges after both ends exist', () => {
    expect(s[5].start).toBe(1600 + 400);
  });
  it('shows labels halfway through their edge', () => {
    expect(s[6].start).toBe(200 + 300);
  });
});

describe('schedule (position)', () => {
  it('orders top-to-bottom then left-to-right with stagger and delay', () => {
    const s = schedule(
      [{ kind: 'node', rect: box(100) }, { kind: 'node', rect: box(0, 50) }, { kind: 'node', rect: box(0, 0) }],
      { ...timing, order: 'position', delay: 1000 },
    );
    expect(s.map((x) => x.start)).toEqual([1200, 1100, 1000]);
  });
});
