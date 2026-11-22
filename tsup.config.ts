import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.tsx',
    svelte: 'src/svelte.ts',
    element: 'src/element.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  // No source maps in the published package: dist is readable, unminified JS.
  sourcemap: false,
  // Share chunks in CJS too, so every entry uses one copy of the engine
  // (otherwise each entry has its own instance counter and IDs can collide).
  splitting: true,
  clean: true,
  target: 'es2020',
  external: ['mermaid', 'gifenc', 'react', 'react/jsx-runtime'],
  // One build so all entries share chunks (one copy of the engine). Then mark
  // the React entry as a client module for Next.js App Router.
  async onSuccess() {
    for (const file of ['dist/react.js', 'dist/react.cjs']) {
      const code = await readFile(file, 'utf8');
      if (!code.startsWith('"use client"')) await writeFile(file, `"use client";\n${code}`);
    }
  },
});
