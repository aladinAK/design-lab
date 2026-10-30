// Mise en page du chapitre, puis transfert de chaque page sur une texture.
// Le navigateur compose le texte (justification, césure française, ligatures) dans de vraies pages HTML
// hors écran ; on recopie ensuite chaque mot à sa position exacte sur un canvas. La typo de la 3D est
// donc celle du navigateur, pas une approximation.

export const PAGE_W = 440 // format de la page HTML (px CSS)
export const PAGE_H = 620
export const TEX_SCALE = 2.4 // résolution des textures : 1056 × 1488

export const BOOK_TITLE = 'L’Épée de la Dernière Chance'
export const CHAPTER_TITLE = 'La mission'
export const NEXT_URL = 'https://www.amazon.ca/-/fr/dp/B0G4KNMJ42'

const escape = (text) => text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

// ---------- Ornements ----------
const RULE = '<svg class="chapter-rule" viewBox="0 0 150 14"><path d="M0 7h62M88 7h62" stroke="currentColor" stroke-width="1"/><path d="M75 1l6 6-6 6-6-6z" fill="currentColor"/><circle cx="64" cy="7" r="1.6" fill="currentColor"/><circle cx="86" cy="7" r="1.6" fill="currentColor"/></svg>'
const BREAK = '<svg class="break" viewBox="0 0 60 10"><path d="M10 5l4-4 4 4-4 4zM26 5l4-4 4 4-4 4zM42 5l4-4 4 4-4 4z" fill="currentColor"/></svg>'
const FIN = '<svg class="fin" viewBox="0 0 80 28"><path d="M40 4c-6 6-14 8-24 7 6 4 14 5 24 3 10 2 18 1 24-3-10 1-18-1-24-7z" fill="currentColor"/><path d="M40 16v8M36 22h8" stroke="currentColor" stroke-width="1.4"/><path d="M4 11h10M66 11h10" stroke="currentColor"/></svg>'

// Titre courant à l'ancienne : titre du livre à gauche, titre du chapitre à droite
const pageShell = (side, body, folio, first = false) => `<div class="page page--${side}" lang="fr">
  ${first ? '' : `<div class="running">${side === 'left' ? BOOK_TITLE : CHAPTER_TITLE}</div>`}
  <div class="page-body">${body}</div>
  ${folio ? `<div class="folio">${folio}</div>` : ''}
</div>`

// Atelier hors écran où les pages HTML sont composées et mesurées
const workshop = document.createElement('div')
workshop.className = 'workshop'
workshop.setAttribute('aria-hidden', 'true')
document.body.append(workshop)

// ---------- Pagination ----------
export const paginate = (source) => {
  const blocks = [...source.querySelectorAll('p, hr')].map((el) => (el.tagName === 'HR' ? { type: 'break' } : { type: 'p', text: el.textContent.trim() }))
  workshop.innerHTML = pageShell('right', '', '')
  const body = workshop.querySelector('.page-body')
  const overflows = () => body.scrollHeight > body.clientHeight + 1

  const pages = []
  const startPage = (first) => {
    body.innerHTML = first
      ? `<header class="chapter-head"><p class="chapter-num">Chapitre I</p>${RULE}<p class="chapter-title">${CHAPTER_TITLE}</p></header>`
      : ''
  }
  const closePage = () => pages.push(body.innerHTML)
  const setText = (p, words, lettrine) => {
    const text = words.join(' ')
    if (lettrine) p.innerHTML = `<span class="lettrine">${escape(text[0])}</span>${escape(text.slice(1))}`
    else p.textContent = text
  }

  startPage(true)
  blocks.forEach((block, index) => {
    if (block.type === 'break') {
      if (body.childElementCount === 0) return // jamais d'ornement en haut de page
      body.insertAdjacentHTML('beforeend', BREAK)
      if (overflows()) {
        body.lastElementChild.remove()
        closePage()
        startPage(false)
      }
      return
    }
    let words = block.text.split(/\s+/)
    let cls = index === 0 ? 'first' : ''
    while (words.length) {
      const p = document.createElement('p')
      if (cls) p.className = cls
      body.append(p)
      setText(p, words, cls === 'first')
      if (!overflows()) break
      // le paragraphe déborde : on garde le plus de mots possible (recherche dichotomique)
      let lo = 0
      let hi = words.length
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        setText(p, words.slice(0, mid), cls === 'first')
        if (overflows()) hi = mid - 1
        else lo = mid
      }
      if (lo === 0) p.remove()
      else setText(p, words.slice(0, lo), cls === 'first')
      closePage()
      startPage(false)
      words = words.slice(lo)
      if (lo > 0) cls = 'cont' // suite du paragraphe : pas d'alinéa
    }
  })

  // Fin du chapitre : fleuron + lien vers la suite du livre
  const ending = `${FIN}<p class="to-follow"><a href="${NEXT_URL}">À suivre…</a></p>`
  const before = body.innerHTML
  body.insertAdjacentHTML('beforeend', ending)
  if (overflows()) {
    body.innerHTML = before
    closePage()
    startPage(false)
    body.innerHTML = ending
  }
  closePage()

  return pages.map((html, i) => ({ html, side: i % 2 === 0 ? 'right' : 'left', folio: i + 1, first: i === 0 }))
}

