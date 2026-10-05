const tv = document.querySelector('[data-tv]')
const room = document.querySelector('[data-room]')
const channels = [...document.querySelectorAll('[data-channel]')]
const osdChannel = document.querySelector('[data-osd-ch]')
const osdDate = document.querySelector('[data-osd-date]')
const osdTape = document.querySelector('[data-osd-tape]')
const nextKnob = document.querySelector('[data-next]')
const prevKnob = document.querySelector('[data-prev]')
const powerButton = document.querySelector('[data-power-toggle]')
const soundButton = document.querySelector('[data-sound]')
const osdSound = document.querySelector('[data-osd-sound]')
const canvas = document.querySelector('[data-static]')
const ctx = canvas.getContext('2d')

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const SWITCH_MS = reduceMotion ? 0 : 280
const BOOT_MS = reduceMotion ? 0 : 1300
const OFF_MS = reduceMotion ? 0 : 450

let current = 0
let isOn = false
let switching = false
let frame = null
let soundOn = false

// Date VHS, ex. « OCT. 05 2026 »
const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
osdDate.textContent = `${now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}. ${pad(now.getDate())} ${now.getFullYear()}`

// Neige : bruit en basse résolution, agrandi en pixelated
canvas.width = 160
canvas.height = 100
const noise = ctx.createImageData(canvas.width, canvas.height)

const drawNoise = () => {
  const d = noise.data
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  ctx.putImageData(noise, 0, 0)
}
const loop = () => {
  drawNoise()
  frame = requestAnimationFrame(loop)
}
const startNoise = () => { if (!frame && !reduceMotion) loop() }
const stopNoise = () => {
  cancelAnimationFrame(frame)
  frame = null
}

// Vidéos YouTube : toutes chargées une fois à l'allumage, puis lecture / pause selon la chaîne affichée.
// Zapper ne recharge rien : la vidéo est déjà prête, le changement est immédiat.
const videoChannels = channels.filter((channel) => channel.dataset.video)
const isLive = (channel) => 'live' in channel.dataset

const videoSrc = (id, autoplay, live) => `https://www.youtube.com/embed/${id}?${new URLSearchParams({
  autoplay: autoplay ? 1 : 0, mute: 1,
  ...(live ? {} : { loop: 1, playlist: id }), // playlist = id : nécessaire pour boucler (inutile en direct)
  controls: 0, disablekb: 1, playsinline: 1, rel: 0, iv_load_policy: 3,
  enablejsapi: 1, origin: location.origin,
})}`

const send = (iframe, func) => iframe?.contentWindow?.postMessage(
  JSON.stringify({ event: 'command', func, args: [] }),
  'https://www.youtube.com',
)

// La chaîne affichée joue (avec le son si activé) ; les autres sont muettes, en pause sauf les directs,
// qui continuent de tourner pour qu'on retombe toujours sur le live
const syncVideo = (channel) => {
  const iframe = channel.querySelector('iframe')
  const active = isOn && channel === channels[current]
  send(iframe, active || (isOn && isLive(channel)) ? 'playVideo' : 'pauseVideo')
  send(iframe, active && soundOn ? 'unMute' : 'mute')
}

const mountVideos = () => {
  if (videoChannels[0].querySelector('iframe')) return
  videoChannels.forEach((channel) => {
    const iframe = document.createElement('iframe')
    iframe.src = videoSrc(channel.dataset.video, channel === channels[current] || isLive(channel), isLive(channel))
    iframe.title = channel.getAttribute('aria-label')
    iframe.allow = 'autoplay; encrypted-media'
    iframe.tabIndex = -1
    // le lecteur écoute les commandes un peu après le load : on resynchronise deux fois
    iframe.addEventListener('load', () => {
      // s'abonne aux événements du lecteur (pour détecter une vidéo / un live mort),
      // répété comme le fait l'API officielle, le lecteur n'écoute pas tout de suite
      const listen = () => iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: channel.dataset.video, channel: 'widget' }),
        'https://www.youtube.com',
      )
      ;[0, 500, 1500, 3000].forEach((delay) => setTimeout(listen, delay))
      syncVideo(channel)
      setTimeout(() => syncVideo(channel), 800)
    })
    channel.append(iframe)
  })
}

// Vidéo supprimée ou live terminé : la chaîne passe en NO SIGNAL au lieu de l'écran d'erreur YouTube
addEventListener('message', (e) => {
  if (e.origin !== 'https://www.youtube.com') return
  let data
  try { data = JSON.parse(e.data) } catch { return }
  if (data.event !== 'onError') return
  videoChannels
    .find((channel) => channel.querySelector('iframe')?.contentWindow === e.source)
    ?.classList.add('is-dead')
})

const show = (index) => {
  channels.forEach((channel, i) => channel.classList.toggle('is-current', i === index))
  current = index
  room.style.setProperty('--glow', channels[index].dataset.glow)
  const live = isLive(channels[index])
  osdTape.textContent = live ? '● LIVE' : 'TAPE'
  osdTape.classList.toggle('is-live', live)
  videoChannels.forEach(syncVideo)
}

