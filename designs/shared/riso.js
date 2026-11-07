import { drawTriangle, NOISE, program, reducedMotion } from './gl.js'

// The riso-printed plant, shared by The Works and its plainer descendants. The
// scene is worked out as amounts of three spot inks; each ink then goes through
// its own halftone screen, slightly out of register, and overprints on paper.
// draw() prints it into any rectangle of the canvas.

const WORLD_H = 620

// Where each building stands along the street.
export const STREET = { width: 6600, main: 180, press: 1560, mail: 2560, scope: 3480, arcade: 4380, tower: 5260, house: 5960, crate: 6330, annex: true }

// The same buildings, shoulder to shoulder, for fitting on one screen.
export const COMPACT = { width: 4160, main: 30, press: 1130, mail: 1760, scope: 2320, arcade: 2900, tower: 3420, house: 3780, crate: 4060, annex: false }

// A tone is how much blue and orange ink a shape takes. The blue channel of the
// bake marks window glass, which lights up after dark.
const tone = (blue, orange, glass = 0) => `rgb(${blue * 255},${orange * 255},${glass * 255})`

function drawPlant(scale, layout) {
    const c = document.createElement('canvas')
    c.width = Math.ceil(layout.width * scale)
    c.height = Math.ceil(WORLD_H * scale)
    const ctx = c.getContext('2d')
    ctx.scale(scale, scale)
    const stacks = []
    const G = WORLD_H // ground line

    const rect = (x, y, w, h, t) => {
        ctx.fillStyle = t
        ctx.fillRect(x, y, w, h)
    }
    const poly = (points, t) => {
        ctx.fillStyle = t
        ctx.beginPath()
        points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.closePath()
        ctx.fill()
    }
    const windows = (x, y, cols, rows, w, h, gapX, gapY) => {
        for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) rect(x + i * (w + gapX), y + r * (h + gapY), w, h, tone(.82, .1, 1))
    }
    const stack = (x, w, top, t, smoke = 0, bands = true) => {
        poly([[x - w * .5, G], [x - w * .32, top], [x + w * .32, top], [x + w * .5, G]], t)
        if (bands) {
            rect(x - w * .36, top + 16, w * .72, 8, tone(0, 1))
            rect(x - w * .38, top + 34, w * .76, 8, tone(0, 0))
        }
        rect(x - w * .38, top - 5, w * .76, 8, tone(1, .5))
        stacks.push([x, top - 5, w * .34, smoke])
    }
    // Glass value .25 marks paint that stays lit after dark.
    const lit = (blue, orange) => tone(blue, orange, .25)
    const sign = (text, x, y, size, t, align = 'center') => {
        ctx.fillStyle = t
        ctx.font = `400 ${size}px Anton, Impact, sans-serif`
        ctx.textAlign = align
        ctx.fillText(text, x, y)
    }
    const signBoard = (text, x, y, size, back, fore) => {
        ctx.font = `400 ${size}px Anton, Impact, sans-serif`
        const w = ctx.measureText(text).width + size * .7
        rect(x - w / 2, y - size * 1.2, w, size * 1.45, back)
        for (const leg of [x - w * .36, x + w * .36]) rect(leg - 2, y + size * .2, 4, 26, back)
        sign(text, x, y, size, fore)
    }

    // Gatehouse and main shed, sawtooth roof.
    const mainX = layout.main
    stack(mainX + 95, 66, 170, tone(1, .55), 0)
    stack(mainX + 215, 58, 240, tone(1, .55), 1)
    rect(mainX, 390, 760, G - 390, tone(.18, .62))
    for (let i = 0; i < 7; i++) {
        const x = mainX + i * 108.6
        poly([[x, 390], [x, 322], [x + 108.6, 390]], tone(.92, .3))
        poly([[x + 4, 386], [x + 4, 340], [x + 72, 386]], tone(.82, .1, 1))
    }
    windows(mainX + 34, 424, 11, 2, 44, 44, 18, 16)
    rect(mainX + 610, 522, 112, G - 522, tone(.9, .4))
    rect(mainX + 664, 522, 3, G - 522, tone(0, .6))
    signBoard('FIGATNER INDUSTRIES', mainX + 380, 300, 40, lit(.95, .2), lit(0, 0))

    // Building 1: Golem Docs, a tall press hall with sheets on the roof.
    const press = layout.press
    stack(press - 170, 60, 110, tone(.9, 0), 2)
    rect(press - 280, 240, 560, G - 240, tone(.1, .22))
    rect(press - 280, 216, 560, 30, tone(1, .3))
    windows(press - 244, 268, 8, 5, 40, 42, 22, 20)
    // Giant pages on the roof, dog-eared.
    for (let i = 0; i < 4; i++) {
        const x = press + 20 + i * 54, y = 216 - 142 + i * 3, w = 96, h = 142
        poly([[x, y + h - i * 3], [x, y + 22], [x + 24, y], [x + w, y], [x + w, y + h - i * 3]], i === 3 ? tone(0, 0) : tone(.1 + i * .05, .5 + i * .1))
        ctx.strokeStyle = tone(.9, .2)
        ctx.lineWidth = 3
        ctx.stroke()
    }
    for (let l = 0; l < 5; l++) rect(press + 196, 112 + l * 18, 60, 5, tone(1, .3))
    rect(press + 182, 78, 6, 30, tone(1, .3))
    signBoard('GOLEM DOCS', press - 120, 198, 42, lit(0, 1), lit(1, .2))

    // Building 2: Satchel, a mail room with a big envelope front.
    const mail = layout.mail
    stack(mail + 200, 56, 170, tone(.1, .95), 3)
    rect(mail - 300, 310, 600, G - 310, tone(.62, .05))
    poly([[mail - 300, 310], [mail, 500], [mail + 300, 310]], tone(.9, .15))
    poly([[mail - 300, G], [mail - 300, 330], [mail - 40, 490], [mail - 40, G]], tone(.5, .05))
    poly([[mail + 300, G], [mail + 300, 330], [mail + 40, 490], [mail + 40, G]], tone(.5, .05))
    ctx.fillStyle = tone(0, 1)
    ctx.beginPath()
    ctx.arc(mail, 480, 52, 0, Math.PI * 2)
    ctx.fill()
    rect(mail - 42, 540, 84, G - 540, tone(.95, .3))
    windows(mail - 262, 480, 3, 2, 42, 38, 18, 16)
    windows(mail + 92, 480, 3, 2, 42, 38, 18, 16)
    signBoard('SATCHEL.EMAIL', mail, 270, 44, lit(0, 0), lit(1, .1))

    // Building 3: pixi-viewport, an observatory with a lens.
    const scope = layout.scope
    rect(scope - 210, 400, 420, G - 400, tone(.1, .5))
    ctx.fillStyle = tone(.85, .1)
    ctx.beginPath()
    ctx.arc(scope, 400, 200, Math.PI, 0)
    ctx.fill()
    rect(scope - 20, 200, 40, 200, tone(0, 0))
    ctx.save()
    ctx.translate(scope + 10, 300)
    ctx.rotate(-.62)
    rect(-20, -38, 260, 76, tone(.15, .9))
    rect(226, -50, 44, 100, tone(1, .3))
    ctx.fillStyle = tone(.82, .1, 1)
    ctx.fillRect(270, -42, 10, 84)
    ctx.restore()
    windows(scope - 172, 448, 6, 2, 36, 42, 22, 22)
    rect(scope - 44, 548, 88, G - 548, tone(.9, .4))
    signBoard('PIXI-VIEWPORT', scope - 190, 180, 38, lit(.9, .15), lit(0, 0))
    stack(scope + 280, 46, 330, tone(.75, .4), 0)

    // Building 4: Games, an arcade with a marquee and a big d-pad.
    const arcade = layout.arcade
    stack(arcade - 280, 54, 180, tone(1, .1), 1)
    rect(arcade - 280, 270, 560, G - 270, tone(.0, .85))
    for (let i = 0; i < 7; i++) rect(arcade - 280 + i * 84, 330, 42, G - 330, tone(.08, .95))
    rect(arcade - 300, 232, 600, 56, lit(.95, .15))
    sign('GAMES', arcade, 281, 56, lit(0, 0))
    for (let i = 0; i < 25; i++) {
        ctx.fillStyle = tone(.82, .1, 1)
        ctx.beginPath()
        ctx.arc(arcade - 290 + i * 24.2, 240, 4.4, 0, 7)
        ctx.arc(arcade - 290 + i * 24.2, 280, 4.4, 0, 7)
        ctx.fill()
    }
    rect(arcade - 40, 110, 80, 128, tone(1, .3))
    rect(arcade - 70, 140, 140, 68, tone(1, .3))
    ctx.fillStyle = tone(.1, 1)
    ctx.beginPath()
    ctx.arc(arcade + 180, 180, 36, 0, 7)
    ctx.fill()
    rect(arcade + 172, 180, 16, 56, tone(1, .3))
    windows(arcade - 240, 340, 7, 2, 50, 54, 20, 22)
    rect(arcade - 52, 520, 104, G - 520, tone(1, .4))

    // The water tower, with the promises on it.
    const tower = layout.tower
    for (const dx of [-130, -48, 48, 130]) rect(tower + dx - 5, 290, 10, G - 290, tone(.95, .3))
    for (let y = 340; y < G; y += 74) {
        ctx.strokeStyle = tone(.95, .3)
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(tower - 130, y)
        ctx.lineTo(tower + 130, y + 60)
        ctx.moveTo(tower + 130, y)
        ctx.lineTo(tower - 130, y + 60)
        ctx.stroke()
    }
    rect(tower - 170, 100, 340, 196, lit(.06, .75))
    poly([[tower - 180, 100], [tower, 34], [tower + 180, 100]], tone(.95, .3))
    sign('FOUR', tower, 174, 66, lit(1, .3))
    sign('PROMISES', tower, 258, 66, lit(1, .3))
    if (layout.annex) {
        rect(tower + 250, 470, 280, G - 470, tone(.7, .3))
        windows(tower + 278, 500, 4, 2, 38, 34, 18, 16)
    }

    // Up the hill: yopeyopey's cut-paper house, sewcrates' rainy tower.
    const house = layout.house
    poly([[house - 140, G], [house - 148, 430], [house - 170, 428], [house - 2, 300], [house + 164, 432], [house + 138, 430], [house + 134, G]], tone(.02, .95))
    rect(house - 30, 516, 62, G - 516, tone(1, .2))
    rect(house - 106, 450, 58, 52, tone(.82, .1, 1))
    rect(house + 56, 450, 58, 52, tone(.82, .1, 1))
    signBoard('YOPEYOPEY', house, 288, 30, lit(0, 0), lit(0, 1))
    const crate = layout.crate
    rect(crate - 74, 300, 148, G - 300, tone(1, .35))
    windows(crate - 52, 326, 3, 5, 22, 34, 14, 14)
    signBoard('SEWCRATES', crate, 278, 30, lit(0, 0), lit(1, .3))

    return { canvas: c, stacks }
}

