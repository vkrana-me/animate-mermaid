import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // animate-mermaid is linked from ../.. and has its own node_modules.
  // Dedupe so the app and the library share one React and one Mermaid.
  resolve: { dedupe: ['react', 'react-dom', 'mermaid'] },
});
