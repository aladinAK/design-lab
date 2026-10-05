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

// Copier la commande de création
const cmd = document.querySelector('[data-copy]')
const copied = document.querySelector('[data-copied]')
cmd.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(cmd.dataset.copy)
    copied.textContent = 'copié'
  } catch {
    copied.textContent = 'copie impossible'
  }
  setTimeout(() => { copied.textContent = '' }, 1400)
})
