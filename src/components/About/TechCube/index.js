import { useEffect, useRef } from 'react'
import './index.scss'

// A glass dodecahedron with one tool on each of its 12 faces. It tilts toward the
// cursor (eased, so it trails a little) and drifts slowly on its own, which also
// covers phones, where there is no cursor. three.js loads on demand.
const TILT_X = 0.55 // radians of tilt for a cursor at the very top or bottom of the page
const TILT_Y = 0.9 // ...and at the left or right edge
const DRIFT = 0.18 // radians per second of idle spin
const EASE = 5 // how quickly it chases the cursor

const drawLogo = (src, THREE) => new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
        const S = 512
        const c = document.createElement('canvas')
        c.width = S
        c.height = S
        const ctx = c.getContext('2d')
        const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1)
        const w = ratio >= 1 ? S : S * ratio
        const h = ratio >= 1 ? S / ratio : S
        ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h)
        const tex = new THREE.CanvasTexture(c)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 4
        resolve(tex)
    }
    img.onerror = () => resolve(null)
    img.src = src
})

const TechCube = ({ logos }) => {
    const canvasRef = useRef(null)

    useEffect(() => {
        let dead = false
        let cleanup = () => {}

        ;(async () => {
            const THREE = await import('three')
            const textures = await Promise.all(logos.map((l) => drawLogo(l.src, THREE)))
            if (dead) return
            const canvas = canvasRef.current
            const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
            renderer.setClearColor(0x000000, 0)
            const scene = new THREE.Scene()
            const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
            camera.position.z = 10.5

            const root = new THREE.Group()
            scene.add(root)

            const R = 1.55 // dodecahedron radius
            const geo = new THREE.DodecahedronGeometry(R)
            const pos = geo.getAttribute('position')
            const faces = []
            // detail 0 gives each pentagon as 3 consecutive triangles (9 vertices)
            for (let f = 0; f < 12; f += 1) {
                const verts = []
                const seen = new Map()
                for (let v = 0; v < 9; v += 1) {
                    const p = new THREE.Vector3().fromBufferAttribute(pos, f * 9 + v)
                    const key = `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`
                    if (!seen.has(key)) {
                        seen.set(key, true)
                        verts.push(p)
                    }
                }
                const center = verts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(verts.length)
                faces.push({ verts, center, normal: center.clone().normalize() })
            }

            const light = new THREE.Vector3(-0.5, 0.8, 0.6).normalize()
            const items = faces.map((face, i) => {
                const group = new THREE.Group()
                // the pentagon pane, as a fan around the face centre
                const verts = face.verts
                const ref = new THREE.Vector3(0, 1, 0)
                if (Math.abs(face.normal.dot(ref)) > 0.95) ref.set(1, 0, 0)
                const ux = new THREE.Vector3().crossVectors(ref, face.normal).normalize()
                const uy = new THREE.Vector3().crossVectors(face.normal, ux)
                verts.sort((a, b) => {
                    const da = a.clone().sub(face.center)
                    const db = b.clone().sub(face.center)
                    return Math.atan2(da.dot(uy), da.dot(ux)) - Math.atan2(db.dot(uy), db.dot(ux))
                })
                const arr = []
                verts.forEach((v, k) => {
                    const w = verts[(k + 1) % verts.length]
                    arr.push(face.center.x, face.center.y, face.center.z, v.x, v.y, v.z, w.x, w.y, w.z)
                })
                const g = new THREE.BufferGeometry()
                g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3))
                const glassMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false,
                })
                const glass = new THREE.Mesh(g, glassMat)
                group.add(glass)

                // the logo, upright as far as the face allows, a hair off the surface
                const size = R * 0.66
                const logo = new THREE.Mesh(
                    new THREE.PlaneGeometry(size, size),
                    new THREE.MeshBasicMaterial({ map: textures[i], transparent: true, side: THREE.DoubleSide, depthWrite: false })
                )
                const worldUp = new THREE.Vector3(0, 1, 0)
                const up = Math.abs(face.normal.dot(worldUp)) > 0.95
                    ? new THREE.Vector3(0, 0, -1).multiplyScalar(Math.sign(face.normal.y))
                    : worldUp.clone().addScaledVector(face.normal, -worldUp.dot(face.normal)).normalize()
                const right = new THREE.Vector3().crossVectors(up, face.normal)
                logo.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, face.normal))
                logo.position.copy(face.center).addScaledVector(face.normal, 0.02)
                logo.visible = !!textures[i]
                group.add(logo)
                root.add(group)
                return { face, glassMat }
            })

            const edges = new THREE.LineSegments(
                new THREE.EdgesGeometry(geo),
                new THREE.LineBasicMaterial({ color: 0x275dfa, transparent: true, opacity: 0.95 })
            )
            root.add(edges)

            const resize = () => {
                const w = canvas.clientWidth
                const h = canvas.clientHeight
                if (!w || !h) return
                renderer.setSize(w, h, false)
                camera.aspect = w / h
                camera.updateProjectionMatrix()
            }
            const ro = new ResizeObserver(resize)
            ro.observe(canvas)
            resize()

            const cursor = { x: 0, y: 0 }
            const onMove = (e) => {
                cursor.x = (e.clientX / window.innerWidth) * 2 - 1
                cursor.y = (e.clientY / window.innerHeight) * 2 - 1
            }
            window.addEventListener('pointermove', onMove)

            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            const cur = { x: 0.35, y: -0.4 }
            let spin = 0
            let last = performance.now()
            let raf = 0
            const q = new THREE.Quaternion()
            const wn = new THREE.Vector3()

            const tick = (now) => {
                const dt = Math.min(0.05, (now - last) / 1000)
                last = now
                if (!reduced) spin += dt * DRIFT
                const k = 1 - Math.exp(-dt * EASE)
                cur.x += (cursor.y * TILT_X + 0.35 - cur.x) * k
                cur.y += (cursor.x * TILT_Y - 0.4 - cur.y) * k
                root.rotation.set(cur.x, cur.y + spin, 0, 'YXZ')
                root.updateMatrixWorld()
                root.getWorldQuaternion(q)
                items.forEach(({ face, glassMat }) => {
                    wn.copy(face.normal).applyQuaternion(q)
                    const lit = 0.5 + 0.5 * wn.dot(light)
                    const c = 0.78 + 0.22 * lit
                    glassMat.color.setRGB(c * 0.92, c * 0.96, c)
                })
                renderer.render(scene, camera)
                raf = requestAnimationFrame(tick)
            }
            raf = requestAnimationFrame(tick)

            cleanup = () => {
                cancelAnimationFrame(raf)
                ro.disconnect()
                window.removeEventListener('pointermove', onMove)
                scene.traverse((o) => {
                    if (o.geometry) o.geometry.dispose()
                    if (o.material) {
                        if (o.material.map) o.material.map.dispose()
                        o.material.dispose()
                    }
                })
                renderer.dispose()
            }
        })().catch(() => {})

        return () => {
            dead = true
            cleanup()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return <canvas ref={canvasRef} className="tech-cube" aria-hidden="true" />
}

export default TechCube
