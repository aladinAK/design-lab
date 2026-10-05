// Le bouton du croquis fait faire coucou au bonhomme
const waveButton = document.querySelector('[data-wave]')
const sheet = document.querySelector('.sheet')

const wave = () => {
  sheet.classList.remove('waving')
  void sheet.getBoundingClientRect() // relance l'animation si on clique pendant qu'elle tourne
  sheet.classList.add('waving')
}

waveButton.addEventListener('click', wave)
waveButton.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    wave()
  }
})

// Le corps s'allonge au scroll : le bas du trait reste fixe à l'écran pendant que la tête remonte
const body = document.querySelector('[data-body]')
const BODY_END = 1005 // y du bas du corps dans le croquis (viewBox 1440 × 1024)
let frame = null

const stretchBody = () => {
  frame = null
  const scale = sheet.getScreenCTM().d // px écran par unité du croquis
  const end = BODY_END + scrollY / scale
  body.setAttribute('d', `M1109 829 C1108 845 1108 860 1106 878 L1102 ${BODY_END} L1102 ${end.toFixed(1)}`)
}

addEventListener('scroll', () => { frame ??= requestAnimationFrame(stretchBody) }, { passive: true })
addEventListener('resize', stretchBody)

// « Line boil » : on change le seed du bruit en boucle pour que les traits frémissent comme une animation image par image.
const turbulences = document.querySelectorAll('#filters feTurbulence')
const boilButton = document.querySelector('[data-boil]')
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

let timer = null

if (reduceMotion) {
  boilButton.hidden = true
} else {
  boilButton.addEventListener('click', () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    } else {
      timer = setInterval(() => {
        turbulences.forEach((t) => t.setAttribute('seed', Math.floor(Math.random() * 100)))
      }, 130)
    }
    boilButton.setAttribute('aria-pressed', String(Boolean(timer)))
    boilButton.textContent = timer ? 'Arrêter' : 'Faire trembler'
  })
}

// Crayon : on dessine partout sur la page (souris et stylet ; au doigt on garde le scroll)
const canvas = document.querySelector('[data-crayon]')
const ctx = canvas.getContext('2d')
const eraser = document.querySelector('[data-erase]')
const CRAYON = getComputedStyle(document.documentElement).getPropertyValue('--red').trim()
const strokes = []
let current = null

// 3 passages fins légèrement décalés = grain de cire
const crayonSegment = (a, b) => {
  const jitter = () => (Math.random() - 0.5) * 1.6
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.35 + Math.random() * 0.3
    ctx.lineWidth = 1.2 + Math.random() * 1.4
    ctx.beginPath()
    ctx.moveTo(a.x + jitter(), a.y + jitter())
    ctx.lineTo(b.x + jitter(), b.y + jitter())
    ctx.stroke()
  }
}

const resizeCanvas = () => {
  canvas.style.height = '0' // pour ne pas compter le canvas dans la hauteur mesurée
  const width = document.documentElement.clientWidth
  const height = document.documentElement.scrollHeight
  const dpr = devicePixelRatio || 1
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.height = `${height}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.strokeStyle = CRAYON
  ctx.lineCap = 'round'
  strokes.forEach((stroke) => stroke.slice(1).forEach((p, i) => crayonSegment(stroke[i], p)))
}

const pagePoint = (e) => ({ x: e.pageX, y: e.pageY })

addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' || e.button !== 0 || e.target.closest('button, a, [role="button"]')) return
  e.preventDefault() // pas de sélection de texte pendant qu'on dessine
  current = [pagePoint(e)]
  strokes.push(current)
})
addEventListener('pointermove', (e) => {
  if (!current) return
  const p = pagePoint(e)
  crayonSegment(current.at(-1), p)
  current.push(p)
})
addEventListener('pointerup', () => { current = null })
addEventListener('pointercancel', () => { current = null })

const erase = () => {
  strokes.length = 0
  resizeCanvas()
}
eraser.addEventListener('click', erase)
addEventListener('keydown', (e) => { if (e.key === 'Escape') erase() })

new ResizeObserver(resizeCanvas).observe(document.body)
