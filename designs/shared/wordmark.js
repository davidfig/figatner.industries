// The hand-drawn wordmark. Every letter is an outline drawn by hand, with no font
// behind it, so any curve can be changed here. Coordinates: the baseline is y = 0,
// up is negative, the lowercase height is 470 and capitals about 660.
// w is the letter's rough width, used only for its click area. Stems flare toward the base, like the logo's stack.

// Clockwise ellipse, or counterclockwise for a hole: the letters fill by winding, so
// a bowl and a stem can overlap, and a hole cuts through whatever it's drawn over.
const K = 0.5523
function ellipse(cx, cy, rx, ry, hole = false) {
    const kx = rx * K, ky = ry * K, s = hole ? -1 : 1
    return `M${cx - rx} ${cy}C${cx - rx} ${cy - s * ky} ${cx - kx} ${cy - s * ry} ${cx} ${cy - s * ry}`
        + `C${cx + kx} ${cy - s * ry} ${cx + rx} ${cy - s * ky} ${cx + rx} ${cy}`
        + `C${cx + rx} ${cy + s * ky} ${cx + kx} ${cy + s * ry} ${cx} ${cy + s * ry}`
        + `C${cx - kx} ${cy + s * ry} ${cx - rx} ${cy + s * ky} ${cx - rx} ${cy}Z`
}
const BOWL = ellipse(255, -235, 255, 247) + ellipse(255, -235, 125, 128, true)
const I_STEM = 'M18 -470L160 -470 175 0 5 0Z'
const DOT = ellipse(89, -605, 76, 76)

export const LETTERS = {
    F: [
        { name: 'Swooping arm', w: 470, d: 'M30 -650C150 -680 320 -685 460 -640L435 -530C350 -555 250 -558 175 -550L173 -405 390 -412 384 -300 175 -295 190 0 12 0Z' },
        { name: 'Straight arm', w: 450, d: 'M30 -650L450 -665 440 -540 175 -533 173 -405 390 -412 384 -300 175 -295 190 0 12 0Z' },
    ],
    i: [
        { name: 'Round dot', w: 180, d: I_STEM + DOT },
        { name: 'No dot', w: 180, d: I_STEM },
    ],
    g: [{ name: 'Round', w: 485, d: ellipse(232, -235, 232, 247) + ellipse(232, -235, 112, 122, true) + 'M344 -470L480 -470 485 -20C490 120 410 190 255 190 170 190 95 170 40 125L92 34C135 64 190 80 245 80 315 80 345 50 344 -10Z' }],
    a: [
        { name: 'Two-story', w: 480, d: 'M50 -430C110 -468 180 -482 255 -482 385 -482 450 -425 450 -325L456 -110C456 -70 465 -35 480 0L330 0C322 -12 316 -28 314 -42 275 -8 225 12 170 12 75 12 15 -45 15 -130 15 -225 100 -280 305 -295L305 -320C305 -360 280 -375 235 -375 190 -375 140 -360 100 -330ZM305 -205C215 -195 165 -175 165 -135 165 -110 185 -95 215 -95 255 -95 285 -110 306 -135Z' },
        { name: 'One-story', w: 535, d: BOWL + 'M380 -470L525 -470 535 0 380 0Z' },
    ],
    t: [{ name: 'Curved foot', w: 360, d: 'M100 -600L240 -630 244 -470 350 -470 346 -360 246 -360 250 -140C250 -108 270 -95 300 -95 320 -95 335 -98 350 -104L355 0C315 10 280 14 240 12 140 8 98 -35 96 -125L92 -360 10 -360 14 -470 94 -470Z' }],
    n: [{ name: 'Round arch', w: 490, d: 'M10 0L22 -470 150 -470 152 -415C195 -462 245 -482 300 -482 410 -482 470 -420 470 -305L480 0 335 0 330 -290C330 -335 302 -362 252 -362 205 -362 166 -335 160 -285L170 0Z' }],
    e: [{ name: 'Round', w: 510, d: 'M255 -482C400 -482 510 -380 506 -225L505 -195 150 -195C160 -130 200 -100 270 -100 330 -100 375 -120 415 -160L490 -80C430 -15 355 12 265 12 105 12 0 -90 0 -235 0 -385 110 -482 255 -482ZM255 -372C195 -372 155 -340 147 -285L365 -285C358 -340 315 -372 255 -372Z' }],
    r: [{ name: 'Round', w: 340, d: 'M10 0L22 -470 148 -470 150 -385C180 -450 240 -485 335 -480L330 -350C235 -355 168 -330 165 -255L172 0Z' }],
    I: [{ name: 'Plain', w: 215, d: 'M30 -660L185 -670 205 0 10 0Z' }],
    d: [{ name: 'Round', w: 535, d: BOWL + 'M380 -650L525 -670 535 0 380 0Z' }],
    u: [{ name: 'Round', w: 490, d: 'M10 -470L160 -470 160 -180C160 -130 190 -108 235 -108 280 -108 330 -130 330 -180L326 -470 470 -470 480 0 340 0 338 -55C295 -10 245 12 190 12 80 12 18 -50 18 -165Z' }],
    s: [{ name: 'Round', w: 470, d: 'M240 -482C320 -482 385 -462 440 -420L385 -320C340 -355 295 -372 245 -372 205 -372 185 -360 185 -340 185 -315 225 -305 290 -288 395 -262 455 -215 455 -135 455 -40 365 12 245 12 155 12 75 -12 15 -60L75 -160C125 -120 185 -98 245 -98 285 -98 310 -108 310 -130 310 -155 270 -165 205 -182 100 -210 40 -255 40 -340 40 -430 125 -482 240 -482Z' }],
}

