import { context, fit, loop, reducedMotion, trackPointer } from '../shared/gl.js'
import { createRiso, STREET } from '../shared/riso.js'

// The plant in a strip above the products. Pointing at a product takes the
// strip to its building and its time of day; left alone, the strip visits each
// one in turn, and the matching card shows which. Nothing depends on any of it:
// the cards are plain links in a plain row.

const canvas = document.querySelector('#print')
const gl = context(canvas)
const HOLD = 6.5 // seconds at each building when left alone

function start() {
    const pointer = trackPointer()
    const riso = createRiso(gl)
    const cards = [...document.querySelectorAll('.cards li')].map(el => ({ el, x: STREET[el.dataset.at], hour: Number(el.dataset.hour) }))
    const home = { el: null, x: 560, hour: 0 }
    const stops = [home, ...cards]

    let aimed = null
    for (const card of cards) {
        const a = card.el.querySelector('a')
        const enter = () => { aimed = card }
        const leave = () => { if (aimed === card) aimed = null }
        a.addEventListener('pointerenter', enter)
        a.addEventListener('pointerleave', leave)
        a.addEventListener('focus', enter)
        a.addEventListener('blur', leave)
    }

    let visible = true
    new IntersectionObserver(([e]) => { visible = e.isIntersecting }).observe(canvas)

    let cam = home.x
    let hour = 0
    let walked = 0
    let idle = 0
    let index = 0
    let lastShown = null

    loop((time, dt) => {
        pointer.update(dt)
        if (!visible) return
        fit(canvas, 1.5)
        const w = canvas.clientWidth, h = canvas.clientHeight
        if (aimed) idle = 0
        else if (!reducedMotion) {
            idle += dt
            if (idle > HOLD) {
                idle = 0
                index = (index + 1) % stops.length
            }
        }
        const stop = aimed ?? stops[index]
        if (stop.el !== lastShown) {
            cards.forEach(c => c.el.classList.toggle('on', c === stop))
            lastShown = stop.el
        }
        const zoom = Math.max(.4, Math.min(.86, h * .92 / 620))
        const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 2.6)
        const moved = (stop.x - cam) * k
        cam += moved
        hour += (stop.hour - hour) * k
        walked += Math.abs(moved)
        const rect = canvas.getBoundingClientRect()
        riso.draw({
            rect: [0, 0, w, h], ratio: canvas.width / w, canvasHeight: h, cam, zoom, hour, time,
            pointer: [pointer.smoothX - rect.left, pointer.smoothY - rect.top], near: pointer.seen ? pointer.near : 0,
            cell: 4.4, robot: w * .3, walked,
        })
        pointer.endFrame()
    })
}

if (gl) start()
