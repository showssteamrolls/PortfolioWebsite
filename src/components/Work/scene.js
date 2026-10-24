// The 3D world: terrain you can feel (hills, the camera and car rising and
// falling with them), the lit line, the checkered start/finish line and the car.
// three.js and the model load on demand; if anything fails the caller falls back
// to a plain list.
import track from '../../data/laguna.json'
import { buildCar, LENGTH } from './car'

export const K = 7 // world px per map px: how big the circuit is
export const MARGIN = 420 // room around the circuit
const HS = 680 // world px of height for the full terrain range
const CELL = 14 // world px between heightfield samples
export const PRE = 130 // run-up before the start line, and run-out past the finish
export const R = 1300 // camera distance from the car (also sets the field of view)
const EL = (36 * Math.PI) / 180 // camera elevation above the ground
const STEP = 4 // px between samples along the line
const BG = [244 / 255, 245 / 255, 247 / 255]

// ---------- the line, as a closed loop ----------

const buildTrack = () => {
    const pts = track.points.map(([x, y]) => ({ x: x * K + MARGIN, z: y * K + MARGIN }))
    const n = pts.length
    const SUB = 16
    const poly = []
    for (let i = 0; i < n; i += 1) {
        const p0 = pts[(i - 1 + n) % n]
        const p1 = pts[i]
        const p2 = pts[(i + 1) % n]
        const p3 = pts[(i + 2) % n]
        for (let k = 0; k < SUB; k += 1) {
            const t = k / SUB
            const t2 = t * t
            const t3 = t2 * t
            const c = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3)
            poly.push({ x: c(p0.x, p1.x, p2.x, p3.x), z: c(p0.z, p1.z, p2.z, p3.z) })
        }
    }
    poly.push({ ...poly[0] })
    const cum = [0]
    for (let i = 1; i < poly.length; i += 1) {
        cum.push(cum[i - 1] + Math.hypot(poly[i].x - poly[i - 1].x, poly[i].z - poly[i - 1].z))
    }
    const L = cum[cum.length - 1]
    const count = Math.round(L / STEP)
    const step = L / count
    const xs = new Float64Array(count + 1)
    const zs = new Float64Array(count + 1)
    const ls = new Float64Array(count + 1)
    let q = 0
    for (let k = 0; k <= count; k += 1) {
        const len = k * step
        while (q < poly.length - 2 && cum[q + 1] < len) q += 1
        const f = (len - cum[q]) / ((cum[q + 1] - cum[q]) || 1)
        xs[k] = poly[q].x + (poly[q + 1].x - poly[q].x) * f
        zs[k] = poly[q].z + (poly[q + 1].z - poly[q].z) * f
        ls[k] = len
    }

    // which way the line points (clockwise from straight up the map), unwrapped
    const tru = new Float64Array(count + 1)
    for (let k = 0; k <= count; k += 1) {
        const lo = (k - 3 + count) % count
        const hi = (k + 3) % count
        tru[k] = Math.atan2(xs[hi] - xs[lo], -(zs[hi] - zs[lo]))
        if (k > 0) {
            while (tru[k] - tru[k - 1] > Math.PI) tru[k] -= 2 * Math.PI
            while (tru[k] - tru[k - 1] < -Math.PI) tru[k] += 2 * Math.PI
        }
    }
    // one lap turns the line through this much (about a full circle)
    const lap = Math.round((tru[count] - tru[0]) / (2 * Math.PI)) * 2 * Math.PI
    const at = (k) => {
        if (k < 0) return tru[k + count] - lap
        if (k > count) return tru[k - count] + lap
        return tru[k]
    }
    // the camera looks a little ahead and eases through the bends
    const cam = new Float64Array(count + 1)
    for (let k = 0; k <= count; k += 1) {
        let sum = 0
        for (let q = k - 15; q <= k + 45; q += 1) sum += at(q)
        cam[k] = sum / 61
    }

    const nodes = track.stops.map((si) => {
        const p = pts[si]
        const before = pts[(si - 4 + n) % n]
        const after = pts[(si + 4) % n]
        const turn = (p.x - before.x) * (after.z - p.z) - (p.z - before.z) * (after.x - p.x)
        let best = 0
        let bd = Infinity
        for (let k = 0; k <= count; k += 1) {
            const d2 = (xs[k] - p.x) ** 2 + (zs[k] - p.z) ** 2
            if (d2 < bd) {
                bd = d2
                best = k
            }
        }
        // the card goes on the outside of the turn
        return { x: p.x, z: p.z, len: ls[best], side: turn > 0 ? -1 : 1 }
    })

    return {
        count, step, L, xs, zs, ls, tru, cam, lap, nodes,
        worldW: track.w * K + MARGIN * 2,
        worldH: track.h * K + MARGIN * 2,
    }
}

