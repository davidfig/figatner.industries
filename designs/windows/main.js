import { context, fit, loop, trackPointer } from '../shared/gl.js'
import { createRiso, STREET } from '../shared/riso.js'

// An ordinary grid of cards, each headed by a small print of that thing's
// building at its own time of day. Pointing at a card turns its lights on.

const canvas = document.querySelector('#print')
const gl = context(canvas)

// How far each building reaches along the street, for lighting it up.
const SPAN = { press: 300, mail: 320, scope: 230, arcade: 300, tower: 200, house: 180, crate: 90 }

function start() {
    const pointer = trackPointer()
    const riso = createRiso(gl)
    const prints = [...document.querySelectorAll('.print')].map(el => ({
        el,
        x: STREET[el.dataset.at],
        span: SPAN[el.dataset.at],
        hour: Number(el.dataset.hour),
        zoomScale: Number(el.dataset.zoom ?? 1),
        hovered: false,
    }))
    for (const p of prints) {
        const a = p.el.closest('a')
        if (!a) continue
        a.addEventListener('pointerenter', () => { p.hovered = true })
        a.addEventListener('pointerleave', () => { p.hovered = false })
        a.addEventListener('focus', () => { p.hovered = true })
        a.addEventListener('blur', () => { p.hovered = false })
    }

    gl.clearColor(.957, .925, .851, 1)
    loop((time, dt) => {
        pointer.update(dt)
        fit(canvas, 1.5)
        const view = [canvas.clientWidth, canvas.clientHeight]
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clear(gl.COLOR_BUFFER_BIT)
        for (const p of prints) {
            const r = p.el.getBoundingClientRect()
            if (r.bottom < 0 || r.top > view[1] || r.width === 0) continue
            // Frame the whole building, stacks and all.
            const fitWidth = r.width / (p.span * 2 + 150)
            const fitHeight = r.height * .92 / 620
            const zoom = Math.min(fitWidth, fitHeight) * p.zoomScale
            riso.draw({
                rect: [r.left, r.top, r.width, r.height], ratio: canvas.width / view[0], canvasHeight: view[1],
                cam: p.x, zoom, hour: p.hour, time: time + p.x, groundH: 24,
                pointer: [pointer.smoothX, pointer.smoothY], near: pointer.seen ? pointer.near : 0,
                cell: 3.6, lit: p.hovered ? [p.x - p.span, p.x + p.span] : [1, 0],
            })
        }
        pointer.endFrame()
    })
}

if (gl) start()
