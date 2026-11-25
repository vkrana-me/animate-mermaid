---
name: animate-mermaid
description: Animate Mermaid diagrams. Nodes reveal in graph order and edges draw toward their targets. Export as an animated SVG, GIF or PNG, or embed the animation in a web app (React, Next.js, TanStack, Svelte, Vue, Angular or plain HTML). Use when the user wants an animated diagram, flowchart, architecture or sequence animation, a GIF or animated SVG of a Mermaid chart (for a README, docs, Slack, Teams or slides), or wants to add Mermaid animation to a web project.
---

# animate-mermaid

[`animate-mermaid`](https://www.npmjs.com/package/animate-mermaid) is an npm library that animates Mermaid diagrams with pure CSS keyframes. Pick the path that fits the request:

| User wants | Path |
| --- | --- |
| A **file**: animated SVG for a README or docs, a GIF for chat or slides, a PNG | **A. CLI** (`scripts/animate.mjs`) |
| The animation **inside their app or site** | **B. Library** (`npm i animate-mermaid mermaid`) |

## A. Make files with the CLI

One-time setup (installs puppeteer and headless Chrome, about 150 MB):

```bash
cd <this-skill-dir>/scripts && npm install
```

If the CLI later says it "could not start headless Chrome" (npm sometimes blocks puppeteer's download script), run `npx puppeteer browsers install chrome` in `scripts/`.

Write the Mermaid source to a `.mmd` file, then run:

```bash
node <this-skill-dir>/scripts/animate.mjs diagram.mmd -o diagram.svg -o diagram.gif
```

- The output format comes from the extension: `.svg` (animated, plays by itself), `.gif` (animated), `.png` (still).
- Pass `-` instead of a file to read the source from stdin.
- Useful flags: `--loop`, `--order flow|position|together`, `--node-effect pop|fade|slide|none`, `--edge-effect draw|fade|none`, `--node-duration 450`, `--edge-duration 500`, `--theme nord|dracula|tokyo-night|github-dark|catppuccin-latte|...` (palettes, or Mermaid's default|dark|forest|neutral), `--edge-motion dash|dot` (edges keep moving toward their arrows), `--background white|transparent|#hex`, `--fps 20`, `--scale 1`, `--frame end|<ms>` (PNG only).
- Run `node scripts/animate.mjs --help` for the full list.
- The CLI prints one line per output, for example `wrote diagram.gif (64 frames, 412 KB, 3.1 s animation)`.

Choosing a format:
- **GitHub README / docs site**: `.svg`. It animates inside `<img>` and Markdown `![](diagram.svg)`. Add `--loop` so readers who scroll in late still see it play.
- **Slack, Teams, WhatsApp, email, Google Slides, PowerPoint**: `.gif`. Keep it small with `--fps 15 --scale 1`; files over about 5 MB are slow in chat.
- **Static image or thumbnail**: `.png` (default frame is the finished diagram).

After generating a file, tell the user its path and size. If a GIF is over 5 MB, suggest a lower `--fps` or `--scale`.

## B. Add the animation to an app

Install: `npm i animate-mermaid mermaid`. Then use the entry point for the stack:

| Stack | Import | Usage |
| --- | --- | --- |
| React, Next.js (App Router or Pages), TanStack Start/Router, Remix, Vite | `animate-mermaid/react` | `<AnimatedMermaid chart={src} loop />` or `useAnimatedMermaid(src, opts)` |
| Svelte, SvelteKit | `animate-mermaid/svelte` | `<div use:animatedMermaid={{ chart, loop: true }} />` |
| Vue, Angular, Solid, Astro, Lit, plain HTML | `animate-mermaid/element` | `<animated-mermaid loop>flowchart LR; A-->B</animated-mermaid>` |
| Any framework, imperative | `animate-mermaid` | `const ctrl = await renderAnimated(el, src, opts)` |

Copy-paste snippets per stack, every option, and the export and share APIs are in [references/api.md](references/api.md). Read it before writing integration code.

Rules when integrating:
- Mermaid needs the browser DOM. Render only on the client: in an effect, `onMount`, or a `"use client"` component. The React entry is already marked `"use client"`, so importing it from a Next.js server component file is fine.
- For Vue, tell the compiler that `animated-mermaid` is a custom element (`compilerOptions.isCustomElement`). For Angular, add `CUSTOM_ELEMENTS_SCHEMA`. Snippets are in the reference.
- To let users share a GIF, use two clicks: build it with `toGif(ctrl)`, then call `shareFile(blob)` from a **second** click. Browsers only allow the share sheet right after a click.

## Writing good animated diagrams

- `order: 'flow'` (the default) works best for flowcharts, state and class diagrams. Sequence, gantt, mindmap and other diagrams automatically reveal top to bottom.
- Keep it to about 15 nodes or fewer. Bigger graphs take long to play; for those, lower `nodeDuration` and `edgeDuration` (for example 250 and 300) or use `order: 'together'`.
- Dashed and dotted edges (`-.->`) fade in instead of drawing.
- The animation honors `prefers-reduced-motion`.

## Troubleshooting

- **`Cannot find module 'puppeteer'`**: run `npm install` in `scripts/` first.
- **Mermaid syntax error**: the CLI prints Mermaid's parse error. Fix the `.mmd` source; the error names the line.
- **SVG doesn't animate on GitHub**: GitHub Markdown doesn't render inline `<svg>` markup. Commit the `.svg` as a file and reference it with `![](path.svg)` or `<img src="path.svg">`.
- **Safari won't export PNG or GIF**: use `mermaidConfig: { htmlLabels: false }`.
