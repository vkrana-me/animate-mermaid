import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // animate-mermaid is linked from ../.., so make sure there's only one Mermaid.
  resolve: { dedupe: ['mermaid'] },
});