// A lighter set, drawn separately for the second line: even strokes about 100 wide.
const LIGHT_BOWL = ellipse(245, -235, 245, 247) + ellipse(245, -235, 150, 152, true)
const LIGHT_I_STEM = 'M18 -470L118 -470 128 0 8 0Z'

export const LIGHT_LETTERS = {
    I: [{ name: 'Light', w: 160, d: 'M28 -662L130 -668 140 0 18 0Z' }],
    n: [{ name: 'Light', w: 460, d: 'M10 0L18 -470 118 -470 120 -400C165 -455 220 -482 280 -482 395 -482 445 -415 445 -305L452 0 350 0 345 -300C345 -360 315 -388 265 -388 195 -388 130 -350 125 -285L132 0Z' }],
    d: [{ name: 'Light', w: 505, d: LIGHT_BOWL + 'M395 -650L495 -670 505 0 395 0Z' }],
    u: [{ name: 'Light', w: 460, d: 'M10 -470L112 -470 112 -175C112 -115 145 -84 200 -84 270 -84 340 -120 342 -190L338 -470 440 -470 450 0 350 0 348 -75C300 -20 245 12 180 12 70 12 14 -55 14 -165Z' }],
    s: [{ name: 'Light', w: 430, d: 'M225 -482C300 -482 360 -462 405 -425L362 -350C320 -382 275 -398 228 -398 175 -398 142 -378 142 -345 142 -310 185 -295 255 -275 350 -248 410 -205 410 -130 410 -40 330 12 225 12 145 12 75 -15 20 -62L65 -140C115 -98 170 -72 225 -72 280 -72 310 -92 310 -125 310 -160 265 -175 195 -195 100 -222 42 -265 42 -340 42 -425 120 -482 225 -482Z' }],
    t: [{ name: 'Light', w: 340, d: 'M100 -600L200 -625 204 -470 330 -470 326 -385 205 -385 208 -130C208 -95 230 -80 265 -80 290 -80 310 -85 330 -92L335 -5C300 8 265 14 230 12 150 8 108 -35 106 -120L102 -385 14 -385 18 -470 104 -470Z' }],
    r: [{ name: 'Light', w: 320, d: 'M10 0L18 -470 118 -470 120 -370C155 -445 220 -485 315 -480L310 -385C215 -390 130 -350 125 -255L132 0Z' }],
    i: [
        { name: 'Light, round dot', w: 140, d: LIGHT_I_STEM + ellipse(68, -590, 60, 60) },
        { name: 'Light, no dot', w: 140, d: LIGHT_I_STEM },
    ],
    e: [{ name: 'Light', w: 490, d: 'M245 -482C385 -482 490 -385 488 -230L487 -205 100 -205C108 -125 170 -78 258 -78 325 -78 375 -100 418 -145L476 -85C420 -20 345 12 258 12 100 12 0 -90 0 -235 0 -385 105 -482 245 -482ZM245 -398C165 -398 112 -355 102 -285L388 -285C378 -355 325 -398 245 -398Z' }],
}

export const LINES = ['Figatner', 'Industries']
// Each line's color: the logo's navy.
const LINE_COLORS = ['#1f2a6b', '#1f2a6b']
export const SLOTS = LINES.join('').length

// Which drawing each letter uses, in order. The first drawing of each letter is
// its plain one; the others are kept only as swaps to try.
export const DEFAULT_CHOICES = '0'.repeat(SLOTS)

// Where the r's stem ends at the baseline. The second line ends here, so the r's arm
// overhangs it.
const R_STEM_RIGHT = 172
const LINE_GAP = 40 // clear space under the g's tail, down to the tallest letter below
const TAIL = 190
const CAP = 670
const TOP = 700
const BOTTOM = 30

