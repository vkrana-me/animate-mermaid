// Minimal types for gifenc (MIT, https://github.com/mattdesl/gifenc).
declare module 'gifenc' {
  export type Palette = number[][];
  export interface QuantizeOptions { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean | number; clearAlpha?: boolean; clearAlphaThreshold?: number; clearAlphaColor?: number }
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: QuantizeOptions): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: QuantizeOptions['format']): Uint8Array;
  export interface FrameOptions { palette?: Palette; delay?: number; repeat?: number; transparent?: boolean; transparentIndex?: number; dispose?: number; first?: boolean }
  export interface Encoder { writeFrame(index: Uint8Array, width: number, height: number, opts?: FrameOptions): void; finish(): void; bytes(): Uint8Array<ArrayBuffer>; bytesView(): Uint8Array<ArrayBuffer>; reset(): void }
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): Encoder;
}