// ---------- Fond de page : papier froissé teinté parchemin ----------
const paintPaper = (ctx, paper, side) => {
  ctx.drawImage(paper, 0, 0, PAGE_W, PAGE_H)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = '#efdfb8'
  ctx.fillRect(0, 0, PAGE_W, PAGE_H)
  const edges = ctx.createRadialGradient(PAGE_W / 2, PAGE_H / 2, PAGE_H * 0.32, PAGE_W / 2, PAGE_H / 2, PAGE_H * 0.72)
  edges.addColorStop(0, '#ffffff')
  edges.addColorStop(1, '#cfae76')
  ctx.fillStyle = edges
  ctx.fillRect(0, 0, PAGE_W, PAGE_H)
  // ombre de la reliure, côté pli
  const gutter = side === 'right' ? ctx.createLinearGradient(0, 0, 70, 0) : ctx.createLinearGradient(PAGE_W, 0, PAGE_W - 70, 0)
  gutter.addColorStop(0, 'rgb(150 110 60)')
  gutter.addColorStop(1, '#ffffff')
  ctx.fillStyle = gutter
  ctx.fillRect(0, 0, PAGE_W, PAGE_H)
  ctx.globalCompositeOperation = 'source-over'
}

const svgImage = (svg, color) => new Promise((resolve) => {
  const clone = svg.cloneNode(true)
  const { width, height } = svg.getBoundingClientRect()
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', width * TEX_SCALE)
  clone.setAttribute('height', height * TEX_SCALE)
  const markup = clone.outerHTML.replaceAll('currentColor', color)
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => resolve(null)
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
})