// Optical spacing, worked out from the drawings so it stays right when one changes.
// Each pair is set so the white space between the letters, averaged over the
// lowercase height, is the same. Only so much of an open shape's space counts
// (DEPTH), so round and open letters tuck in closer than straight stems.
const WHITE = 76 // average white between two letters
const DEPTH = 74 // how far into an open shape the eye counts white
const MIN_GAP = 36 // nothing comes closer than this, at any height
const BAND_TOP = -470
// Corrections made by eye, in letter units, for pairs the measuring gets wrong.
const KERN = { at: -6, In: -22, du: -16, es: 10 }
const RASTER = 0.25
const RASTER_X = -60
const RASTER_Y = -800
const ROW = 1 / RASTER // height of a scanline, in letter units

const profiles = new Map()
function profile(glyph) {
    let p = profiles.get(glyph.d)
    if (p) return p
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(760 * RASTER)
    canvas.height = Math.ceil(1100 * RASTER)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.setTransform(RASTER, 0, 0, RASTER, -RASTER_X * RASTER, -RASTER_Y * RASTER)
    ctx.fill(new Path2D(glyph.d))
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    p = { left: [], right: [], min: Infinity, max: -Infinity }
    for (let row = 0; row < height; row++) {
        let first = -1, last = -1
        for (let x = 0; x < width; x++) {
            if (data[(row * width + x) * 4 + 3] > 127) {
                if (first < 0) first = x
                last = x
            }
        }
        if (first < 0) continue
        p.left[row] = first * ROW + RASTER_X
        p.right[row] = (last + 1) * ROW + RASTER_X
        p.min = Math.min(p.min, p.left[row])
        p.max = Math.max(p.max, p.right[row])
    }
    profiles.set(glyph.d, p)
    return p
}

// How far the second letter's origin sits from the first's.
function advance(a, b) {
    const A = profile(a), B = profile(b)
    const rows = Math.max(A.right.length, B.left.length)
    const bandTop = Math.round((BAND_TOP - RASTER_Y) / ROW), bandBottom = Math.round(-RASTER_Y / ROW)
    let white = 0, counted = 0, closest = Infinity
    for (let row = bandTop; row < bandBottom; row++) {
        white += Math.min(A.right[row] === undefined ? DEPTH : A.max - A.right[row], DEPTH)
        white += Math.min(B.left[row] === undefined ? DEPTH : B.left[row] - B.min, DEPTH)
        counted++
    }
    // Check neighboring rows too, so shapes that nearly touch diagonally count.
    const reach = Math.round(20 / ROW)
    for (let row = 0; row < rows; row++) {
        if (A.right[row] === undefined) continue
        for (let other = row - reach; other <= row + reach; other++) {
            if (B.left[other] !== undefined) closest = Math.min(closest, A.max - A.right[row] + B.left[other] - B.min)
        }
    }
    const opening = Math.max(WHITE - white / counted, MIN_GAP - closest)
    return A.max + opening - B.min
}

// choices is a string with one digit per letter, choosing its drawing. Each line
// after the first is scaled to end at the first line's r stem.
export function layout(choices) {
    choices ||= DEFAULT_CHOICES
    const placed = []
    let slot = 0
    let width = 0
    let lineEnd = 0
    let baseline = 0
    LINES.forEach((line, row) => {
        const start = placed.length
        let x = 0
        let previous = null
        let previousCh = ''
        for (const ch of line) {
            const options = (row === 0 ? LETTERS : LIGHT_LETTERS)[ch]
            const choice = Math.min(Number(choices[slot]) || 0, options.length - 1)
            const glyph = options[choice]
            x = previous ? x + advance(previous, glyph) + (KERN[previousCh + ch] || 0) : -profile(glyph).min
            placed.push({ slot, ch, choice, options, row, x, glyph, color: LINE_COLORS[row] })
            previous = glyph
            previousCh = ch
            slot++
        }
        const natural = x + profile(previous).max
        if (row === 0) {
            width = natural
            lineEnd = x + R_STEM_RIGHT
        }
        const scale = row === 0 ? 1 : lineEnd / natural
        if (row > 0) baseline += TAIL + LINE_GAP + CAP * scale
        for (const p of placed.slice(start)) {
            p.scale = scale
            p.transform = `translate(${(p.x * scale).toFixed(2)} ${baseline.toFixed(2)}) scale(${scale.toFixed(4)})`
        }
    })
    return { placed, width, height: TOP + baseline + BOTTOM }
}

// One letter's shape as SVG.
export function letterSvg(p) {
    return `<path fill="${p.color}" d="${p.glyph.d}"/>`
}

// The wordmark as SVG. The letters use currentColor.
export function wordmarkSvg(choices) {
    const { placed, width, height } = layout(choices)
    const shapes = placed.map(p => `<g transform="${p.transform}">${letterSvg(p)}</g>`).join('')
    return `<svg viewBox="0 ${-TOP} ${width} ${height}" aria-hidden="true">${shapes}</svg>`
}

export const VIEW = { TOP }