const zapTo = (index) => {
  if (!isOn || switching || index === current) return
  switching = true
  tv.classList.add('is-switching')
  osdChannel.textContent = `CH ${pad(index)}`
  setTimeout(() => show(index), SWITCH_MS / 2)
  setTimeout(() => {
    tv.classList.remove('is-switching')
    switching = false
  }, SWITCH_MS)
}
const wrap = (index) => ((index % channels.length) + channels.length) % channels.length
const zap = (direction) => zapTo(wrap(current + direction))

const powerOn = () => {
  isOn = true
  mountVideos()
  show(current)
  osdChannel.textContent = `CH ${pad(current)}`
  tv.dataset.power = 'on'
  tv.classList.add('is-booting')
  powerButton.setAttribute('aria-pressed', 'true')
  startNoise()
  setTimeout(() => tv.classList.remove('is-booting'), BOOT_MS)
}

const powerOff = () => {
  isOn = false
  tv.dataset.power = 'turning-off'
  powerButton.setAttribute('aria-pressed', 'false')
  room.style.setProperty('--glow', 'transparent')
  videoChannels.forEach(syncVideo)
  setTimeout(stopNoise, OFF_MS)
}

const togglePower = () => (isOn ? powerOff() : powerOn())

// Son : l'autoplay n'est permis qu'en muet ; on (dé)mute le lecteur en place via son API postMessage
const toggleSound = () => {
  soundOn = !soundOn
  soundButton.setAttribute('aria-pressed', String(soundOn))
  soundButton.setAttribute('aria-label', soundOn ? 'Couper le son' : 'Activer le son')
  osdSound.textContent = soundOn ? '' : 'MUTE'
  syncVideo(channels[current])
}

// Molettes : un cran = 30° = une chaîne. Elles tournent même télé éteinte (comme une vraie).
const NOTCH = 30
const getAngle = (knob) => Number(knob.dataset.angle) || 0
const setAngle = (knob, angle) => {
  knob.dataset.angle = angle
  knob.style.setProperty('--rot', `${angle}deg`)
}
const next = () => { setAngle(nextKnob, getAngle(nextKnob) + NOTCH); zap(1) }
const prev = () => { setAngle(prevKnob, getAngle(prevKnob) - NOTCH); zap(-1) }

// Angle du pointeur autour du centre de la molette (le centre de la zone = l'axe mesuré sur la photo)
const pointerAngle = (knob, e) => {
  const r = knob.getBoundingClientRect()
  return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI
}

// Glisser autour de la molette la fait tourner : sens horaire = chaîne suivante, un cran franchi = un zapping.
// Un simple clic reste possible (et au clavier, Entrée / Espace).
const makeDial = (knob, onClick) => {
  let drag = null
  knob.addEventListener('pointerdown', (e) => {
    knob.setPointerCapture(e.pointerId)
    drag = { last: pointerAngle(knob, e), total: 0, start: getAngle(knob), channel: current, moved: false }
    knob.classList.add('is-dragging')
  })
  knob.addEventListener('pointermove', (e) => {
    if (!drag) return
    const angle = pointerAngle(knob, e)
    let delta = angle - drag.last
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    drag.last = angle
    drag.total += delta
    if (Math.abs(drag.total) > 6) drag.moved = true
    setAngle(knob, drag.start + drag.total)
    if (drag.moved) zapTo(wrap(drag.channel + Math.round(drag.total / NOTCH)))
  })
  const release = () => {
    if (!drag) return
    knob.classList.remove('is-dragging')
    const notches = Math.round(drag.total / NOTCH)
    setAngle(knob, drag.start + notches * NOTCH) // se cale sur le cran le plus proche
    if (drag.moved) {
      const target = wrap(drag.channel + notches)
      setTimeout(() => zapTo(target), SWITCH_MS) // rattrape un cran ignoré pendant un zapping en cours
      knob.dataset.dragged = 'true'
    }
    drag = null
  }
  knob.addEventListener('pointerup', release)
  knob.addEventListener('pointercancel', release)
  knob.addEventListener('click', () => {
    if (knob.dataset.dragged) {
      delete knob.dataset.dragged // ce clic termine un glisser, pas un clic
      return
    }
    onClick()
  })
}
makeDial(nextKnob, next)
makeDial(prevKnob, prev)
document.querySelectorAll('[data-channel-key]').forEach((key) => {
  key.addEventListener('click', () => zapTo(Number(key.dataset.channelKey)))
})
powerButton.addEventListener('click', togglePower)
soundButton.addEventListener('click', toggleSound)

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next()
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') prev()
  else if (e.key.toLowerCase() === 'p') togglePower()
  else if (e.key.toLowerCase() === 'm') toggleSound()
  else if (/^[0-9]$/.test(e.key) && Number(e.key) < channels.length) zapTo(Number(e.key))
})

// La télé s'allume toute seule à l'arrivée
setTimeout(powerOn, 500)
