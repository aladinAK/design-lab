import { defineConfig } from 'vite'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Chaque dossier de experiments/ contenant un index.html devient une page (sauf ceux en _).
const dir = resolve(import.meta.dirname, 'experiments')
const listExperiments = () => readdirSync(dir)
  .filter((name) => !name.startsWith('_') && existsSync(resolve(dir, name, 'index.html')))

const pages = Object.fromEntries(listExperiments().map((name) => [name, resolve(dir, name, 'index.html')]))

// Métadonnées de chaque expérimentation (experiments/<nom>/meta.json), triées par date de création
const readMeta = (name) => {
  try {
    return JSON.parse(readFileSync(resolve(dir, name, 'meta.json'), 'utf8'))
  } catch {
    return {}
  }
}
const hasPreview = (name) => existsSync(resolve(dir, name, 'preview.jpg'))
const escape = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const renderRows = () => listExperiments()
  .map((name) => ({ name, ...readMeta(name) }))
  .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')) || a.name.localeCompare(b.name))
  .map((exp, i) => `
        <li style="--i:${i}">
          <a class="row" href="/experiments/${escape(exp.name)}/"${hasPreview(exp.name) ? ` data-preview="/experiments/${escape(exp.name)}/preview.jpg"` : ''}>
            <span class="num">${String(i + 1).padStart(3, '0')}</span>
            <span class="name">${escape(exp.name)}${exp.note ? ` <small>${escape(exp.note)}</small>` : ''}</span>
            <span class="author hide-sm">${exp.author ? `@${escape(exp.author)}` : '—'}</span>
            <span class="tech hide-sm">${escape(exp.tech) || '—'}</span>
            <span class="state">${escape(exp.status) || 'en cours'} <svg class="arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12M9 3l5 5-5 5" /></svg></span>
          </a>
        </li>`)
  .join('')

// Remplace le marqueur de l'accueil par la liste : personne n'a à modifier index.html pour s'y ajouter
const labIndex = {
  name: 'lab-index',
  // les aperçus ne sont référencés que par data-preview : on les copie nous-mêmes dans le build
  generateBundle() {
    listExperiments().filter(hasPreview).forEach((name) => this.emitFile({
      type: 'asset',
      fileName: `experiments/${name}/preview.jpg`,
      source: readFileSync(resolve(dir, name, 'preview.jpg')),
    }))
  },
  transformIndexHtml: {
    order: 'pre',
    handler: (html, ctx) => (ctx.path === '/index.html' ? html.replace('<!-- lab:experiments -->', renderRows()) : html),
  },
}

export default defineConfig({
  plugins: [labIndex],
  build: {
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), ...pages } },
  },
})
