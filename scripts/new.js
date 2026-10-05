import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const name = process.argv[2]
if (!name || !/^[a-z0-9-]+$/.test(name)) {
  console.error('Usage : pnpm new <nom-en-kebab-case>')
  process.exit(1)
}
const target = resolve('experiments', name)
if (existsSync(target)) {
  console.error(`experiments/${name} existe déjà`)
  process.exit(1)
}
cpSync(resolve('experiments/_template'), target, { recursive: true })
console.log(`Créé : experiments/${name}/ → http://localhost:5173/experiments/${name}/`)
console.log('Pense à l’ajouter dans la liste de index.html.')
