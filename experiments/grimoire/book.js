import * as THREE from 'three'
import { PAGE_W, PAGE_H, GEM } from './pages.js'

// Unités de la scène : la page fait 1 de large. La reliure est sur l'axe Z (x = 0),
// les pages de droite vont vers +x, le haut de la page est vers -z, la table est en y = 0.
export const W = 1
export const H = PAGE_H / PAGE_W
const BOARD = 0.028 // épaisseur d'un plat
const OVER = 0.035 // débord du plat autour des pages
const BLOCK = 0.12 // épaisseur totale du bloc de pages
const LEAF_GAP = 0.0016 // écart entre feuilles empilées (évite qu'elles se chevauchent à l'écran)
const COLS = 48 // subdivisions d'une feuille, de la reliure au bord
const ROWS = 32
const CURL = 0.95 // courbure (rad) au milieu du tour de page
const TWIST = 0.42 // le coin du bas devance le haut : la page se soulève en diagonale

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v))
const lerp = (a, b, t) => a + (b - a) * t

export class Book {
  constructor({ maps, pages, foil, endpapers, edges, anisotropy }) {
    this.group = new THREE.Group()
    this.leaves = []
    this.anisotropy = anisotropy

    const leather = this.leatherMaterial(maps)
    const endLeft = this.canvasMaterial(endpapers.left, { roughness: 0.85 })
    const endRight = this.canvasMaterial(endpapers.right, { roughness: 0.85 })
    const edgeTex = this.texture(edges)
    edgeTex.wrapS = edgeTex.wrapT = THREE.RepeatWrapping
    edgeTex.repeat.set(1, 0.4)
    this.edgeMaterial = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.9, color: '#efe0bf' })
    this.paperNormal = maps.paperNormal

    // ---- Plat arrière (sous le bloc, côté droit) ----
    const backGeo = new THREE.BoxGeometry(W + OVER, BOARD, H + OVER * 2)
    backGeo.translate((W + OVER) / 2, BOARD / 2, 0)
    // faces : +x, -x, +y (intérieur : garde), -y (dessous), +z, -z
    this.back = new THREE.Mesh(backGeo, [leather, leather, endRight, leather, leather, leather])
    this.back.receiveShadow = this.back.castShadow = true
    this.group.add(this.back)

    // ---- Blocs de pages (droite : pages à lire, gauche : pages lues) ----
    const blockGeo = new THREE.BoxGeometry(1, 1, 1)
    blockGeo.translate(0.5, 0.5, 0)
    const hidden = new THREE.MeshBasicMaterial({ visible: false })
    this.blockRight = new THREE.Mesh(blockGeo, [this.edgeMaterial, hidden, hidden, hidden, this.edgeMaterial, this.edgeMaterial])
    this.blockLeft = new THREE.Mesh(blockGeo, [hidden, this.edgeMaterial, hidden, hidden, this.edgeMaterial, this.edgeMaterial])
    for (const block of [this.blockRight, this.blockLeft]) {
      block.castShadow = block.receiveShadow = true
      this.group.add(block)
    }

    // ---- Dos arrondi (visible livre fermé) ----
    const spineGeo = new THREE.CylinderGeometry(1, 1, H + OVER * 2, 24, 1, true, Math.PI, Math.PI)
    spineGeo.rotateX(Math.PI / 2)
    this.spine = new THREE.Mesh(spineGeo, leather)
    this.spine.castShadow = this.spine.receiveShadow = true
    this.group.add(this.spine)

    // ---- Plat avant : charnière sur la reliure ----
    this.coverPivot = new THREE.Group()
    const coverGeo = new THREE.BoxGeometry(W + OVER, BOARD, H + OVER * 2)
    coverGeo.translate((W + OVER) / 2, BOARD / 2, 0)
    this.cover = new THREE.Mesh(coverGeo, [leather, leather, leather, endLeft, leather, leather])
    this.cover.castShadow = this.cover.receiveShadow = true
    this.coverPivot.add(this.cover)
    this.addFoil(foil)
    this.addCorners()
    this.group.add(this.coverPivot)
    this.coverP = 0

    // ---- Feuilles ----
    for (let i = 0; i < pages.length; i += 2) {
      this.addLeaf(pages[i], pages[i + 1])
    }
    this.layout()
  }

  texture(canvas) {
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = this.anisotropy
    return tex
  }

  canvasMaterial(canvas, options = {}) {
    return new THREE.MeshStandardMaterial({ map: this.texture(canvas), ...options })
  }

  leatherMaterial(maps) {
    // le cuir CC0 a une couture à gauche : on cadre la partie saine de la texture
    for (const tex of [maps.leatherDiff, maps.leatherNor, maps.leatherRough]) {
      tex.repeat.set(0.58, 0.82)
      tex.offset.set(0.41, 0.09)
      tex.anisotropy = this.anisotropy
    }
    return new THREE.MeshStandardMaterial({
      map: maps.leatherDiff,
      normalMap: maps.leatherNor,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughnessMap: maps.leatherRough,
      roughness: 0.95,
      color: '#7c3321',
    })
  }

  // Dorure : un plan métallique découpé par le masque, posé sur le cuir
  addFoil(canvas) {
    const mask = this.texture(canvas)
    mask.colorSpace = THREE.NoColorSpace
    const foil = new THREE.Mesh(
      new THREE.PlaneGeometry(W + OVER, H + OVER * 2),
      new THREE.MeshStandardMaterial({ color: '#d9ac5c', metalness: 1, roughness: 0.3, alphaMap: mask, alphaTest: 0.5 }),
    )
    foil.rotation.x = -Math.PI / 2
    foil.position.set((W + OVER) / 2, BOARD + 0.0012, 0)
    foil.receiveShadow = true
    this.cover.add(foil)

    // gemme du pommeau
    const gem = new THREE.Mesh(
      new THREE.SphereGeometry(0.017, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#9b1410', roughness: 0.08, metalness: 0.1, emissive: '#2a0302' }),
    )
    gem.position.set(GEM.x * (W + OVER), BOARD + 0.0015, (GEM.y - 0.5) * (H + OVER * 2))
    gem.scale.y = 0.6
    this.cover.add(gem)
  }

  // Coins de laiton en relief
  addCorners() {
    const s = 0.17
    const t = 0.036
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.lineTo(s, 0)
    shape.lineTo(s, t)
    shape.lineTo(t, t)
    shape.lineTo(t, s)
    shape.lineTo(0, s)
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 })
    geo.rotateX(Math.PI / 2) // à plat sur le plat
    const brass = new THREE.MeshStandardMaterial({ color: '#b48a46', metalness: 1, roughness: 0.36 })
    const rivetGeo = new THREE.SphereGeometry(0.007, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)
    const w = W + OVER
    const h = H + OVER * 2
    const corners = [
      { x: 0.012, z: -h / 2 + 0.012, r: 0 }, // haut, côté reliure
      { x: w - 0.012, z: -h / 2 + 0.012, r: -Math.PI / 2 }, // haut, côté tranche
      { x: w - 0.012, z: h / 2 - 0.012, r: Math.PI }, // bas, côté tranche
      { x: 0.012, z: h / 2 - 0.012, r: Math.PI / 2 }, // bas, côté reliure
    ]
    for (const c of corners) {
      const piece = new THREE.Group()
      const plate = new THREE.Mesh(geo, brass)
      plate.castShadow = plate.receiveShadow = true
      const rivet = new THREE.Mesh(rivetGeo, brass)
      rivet.position.set(0.016, 0.0001, 0.016)
      piece.add(plate, rivet)
      piece.position.set(c.x, BOARD + 0.009, c.z)
      piece.rotation.y = c.r
      this.cover.add(piece)
    }
  }

  addLeaf(front, back) {
    const geo = new THREE.PlaneGeometry(W, H, COLS, ROWS)
    geo.rotateX(-Math.PI / 2)
    geo.translate(W / 2, 0, 0)
    const base = Float32Array.from(geo.attributes.position.array)

    const paperOptions = (map) => ({
      map,
      normalMap: this.paperNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.93,
    })
    const frontTex = this.texture(front.canvas)
    const frontMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ ...paperOptions(frontTex), side: THREE.FrontSide, shadowSide: THREE.DoubleSide }))
    let backMesh
    if (back) {
      // vu par-dessous, le plan est en miroir : on retourne la texture du verso
      const backTex = this.texture(back.canvas)
      backTex.wrapS = THREE.RepeatWrapping
      backTex.repeat.x = -1
      backTex.offset.x = 1
      backMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ ...paperOptions(backTex), side: THREE.BackSide }))
    } else {
      backMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#e8d6ad', roughness: 0.93, side: THREE.BackSide }))
    }
    frontMesh.castShadow = true
    frontMesh.receiveShadow = backMesh.receiveShadow = true
    const group = new THREE.Group()
    group.add(frontMesh, backMesh)
    this.group.add(group)

    const leaf = {
      index: this.leaves.length, group, geo, base, front: frontMesh, back: backMesh,
      links: { front: front.link, back: back?.link }, p: 0, drawnP: -1, drawnY: -1, anim: null,
    }
    frontMesh.userData.leaf = backMesh.userData.leaf = leaf
    frontMesh.userData.face = 'front'
    backMesh.userData.face = 'back'
    this.leaves.push(leaf)
  }

  // Avancement de la lecture : 0 = rien de tourné, 1 = tout tourné
  get turned() {
    return this.leaves.reduce((sum, leaf) => sum + leaf.p, 0) / Math.max(this.leaves.length, 1)
  }

  // Replace blocs, dos, plat avant et feuilles selon l'état courant
  layout() {
    const turned = this.turned
    const right = BLOCK * (1 - turned)
    const left = BLOCK * turned
    const open = this.coverP

    this.blockRight.scale.set(W - 0.006, Math.max(right, 0.0001), H)
    this.blockRight.position.set(0.002, BOARD, 0)
    this.blockLeft.scale.set(W - 0.006, Math.max(left, 0.0001), H)
    this.blockLeft.position.set(-(W - 0.004), BOARD, 0)
    this.blockLeft.visible = left > 0.001

    // fermé : le plat avant repose sur le bloc ; ouvert : il est à plat sur la table, à gauche
    const closedHinge = BOARD + right + this.leaves.length * LEAF_GAP
    const hinge = lerp(closedHinge, BOARD, Math.sin((open * Math.PI) / 2))
    this.coverPivot.position.set(0, hinge, 0)
    this.coverPivot.rotation.z = open * Math.PI

    // dos : demi-cylindre entre le plat arrière et le plat avant
    const top = lerp(closedHinge + BOARD, BOARD * 2 + left, open)
    // le dos s'aplatit à l'ouverture (sinon il ressort entre les pages)
    this.spine.scale.set(Math.max(top / 2, 0.001) * 0.55 * (1 - open), Math.max(top / 2, 0.001), 1)
    this.spine.position.set(0, top / 2, 0)
    this.spine.visible = open < 0.98

    const rightTop = BOARD + right
    const leftTop = BOARD + left
    const count = this.leaves.length
    this.leaves.forEach((leaf) => {
      // pile de droite : la première feuille à tourner est en haut ; pile de gauche : la dernière tournée en haut
      const stackR = rightTop + (count - leaf.index) * LEAF_GAP
      const stackL = leftTop + (leaf.index + 1) * LEAF_GAP
      const y = lerp(stackR, stackL, leaf.p)
      this.bend(leaf, y)
    })
  }

  // Déforme la feuille : la page part de la reliure et s'enroule, le coin du bas en avance
  bend(leaf, hingeY) {
    const p = leaf.p
    if (Math.abs(leaf.drawnP - p) < 1e-5 && Math.abs(leaf.drawnY - hingeY) < 1e-5) return
    leaf.drawnP = p
    leaf.drawnY = hingeY
    const pos = leaf.geo.attributes.position
    const arr = pos.array
    const theta = p * Math.PI
    const lift = Math.sin(p * Math.PI)
    const curl = lift * CURL
    const a0 = theta - curl * p
    const aEnd = theta + curl * (1 - p)
    const ds = W / COLS

    for (let r = 0; r <= ROWS; r++) {
      const zf = r / ROWS // 0 = haut de page, 1 = bas
      const twist = lift * TWIST * (zf - 0.5)
      let x = 0
      let y = 0
      for (let c = 0; c <= COLS; c++) {
        const i = (r * (COLS + 1) + c) * 3
        arr[i] = x
        arr[i + 1] = hingeY + y
        arr[i + 2] = leaf.base[i + 2]
        // angle au milieu du pas suivant (intégration le long de la page : la feuille ne s'étire pas)
        const s = (c + 0.5) / COLS
        const angle = clamp(lerp(a0, aEnd + twist, s), 0, Math.PI)
        x += Math.cos(angle) * ds
        y += Math.sin(angle) * ds
      }
    }
    pos.needsUpdate = true
    leaf.geo.computeVertexNormals()
    leaf.geo.computeBoundingSphere()
  }

  // centre visuel du livre : fermé → au milieu du plat ; ouvert → sur la reliure
  get center() {
    return lerp((W + OVER) / 2, 0, this.coverP)
  }

  get size() {
    return { width: lerp(W + OVER, 2 * (W + OVER), this.coverP), depth: H + OVER * 2 }
  }

  get meshes() {
    return [this.cover, this.back, this.blockRight, this.blockLeft, this.spine, ...this.leaves.flatMap((l) => [l.front, l.back])]
  }
}
