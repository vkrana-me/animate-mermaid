# animate-mermaid API reference

Package: `animate-mermaid` (peer dependency: `mermaid` >= 10.9). Source: https://github.com/vkrana-me/animate-mermaid

## Contents
- Options
- Controller
- Export and share
- Framework snippets: React, Next.js, TanStack, Svelte, Vue, Angular, plain HTML, existing Mermaid SVG

## Options (`AnimateOptions`, also accepted by every adapter)

| Option | Default | Notes |
| --- | --- | --- |
| `order` | `'flow'` | `'flow'` follows edges, `'position'` reveals top to bottom, `'together'` reveals everything at once |
| `nodeEffect` | `'pop'` | `'pop' \| 'fade' \| 'slide' \| 'none'` |
| `edgeEffect` | `'draw'` | `'draw' \| 'fade' \| 'none'`. Dashed and dotted edges always fade |
| `nodeDuration` | `450` | ms |
| `edgeDuration` | `500` | ms |
| `stagger` | `120` | ms between items in `position` order |
| `delay` | `0` | ms before start |
| `easing` | ease-out | CSS easing for nodes |
| `edgeEasing` | ease-in-out | CSS easing for edges |
| `loop` | `false` | replay forever |
| `loopHold` | `1500` | ms the finished diagram stays before replaying |
| `autoplay` | `true` | `false` waits for `play()`; `'visible'` starts on scroll into view |
| `respectReducedMotion` | `true` | |

`renderAnimated` and the adapters also accept:
- `mermaid`: your own Mermaid instance
- `mermaidConfig`: passed to `mermaid.initialize`, e.g. `{ theme: 'dark' }`
- `signal`: an `AbortSignal` that cancels a stale render

## Controller (`AnimationController`)

```ts
ctrl.play(); ctrl.pause(); ctrl.restart(); ctrl.seek(ms); ctrl.destroy();
ctrl.svg       // the <svg> element
ctrl.duration  // ms for one pass
ctrl.period    // ms for one full cycle (includes the loop hold)
```

## Export and share

```ts
import { toSvgString, toSvgBlob, toPng, toGif, renderFrame, shareFile, canShareFile, download } from 'animate-mermaid';

toSvgString(ctrl.svg)                      // animated SVG markup (plays standalone)
toSvgString(ctrl.svg, { frame: 'end' })    // frozen SVG
await toPng(ctrl.svg, { frame: 'end', scale: 2, background: 'white' })
await toGif(ctrl, { fps: 20, scale: 1, maxWidth: 1200, background: 'white', holdEnd: 1500, repeat: 0, onProgress })
await renderFrame(ctrl.svg, { frame: 1200 })   // a canvas, for custom encoders
await shareFile(blob, { filename: 'diagram.gif', title: 'Diagram' })  // 'shared' | 'downloaded' | 'cancelled' | 'unsupported'
download(blobOrSvgString, 'diagram.svg')
```

## React

```tsx
import { useRef } from 'react';
import { AnimatedMermaid, type AnimationController } from 'animate-mermaid/react';
import { toGif, download } from 'animate-mermaid';

export function Diagram({ chart }: { chart: string }) {
  const ctrl = useRef<AnimationController | null>(null);
  return (
    <>
      <AnimatedMermaid ref={ctrl} chart={chart} loop autoplay="visible" />
      <button onClick={async () => ctrl.current && download(await toGif(ctrl.current), 'diagram.gif')}>GIF</button>
    </>
  );
}
```

Hook form: `const { ref, controller, error } = useAnimatedMermaid(chart, { loop: true }); return <div ref={ref} />;`

## Next.js (App Router)

Import `animate-mermaid/react` directly. The entry is marked `"use client"`, so a server component can render `<AnimatedMermaid chart={...} />`. Don't call `renderAnimated` in server code.

## TanStack Start / Router, Remix, Vite + React

Same as React. The component renders only on the client, so SSR is safe.

## Svelte / SvelteKit

```svelte
<script lang="ts">
  import { animatedMermaid, type AnimationController } from 'animate-mermaid/svelte';
  let { chart } = $props();
  let ctrl: AnimationController | undefined;
</script>

<div use:animatedMermaid={{ chart, loop: true, onReady: (c) => (ctrl = c) }}></div>
<button onclick={() => ctrl?.restart()}>Replay</button>
```

## Vue 3

```ts
// vite.config.ts
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'animated-mermaid' } } })
```

```vue
<script setup lang="ts">
import 'animate-mermaid/element';
import { ref } from 'vue';
const el = ref<HTMLElementTagNameMap['animated-mermaid']>();
const chart = `flowchart LR
  A --> B --> C`;
</script>

<template>
  <animated-mermaid ref="el" loop :chart="chart" />
  <button @click="el?.restart()">Replay</button>
</template>
```

Nuxt: wrap the element in `<ClientOnly>` and import `animate-mermaid/element` from a `.client.ts` plugin.

## Angular

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import 'animate-mermaid/element';

@Component({
  selector: 'app-diagram',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<animated-mermaid loop [chart]="chart"></animated-mermaid>`,
})
export class DiagramComponent {
  chart = 'flowchart LR\n  A --> B';
}
```

## Plain HTML (no build)

```html
<script type="importmap">
{ "imports": {
  "mermaid": "https://cdn.jsdelivr.net/npm/mermaid@12/dist/mermaid.esm.min.mjs",
  "gifenc": "https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js",
  "animate-mermaid": "https://cdn.jsdelivr.net/npm/animate-mermaid@0.1/dist/index.js",
  "animate-mermaid/element": "https://cdn.jsdelivr.net/npm/animate-mermaid@0.1/dist/element.js"
} }
</script>
<script type="module">import 'animate-mermaid/element';</script>

<animated-mermaid loop>
  flowchart LR
    A --> B --> C
</animated-mermaid>
```

`<animated-mermaid>` attributes: `order`, `node-effect`, `edge-effect`, `node-duration`, `edge-duration`, `stagger`, `loop`, `autoplay` (`true` / `false` / `visible`). Methods: `play()`, `pause()`, `restart()`, `seek(ms)`, `toSvg()`, `toPng()`, `toGif()`. Events: `ready` (detail is the controller) and `error`.

## Animate an SVG that Mermaid already rendered

```ts
import { animate } from 'animate-mermaid';
const ctrl = animate(document.querySelector('.mermaid svg')!, { loop: true });
```

The SVG must be in the document, because layout is measured.
