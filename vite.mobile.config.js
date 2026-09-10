import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// One-off build target for the mobile/Artifact test build (AppMobile.jsx +
// mobile.html), kept separate from vite.config.js so it never touches the
// browser extension's dist/ output. Builds locally to dist-mobile/, whose
// single JS/CSS bundle then gets inlined into a Claude Artifact by hand
// (Artifacts can't reference external asset files, everything must be
// embedded in the page itself).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist-mobile'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'mobile.html'),
    },
  },
})
