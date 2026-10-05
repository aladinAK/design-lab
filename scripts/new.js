import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
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

// Date de création préremplie : elle fixe l'ordre dans la liste de l'accueil
const metaPath = resolve(target, 'meta.json')
const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
meta.date = new Date().toISOString().slice(0, 10)
writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`)

console.log(`Créé : experiments/${name}/ → http://localhost:5173/experiments/${name}/`)
console.log(`Remplis experiments/${name}/meta.json (ton pseudo GitHub, la technique) : la page apparaît toute seule sur l’accueil.`)