const lerp = (a, b, k) => a + (b - a) * k
const lerp3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k))

// Times of day: blue, orange, yellow in the sky at top and at the horizon.
const hours = [
    { at: 0, top: [.02, .32, .3], low: [0, .62, .75], sun: [.72, .62], moon: 0, night: 0 },
    { at: .3, top: [.34, 0, .05], low: [.06, .04, .34], sun: [.5, .14], moon: 0, night: 0 },
    { at: .55, top: [.3, .14, .1], low: [0, .3, .6], sun: [.3, .28], moon: 0, night: 0 },
    { at: .74, top: [.42, .62, .05], low: [0, .95, .55], sun: [.2, .72], moon: 0, night: .08 },
    { at: .88, top: [1, .28, 0], low: [.62, .55, 0], sun: [.7, .22], moon: 1, night: .85 },
    { at: 1, top: [1, .2, 0], low: [.85, .3, 0], sun: [.74, .18], moon: 1, night: 1 },
]
export const skyAt = hour => {
    let i = 0
    while (i < hours.length - 2 && hour > hours[i + 1].at) i++
    const a = hours[i], b = hours[i + 1]
    const k = Math.min(1, Math.max(0, (hour - a.at) / (b.at - a.at)))
    return { top: lerp3(a.top, b.top, k), low: lerp3(a.low, b.low, k), sun: [lerp(a.sun[0], b.sun[0], k), lerp(a.sun[1], b.sun[1], k)], moon: k > .5 ? b.moon : a.moon, night: lerp(a.night, b.night, k) }
}

