import { bindTarget, context, drawTriangle, fit, loop, NOISE, program, reducedMotion, target, trackPointer } from '../shared/gl.js'

// A cast-iron plate behind the page. The page's layout is drawn into a height
// map (raised letters, recessed panels, rivets), so everything on the page is
// cast into the same piece of metal. A small simulation carries heat across
// it: the cursor is a torch, and steel it heated keeps a temper color (straw,
// purple, blue) long after the glow has gone.

const canvas = document.querySelector('#iron')
const gl = context(canvas)
if (gl) start()

function start() {
    const pointer = trackPointer()

    // Tiling noise, baked once: r mottling, g fine pits, b brushed streaks.
    const bakeNoise = program(gl, `#version 300 es
    precision highp float;
    in vec2 v_uv; out vec4 o;
    float h(vec2 p, float n) { p = mod(p, n); vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    float vn(vec2 p, float n) { vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(h(i,n),h(i+vec2(1,0),n),f.x),mix(h(i+vec2(0,1),n),h(i+vec2(1,1),n),f.x),f.y); }
    float fb(vec2 u, float n) { float a=.5,v=0.; for(int i=0;i<5;i++){ v+=a*vn(u*n,n); n*=2.; a*=.5; } return v; }
    void main() {
        float mott = fb(v_uv, 6.);
        float pits = fb(v_uv, 180.);
        pits = smoothstep(.3, .66, pits);
        float streak = fb(v_uv * vec2(1., 1.), 8.) * .3 + vn(v_uv * vec2(14., 512.), 512.) * .7;
        o = vec4(mott, pits, streak, 1.);
    }`)
    const noise = target(gl, 1024, 1024, { wrap: gl.REPEAT })
    bindTarget(gl, noise)
    bakeNoise.use()
    drawTriangle(gl)
    gl.bindTexture(gl.TEXTURE_2D, noise.texture)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)

    const heatStep = program(gl, `#version 300 es
    precision highp float;
    in vec2 v_uv; out vec4 o;
    uniform sampler2D u_prev, u_height;
    uniform vec2 u_texel, u_view, u_page, u_a, u_b;
    uniform float u_scroll, u_shift, u_dt, u_power, u_pour, u_t;
    uniform vec4 u_rect;
    ${NOISE}
    float segment(vec2 p, vec2 a, vec2 b) {
        vec2 ab = b - a; float k = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-3), 0., 1.);
        return length(p - a - ab * k);
    }
    void main() {
        vec2 uv = v_uv - vec2(0., u_shift / u_view.y);
        vec4 c = texture(u_prev, uv);
        vec4 sum = texture(u_prev, uv + vec2(u_texel.x, 0.)) + texture(u_prev, uv - vec2(u_texel.x, 0.))
                 + texture(u_prev, uv + vec2(0., u_texel.y)) + texture(u_prev, uv - vec2(0., u_texel.y));
        vec2 css = vec2(v_uv.x, 1. - v_uv.y) * u_view;
        vec2 page = css + vec2(0., u_scroll);
        float h = textureLod(u_height, page / u_page, 1.).r;
        float raised = smoothstep(.55, .85, h);

        // Heat spreads quickly and cools faster through thin ground than through
        // the thick letters, which hold their glow.
        float t = mix(c.r, sum.r * .25, min(u_dt * 16., .8));
        t *= exp(-u_dt * mix(1.25, .52, raised));
        t -= u_dt * .012;

        float d = segment(css, u_a, u_b);
        float flame = .7 + .3 * vnoise(css * .07 + u_t * 5.);
        t += u_power * u_dt * 9. * flame * exp(-d * d / (mix(620., 300., raised)));

        if (u_pour > -1e4) {
            float behind = u_pour - css.x;
            float wob = (vnoise(vec2(css.y * .03, u_t * 2.)) - .5) * 70.;
            t += raised * smoothstep(-1., 8., behind + wob) * smoothstep(120., 0., behind + wob) * u_dt * 6.5;
        }
        if (u_rect.z > 0.) {
            vec2 center = u_rect.xy + u_rect.zw * .5;
            vec2 q = abs(css - center) - u_rect.zw * .5;
            float edge = abs(length(max(q, 0.)) + min(max(q.x, q.y), 0.));
            t += smoothstep(7., 1., edge) * u_dt * 2.1 * (.6 + .4 * vnoise(css * .05 + u_t));
        }
        t = clamp(t, 0., 1.5);

        // The temper color tracks the hottest this steel has been lately, and
        // fades over about half a minute.
        float temper = max(c.g - u_dt * .03, smoothstep(.1, .85, t) * .95);
        o = vec4(t, temper, 0., 1.);
    }`)

    const plate = program(gl, `#version 300 es
    precision highp float;
    in vec2 v_uv; out vec4 o;
    uniform sampler2D u_height, u_heat, u_noise;
    uniform vec2 u_view, u_page, u_ptr;
    uniform float u_scroll, u_t, u_near, u_ratio;
    ${NOISE}

    float H(vec2 uv, float lod) { return textureLod(u_height, uv, lod).r; }

    vec3 temperColor(float k) {
        vec3 c = mix(vec3(1.), vec3(1.2, 1., .58), smoothstep(.04, .22, k));
        c = mix(c, vec3(.92, .58, .36), smoothstep(.22, .42, k));
        c = mix(c, vec3(.5, .3, .62), smoothstep(.42, .6, k));
        c = mix(c, vec3(.26, .4, .82), smoothstep(.6, .8, k));
        return c;
    }
    vec3 aces(vec3 x) { return clamp(x * (2.51 * x + .03) / (x * (2.43 * x + .59) + .14), 0., 1.); }

    void main() {
        vec2 css = vec2(v_uv.x, 1. - v_uv.y) * u_view;
        vec2 page = css + vec2(0., u_scroll);
        vec2 uv = page / u_page;
        vec2 px = 1. / u_page;

        vec2 tuv = page / 900.;
        float n0 = texture(u_noise, tuv).g;
        float nx = texture(u_noise, tuv + vec2(1.5 / 900., 0.)).g;
        float ny = texture(u_noise, tuv + vec2(0., 1.5 / 900.)).g;
        vec3 ns = texture(u_noise, tuv * .37).rgb;
        float brush = texture(u_noise, page / vec2(1800., 500.)).b;

        float h = H(uv, 0.);
        float soft = H(uv, 3.5);

        // Bevels from the height map at two widths, plus sand-cast pitting.
        vec2 grad = vec2(H(uv + vec2(px.x * 1.6, 0.), 1.2) - H(uv - vec2(px.x * 1.6, 0.), 1.2),
                         H(uv + vec2(0., px.y * 1.6), 1.2) - H(uv - vec2(0., px.y * 1.6), 1.2)) * 3.4;
        grad += vec2(H(uv + vec2(px.x * 6., 0.), 3.) - H(uv - vec2(px.x * 6., 0.), 3.),
                     H(uv + vec2(0., px.y * 6.), 3.) - H(uv - vec2(0., px.y * 6.), 3.)) * 1.5;

        float raised = smoothstep(.56, .84, h);
        float sunk = smoothstep(.26, .13, h);
        float pitAmt = mix(.2, .035, raised) * (1. - sunk * .7);
        grad += vec2(nx - n0, ny - n0) * pitAmt;
        vec3 N = normalize(vec3(-grad.x, grad.y, 1.));

        // Raised faces ground to bright metal, the plate black iron, the
        // recessed panels painted, so type on them reads.
        vec3 albedo = vec3(.03, .0285, .027) * (.55 + ns.r * 1.);
        albedo = mix(albedo, vec3(.016, .0155, .015) * (.8 + n0 * .4), sunk);
        vec3 ground = vec3(.5, .46, .4) * (.72 + brush * .55);
        albedo = mix(albedo, ground, raised);

        float ao = clamp(1. + (h - soft) * 1.9, .2, 1.25);

        vec3 V = vec3(0., 0., 1.);
        vec3 key = normalize(vec3(-.55, .68, .58));
        float diff = max(dot(N, key), 0.);
        float gloss = mix(26., 70., raised);
        float spec = pow(max(dot(N, normalize(key + V)), 0.), gloss) * mix(.05, .7, raised);

        vec3 toLight = vec3(u_ptr - css, 0.);
        toLight.y = -toLight.y;
        toLight.z = 210.;
        float dist = length(toLight);
        vec3 pl = toLight / dist;
        float att = u_near / (1. + dist * dist / 130000.);
        float pdiff = max(dot(N, pl), 0.) * att;
        float pspec = pow(max(dot(N, normalize(pl + V)), 0.), gloss) * att * mix(.25, 1.3, raised);

        vec3 col = albedo * (vec3(.13, .135, .15) * ao + vec3(1.05, .98, .9) * diff * ao + vec3(2., 1.42, .95) * pdiff);
        col += vec3(.92, .95, 1.) * spec * ao + vec3(1., .78, .55) * pspec;

        vec4 heat = textureLod(u_heat, v_uv, 0.);
        float T = heat.r;

        col *= mix(vec3(1.), temperColor(heat.g), smoothstep(.02, .14, heat.g) * .82 * (1. - sunk * .6));

        // Black-body glow, with a soft bloom from wider taps of the heat.
        float glow = textureLod(u_heat, v_uv, 2.).r * .55 + textureLod(u_heat, v_uv, 3.5).r * .45;
        vec3 emit = vec3(.95, .13, .01) * smoothstep(.1, .42, T)
                  + vec3(1.1, .46, .05) * smoothstep(.34, .72, T) * 1.7
                  + vec3(1., .86, .55) * smoothstep(.68, 1.1, T) * 3.5;
        col = col * (1. - smoothstep(.2, .9, T) * .75) + emit * mix(.8, 1.2, ns.g);
        col += vec3(1., .24, .04) * glow * glow * 1.1;

        vec2 c = v_uv - .5;
        col *= 1. - dot(c, c) * .55;
        col = aces(col * 1.28);
        col = pow(col, vec3(1. / 2.2));
        col += (hash12(gl_FragCoord.xy + fract(u_t) * 91.) - .5) * .012;
        o = vec4(col, 1.);
    }`)

    // Sparks, drawn as points over the plate.
    const MAX_SPARKS = 340
    const spark = { x: new Float32Array(MAX_SPARKS), y: new Float32Array(MAX_SPARKS), vx: new Float32Array(MAX_SPARKS), vy: new Float32Array(MAX_SPARKS), life: new Float32Array(MAX_SPARKS), max: new Float32Array(MAX_SPARKS) }
    let sparkNext = 0
    const sparkData = new Float32Array(MAX_SPARKS * 3)
    const sparkBuffer = gl.createBuffer()
    const sparkVao = gl.createVertexArray()
    gl.bindVertexArray(sparkVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, sparkBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, sparkData.byteLength, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
    const sparks = program(gl, `#version 300 es
    precision highp float;
    in float v_life; out vec4 o;
    void main() {
        float d = length(gl_PointCoord - .5) * 2.;
        float a = smoothstep(1., .1, d);
        vec3 c = mix(vec3(1., .25, .03), vec3(1., .84, .5), v_life);
        o = vec4(c * a * (.35 + v_life), 0.);
    }`, `#version 300 es
    layout(location = 0) in vec3 a;
    uniform vec2 u_view; uniform float u_ratio;
    out float v_life;
    void main() {
        v_life = a.z;
        gl_Position = vec4(a.x / u_view.x * 2. - 1., 1. - a.y / u_view.y * 2., 0., 1.);
        gl_PointSize = u_ratio * (1.2 + a.z * 2.6);
    }`)
    const emitSpark = (x, y, vx, vy) => {
        const i = sparkNext++ % MAX_SPARKS
        spark.x[i] = x
        spark.y[i] = y
        spark.vx[i] = vx + (Math.random() - .5) * 260
        spark.vy[i] = vy - Math.random() * 300
        spark.max[i] = spark.life[i] = .35 + Math.random() * .9
    }

    let heat = []
    const makeHeat = () => {
        heat.forEach(t => t.dispose())
        const w = Math.max(2, Math.floor(canvas.clientWidth / 2.5))
        const h = Math.max(2, Math.floor(canvas.clientHeight / 2.5))
        heat = [target(gl, w, h, { float: true }), target(gl, w, h, { float: true })]
    }

    // The page's height map, redrawn when its layout changes.
    const heightTexture = gl.createTexture()
    let pageSize = [1, 1]
    const buildHeight = () => {
        const width = document.documentElement.clientWidth
        const height = document.documentElement.scrollHeight
        const scale = Math.min(Math.min(devicePixelRatio || 1, 2) * 1.0, 8000 / height, 8000 / width)
        const c = document.createElement('canvas')
        c.width = Math.ceil(width * scale)
        c.height = Math.ceil(height * scale)
        const ctx = c.getContext('2d', { willReadFrequently: false })
        ctx.scale(scale, scale)
        const level = v => `rgb(${v},${v},${v})`
        ctx.fillStyle = level(90)
        ctx.fillRect(0, 0, width, height)
        const top = scrollY

        const rivet = (x, y, r = 5) => {
            const g = ctx.createRadialGradient(x - r * .15, y - r * .15, 0, x, y, r)
            g.addColorStop(0, level(255))
            g.addColorStop(.7, level(230))
            g.addColorStop(1, level(120))
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.arc(x, y, r, 0, Math.PI * 2)
            ctx.fill()
        }
        const frame = (x, y, w, h, radius, thick, value) => {
            ctx.strokeStyle = level(value)
            ctx.lineWidth = thick
            ctx.beginPath()
            ctx.roundRect(x, y, w, h, radius)
            ctx.stroke()
        }

        // The hero's raised border with its rivets.
        const inset = Math.min(width * .018, 22)
        const heroH = document.querySelector('.hero').getBoundingClientRect().bottom + top
        frame(inset, inset, width - inset * 2, heroH - inset * 2, 16, 5, 215)
        const rivets = Math.max(3, Math.round(width / 280))
        for (let i = 0; i <= rivets; i++) {
            const x = inset + 22 + (width - inset * 2 - 44) * i / rivets
            rivet(x, inset + 20)
            rivet(x, heroH - inset - 20)
        }

        // Panels: painted recesses with a raised lip and a rivet in each corner.
        for (const el of document.querySelectorAll('[data-panel]')) {
            const r = el.getBoundingClientRect()
            const x = r.left, y = r.top + top, w = r.width, h = r.height
            ctx.fillStyle = level(30)
            ctx.beginPath()
            ctx.roundRect(x, y, w, h, 10)
            ctx.fill()
            frame(x, y, w, h, 10, 3, 190)
            for (const [a, b] of [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + h - 12], [x + w - 12, y + h - 12]]) rivet(a, b, 2.8)
        }

        // Cast type.
        ctx.textBaseline = 'alphabetic'
        ctx.fillStyle = level(255)
        for (const el of document.querySelectorAll('[data-cast]')) {
            const style = getComputedStyle(el)
            ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
            const text = style.textTransform === 'uppercase' ? el.textContent.toUpperCase() : el.textContent
            const metrics = ctx.measureText(text)
            const r = el.getBoundingClientRect()
            const mid = r.top + r.height / 2 + top
            ctx.fillText(text, r.left, mid + (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2)
        }

        gl.bindTexture(gl.TEXTURE_2D, heightTexture)
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, c)
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        pageSize = [width, height]
    }

    let needsHeight = true
    new ResizeObserver(() => { needsHeight = true }).observe(document.documentElement)
    document.fonts.ready.then(() => { needsHeight = true })
    document.fonts.load('900 80px "Big Shoulders Display"').then(() => { needsHeight = true })

    let hovered = null
    for (const el of document.querySelectorAll('a[data-panel]')) {
        el.addEventListener('pointerenter', () => { hovered = el })
        el.addEventListener('pointerleave', () => { if (hovered === el) hovered = null })
        el.addEventListener('focus', () => { hovered = el })
        el.addEventListener('blur', () => { if (hovered === el) hovered = null })
    }

    const h1 = document.querySelector('h1')
    let pour = reducedMotion ? null : -200
    let lastScroll = scrollY

    loop((time, dt) => {
        if (fit(canvas) || !heat.length) makeHeat()
        if (needsHeight) {
            buildHeight()
            needsHeight = false
        }
        pointer.update(dt)
        const view = [canvas.clientWidth, canvas.clientHeight]
        const shift = scrollY - lastScroll
        lastScroll = scrollY

        const speed = Math.min(pointer.speed / 500, 1)
        const power = pointer.seen ? Math.max(speed, pointer.down ? 1 : 0) : 0

        let pourX = -1e5
        if (pour !== null) {
            pour += dt * view[0] * .36
            pourX = pour
            if (pour > view[0] + 260) pour = null
            else if (scrollY < innerHeight * .5) {
                const r = h1.getBoundingClientRect()
                for (let i = 0; i < 4; i++) {
                    const x = pour - Math.random() * 40
                    if (x > r.left && x < r.right) emitSpark(x, r.top + Math.random() * r.height, 100, -40)
                }
            }
        }

        if (pointer.seen && speed > .35 && !reducedMotion) {
            const n = Math.ceil(speed * 3)
            for (let i = 0; i < n; i++) emitSpark(pointer.x, pointer.y, (pointer.x - pointer.fromX) / Math.max(dt, .001) * .15, (pointer.y - pointer.fromY) / Math.max(dt, .001) * .15)
        }

        let rect = [0, 0, 0, 0]
        if (hovered) {
            const r = hovered.getBoundingClientRect()
            rect = [r.left, r.top, r.width, r.height]
        }

        gl.disable(gl.BLEND)
        bindTarget(gl, heat[1])
        heatStep.use({
            u_prev: heat[0].texture, u_height: heightTexture,
            u_texel: [1 / heat[0].width, 1 / heat[0].height], u_view: view, u_page: pageSize,
            u_a: [pointer.fromX, pointer.fromY], u_b: [pointer.x, pointer.y],
            u_scroll: scrollY, u_shift: shift, u_dt: dt, u_power: power, u_pour: pourX, u_t: time, u_rect: rect,
        })
        drawTriangle(gl)
        heat.reverse()
        gl.bindTexture(gl.TEXTURE_2D, heat[0].texture)
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)

        bindTarget(gl, null)
        plate.use({
            u_height: heightTexture, u_heat: heat[0].texture, u_noise: noise.texture,
            u_view: view, u_page: pageSize, u_ptr: [pointer.smoothX, pointer.smoothY],
            u_scroll: scrollY, u_t: time, u_near: pointer.seen ? pointer.near : 0, u_ratio: canvas.width / view[0],
        })
        drawTriangle(gl)

        // Sparks: gravity, drag, and a bit of scroll carried along.
        let live = 0
        for (let i = 0; i < MAX_SPARKS; i++) {
            if (spark.life[i] <= 0) continue
            spark.life[i] -= dt
            spark.vy[i] += 880 * dt
            spark.vx[i] *= 1 - dt * .8
            spark.x[i] += spark.vx[i] * dt
            spark.y[i] += spark.vy[i] * dt - shift
            sparkData[live * 3] = spark.x[i]
            sparkData[live * 3 + 1] = spark.y[i]
            sparkData[live * 3 + 2] = Math.max(spark.life[i] / spark.max[i], 0)
            live++
        }
        if (live) {
            gl.enable(gl.BLEND)
            gl.blendFunc(gl.ONE, gl.ONE)
            sparks.use({ u_view: view, u_ratio: canvas.width / view[0] })
            gl.bindVertexArray(sparkVao)
            gl.bindBuffer(gl.ARRAY_BUFFER, sparkBuffer)
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, sparkData, 0, live * 3)
            gl.drawArrays(gl.POINTS, 0, live)
            gl.bindVertexArray(null)
            gl.disable(gl.BLEND)
        }
        pointer.endFrame()
        canvas.classList.add('on')
    })
}
