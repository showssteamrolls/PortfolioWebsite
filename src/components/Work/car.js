// The little race car that rides the line. It lives inside the 3D scene
// (scene.js); this builds it from the loaded model.
import { splitWheels, ROLL_RADIUS } from './wheels'

export const LENGTH = 99 // world px the car measures nose to tail

export const buildCar = (THREE, gltf) => {
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
    const rollPx = ROLL_RADIUS * (LENGTH / dim.x) // tire radius in world px
    return {
        car,
        // distance: how far the car has rolled (px)
        spin: (distance) => tires.forEach((t) => { t.rotation.y = -distance / rollPx }),
    }
}
