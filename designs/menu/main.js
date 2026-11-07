import { context, fit, loop, reducedMotion, trackPointer } from '../shared/gl.js'
import { COMPACT, createRiso } from '../shared/riso.js'

// The whole plant on one screen, and the plant is the menu: every building is a
// labeled link. Pointing at a building, or at its row in the list below, turns
// its lights on. Phones get the list, with the plant drifting by above it.

const canvas = document.querySelector('#print')
const gl = context(canvas)

const WORLD_H = 620
// Each building's reach along the street and the height of its label.
const SPOTS = {
    press: { half: 290, top: 500 }, mail: { half: 310, top: 400 }, scope: { half: 225, top: 480 }, arcade: { half: 300, top: 530 },
    tower: { half: 180, top: 610 }, house: { half: 170, top: 370 }, crate: { half: 80, top: 370 },
}

function start() {
    const pointer = trackPointer()
    const riso = createRiso(gl, COMPACT)
    const poster = document.querySelector('#poster')
    const spots = [...document.querySelectorAll('#spots a')]

    let lit = null
    for (const a of document.querySelectorAll('a[data-at]')) {
        const at = a.dataset.at
        const enter = () => { lit = at }
        const leave = () => { if (lit === at) lit = null }
        a.addEventListener('pointerenter', enter)
        a.addEventListener('pointerleave', leave)
        a.addEventListener('focus', enter)
        a.addEventListener('blur', leave)
    }

    let visible = true
    new IntersectionObserver(([e]) => { visible = e.isIntersecting }).observe(poster)

    const place = (w, zoom) => {
        for (const a of spots) {
            const spot = SPOTS[a.dataset.at]
            const x = (COMPACT[a.dataset.at] - spot.half) * zoom
            a.style.left = `${x}px`
            a.style.width = `${spot.half * 2 * zoom}px`
            a.style.height = `${(spot.top + 70) * zoom + 30}px`
        }
    }

    let placedFor = 0
    loop((time, dt) => {
        pointer.update(dt)
        if (!visible) return
        fit(canvas, 1.5)
        const w = canvas.clientWidth, h = canvas.clientHeight
        const wide = w > 760
        const zoom = wide ? w / COMPACT.width : .5
        if (wide && placedFor !== w) {
            place(w, zoom)
            placedFor = w
        }
        // On a phone the plant drifts past, one building at a time.
        const drift = (Math.sin(time * .05 - 1.2) * .5 + .5) * (COMPACT.width - w / zoom) + w / zoom * .5
        const cam = wide ? COMPACT.width / 2 : reducedMotion ? 560 : drift
        const spot = lit && SPOTS[lit]
        const rect = canvas.getBoundingClientRect()
        const span = w * 1.1
        riso.draw({
            rect: [0, 0, w, h], ratio: canvas.width / w, canvasHeight: h, cam, zoom, hour: .62, time,
            pointer: [pointer.smoothX - rect.left, pointer.smoothY - rect.top], near: pointer.seen ? pointer.near : 0,
            cell: wide ? 3.6 : 4.2,
            lit: spot ? [COMPACT[lit] - spot.half, COMPACT[lit] + spot.half] : [1, 0],
            robot: reducedMotion ? -w * .2 : ((time * 16) % span) - span / 2, walked: time * 62,
        })
        pointer.endFrame()
    })
}

if (gl) start()
