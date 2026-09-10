import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// base:'./' -- the built app is loaded from a chrome-extension://.../dist/index.html
// URL, not a domain root, so asset paths must be relative.
// build.outDir -- points directly into the browser extension folder so
// `npm run build` here is the entire packaging step (see the project plan
// for why an absolute cross-repo path was the chosen tradeoff).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: path.resolve(__dirname, '../../WebDev/Projects/paradigm extension/dist'),
    emptyOutDir: true,
  },
})
