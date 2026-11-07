import { bindTarget, context, drawTriangle, fit, loop, NOISE, program, reducedMotion, target, trackPointer } from '../shared/gl.js'

// The sky behind the page: sun, cut-paper clouds and smoke, printed
// live as three spot inks through out-of-register halftone screens. It stays
// behind the page, and the day passes as you scroll. The print itself (dots,
// paper grain, ink skips) belongs to the page, so it scrolls with the content. A few stacks on the
// horizon make the smoke. A moving cursor stirs the air: a small low-resolution
// field gives the smoke it passes through some velocity, which coasts against
// drag, rises with the smoke and fades. Nothing else in the sky reacts to it.

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
const skyAt = hour => {
    let i = 0
    while (i < hours.length - 2 && hour > hours[i + 1].at) i++
    const a = hours[i], b = hours[i + 1]
    const k = Math.min(1, Math.max(0, (hour - a.at) / (b.at - a.at)))
    return { top: lerp3(a.top, b.top, k), low: lerp3(a.low, b.low, k), sun: [lerp(a.sun[0], b.sun[0], k), lerp(a.sun[1], b.sun[1], k)], moon: k > .5 ? b.moon : a.moon, night: lerp(a.night, b.night, k) }
}

const canvas = document.querySelector('#sky')
const gl = context(canvas)

