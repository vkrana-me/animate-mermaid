# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.1] - 2026-11-25

### Changed

- **Built-in theme colors.** Every palette is now built from its original
  theme's published colors (Tailwind zinc, Tokyo Night, Catppuccin, Nord,
  Dracula, GitHub Primer, Solarized, Atom One Dark). Most palettes now also set
  node fill (`surface`) and border colors. Some accents changed: `dracula` uses
  pink, `solarized-dark` cyan, `one-dark` blue, `tokyo-night-light` purple.
  Theme names are unchanged.

### Fixed

- **Themes with several diagrams on a page.** Mermaid's config is global, so a
  themed and an unthemed diagram rendering at the same time could swap
  configs, giving a themed diagram Mermaid's default node colors on the theme
  background. Renders now run one at a time, each with its own config.

## [0.2.0] - 2026-11-25

### Added

- **Themes.** New `theme` option for `renderAnimated`, the React component and
  hook, the Svelte action and the `<animated-mermaid theme="...">` attribute.
  - 15 built-in palettes: `zinc-light`, `zinc-dark`, `tokyo-night`,
    `tokyo-night-storm`, `tokyo-night-light`, `catppuccin-mocha`,
    `catppuccin-latte`, `nord`, `nord-light`, `dracula`, `github-light`,
    `github-dark`, `solarized-light`, `solarized-dark`, `one-dark`.
  - Custom themes as `{ bg, fg, line?, accent?, muted?, surface?, border? }`.
    Only `bg` and `fg` are required; the other colors are mixed from them.
  - Arrowheads use the theme's `accent` color and edge labels use `muted`.
  - The SVG background is painted with `bg`. Pass `transparent: true`
    (`transparent` attribute on the element) to skip it.
  - `mermaidConfig.themeVariables` still override the theme's colors.
  - Exported `THEMES`, `themeConfig(theme)` (Mermaid config for your own
    pipeline) and `resolveTheme(theme)`, plus the `Theme`, `ThemeName` and
    `ThemeColors` types.
- **Edge motion.** New `edgeMotion` option keeps edges moving after they appear,
  so the direction of flow is always visible.
  - `'dash'`: dashes march along each edge toward its arrowhead.
  - `'dot'`: a dot travels along each edge toward its arrowhead.
  - `edgeMotionDuration` sets one cycle in ms (default 1000 for dash, 2000 for
    dot). `edgeMotionColor` sets the color (default: theme accent, otherwise
    each edge's own color).
  - Element attributes: `edge-motion`, `edge-motion-duration`,
    `edge-motion-color`.
  - Hidden for users with `prefers-reduced-motion` when
    `respectReducedMotion` is on.
  - Animated SVG exports keep the motion.
  - New `motionCycle` field on `AnimationController` (0 when off). Custom
    `AnimationController` implementations now need to include it.
- **GIF export with edge motion.** The hold at the end of a non-looping GIF
  keeps moving (rounded to whole motion cycles) instead of showing one still
  frame.
- **Agent skill CLI.** `--theme` accepts the palette names (Mermaid's
  `default`, `dark`, `forest`, `neutral` and `base` still work). New
  `--edge-motion`, `--edge-motion-duration` and `--edge-motion-color` flags.
- **Demo and React playground.** Theme and Edge motion pickers. In the React
  playground the card background follows the theme, and PNG/GIF exports use the
  theme background.

### Changed

- `renderAnimated` now calls `mermaid.initialize()` whenever the effective
  config changes (for the lazily imported Mermaid). A themed render no longer
  leaks its theme into the next unthemed one. A Mermaid instance passed through
  `mermaid` is only initialized when you set `mermaidConfig` or `theme`.

## [0.1.1] - 2026-11-22

### Fixed

- CommonJS entries (`index`, `react`, `element`) now share one copy of the
  animation engine. Separate copies had their own instance counters and could
  generate clashing animation IDs.

### Changed

- The published build no longer includes source maps, which brings the
  package from 107 kB to 32 kB.

## [0.1.0] - 2026-11-21

### Added

- **Graph-aware animation.** In `flow` order, roots appear first, each edge
  draws toward its target, then the target appears. `position` and `together`
  orders cover other diagram types.
- **Effects.** Node effects `pop`, `fade`, `slide` and `none`; edge effects
  `draw`, `fade` and `none`, with configurable durations, stagger, delay and
  easing.
- **Controller.** `play`, `pause`, `restart` and `seek`, plus `loop` with
  `loopHold`, `autoplay: 'visible'` (play on scroll into view) and
  `prefers-reduced-motion` support.
- **Export.** Self-playing animated SVG (`toSvgString`, `toSvgBlob`), PNG of
  any frame (`toPng`, `renderFrame`), and animated GIF rendered frame by frame
  (`toGif`, using gifenc).
- **Sharing.** `shareFile` and `canShareFile` open the system share sheet
  (Web Share API) and fall back to `download`.
- **Adapters.** React component and hook (marked `"use client"`), Svelte
  action, and the `<animated-mermaid>` web component for Vue, Angular, Astro
  and plain HTML.
- **Examples.** Plain HTML (no build step), React 19 and Svelte 5.
- **Agent skill.** `skills/animate-mermaid` with a `SKILL.md`, an API
  reference, and a headless CLI (`scripts/animate.mjs`) that turns `.mmd`
  files into animated SVG, GIF or PNG.

[Unreleased]: https://github.com/vkrana-me/animate-mermaid/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/vkrana-me/animate-mermaid/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/vkrana-me/animate-mermaid/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/vkrana-me/animate-mermaid/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/vkrana-me/animate-mermaid/releases/tag/v0.1.0