export const TRACK = buildTrack()

// Position and headings on the line at distance `len` from the start. The line is
// a loop, so lengths before the start or past the finish wrap around.
export const sampleTrack = (len) => {
    const t = TRACK
    let s = len
    let laps = 0
    while (s < 0) { s += t.L; laps -= 1 }
    while (s > t.L) { s -= t.L; laps += 1 }
    const k = Math.min(t.count - 1, Math.floor(s / t.step))
    const f = (s - t.ls[k]) / (t.ls[k + 1] - t.ls[k] || 1)
    const mix = (a) => a[k] + (a[k + 1] - a[k]) * f
    return { x: mix(t.xs), z: mix(t.zs), len, cam: mix(t.cam) + laps * t.lap, tru: mix(t.tru) + laps * t.lap }
}

// ---------- terrain ----------

const TERRAIN_VERT = `
varying vec3 vN;
varying float vH;
varying vec3 vP;
void main() {
    vN = normal;
    vH = position.y / ${HS.toFixed(1)};
    vP = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const TERRAIN_FRAG = `
uniform vec3 uL;
uniform vec3 uBg;
uniform vec3 uCam;
uniform vec2 uBounds;
varying vec3 vN;
varying float vH;
varying vec3 vP;
void main() {
    vec3 n = normalize(vN);
    float d = dot(n, uL) - uL.y;                 // 0 on flat ground
    vec3 col = uBg;
    col = mix(col, vec3(0.69, 0.76, 0.90), clamp(-d * 2.6, 0.0, 1.0));
    col = mix(col, vec3(1.0), clamp(d * 1.8, 0.0, 1.0) * 0.9);
    col = mix(col, vec3(0.80, 0.86, 0.97), smoothstep(0.1, 0.9, vH) * 0.55); // higher ground reads bluer

    // contour lines every 0.05 of height, stronger every 0.25
    float lv = vH * 20.0;
    float f = abs(fract(lv - 0.5) - 0.5) / max(fwidth(lv), 1e-5);
    float line = 1.0 - clamp(f * 0.8, 0.0, 1.0);
    float iv = lv / 5.0;
    float fi = abs(fract(iv - 0.5) - 0.5) / max(fwidth(iv), 1e-5);
    float major = 1.0 - clamp(fi * 0.55, 0.0, 1.0);
    vec3 blue = vec3(0.208, 0.490, 0.929);

    // melt into the page colour with distance and at the edges of the map
    float dist = length(vP - uCam);
    float fog = smoothstep(1500.0, 3700.0, dist);
    float edge = min(min(vP.x, uBounds.x - vP.x), min(vP.z, uBounds.y - vP.z));
    fog = max(fog, 1.0 - smoothstep(0.0, 900.0, edge));
    gl_FragColor = vec4(mix(col, uBg, fog), 1.0);
}`

const checkerTexture = (THREE) => {
    const c = document.createElement('canvas')
    c.width = 160
    c.height = 48
    const ctx = c.getContext('2d')
    const sq = 16
    for (let y = 0; y < 3; y += 1) {
        for (let x = 0; x < 10; x += 1) {
            ctx.fillStyle = (x + y) % 2 === 0 ? '#0e1b4d' : '#ffffff'
            ctx.fillRect(x * sq, y * sq, sq, sq)
        }
    }
    const tex = new THREE.CanvasTexture(c)
    tex.magFilter = THREE.NearestFilter
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
}

const shadowTexture = (THREE) => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 128
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
    g.addColorStop(0, 'rgba(20,30,70,0.4)')
    g.addColorStop(1, 'rgba(20,30,70,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
}

export const loadWorld = async (canvas) => {
    const THREE = await import('three')
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const base = process.env.PUBLIC_URL

    const [heightBuf, gltf] = await Promise.all([
        fetch(`${base}/topo/laguna-height.bin`).then((r) => {
            if (!r.ok) throw new Error('height map missing')
            return r.arrayBuffer()
        }),
        new GLTFLoader().loadAsync(`${base}/models/williams.glb`),
    ])

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(new THREE.Color(BG[0], BG[1], BG[2]), 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 60, 12000)

    // ----- heightfield -----
    const head = new Uint16Array(heightBuf, 0, 2)
    const cols = head[0]
    const rows = head[1]
    const data = new Uint16Array(heightBuf, 4, cols * rows)
    const height = (x, z) => {
        const fx = Math.min(cols - 1.001, Math.max(0, x / CELL))
        const fz = Math.min(rows - 1.001, Math.max(0, z / CELL))
        const i = Math.floor(fx)
        const j = Math.floor(fz)
        const u = fx - i
        const v = fz - j
        const a = data[j * cols + i]
        const b = data[j * cols + i + 1]
        const c = data[(j + 1) * cols + i]
        const d = data[(j + 1) * cols + i + 1]
        return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) * (HS / 65535)
    }
    const normalAt = (x, z, out) => {
        const e = 24
        out.set(
            (height(x - e, z) - height(x + e, z)) / (2 * e),
            1,
            (height(x, z - e) - height(x, z + e)) / (2 * e)
        ).normalize()
        return out
    }

    const tpos = new Float32Array(cols * rows * 3)
    for (let j = 0; j < rows; j += 1) {
        for (let i = 0; i < cols; i += 1) {
            const o = (j * cols + i) * 3
            tpos[o] = i * CELL
            tpos[o + 1] = (data[j * cols + i] / 65535) * HS
            tpos[o + 2] = j * CELL
        }
    }
    const tidx = new Uint32Array((cols - 1) * (rows - 1) * 6)
    let w = 0
    for (let j = 0; j < rows - 1; j += 1) {
        for (let i = 0; i < cols - 1; i += 1) {
            const a = j * cols + i
            const b = a + 1
            const c = a + cols
            const d = c + 1
            tidx[w++] = a; tidx[w++] = c; tidx[w++] = b
            tidx[w++] = b; tidx[w++] = c; tidx[w++] = d
        }
    }
    const tgeo = new THREE.BufferGeometry()
    tgeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3))
    tgeo.setIndex(new THREE.BufferAttribute(tidx, 1))
    tgeo.computeVertexNormals()
    const uniforms = {
        uL: { value: new THREE.Vector3(0, 1, 0) },
        uBg: { value: new THREE.Vector3(BG[0], BG[1], BG[2]) },
        uCam: { value: new THREE.Vector3() },
        uBounds: { value: new THREE.Vector2((cols - 1) * CELL, (rows - 1) * CELL) },
    }
    const tmat = new THREE.ShaderMaterial({ vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG, uniforms })
    scene.add(new THREE.Mesh(tgeo, tmat))

    // ----- the line: a faint ribbon, a glow, and the lit part behind the car -----
    const t = TRACK
    const n = t.count + 1
    const LIFT = 6
    const ribbon = (hw, colorAt) => {
        const pos = new Float32Array(n * 6)
        const col = colorAt ? new Float32Array(n * 6) : null
        for (let k = 0; k < n; k += 1) {
            const kp = k === 0 ? n - 2 : k - 1
            const kn = k === n - 1 ? 1 : k + 1
            const tx = t.xs[kn] - t.xs[kp]
            const tz = t.zs[kn] - t.zs[kp]
            const tl = Math.hypot(tx, tz) || 1
            const nx = -tz / tl
            const nz = tx / tl
            for (let s = 0; s < 2; s += 1) {
                const sg = s === 0 ? 1 : -1
                const x = t.xs[k] + nx * hw * sg
                const z = t.zs[k] + nz * hw * sg
                const o = k * 6 + s * 3
                pos[o] = x
                pos[o + 1] = height(x, z) + LIFT
                pos[o + 2] = z
                if (col) {
                    const c = colorAt(k / (n - 1))
                    col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b
                }
            }
        }
        const idx = new Uint32Array((n - 1) * 6)
        for (let k = 0; k < n - 1; k += 1) {
            const a = k * 2
            idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], k * 6)
        }
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3))
        g.setIndex(new THREE.BufferAttribute(idx, 1))
        return g
    }
    const lastStop = t.nodes[t.nodes.length - 1].len
    const c0 = new THREE.Color('#00b4d8')
    const c1 = new THREE.Color('#275DFA')
    const grade = (f) => {
        const u = Math.min(1, (f * t.L) / lastStop)
        return new THREE.Color().copy(c0).lerp(c1, u)
    }
    const mk = (geometry, opts) => {
        const m = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide, transparent: true, depthWrite: false,
            polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...opts,
        }))
        scene.add(m)
        return m
    }
    mk(ribbon(10), { color: new THREE.Color('#357DED'), opacity: 0.26 })
    const glow = mk(ribbon(26, grade), { vertexColors: true, opacity: 0.16 })
    const lit = mk(ribbon(10, grade), { vertexColors: true, opacity: 1 })
    glow.geometry.setDrawRange(0, 0)
    lit.geometry.setDrawRange(0, 0)

    // ----- helpers to stand things on the ground -----
    const fwd = new THREE.Vector3()
    const up = new THREE.Vector3()
    const right = new THREE.Vector3()
    const m4 = new THREE.Matrix4()
    const stand = (obj, x, z, lift, f3, noseNegX) => {
        normalAt(x, z, up)
        fwd.copy(f3).addScaledVector(up, -f3.dot(up)).normalize()
        if (noseNegX) {
            // car: nose along -X, up along Y
            right.copy(fwd).negate()
            const zax = new THREE.Vector3().crossVectors(right, up)
            m4.makeBasis(right, up, zax)
        } else {
            // flat marking: x across the track, y along it, z up
            const xax = new THREE.Vector3().crossVectors(fwd, up)
            m4.makeBasis(xax, fwd, up)
        }
        obj.quaternion.setFromRotationMatrix(m4)
        obj.position.set(x, height(x, z) + lift, z)
    }
    const tangent3 = (len, out) => {
        const a = sampleTrack(len - 18)
        const b = sampleTrack(len + 18)
        return out.set(b.x - a.x, height(b.x, b.z) - height(a.x, a.z), b.z - a.z).normalize()
    }

    // ----- checkered start / finish line -----
    const checker = new THREE.Mesh(
        new THREE.PlaneGeometry(80, 24),
        new THREE.MeshBasicMaterial({ map: checkerTexture(THREE), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
    )
    scene.add(checker)
    const t0 = new THREE.Vector3()
    tangent3(8, t0)
    stand(checker, t.xs[0], t.zs[0], LIFT + 1, t0, false)

    // ----- the car -----
    const { car, spin } = buildCar(THREE, gltf)
    scene.add(car)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a8, 1.7))
    const sun = new THREE.DirectionalLight(0xffffff, 2.2)
    sun.position.set(-1500, 3000, 1200)
    scene.add(sun)
    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(LENGTH * 1.5, LENGTH * 0.8),
        new THREE.MeshBasicMaterial({ map: shadowTexture(THREE), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
    )
    scene.add(shadow)

    // ----- per-frame -----
    const size = { w: 1, h: 1 }
    const target = new THREE.Vector3()
    const camFwd = new THREE.Vector3()
    const tmp = new THREE.Vector3()
    const lightDir = new THREE.Vector3()
    const rightVec = new THREE.Vector3()

    const setSize = (w, h, aX, aY) => {
        size.w = w
        size.h = h
        renderer.setSize(w, h)
        camera.aspect = w / h
        camera.fov = (2 * Math.atan(h / 2 / R) * 180) / Math.PI
        camera.setViewOffset(w, h, w / 2 - aX, h / 2 - aY, w, h)
        camera.updateProjectionMatrix()
    }

    const frame = ({ len, camYaw, distance }) => {
        const p = sampleTrack(len)
        const gy = height(p.x, p.z)

        // camera: behind and above the car, a little lower when climbing
        const ahead = sampleTrack(len + 140)
        const behind = sampleTrack(len - 40)
        const run = Math.hypot(ahead.x - behind.x, ahead.z - behind.z) || 1
        const slope = Math.atan2(height(ahead.x, ahead.z) - height(behind.x, behind.z), run)
        const el = EL - 0.7 * Math.max(-0.5, Math.min(0.5, slope))
        camFwd.set(Math.sin(camYaw), 0, -Math.cos(camYaw))
        target.set(p.x, gy + LIFT + 6, p.z)
        camera.position.set(
            target.x - camFwd.x * R * Math.cos(el),
            target.y + R * Math.sin(el),
            target.z - camFwd.z * R * Math.cos(el)
        )
        camera.lookAt(target)
        camera.updateMatrixWorld()
        camera.getWorldDirection(camFwd)

        // light stays fixed relative to the view: from the upper left, a little toward us
        rightVec.set(Math.cos(camYaw), 0, Math.sin(camYaw))
        lightDir.set(0, 0.75, 0)
        lightDir.addScaledVector(rightVec, -0.55)
        tmp.set(Math.sin(camYaw), 0, -Math.cos(camYaw))
        lightDir.addScaledVector(tmp, -0.35).normalize()
        uniforms.uL.value.copy(lightDir)
        uniforms.uCam.value.copy(camera.position)

        // car and its shadow sit on the ground, tilting with the slope
        const f3 = tangent3(len, new THREE.Vector3())
        stand(car, p.x, p.z, LIFT, f3, true)
        stand(shadow, p.x, p.z, LIFT + 1.5, f3, false)
        spin(distance)

        // lit part of the line behind the car
        // the trail starts afresh each time the car crosses the line
        const inLap = len < 0 && len >= -PRE ? 0 : ((len % t.L) + t.L) % t.L
        const upto = Math.min(n - 1, Math.floor(inLap / t.step))
        const cnt = upto * 6
        lit.geometry.setDrawRange(0, cnt)
        glow.geometry.setDrawRange(0, cnt)

        renderer.render(scene, camera)
    }

    // where a point on the ground lands on screen, and how big things there look
    const project = (x, z, lift = 0) => {
        tmp.set(x, height(x, z) + lift, z)
        const cp = camera.position
        const depth = (tmp.x - cp.x) * camFwd.x + (tmp.y - cp.y) * camFwd.y + (tmp.z - cp.z) * camFwd.z
        if (depth < R / 5) return null
        tmp.project(camera)
        return { x: ((tmp.x + 1) / 2) * size.w, y: ((1 - tmp.y) / 2) * size.h, s: R / depth }
    }

    const dispose = () => {
        renderer.dispose()
        scene.traverse((o) => {
            if (o.geometry) o.geometry.dispose()
            if (o.material) {
                [].concat(o.material).forEach((m) => {
                    if (m.map) m.map.dispose()
                    m.dispose()
                })
            }
        })
    }

    return { setSize, frame, project, dispose }
}
