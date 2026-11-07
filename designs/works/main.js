import { context, fit, loop, reducedMotion, trackPointer } from '../shared/gl.js'
import { createRiso } from '../shared/riso.js'

// The riso plant as a scroll tour: scrolling walks along it from dawn to the
// night shift. The stacks smoke, and the cursor pushes the smoke around.

const canvas = document.querySelector('#print')
const gl = context(canvas)
const lerp = (a, b, k) => a + (b - a) * k

function start() {
    const pointer = trackPointer()
    const riso = createRiso(gl)

    // Scroll positions where the camera stands at each building.
    const stops = [...document.querySelectorAll('[data-stop]')]
    let track = []
    const measure = () => {
        track = stops.map(el => ({ y: el.offsetTop + Math.max(0, (el.offsetHeight - innerHeight) * .28), x: Number(el.dataset.stop), hour: Number(el.dataset.hour) }))
        track[0].y = 0
        // On wide screens, stand further left so the intro doesn't cover the plant's sign.
        if (innerWidth >= 900) track[0].x = 300
    }
    measure()
    addEventListener('resize', measure)
    document.fonts.ready.then(measure)

    // Linger at each building, walk between them.
    const camAt = y => {
        if (y <= track[0].y) return track[0]
        for (let i = 0; i < track.length - 1; i++) {
            const a = track[i], b = track[i + 1]
            if (y < b.y) {
                const k = (y - a.y) / (b.y - a.y)
                const s = k * k * (3 - 2 * k)
                const e = s * .75 + k * .25
                return { x: lerp(a.x, b.x, e), hour: lerp(a.hour, b.hour, k) }
            }
        }
        return track.at(-1)
    }

    let cam = track[0].x
    let hour = 0
    let walked = 0
    loop((time, dt) => {
        fit(canvas, 1.5)
        pointer.update(dt)
        const view = [canvas.clientWidth, canvas.clientHeight]
        const goal = camAt(scrollY)
        const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 6)
        const moved = (goal.x - cam) * k
        cam += moved
        hour += (goal.hour - hour) * k
        walked += Math.abs(moved)
        const zoom = Math.max(.46, Math.min(1.1, view[1] * .56 / 620))
        riso.draw({
            rect: [0, 0, view[0], view[1]], ratio: canvas.width / view[0], canvasHeight: view[1], cam, zoom, hour, time,
            pointer: [pointer.smoothX, pointer.smoothY], near: pointer.seen ? pointer.near : 0, robot: view[0] * .12, walked,
        })
        pointer.endFrame()
        canvas.classList.add('on')
    })
}

if (gl) start()
