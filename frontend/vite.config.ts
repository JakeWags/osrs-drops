import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    // Custom plugin to load .wgsl files as strings
    {
      name: "wgsl-loader",
      transform(code, id) {
        if (id.endsWith(".wgsl")) {
          return {
            code: `export default ${JSON.stringify(code)};`,
            map: null,
          };
        }
      },
    },
  ],
  optimizeDeps: {
    include: ['react-vega', 'vega', 'vega-lite'],
    exclude: ['drop-sim'] 
  },
  server: {
    fs: {
      allow: ['..']
    }
  }
})