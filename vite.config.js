import { defineConfig } from 'vite'
import { readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Chaque dossier de experiments/ contenant un index.html devient une page.
const dir = resolve(import.meta.dirname, 'experiments')
const pages = Object.fromEntries(
  readdirSync(dir)
    .filter((name) => !name.startsWith('_') && existsSync(resolve(dir, name, 'index.html')))
    .map((name) => [name, resolve(dir, name, 'index.html')])
)

export default defineConfig({
  build: {
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), ...pages } },
  },
})
