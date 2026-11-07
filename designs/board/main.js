import { context, fit, loop, NOISE, program, reducedMotion, trackPointer } from '../shared/gl.js'

// The whole site is one split-flap board, the kind that used to hang over a
// factory floor or a train station. Every flap is real geometry: it turns on
// its hinge, catches the light as it falls, and drops a shadow on the flap
// beneath. The real links sit invisibly over the rows, and the full text is in
// the page for screen readers.

const canvas = document.querySelector('#board')
const gl = context(canvas, { antialias: true })

const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;-/'&+!?()>"
const CHAR_INDEX = new Map([...CHARS].map((c, i) => [c, i]))
const ATLAS_COLS = 10
const ATLAS_ROWS = Math.ceil(CHARS.length / ATLAS_COLS)
const CELL_ASPECT = 1.5

// Flap tints: 0 charcoal, 1 ember, 2 arcane, 3 verdigris, 4 gold (yopeyopey's
// four hues), 5 cream with dark type, 6 charcoal with ember type.
const FLAP = [[.125, .125, .13], [.86, .24, .1], [.34, .22, .86], [.03, .5, .41], [.74, .48, .02], [.93, .89, .79], [.125, .125, .13]]
const GLYPH = [[.94, .9, .82], [1, .96, .9], [1, .97, 1], [.96, 1, .96], [1, .97, .88], [.07, .07, .07], [1, .47, .2]]

const pages = {
    home: {
        rows: (narrow, cols) => [
            { text: 'THE COMPANY BEHIND GOLEM DOCS AND SATCHEL.EMAIL.' },
            { text: 'SOFTWARE THAT LEAVES YOUR FILES YOURS.' },
            {},
            ...products(narrow, cols),
            {},
            { columns: [['STAFF ON DUTY', 0], ['1', narrow ? 15 : 15, 6]] },
            { columns: [['LOCAL TIME', 0], ['{clock}', narrow ? 15 : 15, 6]] },
            ...(narrow
                ? [{ text: 'LATEST WRITING: MEAT PROXY >', link: 'https://sewcrates.com', label: 'Latest writing: Meat proxy, on sewcrates.com' }]
                : [{ columns: [['LATEST WRITING', 0], ['MEAT PROXY >', 15, 0]], link: 'https://sewcrates.com', label: 'Latest writing: Meat proxy, on sewcrates.com' }]),
        ],
    },
    promises: {
        rows: () => [
            { text: 'FOUR PROMISES, IN THE OPERATING AGREEMENT.', tint: 6 },
            {},
            { text: '1 WHAT YOU KEEP HERE IS YOURS.', tint: 5 },
            { text: 'GET IT OUT ANYTIME, IN OPEN FORMATS. NEVER SOLD. NO ADS. NO AI TRAINING WITHOUT YOUR PERMISSION.' },
            {},
            { text: '2 THE SOFTWARE WORKS FOR YOU.', tint: 5 },
            { text: 'YOUR DATA STAYS ON YOUR OWN DEVICES WHEREVER THE DESIGN ALLOWS.' },
            {},
            { text: '3 THE SOURCE STAYS OPEN.', tint: 5 },
            { text: 'OPEN-SOURCE LICENSES, AND THE CODE STAYS UP IF WORK STOPS.' },
            {},
            { text: '4 NO SUDDEN ENDINGS.', tint: 5 },
            { text: 'REASONABLE NOTICE, AND A WAY TO TAKE YOUR DATA WITH YOU.' },
        ],
    },
    report: {
        rows: () => [
            { text: 'YEARLY REPORT', tint: 6 },
            {},
            { text: 'EVERY YEAR THIS BOARD WILL SHOW WHAT THE COMPANY DID TOWARD ITS PROMISES, WHERE IT FELL SHORT, AND WHAT COMES NEXT.' },
            {},
            { columns: [['FIRST REPORT', 0], ['AWAITING FISCAL YEAR END', 15, 4]] },
        ],
    },
    family: {
        rows: narrow => [
            { text: 'SISTER SITES', tint: 6 },
            {},
            { text: 'YOPEYOPEY.COM >', tint: 1, link: 'https://yopeyopey.com', label: 'yopeyopey.com' },
            { text: 'THE PERSON. GAMES, APPS, AND THE LONG STORY.' },
            {},
            { text: 'SEWCRATES.COM >', tint: 3, link: 'https://sewcrates.com', label: 'sewcrates.com' },
            { text: 'THE WRITING. A BLOG SINCE 2004.' },
            {},
            { text: 'THIS BOARD', tint: 2 },
            { text: 'THE COMPANY. WHO STANDS BEHIND THE SOFTWARE.' },
        ],
    },
}

