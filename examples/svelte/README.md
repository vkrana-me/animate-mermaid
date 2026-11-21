# Svelte example

```bash
# repo root
npm run build
cd examples/svelte
npm i
npm run dev
```

```svelte
<div use:animatedMermaid={{ chart, loop: true, onReady: (c) => (ctrl = c) }}></div>
```

The action re-renders when its parameters change, and cleans up on destroy. It works in Svelte 3, 4 and 5 and in SvelteKit, where actions only run in the browser, so SSR is safe.
