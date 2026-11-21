# React example

```bash
# repo root
npm run build
cd examples/react
npm i
npm run dev
```

- `<AnimatedMermaid ref={ctrl} chart={...} order="flow" loop />`: the ref gives you the controller (`play`, `pause`, `restart`, `seek`, `svg`).
- `useAnimatedMermaid(chart, options)` returns `{ ref, controller, error }`.
- Works in React StrictMode (effects run twice). Stale renders are aborted.

**Next.js / TanStack Start:** the same imports work. `animate-mermaid/react` ships with `"use client"` and renders only in the browser, so server components and SSR are safe.