function products(narrow, cols) {
    const list = [
        ['GOLEM DOCS', 'OUT NOW', 3, 'GOLEMDOCS.COM', 'https://golemdocs.com'],
        ['SATCHEL.EMAIL', 'FINISHING', 4, 'SATCHEL.EMAIL', 'https://satchel.email'],
        ['PIXI-VIEWPORT', 'IN SERVICE', 2, 'GITHUB', 'https://github.com/pixijs-userland/pixi-viewport'],
        ['18 GAMES', 'PLAYABLE', 1, 'YOPEYOPEY.COM', 'https://yopeyopey.com/games/'],
    ]
    if (narrow) return list.map(([name, status, tint, , link]) => ({ columns: [[name, 0], [status, 14, tint]], link, label: `${name}: ${status}`, wide: true }))
    const statusAt = Math.max(17, Math.round(cols * .36))
    const whereAt = Math.max(30, cols - 16)
    return [
        { columns: [['MADE HERE', 0, 6], ['STATUS', statusAt, 6], ['GO TO', whereAt, 6]] },
        ...list.map(([name, status, tint, where, link]) => ({ columns: [[name, 0], [status, statusAt, tint], [where + ' >', whereAt]], link, label: `${name}: ${status}. Go to ${where}` })),
    ]
}

const tabs = [['HOME', 'home'], ['PROMISES', 'promises'], ['REPORT', 'report'], ['FAMILY', 'family']]