const fontOf = (style) => `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
const isLetter = (c) => /\p{L}/u.test(c)

// ---------- Une page HTML → un canvas ----------
export const rasterizePage = async (page, paper) => {
  workshop.innerHTML = pageShell(page.side, page.html, page.folio, page.first)
  const root = workshop.firstElementChild
  const origin = root.getBoundingClientRect()

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(PAGE_W * TEX_SCALE)
  canvas.height = Math.round(PAGE_H * TEX_SCALE)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(TEX_SCALE, 0, 0, TEX_SCALE, 0, 0)
  paintPaper(ctx, paper, page.side)

  // Cadre de la lettrine (le glyphe lui-même passe avec le texte)
  root.querySelectorAll('.lettrine').forEach((el) => {
    const r = el.getBoundingClientRect()
    const x = r.left - origin.left
    const y = r.top - origin.top
    ctx.fillStyle = 'rgb(140 29 20 / .06)'
    ctx.fillRect(x, y, r.width, r.height)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgb(140 29 20 / .6)'
    ctx.strokeRect(x + 0.5, y + 0.5, r.width - 1, r.height - 1)
    ctx.strokeStyle = 'rgb(140 29 20 / .3)'
    ctx.strokeRect(x + 4, y + 4, r.width - 8, r.height - 8)
  })

  // Ornements SVG
  for (const svg of root.querySelectorAll('svg')) {
    const r = svg.getBoundingClientRect()
    const img = await svgImage(svg, getComputedStyle(svg).color)
    if (img) ctx.drawImage(img, r.left - origin.left, r.top - origin.top, r.width, r.height)
  }

  // Texte : mot par mot, à la position calculée par le navigateur
  let link = null
  const range = document.createRange()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    const style = getComputedStyle(parent)
    ctx.font = fontOf(style)
    ctx.fillStyle = style.color
    const spaced = style.letterSpacing !== 'normal' && style.letterSpacing !== '0px'
    if ('letterSpacing' in ctx) ctx.letterSpacing = spaced ? style.letterSpacing : '0px'
    const metrics = ctx.measureText('Hg')
    const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent * 1.25
    const anchor = parent.closest('a')

    const text = node.textContent
    let run = ''
    let runX = 0
    let runTop = 0
    let runRight = 0
    const flush = (hyphen = false) => {
      if (!run) return
      const baseline = runTop + ascent
      ctx.fillText(hyphen ? `${run}-` : run, runX, baseline)
      if (anchor) {
        ctx.fillRect(runX, baseline + 4, runRight - runX, 1) // soulignement du lien
        const box = { x: runX, y: runTop, w: runRight - runX, h: ascent * 1.4 }
        link = link ? { x: Math.min(link.x, box.x), y: Math.min(link.y, box.y), w: Math.max(link.x + link.w, box.x + box.w) - Math.min(link.x, box.x), h: Math.max(link.y + link.h, box.y + box.h) - Math.min(link.y, box.y) } : box
      }
      run = ''
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      if (/\s/.test(char)) { flush(); continue }
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const rects = range.getClientRects()
      const r = rects[rects.length - 1] // après une césure, le 1er rectangle est parfois resté sur la ligne d'avant
      if (!r) continue
      const x = r.left - origin.left
      const top = r.top - origin.top
      if (run && Math.abs(top - runTop) > 2) {
        // le mot continue à la ligne suivante : c'est une césure, on remet le trait d'union
        flush(isLetter(run.at(-1)) && isLetter(char))
      }
      if (spaced && run) { flush() } // texte espacé : lettre par lettre
      if (!run) { runX = x; runTop = top }
      run += char
      runRight = r.right - origin.left
    }
    flush()
  }

  return {
    canvas,
    link: link && { x: link.x / PAGE_W, y: link.y / PAGE_H, w: link.w / PAGE_W, h: link.h / PAGE_H },
  }
}

// ---------- Dorure de la couverture : masque blanc sur noir ----------
const SWORD_PATHS = [
  'M60 8l9 34v182H51V42z',
  'M10 230c10-10 30-6 42-6h16c12 0 32-4 42 6-8 10-30 8-42 8H52c-12 0-34 2-42-8z',
  'M53 238h14v56H53z',
]
export const GEM = { x: 0.5, y: 0.44 } // position de la gemme du pommeau sur la couverture (0-1)

export const paintFoil = (width, height) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const u = width / 1000 // unité : millième de largeur
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'

  // filets poussés au fer : double cadre
  ctx.lineWidth = 3 * u
  ctx.strokeRect(70 * u, 60 * u, width - 140 * u, height - 120 * u)
  ctx.lineWidth = 1.6 * u
  ctx.strokeRect(92 * u, 82 * u, width - 184 * u, height - 164 * u)

  // épée
  ctx.save()
  const swordScale = 1.55 * u
  const swordTop = height * 0.12
  ctx.translate(width / 2 - 60 * swordScale, swordTop)
  ctx.scale(swordScale, swordScale)
  SWORD_PATHS.forEach((d) => ctx.fill(new Path2D(d)))
  ctx.beginPath()
  ctx.arc(60, 306, 12, 0, Math.PI * 2)
  ctx.fill()
  // gravure : gouttière de la lame, cordage de la poignée, sertissure de la gemme (retirés de la dorure)
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 1.6
  ctx.stroke(new Path2D('M60 46v168M53 248l14 6M53 260l14 6M53 272l14 6M53 284l14 6'))
  ctx.beginPath()
  ctx.arc(60, 306, 6.5, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
  GEM.y = (swordTop + 306 * swordScale) / height

  // titre sur deux lignes, gothique
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${92 * u}px "UnifrakturMaguntia"`
  ctx.fillText('L’Épée de la', width / 2, height * 0.66)
  ctx.fillText('Dernière Chance', width / 2, height * 0.66 + 100 * u)
  ctx.font = `${30 * u}px "IM Fell English SC"`
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${9 * u}px`
  ctx.fillText('CHAPITRE PREMIER', width / 2, height * 0.66 + 168 * u)
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${2 * u}px`
  ctx.font = `italic ${38 * u}px "IM Fell English"`
  ctx.fillText('Aladin Akkari', width / 2, height - 150 * u)
  return canvas
}

// ---------- Garde intérieure : papier fibreux teinté, bordé de cuir ----------
export const paintEndpaper = (img, width, height, spineSide) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  for (let x = 0; x < width; x += img.width) for (let y = 0; y < height; y += img.height) ctx.drawImage(img, x, y)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = '#86321f'
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'
  const border = width * 0.035
  ctx.fillStyle = '#4a2015'
  ctx.fillRect(0, 0, width, border)
  ctx.fillRect(0, height - border, width, border)
  ctx.fillRect(spineSide === 'left' ? width - border : 0, 0, border, height)
  const fold = spineSide === 'left' ? ctx.createLinearGradient(0, 0, width * 0.12, 0) : ctx.createLinearGradient(width, 0, width * 0.88, 0)
  fold.addColorStop(0, 'rgb(0 0 0 / .5)')
  fold.addColorStop(1, 'rgb(0 0 0 / 0)')
  ctx.fillStyle = fold
  ctx.fillRect(0, 0, width, height)
  return canvas
}

// ---------- Tranches du bloc de pages ----------
export const paintEdges = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  for (let y = 0; y < 256; y += 2) {
    ctx.fillStyle = Math.random() > 0.15 ? '#e6d2a4' : '#d8c08c'
    ctx.fillRect(0, y, 64, 1)
    ctx.fillStyle = '#b89c68'
    ctx.fillRect(0, y + 1, 64, 1)
  }
  return canvas
}