export function createRiso(gl, layout = STREET) {
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE)
    const plantTexture = gl.createTexture()
    let stacks = []
    const bake = () => {
        const baked = drawPlant(Math.min(1.5, max / layout.width), layout)
        stacks = baked.stacks
        gl.bindTexture(gl.TEXTURE_2D, plantTexture)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, baked.canvas)
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }
    bake()
    document.fonts.load('400 40px Anton').then(bake)

    const poster = program(gl, `#version 300 es
    precision highp float;
    in vec2 v_uv; out vec4 o;
    uniform sampler2D u_plant;
    uniform vec2 u_view, u_ptr, u_world;
    uniform float u_t, u_cam, u_zoom, u_ratio, u_night, u_near, u_groundH, u_walk;
    uniform vec3 u_skyTop, u_skyLow;  // blue, orange, yellow tones
    uniform vec2 u_sun; uniform float u_sunR, u_moon;
    uniform vec4 u_stacks[10];
    uniform int u_stackCount;
    uniform float u_cell, u_robot;
    uniform vec2 u_lit;
    const float TAU = 6.283185;
    ${NOISE}

    float rect(vec2 p, vec2 c, vec2 h) { vec2 q = abs(p - c) - h; return max(q.x, q.y); }
    float cut(float d) { return smoothstep(.6, -.6, d); }

    // The static scene as amounts of ink: blue, orange, yellow.
    vec3 scene(vec2 css) {
        float groundY = u_view.y - u_groundH;
        vec2 world = vec2(u_cam + (css.x - u_view.x * .5) / u_zoom, (css.y - groundY) / u_zoom + u_world.y);

        // Sky, stepped into posterized bands.
        float h = clamp(css.y / groundY, 0., 1.);
        float grain = (vnoise(css * .012 + 3.) - .5) * .05;
        float band = floor((h + grain) * 7.) / 6.;
        vec3 ink = mix(u_skyTop, u_skyLow, band);

        // Sun, or a moon knocked out of the blue.
        float sd = length(css - u_sun) - u_sunR;
        float disc = cut(sd);
        ink = mix(ink, mix(vec3(0., 1., .9), vec3(0.), u_moon), disc);

        // Stars at night.
        vec2 cell = floor(css / 44.);
        vec2 starP = fract(css / 44.) - .5 + (vec2(hash12(cell), hash12(cell + 7.)) - .5) * .7;
        float star = smoothstep(.06, .03, length(starP)) * step(.72, hash12(cell + 3.)) * u_night * (1. - disc);
        ink = mix(ink, vec3(0.), star);

        // Clouds, cut out of paper and drifting.
        float cloudX = css.x + u_cam * u_zoom * .12 + u_t * 7.;
        float cloudN = fbm(vec2(cloudX * .0042, css.y * .013));
        float cloud = smoothstep(.565, .575, cloudN) * smoothstep(.75, .12, h);
        ink = mix(ink, mix(vec3(0., .12, .05), vec3(.75, .28, 0.), u_night), cloud);

        // Far hills and a mid-ground town, each moving at its own rate.
        float hx = css.x + u_cam * u_zoom * .22;
        float hill = groundY - u_zoom * (200. + 130. * vnoise(vec2(hx * .0028, 1.)) + 44. * vnoise(vec2(hx * .012, 2.)));
        float hillMask = smoothstep(hill - .7, hill + .7, css.y);
        ink = mix(ink, mix(vec3(.28, .22, .1), vec3(.9, .22, 0.), u_night), hillMask);

        float tx = css.x + u_cam * u_zoom * .5;
        float col = floor(tx / (46. * u_zoom));
        float bh = groundY - u_zoom * (70. + 170. * pow(hash12(vec2(col, 4.)), 2.2)) * step(.28, hash12(vec2(col, 8.)));
        float townMask = smoothstep(bh - .7, bh + .7, css.y);
        vec3 town = mix(vec3(.5, .2, 0.), vec3(1., .32, 0.), u_night);
        vec2 winCell = fract(vec2(tx / (46. * u_zoom), css.y / (22. * u_zoom)));
        float lit = step(.65, hash12(floor(vec2(tx / (46. * u_zoom) * 4., css.y / (22. * u_zoom))) + 13.));
        float townWin = step(.3, fract(tx / (11.5 * u_zoom))) * step(.45, winCell.y) * lit * u_night;
        ink = mix(ink, mix(town, vec3(0., 0., 1.), townWin), townMask);

        // The plant.
        vec2 tuv = world / u_world;
        if (tuv.x > 0. && tuv.x < 1. && tuv.y > 0. && tuv.y < 1.) {
            vec4 p = texture(u_plant, tuv);
            float glass = smoothstep(.45, .55, p.b);
            vec3 plant = vec3(p.r, p.g, 0.);
            float keep = smoothstep(.12, .2, p.b) * (1. - glass);
            vec3 dark = vec3(mix(plant.r, max(plant.r, .62), u_night), plant.g * (1. - u_night * .5), 0.);
            plant = mix(dark, plant, keep);
            float hot = step(u_lit.x, world.x) * step(world.x, u_lit.y);
            vec3 pane = mix(vec3(.82, .1, 0.), vec3(0., .12, 1.), max(smoothstep(.25, .55, u_night), hot));
            plant = mix(plant, pane, glass);
            ink = mix(ink, plant, smoothstep(.35, .65, p.a));
        }

        // The ground, with a conveyor of crates running along it.
        if (css.y > groundY) {
            ink = mix(vec3(.45, .62, 0.), vec3(1., .42, 0.), u_night);
            float y = (css.y - groundY) / u_zoom;
            float ties = step(.5, fract(world.x / 28.)) * step(8., y) * step(y, 16.);
            ink = mix(ink, vec3(1., .5, 0.), max(ties, step(abs(y - 8.), 1.6)));
            float belt = fract((world.x - u_t * 46.) / 340.);
            float crate = step(belt, .1) * step(21., y) * step(y, 54.);
            ink = mix(ink, vec3(0., 1., .15), crate);
        }
        return ink;
    }

    float halftone(vec2 p, float value, float angle, float size) {
        float c = cos(angle), s = sin(angle);
        vec2 q = mat2(c, -s, s, c) * p * (TAU / size);
        float dots = cos(q.x) * cos(q.y) * .5 + .5;
        float w = (1. / u_ratio) * (TAU / size) * .7;
        value = clamp(value, 0., 1.);
        if (value > .985) return 1.;
        if (value < .015) return 0.;
        return smoothstep(dots - w, dots + w, value);
    }

    void main() {
        vec2 css = vec2(v_uv.x, 1. - v_uv.y) * u_view;
        float groundY = u_view.y - u_groundH;
        vec2 world = vec2(u_cam + (css.x - u_view.x * .5) / u_zoom, (css.y - groundY) / u_zoom + u_world.y);

        // Out of register: blue and yellow plates are a touch off the orange.
        vec3 a = scene(css);
        vec3 b = scene(css + vec2(1.9, -1.3));
        vec3 ink = vec3(a.r, b.g, a.b);

        // Smoke, as hard-cut shapes over everything but the ground.
        if (css.y < groundY) {
            vec2 ptrW = vec2(u_cam + (u_ptr.x - u_view.x * .5) / u_zoom, (u_ptr.y - groundY) / u_zoom + u_world.y);
            vec2 toP = world - ptrW;
            vec2 sw = world - toP / 95. * exp(-dot(toP, toP) / 9025.) * u_near * 52.;
            vec2 turbP = sw * .0085 + vec2(-u_t * .06, u_t * .36);
            float turb = fbm(turbP + fbm(turbP * 1.7 + 4.));
            float smoke = 0.;
            float tintS = 0.;
            for (int i = 0; i < u_stackCount; i++) {
                vec4 st = u_stacks[i];
                float rise = st.y - sw.y;
                if (rise < -8.) continue;
                float wind = rise * .36 + sin(rise * .012 - u_t * .9 + st.x) * (12. + rise * .06);
                float dx = sw.x - st.x - wind;
                float width = st.z * (1.1 + rise * .0085);
                float fade = smoothstep(460., 150., rise);
                float density = 1.28 - abs(dx) / (width * 1.5) + (turb - .5) * 2.1;
                density *= fade;
                density *= smoothstep(-8., 4., rise);
                if (density > smoke) { smoke = density; tintS = st.w; }
            }
            float mask = smoothstep(.49, .51, smoke);
            float core = smoothstep(.79, .81, smoke);
            vec3 pale = mix(vec3(.05, .1, .0), vec3(.45, .05, 0.), u_night);
            vec3 deep = mix(vec3(.28, .3, .0), vec3(.08, .1, 0.), u_night);
            if (tintS > 2.5) { deep = vec3(.0, .75, .2); }
            else if (tintS > 1.5) { deep = vec3(.65, .1, .0); }
            ink = mix(ink, pale, mask);
            ink = mix(ink, deep, core);
        }

        // A small robot walks the line as you scroll, on loan from next door.
        float groundPx = groundY;
        float rs = u_zoom * 1.06;
        vec2 r = vec2(css.x - u_view.x * .5 - 0., css.y - groundPx) / rs;
        r.x -= u_robot / rs;
        float step1 = sin(u_walk * .055);
        float bob = abs(step1) * 1.8;
        float head = rect(r, vec2(0., -66. + bob), vec2(13., 10.));
        float body = rect(r, vec2(0., -41. + bob), vec2(16., 16.));
        float legA = rect(r, vec2(-7. + step1 * 5., -12.), vec2(3.4, 13.));
        float legB = rect(r, vec2(7. - step1 * 5., -12.), vec2(3.4, 13.));
        float arm = rect(r, vec2(20., -40. + bob - step1 * 3.), vec2(3., 12.));
        float armB = rect(r, vec2(-20., -40. + bob + step1 * 3.), vec2(3., 12.));
        float ant = rect(r, vec2(0., -80. + bob), vec2(1.2, 5.));
        float bot = min(min(min(head, body), min(legA, legB)), min(min(arm, armB), ant));
        if (u_robot < -1e4) bot = 1e4;
        float botMask = cut(bot);
        if (botMask > 0.) ink = mix(ink, vec3(.05, .05, 0.) + vec3(.82, 0., 0.) * step(0., bot + 3.2 / rs), botMask);
        float eyes = min(rect(r, vec2(-5.5, -67. + bob), vec2(3., 3.)), rect(r, vec2(5.5, -67. + bob), vec2(3., 3.)));
        float chest = rect(r, vec2(0., -42. + bob), vec2(7., 5.));
        if (u_robot < -1e4) { eyes = 1e4; chest = 1e4; }
        ink = mix(ink, vec3(1., .7, 0.), cut(eyes));
        ink = mix(ink, vec3(0., 1., .1), cut(chest));

        // Ink lies unevenly and picks up the paper's tooth.
        float tooth = vnoise(css * 1.7);
        float mottle = fbm(css * .02 + 11.);
        vec3 value = ink;
        value += (tooth - .5) * .05;
        value *= .95 + mottle * .1;
        float cell = u_cell;
        float bCov = halftone(css + vec2(1., 0.), value.r, radians(18.), cell);
        float oCov = halftone(css + vec2(0., 2.), value.g, radians(73.), cell);
        float yCov = halftone(css, value.b, radians(3.), cell);
        // Tiny skips where the drum didn't quite ink.
        float skip = smoothstep(.76, .84, vnoise(css * 2.1 + 41.)) * .22;

        vec3 paper = vec3(.957, .925, .851) * (.985 + vnoise(css * .9) * .03);
        vec3 blue = vec3(.13, .24, .68), orange = vec3(1., .33, .15), yellow = vec3(1., .86, .1);
        vec3 col = paper;
        col *= mix(vec3(1.), yellow, yCov * (1. - skip));
        col *= mix(vec3(1.), orange, oCov * (1. - skip));
        col *= mix(vec3(1.), blue, bCov * (1. - skip));
        o = vec4(col, 1.);
    }`)

    const stackData = new Float32Array(40)
    return {
        // rect is in the canvas's CSS pixels, from its top-left corner.
        draw({ rect, ratio, canvasHeight, cam, zoom, hour, time, pointer = [-1e4, -1e4], near = 0, groundH = 70 * zoom, cell = 5.2, robot = -1e5, walked = 0, lit = [1, 0] }) {
            const [x, y, w, h] = rect
            const sky = skyAt(hour)
            const groundY = h - groundH
            const visible = stacks.filter(s => Math.abs(s[0] - cam) < w / zoom * .5 + 420).slice(0, 10)
            stackData.fill(0)
            visible.forEach((s, i) => stackData.set(s, i * 4))
            const px = Math.round(x * ratio), py = Math.round((canvasHeight - y - h) * ratio)
            const pw = Math.round(w * ratio), ph = Math.round(h * ratio)
            gl.viewport(px, py, pw, ph)
            gl.enable(gl.SCISSOR_TEST)
            gl.scissor(px, py, pw, ph)
            poster.use({
                u_plant: plantTexture, u_view: [w, h], u_ptr: [pointer[0] - x, pointer[1] - y], u_world: [layout.width, WORLD_H],
                u_t: reducedMotion ? 3 : time, u_cam: cam, u_zoom: zoom, u_ratio: ratio,
                u_night: sky.night, u_near: near, u_groundH: groundH, u_walk: walked,
                u_skyTop: sky.top, u_skyLow: sky.low,
                u_sun: [w * sky.sun[0], groundY * sky.sun[1]], u_sunR: Math.min(w, h) * .1, u_moon: sky.moon,
                u_stacks: stackData, u_stackCount: visible.length, u_cell: cell, u_robot: robot, u_lit: lit,
            })
            drawTriangle(gl)
            gl.disable(gl.SCISSOR_TEST)
        },
    }
}
