import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { paginate, rasterizePage, paintFoil, paintEndpaper, paintEdges, NEXT_URL } from './pages.js'
import { Book, W } from './book.js'

const stage = document.querySelector('[data-stage]')
const hint = document.querySelector('[data-hint]')
const source = document.querySelector('[data-source]')
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v))
const lerp = (a, b, t) => a + (b - a) * t
const textureUrl = (name) => new URL(`./textures/${name}`, import.meta.url).href

const start = async () => {
  // ---------- Rendu ----------
  const renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance' })
  let pixelRatio = Math.min(devicePixelRatio, 1.75)
  renderer.setPixelRatio(pixelRatio)
  renderer.setSize(innerWidth, innerHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  stage.append(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#040201')
  scene.fog = new THREE.FogExp2('#040201', 0.16)
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.28 // juste assez pour que l'or et le laiton aient quelque chose à refléter

  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 40)

  // ---------- Chargement : polices, textures, pages ----------
  const loader = new THREE.TextureLoader()
  const loadTexture = (name, color = false) => new Promise((resolve) => loader.load(textureUrl(name), (tex) => {
    if (color) tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    resolve(tex)
  }))
  const loadImage = (name) => new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.src = textureUrl(name)
  })

  const fonts = ['17px "IM Fell English"', 'italic 17px "IM Fell English"', '12px "IM Fell English SC"', '50px "UnifrakturMaguntia"']
  await Promise.all(fonts.map((font) => document.fonts.load(font))).catch(() => {})

  const [leatherDiff, leatherNor, leatherRough, woodDiff, woodNor, woodRough, paperNormal, paperImg, endpaperImg] = await Promise.all([
    loadTexture('leather_diff.jpg', true), loadTexture('leather_nor.jpg'), loadTexture('leather_rough.jpg'),
    loadTexture('wood_diff.jpg', true), loadTexture('wood_nor.jpg'), loadTexture('wood_rough.jpg'),
    loadTexture('paper_nor.jpg'), loadImage('paper.jpg'), loadImage('endpaper.jpg'),
  ])

  const pages = []
  for (const page of paginate(source)) pages.push(await rasterizePage(page, paperImg))

  const anisotropy = renderer.capabilities.getMaxAnisotropy()
  const coverRatio = 1.47 / 1.035 // hauteur / largeur du plat
  const book = new Book({
    maps: { leatherDiff, leatherNor, leatherRough, paperNormal },
    pages,
    foil: paintFoil(1200, Math.round(1200 * coverRatio)),
    endpapers: {
      right: paintEndpaper(endpaperImg, 1024, Math.round(1024 * coverRatio), 'left'),
      left: paintEndpaper(endpaperImg, 1024, Math.round(1024 * coverRatio), 'right'),
    },
    edges: paintEdges(),
    anisotropy,
  })
  book.group.rotation.y = -0.05
  scene.add(book.group)

  // ---------- Table de taverne ----------
  for (const tex of [woodDiff, woodNor, woodRough]) {
    tex.repeat.set(2.2, 2.2)
    tex.anisotropy = anisotropy
  }
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 12),
    new THREE.MeshStandardMaterial({ map: woodDiff, normalMap: woodNor, roughnessMap: woodRough, color: '#8a6648', normalScale: new THREE.Vector2(1.2, 1.2) }),
  )
  table.rotation.x = -Math.PI / 2
  table.receiveShadow = true
  scene.add(table)

  // ---------- Bougie : cire, flamme, lumière qui vacille ----------
  const candle = new THREE.Group()
  candle.position.set(-1.8, 0, -1.2)
  const brass = new THREE.MeshStandardMaterial({ color: '#a8803f', metalness: 1, roughness: 0.32 })
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.025, 48), brass)
  dish.position.y = 0.0125
  const wax = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.068, 0.42, 40),
    new THREE.MeshStandardMaterial({ color: '#efe2c4', roughness: 0.55, emissive: '#3a1a05', emissiveIntensity: 0.25 }),
  )
  wax.position.y = 0.025 + 0.21
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 6), new THREE.MeshBasicMaterial({ color: '#1a1008' }))
  wick.position.y = 0.46
  for (const part of [dish, wax]) part.castShadow = part.receiveShadow = true
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc477').multiplyScalar(9), toneMapped: false }),
  )
  flame.scale.set(0.018, 0.05, 0.018)
  flame.position.y = 0.505
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4dc').multiplyScalar(14), toneMapped: false }),
  )
  core.scale.set(0.008, 0.018, 0.008)
  core.position.y = 0.48
  candle.add(dish, wax, wick, flame, core)
  scene.add(candle)

  const flameWorld = new THREE.Vector3(candle.position.x, 0.51, candle.position.z)
  const candleLight = new THREE.SpotLight('#ffad62', 17, 10, 1.05, 1, 1.5)
  candleLight.position.copy(flameWorld)
  candleLight.target.position.set(0.1, 0, 0.1)
  candleLight.castShadow = true
  candleLight.shadow.mapSize.set(2048, 2048)
  candleLight.shadow.bias = -0.0003
  candleLight.shadow.normalBias = 0.015
  candleLight.shadow.radius = 4
  candleLight.shadow.camera.near = 0.1
  candleLight.shadow.camera.far = 6
  scene.add(candleLight, candleLight.target)
  const glow = new THREE.PointLight('#ff9a4a', 2, 2.4, 1.6) // halo chaud autour de la bougie
  glow.position.copy(flameWorld)
  scene.add(glow)
  const moon = new THREE.DirectionalLight('#7488b4', 0.45) // contre-jour froid, pour détacher le livre du noir
  moon.position.set(2.5, 3, 2.8)
  scene.add(moon)

  // ---------- Poussière dans la lumière ----------
  const DUST = 160
  const dustPositions = new Float32Array(DUST * 3)
  const dustSpeed = new Float32Array(DUST)
  const seedDust = (i, anywhere = true) => {
    // dans le faisceau, entre la bougie et le livre
    const k = Math.random()
    dustPositions[i * 3] = lerp(-1.5, 0.6, k) + (Math.random() - 0.5) * 0.5
    dustPositions[i * 3 + 1] = anywhere ? 0.15 + Math.random() * 0.9 : 0.15
    dustPositions[i * 3 + 2] = lerp(-1.0, 0.1, k) + (Math.random() - 0.5) * 0.5
    dustSpeed[i] = 0.004 + Math.random() * 0.01
  }
  for (let i = 0; i < DUST; i++) seedDust(i)
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
  const dot = document.createElement('canvas')
  dot.width = dot.height = 32
  const dotCtx = dot.getContext('2d')
  const dotGrad = dotCtx.createRadialGradient(16, 16, 0, 16, 16, 16)
  dotGrad.addColorStop(0, 'rgba(255,255,255,1)')
  dotGrad.addColorStop(1, 'rgba(255,255,255,0)')
  dotCtx.fillStyle = dotGrad
  dotCtx.fillRect(0, 0, 32, 32)
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.009, map: new THREE.CanvasTexture(dot), color: '#ffcf96', transparent: true, opacity: 0.32,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }))
  if (!reduceMotion) scene.add(dust)

  // ---------- Post-traitement : profondeur de champ, halo de la flamme, grain ----------
  const target = new THREE.WebGLRenderTarget(innerWidth * pixelRatio, innerHeight * pixelRatio, { type: THREE.HalfFloatType, samples: 4 })
  const composer = new EffectComposer(renderer, target)
  composer.setPixelRatio(pixelRatio)
  composer.addPass(new RenderPass(scene, camera))
  const bokeh = new BokehPass(scene, camera, { focus: 3, aperture: 0.0016, maxblur: 0.0055 })
  composer.addPass(bokeh)
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.75, 1))
  composer.addPass(new OutputPass())
  const grain = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: 0.05 }, vignette: { value: 0.62 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float time; uniform float amount; uniform float vignette; varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        vec2 d = vUv - 0.5;
        color.rgb *= mix(1.0, smoothstep(0.85, 0.2, length(d * vec2(1.1, 1.25))), vignette);
        color.rgb += (hash(vUv * 1000.0) - 0.5) * amount;
        gl_FragColor = color;
      }`,
  })
  composer.addPass(grain)

  // ---------- Caméra : cadre le livre, se rapproche et se redresse à l'ouverture ----------
  const look = new THREE.Vector3()
  const camPos = new THREE.Vector3()
  const pointer = { x: 0, y: 0 }
  let cameraReady = false

  const frameCamera = (time, snap = false) => {
    const open = book.coverP
    const { width, depth } = book.size
    const elevation = lerp(0.93, 1.13, open) // angle depuis la table
    const vfov = THREE.MathUtils.degToRad(camera.fov)
    // fermé : on cadre large pour voir la bougie ; ouvert : on resserre sur la double page
    const needH = (depth * Math.sin(elevation) + 0.3) * lerp(1.45, 1.18, open)
    const needW = width + lerp(1.6, 0.35, open)
    const distance = Math.max((needH / 2) / Math.tan(vfov / 2), (needW / 2) / (Math.tan(vfov / 2) * camera.aspect))
    const drift = reduceMotion ? 0 : 1
    const cx = book.center - lerp(0.45, 0, open) + Math.sin(time * 0.00011) * 0.03 * drift + pointer.x * 0.05 * drift
    const goal = new THREE.Vector3(cx, 0.06, 0.04)
    const pos = new THREE.Vector3(
      cx + pointer.x * 0.12 * drift,
      goal.y + Math.sin(elevation) * distance + pointer.y * 0.06 * drift,
      goal.z + Math.cos(elevation) * distance,
    )
    const ease = snap || !cameraReady ? 1 : 0.06
    look.lerp(goal, ease)
    camPos.lerp(pos, ease)
    camera.position.copy(camPos)
    camera.lookAt(look)
    bokeh.uniforms.focus.value = camera.position.distanceTo(look)
    cameraReady = true
  }

  // ---------- Animation des pages et du plat ----------
  const tweens = new Map()
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
  const easeOut = (t) => 1 - (1 - t) ** 3
  const getP = (item) => (item === 'cover' ? book.coverP : item.p)
  const setP = (item, value) => {
    if (item === 'cover') book.coverP = value
    else item.p = value
    book.layout()
  }
  const updateHint = () => {
    hint.textContent = book.coverP < 0.5 ? 'Touche le livre pour l’ouvrir' : 'Glisse une page pour la tourner · ← →'
  }
  const animate = (item, to, ease = easeInOut) => {
    const from = getP(item)
    const duration = reduceMotion ? 0 : (item === 'cover' ? 1700 : 1050) * Math.abs(to - from)
    tweens.set(item, { from, to, start: performance.now(), duration, ease })
  }
  const stepTweens = (now) => {
    for (const [item, t] of tweens) {
      const k = t.duration ? clamp((now - t.start) / t.duration) : 1
      setP(item, lerp(t.from, t.to, t.ease(k)))
      if (k >= 1) {
        tweens.delete(item)
        updateHint()
      }
    }
  }

  const nextLeaf = () => book.leaves.find((leaf) => leaf.p < 0.5)
  const prevLeaf = () => book.leaves.findLast((leaf) => leaf.p >= 0.5)
  const forward = () => {
    if (book.coverP < 0.5) return animate('cover', 1)
    const leaf = nextLeaf()
    if (leaf) animate(leaf, 1)
  }
  const backward = () => {
    const leaf = prevLeaf()
    if (leaf) animate(leaf, 0)
    else if (book.coverP >= 0.5) animate('cover', 0)
  }

  // ---------- Pointeur : glisser pour tourner, clic pour feuilleter, lien « À suivre » ----------
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const readPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.14)
  const hitPoint = new THREE.Vector3()
  let drag = null

  const aim = (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
  }
  const cast = (e) => {
    aim(e)
    return raycaster.intersectObjects(book.meshes, false).find((hit) => hit.object.visible)
  }
  const planeX = () => (raycaster.ray.intersectPlane(readPlane, hitPoint) ? book.group.worldToLocal(hitPoint.clone()).x : null)

  const linkAt = (hit) => {
    const leaf = hit?.object.userData.leaf
    if (!leaf || !hit.uv) return false
    const face = hit.object.userData.face
    const link = leaf.links[face]
    if (!link) return false
    const x = face === 'back' ? 1 - hit.uv.x : hit.uv.x
    const y = 1 - hit.uv.y
    return x >= link.x - 0.02 && x <= link.x + link.w + 0.02 && y >= link.y - 0.02 && y <= link.y + link.h + 0.02
  }

  const canvas = renderer.domElement
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    const hit = cast(e)
    if (!hit) return
    const x = planeX()
    if (x === null) return
    let item
    if (book.coverP < 0.5) item = 'cover'
    else if (x >= 0) item = nextLeaf()
    else item = prevLeaf() ?? 'cover'
    if (!item) return
    tweens.delete(item)
    canvas.setPointerCapture(e.pointerId)
    const p0 = getP(item)
    drag = { item, x0: x, p0, base: Math.round(p0), sx: e.clientX, moved: false, link: linkAt(hit) }
    canvas.style.cursor = 'grabbing'
  })
  canvas.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1
    pointer.y = (e.clientY / innerHeight) * 2 - 1
    if (!drag) {
      const hit = cast(e)
      canvas.style.cursor = linkAt(hit) ? 'pointer' : hit ? 'grab' : 'default'
      return
    }
    aim(e)
    const x = planeX()
    if (x === null) return
    if (Math.abs(e.clientX - drag.sx) > 5) drag.moved = true
    if (drag.moved) setP(drag.item, clamp(drag.p0 - (x - drag.x0) / (2 * W)))
  })
  const release = () => {
    if (!drag) return
    const { item, base, moved, link } = drag
    drag = null
    canvas.style.cursor = 'grab'
    if (!moved && link) {
      window.open(NEXT_URL, '_blank', 'noopener')
      return
    }
    if (!moved) animate(item, base ? 0 : 1)
    else animate(item, Math.abs(getP(item) - base) > 0.16 ? 1 - base : base, easeOut)
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)

  addEventListener('keydown', (e) => {
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); forward() }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); backward() }
  })

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
    composer.setSize(innerWidth, innerHeight)
    frameCamera(performance.now(), true)
  })

  // ---------- Boucle : flamme, poussière, caméra, qualité adaptative ----------
  let frames = 0
  let slowFrames = 0
  let last = performance.now()
  const loop = (now) => {
    const dt = now - last
    last = now
    stepTweens(now)

    // flamme : somme de sinus désaccordés + un peu de hasard
    const t = now * 0.001
    const flicker = reduceMotion ? 1 : 1 + Math.sin(t * 7.3) * 0.05 + Math.sin(t * 13.1 + 1.7) * 0.035 + (Math.random() - 0.5) * 0.05
    candleLight.intensity = 17 * flicker
    glow.intensity = 2 * flicker
    flame.scale.set(0.018 * (2 - flicker), 0.05 * flicker, 0.018 * (2 - flicker))
    flame.position.x = reduceMotion ? 0 : Math.sin(t * 3.1) * 0.003
    candleLight.position.set(flameWorld.x + flame.position.x, flameWorld.y, flameWorld.z)

    for (let i = 0; i < DUST; i++) {
      dustPositions[i * 3 + 1] += dustSpeed[i] * dt * 0.01
      dustPositions[i * 3] += Math.sin(t * 0.3 + i) * 0.0002
      if (dustPositions[i * 3 + 1] > 1.1) seedDust(i, false)
    }
    dustGeo.attributes.position.needsUpdate = true

    frameCamera(now)
    grain.uniforms.time.value = t % 100
    composer.render()

    // si l'appareil peine, on retire la profondeur de champ et on baisse la résolution
    frames++
    if (frames > 30 && frames < 150 && dt > 26) slowFrames++
    if (frames === 150 && slowFrames > 50) {
      bokeh.enabled = false
      pixelRatio = 1
      renderer.setPixelRatio(1)
      composer.setPixelRatio(1)
    }
    requestAnimationFrame(loop)
  }

  book.layout()
  frameCamera(performance.now(), true)
  updateHint()
  document.body.classList.add('is-ready')
  requestAnimationFrame(loop)

}

// ---------- Sans WebGL : le chapitre s'affiche en simple page de lecture ----------
const probe = document.createElement('canvas')
if (probe.getContext('webgl2') || probe.getContext('webgl')) {
  start()
} else {
  document.body.classList.add('no-webgl')
}
