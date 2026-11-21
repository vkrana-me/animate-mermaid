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
  sourcemap: true,
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