function start() {
    const pointer = trackPointer()
    gl.getExtension('EXT_texture_filter_anisotropic')

    // The glyph atlas.
    const atlas = gl.createTexture()
    const drawAtlas = () => {
        const tileW = 96, tileH = tileW * CELL_ASPECT
        const c = document.createElement('canvas')
        c.width = tileW * ATLAS_COLS
        c.height = tileH * ATLAS_ROWS
        const ctx = c.getContext('2d')
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, c.width, c.height)
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'
        ctx.font = `600 ${tileH * .95}px "Barlow Condensed", "Arial Narrow", sans-serif`
        ;[...CHARS].forEach((ch, i) => {
            const x = (i % ATLAS_COLS + .5) * tileW
            const y = (Math.floor(i / ATLAS_COLS) + .5) * tileH + tileH * .328
            ctx.fillText(ch, x, y)
        })
        gl.bindTexture(gl.TEXTURE_2D, atlas)
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, c)
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }
    drawAtlas()
    document.fonts.load('600 80px "Barlow Condensed"').then(drawAtlas)

    const back = program(gl, `#version 300 es
    precision highp float;
    in vec2 v_uv; out vec4 o;
    uniform vec2 u_view, u_ptr; uniform float u_near, u_scroll;
    ${NOISE}
    void main() {
        vec2 css = vec2(v_uv.x, 1. - v_uv.y) * u_view;
        float brushed = vnoise(vec2(css.x * .012, (css.y + u_scroll) * 1.6));
        vec3 c = vec3(.033, .033, .036) + brushed * .012;
        float d = length(css - u_ptr);
        c += vec3(.05, .046, .04) * u_near / (1. + d * d / 90000.);
        vec2 q = v_uv - .5;
        c *= 1. - dot(q, q) * .6;
        o = vec4(pow(c, vec3(1. / 2.2)) * .62, 1.);
    }`)

    const flaps = program(gl, `#version 300 es
    precision highp float;
    in vec2 v_local; in vec2 v_css; in vec2 v_glyph; in float v_part, v_angle, v_shadow, v_lit; flat in int v_tint;
    in vec2 v_size;
    out vec4 o;
    uniform sampler2D u_atlas;
    uniform vec3 u_flap[7], u_ink[7];
    uniform vec2 u_ptr; uniform float u_near;
    ${NOISE}
    void main() {
        // Round the outer corners. A notch at each end of the hinge shows the pin.
        vec2 p = v_local * v_size;
        vec2 half_ = v_size * .5;
        float r = min(v_size.x, v_size.y) * .07;
        vec2 q = abs(p - half_) - half_ + vec2(.6) + r;
        float box = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
        float pin = length(vec2(min(p.x, v_size.x - p.x), p.y - half_.y)) - v_size.x * .05;
        float edge = max(box, -pin);
        float hinge = abs(v_local.y - .5) * v_size.y;
        if (edge > 0.) discard;

        vec3 base = u_flap[v_tint];
        float glyph = texture(u_atlas, v_glyph).r;
        glyph = smoothstep(.34, .62, glyph);
        vec3 col = mix(base, u_ink[v_tint], glyph);

        // Printed, slightly worn surface.
        float wear = vnoise(v_css * vec2(.9, .22));
        col *= .94 + wear * .1;

        // Light: flaps tilt toward or away from the room's overhead light.
        float cosA = cos(v_angle);
        float facing = mix(1., .28 + .72 * cosA, step(.001, abs(v_angle)));
        float tilt = v_part < .5 ? 1.06 + (v_local.y - .75) * .24 : .9 - (.25 - v_local.y) * .3;
        if (v_part < .5 && abs(v_angle) > .001) tilt += sin(abs(v_angle)) * .34;
        if (v_part > .5 && abs(v_angle) > .001) tilt -= sin(abs(v_angle)) * .3;

        float d = length(v_css - u_ptr);
        float torch = u_near / (1. + d * d / 34000.);
        float light = (.9 + torch * .42 + v_lit * .4) * tilt * facing;
        col *= light;
        col *= 1. - v_shadow * .72 * smoothstep(0., .5, abs(v_local.y - .5) * 2.) ;
        col *= 1. - v_shadow * .35;
        // The dark seam along the hinge.
        col *= smoothstep(0., 1.3, hinge);
        // A soft specular band on the top of each flap.
        col += vec3(.035) * smoothstep(.1, .0, abs(v_local.y - .92)) * (.6 + torch * 2.);
        o = vec4(col, 1.);
    }`, `#version 300 es
    precision highp float;
    layout(location = 0) in vec4 a_cell;
    layout(location = 1) in vec4 a_data;
    layout(location = 2) in vec2 a_extra;
    uniform vec2 u_view; uniform float u_scroll; uniform vec2 u_atlasGrid;
    out vec2 v_local, v_css, v_glyph, v_size; out float v_part, v_angle, v_shadow, v_lit; flat out int v_tint;
    void main() {
        vec2 corner = vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1);
        float part = a_data.y;
        float angle = a_data.z;
        // uv y up: top half 0.5..1, bottom half 0..0.5.
        float vy = part < .5 ? mix(.5, 1., corner.y) : mix(0., .5, corner.y);
        vec2 size = a_cell.zw;
        float hingeY = a_cell.y + size.y * .5;
        float off = (vy - .5) * size.y;
        float y = off * cos(angle);
        float z = abs(off) * sin(abs(angle));
        float persp = 1. / (1. - z / (size.y * 3.2));
        vec2 pos = vec2(a_cell.x + size.x * .5 + (corner.x - .5) * size.x * persp, hingeY - y * persp - u_scroll);
        v_local = vec2(corner.x, vy);
        v_size = size;
        v_css = pos;
        v_part = part; v_angle = angle; v_shadow = a_extra.x; v_lit = a_extra.y;
        v_tint = int(a_data.w + .5);
        float ch = a_data.x;
        vec2 tile = vec2(mod(ch, u_atlasGrid.x), floor(ch / u_atlasGrid.x));
        v_glyph = (tile + vec2(corner.x, 1. - vy)) / u_atlasGrid;
        gl_Position = vec4(pos.x / u_view.x * 2. - 1., 1. - pos.y / u_view.y * 2., 0., 1.);
    }`)

    const FLOATS = 10
    const buffer = gl.createBuffer()
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, FLOATS * 4, 0)
    gl.vertexAttribDivisor(0, 1)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, FLOATS * 4, 16)
    gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, FLOATS * 4, 32)
    gl.vertexAttribDivisor(2, 1)
    gl.bindVertexArray(null)
    let instances = new Float32Array(0)

    // ── the board ──
    let cells = []
    let grid = []          // the small cells by row, then column
    let metrics = null
    let current = 'home'
    const linksEl = document.querySelector('#links')
    const foot = document.querySelector('#foot')
    let rowLinks = []      // { row, el, hovered }
    let clockCells = []

    const makeCell = (x, y, w, h, big = false) => ({ x, y, w, h, big, ch: 0, next: 0, tint: 0, nextTint: 0, p: 0, wait: 0, queue: [], lit: 0, litTarget: 0, blank: true, ripple: 0 })

    const build = () => {
        const W = canvas.clientWidth, H = canvas.clientHeight
        const narrow = W < 720
        const margin = Math.max(12, Math.min(W * .03, 44))
        const usable = W - margin * 2
        const cols = narrow ? Math.max(20, Math.floor(usable / 14.5)) : Math.min(Math.max(44, Math.floor(usable / 21)), 72)
        const cw = usable / cols
        const ch = cw * CELL_ASPECT
        const old = new Map(cells.map(c => [`${c.big ? 'b' : 's'}${c.gridY},${c.gridX}`, c]))
        cells = []
        grid = []

        // The title in big flaps.
        const lines = narrow ? ['FIGATNER', 'INDUSTRIES'] : ['FIGATNER INDUSTRIES']
        const longest = Math.max(...lines.map(l => l.length))
        const bw = usable / longest
        const bh = bw * CELL_ASPECT
        let y = margin
        lines.forEach((line, row) => {
            ;[...line].forEach((c, i) => {
                const cell = makeCell(margin + i * bw, y, bw, bh, true)
                cell.gridY = row
                cell.gridX = i
                cell.targetChar = c
                cell.targetTint = lines.length > 1 ? (row === 1 ? 6 : 0) : (i > 8 ? 6 : 0)
                cells.push(cell)
            })
            y += bh
        })
        y += ch * .5
        const rowsTop = y

        // Enough rows for the tallest page and the window.
        const needed = Math.max(...Object.values(pages).map(p => layout(p, cols, narrow).length)) + (narrow ? 4 : 3)
        const fits = Math.floor((H - rowsTop - 74) / ch)
        const rows = Math.max(needed, fits)
        for (let r = 0; r < rows; r++) {
            const row = []
            for (let c = 0; c < cols; c++) {
                const cell = makeCell(margin + c * cw, rowsTop + r * ch, cw, ch)
                cell.gridY = r
                cell.gridX = c
                const prior = old.get(`s${r},${c}`)
                if (prior) {
                    cell.ch = cell.next = prior.ch
                    cell.tint = cell.nextTint = prior.tint
                }
                row.push(cell)
                cells.push(cell)
            }
            grid.push(row)
        }
        for (const c of cells) if (c.big) {
            const prior = old.get(`b${c.gridY},${c.gridX}`)
            if (prior) {
                c.ch = c.next = prior.ch
                c.tint = c.nextTint = prior.tint
            }
        }
        instances = new Float32Array(cells.length * 3 * FLOATS)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, instances.byteLength, gl.DYNAMIC_DRAW)

        const bottom = rowsTop + rows * ch
        metrics = { W, H, margin, cols, cw, ch, narrow, rowsTop, rows, bottom }
        document.body.style.minHeight = `${bottom + 96}px`
        foot.style.top = `${bottom + 18}px`
        foot.style.left = foot.style.right = `${margin}px`
        for (const c of cells) if (c.big) flipTo(c, CHAR_INDEX.get(c.targetChar), c.targetTint, Math.random() * .9 + c.gridX * .04, 6)
        show(current, true)
    }

    // Turns a page into plain rows of { spans: [[col, text, tint]], link }.
    function layout(page, cols, narrow) {
        const out = []
        for (const row of page.rows(narrow, cols)) {
            if (row.columns) {
                out.push({ spans: row.columns.map(([text, col, tint = 0]) => [col, text, tint]), link: row.link, label: row.label })
            } else if (row.text) {
                const words = row.text.split(' ')
                let line = ''
                const push = (text, first) => out.push({ spans: [[0, text, row.tint ?? 0]], link: row.link, label: row.label })
                for (const word of words) {
                    if (line && line.length + 1 + word.length > cols) {
                        push(line)
                        line = word
                    } else line = line ? `${line} ${word}` : word
                }
                if (line) push(line)
            } else out.push({ spans: [] })
        }
        return out
    }

    function flipTo(cell, ch, tint, delay, maxRoll = 5) {
        if (reducedMotion) {
            cell.ch = cell.next = ch
            cell.tint = cell.nextTint = tint
            cell.queue = []
            cell.p = 0
            return
        }
        const finalStep = cell.queue.at(-1)
        const lastCh = finalStep ? finalStep[0] : cell.p > 0 ? cell.next : cell.ch
        const lastTint = finalStep ? finalStep[1] : cell.p > 0 ? cell.nextTint : cell.tint
        if (lastCh === ch && lastTint === tint) return
        cell.queue = cell.queue.slice(0, 1)
        cell.wait = delay
        // Roll through a few characters first; the real thing goes the long way.
        const rolls = Math.floor(Math.random() * (maxRoll + 1))
        for (let i = 0; i < rolls; i++) cell.queue.push([1 + Math.floor(Math.random() * (CHARS.length - 1)), tint])
        cell.queue.push([ch, tint])
    }

    function clockText() {
        const fmt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Los_Angeles' })
        return `${fmt.format(new Date())} ${metrics?.narrow ? 'PT' : 'SEATTLE'}`
    }

    function show(name, immediateLinks = false) {
        current = name
        const { cols, narrow, margin, cw, ch, rowsTop } = metrics
        const target = grid.map(row => row.map(() => [' ', 0]))
        const newLinks = []

        // Tabs on the first rows.
        let col = 0, r = 0
        for (const [label, id] of tabs) {
            if (col + label.length > cols) {
                col = 0
                r++
            }
            ;[...label].forEach((c, i) => { target[r][col + i] = [c, id === name ? 5 : 0] })
            newLinks.push({ row: r, from: col, to: col + label.length, href: id === 'home' ? '#' : `#${id}`, label, tab: id })
            col += label.length + 1
        }
        let row = r + 2

        clockCells = []
        for (const line of layout(pages[name], cols, narrow)) {
            if (row >= target.length) break
            for (const [at, text, tint] of line.spans) {
                const content = text === '{clock}' ? clockText() : text
                ;[...content].slice(0, cols - at).forEach((c, i) => {
                    target[row][at + i] = [CHAR_INDEX.has(c) ? c : ' ', tint]
                    if (text === '{clock}') clockCells.push({ row, col: at + i, i })
                })
            }
            if (line.link) newLinks.push({ row, from: 0, to: cols, href: line.link, label: line.label })
            row++
        }

        target.forEach((chars, y) => chars.forEach(([c, tint], x) => {
            const cell = grid[y][x]
            cell.blank = c === ' '
            flipTo(cell, CHAR_INDEX.get(c), tint, y * .018 + x * .012 + Math.random() * .12)
        }))

        // Real links.
        const focusedTab = document.activeElement?.dataset?.tab
        linksEl.textContent = ''
        rowLinks = newLinks.map(link => {
            const a = document.createElement('a')
            a.href = link.href
            a.textContent = link.label
            a.setAttribute('aria-label', link.label)
            if (link.tab) {
                a.dataset.tab = link.tab
                if (link.tab === name) a.setAttribute('aria-current', 'page')
            }
            a.style.left = `${margin + link.from * cw}px`
            a.style.top = `${rowsTop + link.row * ch}px`
            a.style.width = `${(link.to - link.from) * cw}px`
            a.style.height = `${ch}px`
            const entry = { ...link, el: a, hovered: false }
            a.addEventListener('pointerenter', () => { entry.hovered = true })
            a.addEventListener('pointerleave', () => { entry.hovered = false })
            a.addEventListener('focus', () => { entry.hovered = true })
            a.addEventListener('blur', () => { entry.hovered = false })
            linksEl.append(a)
            if (focusedTab && link.tab === focusedTab) a.focus()
            return entry
        })
        if (!immediateLinks) playBurst()
    }

    const route = () => {
        const id = location.hash.slice(1)
        show(pages[id] ? id : 'home')
        scrollTo({ top: 0 })
    }
    addEventListener('hashchange', route)
    const initial = location.hash.slice(1)
    if (pages[initial]) current = initial

    // Optional clatter, made from filtered noise. Off until asked for.
    let audio = null
    let tickBuffer = null
    let ticks = 0
    const soundButton = document.querySelector('#sound')
    soundButton.addEventListener('click', () => {
        if (audio) {
            audio.close()
            audio = null
            soundButton.textContent = 'Sound: off'
            soundButton.setAttribute('aria-pressed', 'false')
            return
        }
        audio = new AudioContext()
        tickBuffer = audio.createBuffer(1, audio.sampleRate * .018, audio.sampleRate)
        const data = tickBuffer.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3)
        soundButton.textContent = 'Sound: on'
        soundButton.setAttribute('aria-pressed', 'true')
    })
    function playTick() {
        if (!audio) return
        const source = audio.createBufferSource()
        source.buffer = tickBuffer
        source.playbackRate.value = .75 + Math.random() * .7
        const filter = audio.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 1600 + Math.random() * 1600
        const gain = audio.createGain()
        gain.gain.value = .05 + Math.random() * .08
        source.connect(filter).connect(gain).connect(audio.destination)
        source.start()
    }
    function playBurst() { ticks = 0 }

    let resizeDue = true
    addEventListener('resize', () => { resizeDue = true })

    let lastMinute = ''
    let rippleX = 0, rippleY = 0

    loop((time, dt) => {
        const sizeChanged = fit(canvas, 2)
        if (sizeChanged || resizeDue) {
            resizeDue = false
            build()
        }
        pointer.update(dt)
        const view = [canvas.clientWidth, canvas.clientHeight]
        const scroll = scrollY

        // The clock.
        const text = clockText()
        if (text !== lastMinute) {
            if (lastMinute) for (const { row, col, i } of clockCells) flipTo(grid[row][col], CHAR_INDEX.get(text[i] ?? ' '), 6, i * .03, 2)
            lastMinute = text
        }

        // A disturbance in blank flaps where the cursor passes, as if it's
        // brushing them. Words never change under the cursor.
        if (pointer.seen && pointer.speed > 200 && !reducedMotion) {
            const { margin, cw, ch, rowsTop } = metrics
            const gx = Math.floor((pointer.x - margin) / cw)
            const gy = Math.floor((pointer.y + scroll - rowsTop) / ch)
            if (grid[gy]?.[gx] && (gx !== rippleX || gy !== rippleY)) {
                rippleX = gx
                rippleY = gy
                const cell = grid[gy][gx]
                if (cell.blank && !cell.queue.length && cell.p === 0) {
                    cell.queue.push([1 + Math.floor(Math.random() * (CHARS.length - 1)), 0], [0, 0])
                }
            }
        }

        // Hover lights a whole row.
        for (const row of grid) for (const c of row) c.litTarget = 0
        for (const link of rowLinks) if (link.hovered) for (let x = link.from; x < link.to; x++) grid[link.row][x].litTarget = 1

        // Step the flaps and write their instances.
        let n = 0
        const write = (c, ch, part, angle, tint, shadow) => {
            const i = n * FLOATS
            instances[i] = c.x + .5
            instances[i + 1] = c.y + .5
            instances[i + 2] = c.w - 1
            instances[i + 3] = c.h - 1
            instances[i + 4] = ch
            instances[i + 5] = part
            instances[i + 6] = angle
            instances[i + 7] = tint
            instances[i + 8] = shadow
            instances[i + 9] = c.lit
            n++
        }
        for (const c of cells) {
            c.lit += (c.litTarget - c.lit) * (1 - Math.exp(-dt * 14))
            if (c.p === 0 && c.queue.length) {
                if (c.wait > 0) c.wait -= dt
                else {
                    const [ch, tint] = c.queue.shift()
                    c.next = ch
                    c.nextTint = tint
                    c.p = 1e-4
                    if (audio && ticks++ % 2 === 0 && Math.random() < .3) playTick()
                }
            }
            if (c.p > 0) {
                c.p += dt / (c.big ? .15 : .085)
                if (c.p >= 1) {
                    c.p = 0
                    c.ch = c.next
                    c.tint = c.nextTint
                }
            }
            const off = c.y - scroll
            if (off > view[1] + 4 || off + c.h < -4) continue
            if (c.p > 0) {
                // The next character's top waits behind; the current character's
                // bottom waits below. The flap falls between them.
                const eased = c.p * c.p
                write(c, c.next, 0, 0, c.nextTint, eased < .5 ? (1 - eased * 2) * .85 : 0)
                write(c, c.ch, 1, 0, c.tint, eased >= .5 ? (eased - .5) * 2 * .9 : 0)
                if (eased < .5) write(c, c.ch, 0, eased * Math.PI, c.tint, 0)
                else write(c, c.next, 1, -(1 - eased) * Math.PI, c.nextTint, 0)
            } else {
                write(c, c.ch, 0, 0, c.tint, 0)
                write(c, c.ch, 1, 0, c.tint, 0)
            }
        }

        gl.viewport(0, 0, canvas.width, canvas.height)
        const near = pointer.seen ? pointer.near : 0
        const ptr = [pointer.smoothX, pointer.smoothY]
        back.use({ u_view: view, u_ptr: ptr, u_near: near, u_scroll: scroll })
        gl.drawArrays(gl.TRIANGLES, 0, 3)

        flaps.use({
            u_atlas: atlas, u_flap: FLAP.flat(), u_ink: GLYPH.flat(), u_view: view, u_scroll: scroll,
            u_atlasGrid: [ATLAS_COLS, ATLAS_ROWS], u_ptr: ptr, u_near: near,
        })
        gl.bindVertexArray(vao)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances, 0, n * FLOATS)
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n)
        gl.bindVertexArray(null)
        pointer.endFrame()
        canvas.classList.add('on')
    })
}

if (gl) start()