function start() {
    const pointer = trackPointer()

    const print = program(gl, `#version 300 es
    precision highp float;
    in vec2 v_uv; out vec4 o;
    uniform vec2 u_view, u_sun;
    uniform float u_t, u_ratio, u_night, u_sunR, u_moon, u_scroll, u_scale;
    uniform sampler2D u_stir;
    uniform vec3 u_skyTop, u_skyLow;
    uniform vec4 u_stacks[4];
    uniform int u_stackCount;
    const float TAU = 6.283185;
    ${NOISE}

    float groundLine() { return u_view.y - 26. * u_scale; }

    // Everything but the smoke, as amounts of blue, orange and yellow ink.
    vec3 scene(vec2 css) {
        float groundY = groundLine();
        float h = clamp(css.y / groundY, 0., 1.);
        float grain = (vnoise(css * .012 + 3.) - .5) * .05;
        float band = floor((h + grain) * 7.) / 6.;
        vec3 ink = mix(u_skyTop, u_skyLow, band);

        float disc = smoothstep(.6, -.6, length(css - u_sun) - u_sunR);

        // Stars.
        vec2 cell = floor(css / 44.);
        vec2 starP = fract(css / 44.) - .5 + (vec2(hash12(cell), hash12(cell + 7.)) - .5) * .7;
        float star = smoothstep(.06, .03, length(starP)) * step(.72, hash12(cell + 3.)) * u_night * (1. - disc);
        ink = mix(ink, vec3(0.), star);

        // Cut-paper clouds in two layers, drifting, and sliding a little with
        // the scroll so the sky has depth.
        vec2 cp = vec2(css.x + u_t * 7., css.y + u_scroll * .05) / u_scale;
        float n1 = fbm(vec2(cp.x * .0042, cp.y * .013));
        float back = smoothstep(.565, .575, n1) * smoothstep(.8, .12, h);
        ink = mix(ink, mix(vec3(0., .12, .05), vec3(.75, .28, 0.), u_night), back);
        vec2 cq = vec2(css.x + u_t * 15. + 900., css.y + u_scroll * .1) / u_scale;
        float n2 = fbm(vec2(cq.x * .0031, cq.y * .0105) + 20.);
        float front = smoothstep(.6, .61, n2) * smoothstep(.62, .08, h);
        ink = mix(ink, mix(vec3(0., .02, .0), vec3(.5, .18, 0.), u_night), front);

        // The sun, or a moon knocked out of the blue, in front of the clouds so its
        // outline stays a clean circle.
        ink = mix(ink, mix(vec3(0., 1., .9), vec3(0.), u_moon), disc);

        // Far hills.
        float hx = css.x / u_scale;
        float hill = groundY - u_scale * (56. + 74. * vnoise(vec2(hx * .0026, 1.)) + 22. * vnoise(vec2(hx * .012, 2.)));
        ink = mix(ink, mix(vec3(.28, .22, .1), vec3(.9, .22, 0.), u_night), smoothstep(hill - .7, hill + .7, css.y));

        // Stacks.
        for (int i = 0; i < u_stackCount; i++) {
            vec4 s = u_stacks[i];
            float k = clamp((css.y - s.y) / (groundY - s.y), 0., 1.);
            float w = s.z * (.7 + .34 * k);
            float inside = step(abs(css.x - s.x), w) * step(s.y, css.y);
            float cap = step(abs(css.x - s.x), s.z * .86) * step(abs(css.y - s.y), 3. * u_scale);
            float stripe = step(abs(css.y - s.y - 16. * u_scale), 3.5 * u_scale);
            vec3 c = mix(vec3(1., .5, 0.), vec3(0., 1., 0.), stripe);
            ink = mix(ink, c, inside);
            ink = mix(ink, vec3(1., .55, 0.), cap);
        }

        if (css.y > groundY) ink = mix(vec3(.72, .55, 0.), vec3(1., .42, 0.), u_night);
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
        vec3 a = scene(css);
        vec3 b = scene(css + vec2(1.9, -1.3));
        vec3 ink = vec3(a.r, b.g, a.b);

        // Smoke: hard-cut white shapes, shaped by one shared turbulence.
        vec2 stir = texture(u_stir, v_uv).xy;
        vec2 w = (css - stir) / u_scale;
        vec2 turbP = w * .0075 + vec2(-u_t * .06, u_t * .36);
        float turb = fbm(turbP + fbm(turbP * 1.7 + 4.));
        float smoke = 0.;
        float reach = u_view.y * .82;
        for (int i = 0; i < u_stackCount; i++) {
            vec4 st = u_stacks[i];
            float rise = (st.y - css.y) / u_scale;
            // Stirred smoke stays attached at the stack's mouth.
            vec2 sc = css - stir * smoothstep(0., 70., rise);
            if (rise < 3.) continue; // starts at the top edge of the stack's cap
            // The sway fades in with height, so the base stays fixed at the mouth.
            float wind = rise * .24 + sin(rise * .011 - u_t * .9 + st.x) * (12. * smoothstep(3., 110., rise) + rise * .07);
            float dx = (sc.x - st.x) / u_scale - wind;
            // Narrower than the mouth at first, so it reads as coming out of the pipe.
            float width = st.z / u_scale * (.5 + rise * .0072);
            float fade = smoothstep(reach / u_scale, reach / u_scale * .28, rise);
            float density = (1.28 - abs(dx) / (width * 1.5) + (turb - .5) * 2.1 * smoothstep(3., 55., rise)) * fade;
            smoke = max(smoke, density);
        }
        float mask = smoothstep(.49, .51, smoke);
        float core = smoothstep(.94, .96, smoke);
        // White as steam: bare paper, with a faint warm shadow inside for shape.
        ink = mix(ink, vec3(0.), mask);
        ink = mix(ink, mix(vec3(0., .035, .07), vec3(.04, .01, 0.), u_night), core);

        // Ink lies unevenly and picks up the paper's tooth.
        vec2 page = css + vec2(0., u_scroll);
        float tooth = vnoise(page * 1.7);
        float mottle = fbm(page * .02 + 11.);
        // Bare paper stays clean: grain only shows where there's ink.
        vec3 value = ink + (tooth - .5) * .05 * step(vec3(.001), ink);
        value *= .95 + mottle * .1;
        float cell = 5.2;
        float bCov = halftone(page + vec2(1., 0.), value.r, radians(18.), cell);
        float oCov = halftone(page + vec2(0., 2.), value.g, radians(73.), cell);
        float yCov = halftone(page, value.b, radians(3.), cell);
        float skip = smoothstep(.76, .84, vnoise(page * 2.1 + 41.)) * .22;

        vec3 paper = vec3(.957, .925, .851) * (.985 + vnoise(page * .9) * .03);
        vec3 col = paper;
        col *= mix(vec3(1.), vec3(1., .86, .1), yCov * (1. - skip));
        col *= mix(vec3(1.), vec3(1., .33, .15), oCov * (1. - skip));
        col *= mix(vec3(1.), vec3(.13, .24, .68), bCov * (1. - skip));
        o = vec4(col, 1.);
    }`)

    const stackData = new Float32Array(16)

    // The stirred air, in CSS pixels of push. It needs a float target, since the
    // push can be negative; without one the smoke just doesn't react.
    const canStir = !reducedMotion && gl.getExtension('EXT_color_buffer_float')
    const stirStep = program(gl, `#version 300 es
    precision highp float;
    in vec2 v_uv; out vec4 o;
    uniform sampler2D u_prev;
    uniform vec2 u_view, u_texel, u_from, u_to, u_rise;
    uniform float u_dt, u_scale, u_strength;
    void main() {
        // Carried along at the speed the smoke rises and drifts.
        vec2 uv = v_uv - u_rise * u_dt / u_view;
        vec4 c = texture(u_prev, uv); // xy: how far the smoke has moved. zw: its velocity.
        vec4 around = (texture(u_prev, uv + vec2(u_texel.x, 0.)) + texture(u_prev, uv - vec2(u_texel.x, 0.))
                     + texture(u_prev, uv + vec2(0., u_texel.y)) + texture(u_prev, uv - vec2(0., u_texel.y))) * .25;
        c = mix(c, around, min(u_dt * 7., .7));

        // The cursor adds velocity, never position, along a soft stroke.
        vec2 p = vec2(v_uv.x, 1. - v_uv.y) * u_view;
        vec2 ab = u_to - u_from;
        float k = clamp(dot(p - u_from, ab) / max(dot(ab, ab), 1e-3), 0., 1.);
        vec2 q = p - u_from - ab * k;
        float radius = 62. * u_scale;
        c.zw += vec2(ab.x, -ab.y) * u_strength * exp(-dot(q, q) / (radius * radius));

        // Drag slows it, it coasts, and it eases back toward where it would have been.
        c.zw *= exp(-u_dt * 1.5);
        float speedLimit = 55. * u_scale;
        float v = length(c.zw);
        if (v > speedLimit) c.zw *= speedLimit / v;
        c.xy += c.zw * u_dt;
        c.xy *= exp(-u_dt * .35);
        o = c;
    }`)
    let stir = []
    let stirred = 0
    const makeStir = (w, h) => {
        stir.forEach(t => t.dispose())
        const size = [Math.max(2, Math.round(w / 6)), Math.max(2, Math.round(h / 6))]
        stir = canStir ? [target(gl, ...size, { float: true }), target(gl, ...size, { float: true })] : [target(gl, 2, 2)]
    }

    let hour = 0
    loop((time, dt) => {
        const resized = fit(canvas, 1.5)
        pointer.update(dt)
        const w = canvas.clientWidth, h = canvas.clientHeight
        if (resized || !stir.length) makeStir(w, h)
        const scale = Math.max(.62, Math.min(1.3, h / 900))
        const groundY = h - 26 * scale
        const narrow = w < 700
        // Fractions across the window, heights, and smoke tints.
        const stacks = narrow
            ? [[.74, 230, 21, 0], [.9, 170, 17, 1]]
            : [[.62, 200, 20, 0], [.72, 300, 24, 1], [.94, 240, 20, 2]]
        stackData.fill(0)
        stacks.forEach(([x, height, width, tint], i) => stackData.set([w * x, groundY - height * scale, width * scale, tint], i * 4))

        const page = document.documentElement.scrollHeight - h
        const goal = page > 0 ? scrollY / page : 0
        hour += (goal - hour) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 4))
        const sky = skyAt(hour)

        if (canStir) {
            // Only speed counts: a slow or resting cursor stirs nothing.
            const moved = pointer.seen ? Math.hypot(pointer.x - pointer.fromX, pointer.y - pointer.fromY) : 0
            // A long jump is the cursor leaving and coming back, not a sweep.
            const speed = moved > 260 ? 0 : moved / Math.max(dt, 1e-3)
            const t = Math.min(1, Math.max(0, (speed - 150) / 1000))
            stirred += (t * t * (3 - 2 * t) - stirred) * (1 - Math.exp(-dt * 7))
            bindTarget(gl, stir[1])
            stirStep.use({
                u_prev: stir[0].texture, u_view: [w, h], u_texel: [1 / stir[0].width, 1 / stir[0].height],
                u_from: moved > 260 ? [pointer.x, pointer.y] : [pointer.fromX, pointer.fromY], u_to: [pointer.x, pointer.y],
                u_rise: [11.5 * scale, 48 * scale], u_dt: dt, u_scale: scale, u_strength: stirred * .36,
            })
            drawTriangle(gl)
            stir.reverse()
        }

        bindTarget(gl, null)
        gl.viewport(0, 0, canvas.width, canvas.height)
        print.use({
            u_view: [w, h], u_stir: stir[0].texture, u_t: reducedMotion ? 3 : time, u_ratio: canvas.width / w,
            u_night: sky.night, u_scroll: scrollY, u_scale: scale,
            u_skyTop: sky.top, u_skyLow: sky.low, u_sun: [w * (sky.sun[0] + (narrow ? -.34 : .1) * Math.max(0, 1 - hour * 4)), groundY * sky.sun[1]],
            u_sunR: Math.min(w, h) * .13, u_moon: sky.moon, u_stacks: stackData, u_stackCount: stacks.length,
        })
        drawTriangle(gl)
        pointer.endFrame()
        canvas.classList.add('on')
    })
}

if (gl) start()
