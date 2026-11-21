# Examples

| Folder | Stack | Run |
| --- | --- | --- |
| [html](html/) | Plain HTML with no build step: web component plus JS API, Mermaid from a CDN | `npm run build` in the repo root, then `python3 -m http.server 8080` there and open `/examples/html/` |
| [react](react/) | React 19 + Vite + TypeScript: `<AnimatedMermaid>` and `useAnimatedMermaid` | `cd examples/react && npm i && npm run dev` |
| [svelte](svelte/) | Svelte 5 + Vite + TypeScript: the `use:animatedMermaid` action | `cd examples/svelte && npm i && npm run dev` |

The React and Svelte examples link the library from the repo (`"animate-mermaid": "file:../.."`), so run `npm run build` in the repo root first, and again after changing `src/`. In your own project, use `npm i animate-mermaid mermaid` instead.

[shared/](shared/) holds the sample diagrams and CSS that both apps use.
