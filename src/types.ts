export type NodeEffect = 'pop' | 'fade' | 'slide' | 'none';
export type EdgeEffect = 'draw' | 'fade' | 'none';
/**
 * Continuous motion on every edge once it has appeared, so the direction of
 * flow stays visible:
 * - `dash`: dashes march along the edge toward its arrowhead.
 * - `dot`: a dot travels along the edge toward its arrowhead.
 * - `none`: static edges (default).
 */
export type EdgeMotion = 'dash' | 'dot' | 'none';

/**
 * - `flow`: follow the graph. Roots appear first, each edge draws toward its
 *   target, then the target appears. Best for flowcharts, state and class diagrams.
 * - `position`: reveal top-to-bottom, left-to-right. Works for any diagram type
 *   (sequence, gantt, mindmap, ...).
 * - `together`: everything animates at once.
 */
export type Order = 'flow' | 'position' | 'together';

export interface AnimateOptions {
  /** Reveal order. Default `flow` (falls back to `position` when no graph is found). */
  order?: Order;
  /** Entrance effect for nodes, clusters and labels. Default `pop`. */
  nodeEffect?: NodeEffect;
  /** Entrance effect for edges. Default `draw`. */
  edgeEffect?: EdgeEffect;
  /** Node entrance duration (ms). Default 450. */
  nodeDuration?: number;
  /** Edge draw duration (ms). Default 500. */
  edgeDuration?: number;
  /** Continuous edge motion after the entrance. Default `none`. */
  edgeMotion?: EdgeMotion;
  /** One motion cycle in ms (one dash step, or one trip of the dot). Default 1000 for `dash`, 2000 for `dot`. */
  edgeMotionDuration?: number;
  /**
   * Motion color. Default: the theme's accent when rendered with `theme`
   * (CSS variable `--am-motion` on the <svg>), otherwise the edge's own color.
   */
  edgeMotionColor?: string;
  /** Gap between items for `position` order (ms). Default 120. */
  stagger?: number;
  /** Delay before the first item (ms). Default 0. */
  delay?: number;
  /** CSS easing for node/label entrances. Default a soft ease-out. */
  easing?: string;
  /** CSS easing for edge drawing. Default ease-in-out. */
  edgeEasing?: string;
  /** Replay forever. Default false. */
  loop?: boolean;
  /** With `loop`, how long the finished diagram stays before it replays (ms). Default 1500. */
  loopHold?: number;
  /**
   * `true` plays at once, `false` waits for `play()`, `'visible'` plays the
   * first time the diagram scrolls into view. Default true.
   */
  autoplay?: boolean | 'visible';
  /** Skip animation for users with `prefers-reduced-motion: reduce`. Default true. */
  respectReducedMotion?: boolean;
}

export interface AnimationController {
  readonly svg: SVGSVGElement;
  /** Length of one pass, in ms (without loop hold). */
  readonly duration: number;
  /** Length of one full cycle in ms (equals `duration` unless `loop`). */
  readonly period: number;
  /** Length of one `edgeMotion` cycle in ms, 0 when there is no edge motion. */
  readonly motionCycle: number;
  play(): void;
  pause(): void;
  restart(): void;
  /** Jump to a point in time (ms). */
  seek(ms: number): void;
  /** Remove the animation and restore the original SVG. */
  destroy(): void;
}
