// Horloge
const clock = document.querySelector('[data-clock]')
const tick = () => { clock.textContent = new Date().toLocaleTimeString('fr-FR') }
tick()
setInterval(tick, 1000)

// Coordonnées du curseur
const coords = document.querySelector('[data-coords]')
const pad = (n) => String(Math.round(n)).padStart(4, '0')
addEventListener('pointermove', (e) => { coords.textContent = `x ${pad(e.clientX)} · y ${pad(e.clientY)}` })

// Grille de construction (bouton ou touche G)
const gridButton = document.querySelector('[data-grid]')
const toggleGrid = () => {
  const on = document.body.classList.toggle('grid-on')
  gridButton.setAttribute('aria-pressed', String(on))
}
gridButton.addEventListener('click', toggleGrid)
addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) toggleGrid()
})

// Copier les commandes (chaque bouton a son propre retour « copié »)
document.querySelectorAll('button[data-copy]').forEach((cmd) => {
  const copied = cmd.querySelector('[data-copied]')
  cmd.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(cmd.dataset.copy)
      copied.textContent = 'copié'
    } catch {
      copied.textContent = 'copie impossible'
    }
    setTimeout(() => { copied.textContent = '' }, 1400)
  })
})

// Aperçu au survol : suit le curseur avec un léger retard, bascule à gauche près du bord droit
const peek = document.querySelector('.peek')
const peekImg = Object.assign(new Image(960, 600), { alt: '' }) // créée ici : pas d'<img> vide dans le HTML
peek.prepend(peekImg)
const previewRows = document.querySelectorAll('a.row[data-preview]')
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

if (finePointer && previewRows.length) {
  previewRows.forEach((row) => { new Image().src = row.dataset.preview }) // préchargées : révélation immédiate

  const target = { x: 0, y: 0 }
  const pos = { x: 0, y: 0 }
  let frame = null

  const place = () => {
    const ease = reduceMotion ? 1 : 0.2
    pos.x += (target.x - pos.x) * ease
    pos.y += (target.y - pos.y) * ease
    peek.style.setProperty('--px', `${pos.x}px`)
    peek.style.setProperty('--py', `${pos.y}px`)
    frame = Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) > 0.5 ? requestAnimationFrame(place) : null
  }

  const aim = (e, snap = false) => {
    const { width, height } = peek.getBoundingClientRect()
    const gap = 28
    target.x = e.clientX + gap + width > innerWidth - 16 ? e.clientX - gap - width : e.clientX + gap
    target.y = Math.min(Math.max(e.clientY - height / 2, 16), innerHeight - height - 16)
    if (snap) Object.assign(pos, target)
    frame ??= requestAnimationFrame(place)
  }

  previewRows.forEach((row) => {
    row.addEventListener('pointerenter', (e) => {
      const appearing = !peek.classList.contains('is-on')
      peekImg.src = row.dataset.preview
      peek.classList.add('is-on')
      aim(e, appearing) // à l'apparition, l'aperçu naît sous le curseur au lieu de glisser depuis l'ancien point
    })
    row.addEventListener('pointermove', (e) => aim(e))
    row.addEventListener('pointerleave', () => peek.classList.remove('is-on'))
  })
}
