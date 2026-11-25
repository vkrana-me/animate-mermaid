# animate-mermaid

Smooth animations for [Mermaid](https://mermaid.js.org) diagrams, usable from any framework, with export to **animated SVG**, **GIF** and **PNG**.

- **Follows the graph**: roots appear first, each edge draws toward its target, then the target pops in. Subgraphs fade in just before their contents.
- **Smooth and light**: pure CSS keyframes, so it runs on the browser's compositor with no JS animation loop and no GSAP. Core is about 6 KB gzipped (Mermaid is a peer dependency).
- **Works anywhere**: vanilla JS, React, Next.js (App Router and Pages), TanStack Start/Router, Svelte/SvelteKit, plus a `<animated-mermaid>` web component for Vue, Angular, Solid, Astro or plain HTML.
- **Export**: the animated SVG plays by itself in browsers, `<img>` tags and READMEs. GIF export records the full animation for Slack, slides, docs or anywhere SVG isn't supported. PNG export captures the finished diagram or any frame.
- **Controllable**: `play`, `pause`, `restart`, `seek(ms)`, looping, and play-when-visible.
- **Accessible**: honors `prefers-reduced-motion`.

Tested with Mermaid 12 on flowcharts, sequence, state and class diagrams. Other diagram types fall back to a top-to-bottom reveal.

## Install

```bash
npm i animate-mermaid mermaid
```

## Vanilla JS

```js
import { renderAnimated, toSvgString, toGif, toPng, download } from 'animate-mermaid';

const ctrl = await renderAnimated(document.getElementById('diagram'), `
flowchart LR
  A[Client] --> B[API] --> C[(DB)]
`, { loop: true });

ctrl.pause(); ctrl.seek(800); ctrl.play();

download(toSvgString(ctrl.svg), 'diagram.svg');   // animated SVG
download(await toGif(ctrl), 'diagram.gif');       // animated GIF
download(await toPng(ctrl.svg), 'diagram.png');   // final frame PNG
```

If you already render with Mermaid yourself, animate the existing SVG:

```js
import { animate } from 'animate-mermaid';
const ctrl = animate(document.querySelector('#my-diagram svg'));
```

## React / Next.js / TanStack

```tsx
import { AnimatedMermaid, useAnimatedMermaid } from 'animate-mermaid/react';

<AnimatedMermaid chart={source} order="flow" loop ref={ctrlRef} />

// or the hook
const { ref, controller, error } = useAnimatedMermaid(source, { autoplay: 'visible' });
return <div ref={ref} />;
```

The React entry ships with `"use client"`, so it drops straight into Next.js App Router server components. Mermaid is imported lazily inside an effect, so SSR never touches the DOM.

## Svelte / SvelteKit

```svelte
<script>
  import { animatedMermaid } from 'animate-mermaid/svelte';
  let chart = `flowchart TD; A-->B`;
</script>

<div use:animatedMermaid={{ chart, loop: true, onReady: (c) => console.log(c.duration) }} />
```

## Web component (Vue, Angular, Astro, HTML…)

```html
<script type="module">import 'animate-mermaid/element';</script>

<animated-mermaid order="flow" node-effect="pop" loop>
  flowchart LR
    A --> B --> C
</animated-mermaid>
```

The element has `play()`, `pause()`, `restart()`, `seek(ms)`, `toSvg()`, `toPng()` and `toGif()` methods, and fires `ready` and `error` events.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `order` | `'flow'` | `'flow'` follows edges, `'position'` reveals top-to-bottom, `'together'` reveals everything at once |
| `nodeEffect` | `'pop'` | `'pop' \| 'fade' \| 'slide' \| 'none'` |
| `edgeEffect` | `'draw'` | `'draw' \| 'fade' \| 'none'`. Dashed and dotted edges always fade |
| `nodeDuration` / `edgeDuration` | `450` / `500` | Duration in ms |
| `stagger` | `120` | Gap between items in `position` order (ms) |
| `delay` | `0` | Initial delay (ms) |
| `easing` / `edgeEasing` | ease-out / ease-in-out | Any CSS easing |
| `loop` / `loopHold` | `false` / `1500` | Replay forever, holding the finished diagram for `loopHold` ms between runs |
| `edgeMotion` | `'none'` | `'dash'` (marching dashes) or `'dot'` (a dot travelling along each edge). Edges keep moving toward their arrowheads after they appear, so the direction of flow is always visible |
| `edgeMotionDuration` | `1000` / `2000` | One motion cycle in ms (dash / dot) |
| `edgeMotionColor` | theme accent | Any CSS color. Without a theme, each edge's own color |
| `theme` | — | Color palette (see [Themes](#themes)). `renderAnimated` and the adapters only |
| `transparent` | `false` | With `theme`, don't paint the background |
| `autoplay` | `true` | `true`, `false` (wait for `play()`), or `'visible'` (start on scroll into view) |
| `respectReducedMotion` | `true` | Skip the animation for reduced-motion users |
| `mermaid` / `mermaidConfig` | — | Your own Mermaid instance, or config passed to `mermaid.initialize` |

## Themes

Pick a built-in palette by name or pass your own colors:

```js
renderAnimated(el, src, { theme: 'tokyo-night', edgeMotion: 'dash' });
renderAnimated(el, src, { theme: { bg: '#0b1020', fg: '#e2e8f0', accent: '#38bdf8' } });
```

```html
<animated-mermaid theme="nord" edge-motion="dot">flowchart LR; A-->B</animated-mermaid>
```

Built-in: `zinc-light`, `zinc-dark`, `tokyo-night`, `tokyo-night-storm`, `tokyo-night-light`, `catppuccin-mocha`, `catppuccin-latte`, `nord`, `nord-light`, `dracula`, `github-light`, `github-dark`, `solarized-light`, `solarized-dark`, `one-dark`.

A theme needs only `bg` and `fg`. `line` (edges), `accent` (arrowheads and edge motion), `muted` (edge labels), `surface` (node fill) and `border` are mixed from those two when left out. Values in `mermaidConfig.themeVariables` override the theme. Rendering Mermaid yourself? `mermaid.initialize({ startOnLoad: false, ...themeConfig('dracula') })` gives the same colors, and `THEMES` lists every palette.

## Export API

| Function | Returns |
| --- | --- |
| `toSvgString(svg, { frame?, background? })` | Animated SVG markup. Pass `frame` (ms or `'end'`) to freeze it |
| `toSvgBlob(svg, opts)` | The same, as a `Blob` |
| `toGif(controller, { fps = 20, scale = 1, maxWidth = 1200, background = 'white', holdEnd = 1500, repeat = 0, onProgress, signal })` | Animated GIF `Blob` covering the whole animation |
| `toPng(svg, { frame = 'end', scale = 2, background = 'white' })` | PNG `Blob` |
| `renderFrame(svg, opts)` | `HTMLCanvasElement`, for building GIF/APNG/video frames |
| `shareFile(blob, { filename, title, text, fallbackToDownload = true })` | Opens the system share sheet (WhatsApp, Slack, Teams, Messages, Mail, AirDrop, or whatever is installed). Downloads instead where sharing isn't supported. Resolves to `'shared' \| 'downloaded' \| 'cancelled' \| 'unsupported'` |
| `canShareFile(blob, filename?)` | Whether the share sheet is available for this file (GIF and PNG are shareable, SVG isn't in Chrome) |
| `download(blobOrString, filename)` | Triggers a browser download |

### Sharing a GIF to WhatsApp, Slack or Teams

```js
// click 1: build the GIF (takes a few seconds)
const gif = await toGif(ctrl);
// click 2: share it
shareButton.onclick = () => shareFile(gif, { filename: 'diagram.gif', title: 'Architecture' });
```

Browsers only allow the share sheet for a few seconds after a click, so build the GIF first and share it on a second click. The examples work this way: **Make GIF**, then a preview, then **Share**.

The share sheet works in mobile browsers, Safari, and Chrome or Edge on Windows, macOS and ChromeOS. Firefox desktop doesn't support it and downloads the file instead, which you can then drag into Slack, Teams or WhatsApp Web. Posting straight into a Slack channel or Teams chat without the share sheet would need your own server using each platform's API (a bot token or webhook), which is outside a front-end library.

### Notes

- **GIF**: frames are rendered one by one rather than screen-recorded in real time, so the timing is exact even on a slow machine. A 3 s flowchart at 20 fps is about 60 frames, roughly 400 KB, and takes a few seconds to build. Lower `fps` or `scale` for smaller files. Every frame uses one 256-color palette taken from the finished diagram, so colors don't flicker. `background: 'transparent'` gives 1-bit transparency, so edges come out hard. The encoder ([gifenc](https://github.com/mattdesl/gifenc), MIT) loads only when you call `toGif`.
- A PNG can't animate. Use the animated SVG or GIF, or call `renderFrame` to get individual frames.
- Exported SVGs use the browser's default fonts unless you inline a webfont.
- Safari may refuse to rasterize HTML labels (`<foreignObject>`) to PNG or GIF. If that happens, render with `mermaidConfig: { htmlLabels: false }`.

## Agent skill

[skills/animate-mermaid](skills/animate-mermaid/) is an [Agent Skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview): a `SKILL.md` plus a headless CLI. Coding agents use it to animate diagrams for you, either by writing an animated SVG, GIF or PNG file, or by adding the library to your app with the right snippet for your framework.

```bash
# Claude Code: personal (all projects) or per project
cp -r skills/animate-mermaid ~/.claude/skills/
cp -r skills/animate-mermaid .claude/skills/

# one-time CLI setup
cd ~/.claude/skills/animate-mermaid/scripts && npm install
```

For other agents, point them at `skills/animate-mermaid/SKILL.md` (for example from `AGENTS.md`). The CLI works on its own too:

```bash
node skills/animate-mermaid/scripts/animate.mjs diagram.mmd -o diagram.svg -o diagram.gif --loop
```

## Examples

Runnable sample projects live in [examples/](examples/): [plain HTML](examples/html/), [React](examples/react/) and [Svelte](examples/svelte/).

## Develop

```bash
npm run dev        # demo playground (Vite) at demo/
npm test           # unit tests (vitest)
npm run build      # ESM + CJS + .d.ts into dist/
```

## License

MIT
