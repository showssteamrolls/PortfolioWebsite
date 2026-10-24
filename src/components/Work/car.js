// The little race car that rides the line. three.js and the model are loaded on
// demand, so the rest of the site never pays for them. If anything fails (no
// WebGL, missing file) the caller keeps the plain dot.

import { splitWheels, ROLL_RADIUS } from './wheels'

const LENGTH = 165 // px the car measures nose to tail on the ground
const ELEVATION = (36 * Math.PI) / 180 // matches the ground's 54deg tilt
const FOV = 20

export const loadCar = async (canvas, size) => {
    const THREE = await import('three')
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(size, size, false)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a8, 1.7))
    const sun = new THREE.DirectionalLight(0xffffff, 2.2)
    sun.position.set(-1.5, 3, 1.2)
    scene.add(sun)

    const dist = size / 2 / Math.tan((FOV * Math.PI) / 360)
    const camera = new THREE.PerspectiveCamera(FOV, 1, dist * 0.5, dist * 2)
    camera.position.set(0, dist * Math.sin(ELEVATION), dist * Math.cos(ELEVATION))
    camera.lookAt(0, 0, 0)

    const gltf = await new GLTFLoader().loadAsync(`${process.env.PUBLIC_URL}/models/williams.glb`)
    const model = gltf.scene
    model.rotation.x = -Math.PI / 2 // the file is Z-up; its nose points to -X
    const tires = splitWheels(THREE, model)
    const holder = new THREE.Group()
    holder.add(model)
    const box = new THREE.Box3().setFromObject(holder)
    const dim = box.getSize(new THREE.Vector3())
    model.position.set(-(box.min.x + dim.x / 2), -box.min.y, -(box.min.z + dim.z / 2))
    const car = new THREE.Group()
    car.add(holder)
    car.scale.setScalar(LENGTH / dim.x)
    scene.add(car)

    // soft shadow on the ground
    const sc = document.createElement('canvas')
    sc.width = 128
    sc.height = 128
    const ctx = sc.getContext('2d')
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
    grad.addColorStop(0, 'rgba(20,30,70,0.38)')
    grad.addColorStop(1, 'rgba(20,30,70,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 128, 128)
    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false })
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.4
    scene.add(shadow)

    let yaw = 0
    let travelled = 0
    const rollPx = ROLL_RADIUS * (LENGTH / dim.x) // tire radius in screen px
    const render = () => {
        // heading: angle clockwise from "straight up the screen"
        car.rotation.y = -Math.PI / 2 - yaw
        tires.forEach((t) => { t.rotation.y = -travelled / rollPx })
        shadow.rotation.z = -car.rotation.y
        shadow.scale.set(LENGTH * 1.5, LENGTH * 0.8, 1)
        renderer.render(scene, camera)
    }

    return {
        // heading: which way the car points; distance: how far it has rolled (px)
        update: (heading, distance) => {
            yaw = heading
            travelled = distance
            render()
        },
        dispose: () => {
            renderer.dispose()
            scene.traverse((o) => {
                if (o.geometry) o.geometry.dispose()
                if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose() })
            })
        },
    }
}

export const CAR_SIZE = 360
