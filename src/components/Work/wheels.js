// The car model is a single fused mesh, so the four tires are cut out of it by
// position (triangles whose centre sits inside a tire's circle, on the outer
// side of the car) and given their own pivots so they can spin. Numbers are in
// the model's own units: x runs nose (-) to tail (+), y across, z up.
export const WHEELS = [
    { x: -0.525, z: -0.085, r: 0.14, inner: 0.235, side: 1 }, // front
    { x: -0.525, z: -0.085, r: 0.14, inner: 0.235, side: -1 },
    { x: 0.7, z: -0.085, r: 0.15, inner: 0.2, side: 1 }, // rear
    { x: 0.7, z: -0.085, r: 0.15, inner: 0.2, side: -1 },
]
export const ROLL_RADIUS = 0.125 // model units

export const splitWheels = (THREE, root) => {
    let mesh = null
    root.traverse((o) => {
        if (o.isMesh && !mesh) mesh = o
    })
    if (!mesh || !mesh.geometry.index) return []

    const g = mesh.geometry
    const idx = g.index.array
    const pos = g.attributes.position
    const groups = [[], [], [], [], []] // body, then the four tires
    for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i]
        const b = idx[i + 1]
        const c = idx[i + 2]
        const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3
        const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3
        const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3
        let which = 0
        for (let w = 0; w < WHEELS.length; w += 1) {
            const W = WHEELS[w]
            if (cy * W.side > W.inner && Math.hypot(cx - W.x, cz - W.z) < W.r) {
                which = w + 1
                break
            }
        }
        groups[which].push(a, b, c)
    }

    const part = (list) => {
        const ng = new THREE.BufferGeometry()
        Object.keys(g.attributes).forEach((k) => ng.setAttribute(k, g.attributes[k]))
        ng.setIndex(new THREE.BufferAttribute(new Uint32Array(list), 1))
        return new THREE.Mesh(ng, mesh.material)
    }

    const rig = new THREE.Group()
    rig.position.copy(mesh.position)
    rig.quaternion.copy(mesh.quaternion)
    rig.scale.copy(mesh.scale)
    rig.add(part(groups[0]))

    const pivots = WHEELS.map((W, w) => {
        const pivot = new THREE.Group()
        pivot.position.set(W.x, 0, W.z)
        const tire = part(groups[w + 1])
        tire.position.set(-W.x, 0, -W.z)
        pivot.add(tire)
        rig.add(pivot)
        return pivot
    })

    mesh.parent.add(rig)
    mesh.parent.remove(mesh)
    return pivots
}
