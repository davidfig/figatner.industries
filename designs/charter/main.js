import { context, drawTriangle, fit, loop, NOISE, program, reducedMotion, trackPointer } from '../shared/gl.js'

// Security paper and intaglio engraving, drawn live. Guilloche borders are
// families of sine curves that drift slowly and bend around the cursor, so the
// moire keeps moving. The vignettes are raymarched solids shaded the way an
// engraver would: lines that swell in shadow and cross in the deepest parts.
// Hold the cursor over the paper and it's held up to the light: the watermark
// and security fibers show through.

const canvas = document.querySelector('#press')
const gl = context(canvas, { antialias: false })

const HEAD = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform vec2 u_view, u_ptr;
uniform vec4 u_rect;
uniform float u_scroll, u_t, u_ratio, u_near;
const float TAU = 6.283185;
vec2 cssOf() { return vec2(v_uv.x, 1. - v_uv.y) * u_view; }
// Width of a pixel in CSS units, for antialiasing.
float aa() { return 1. / u_ratio; }

// One family of guilloche curves across a ribbon: v is the position across
// the ribbon (-1..1), s runs along it, w its half-width in CSS pixels.
float weave(float v, float s, float w, float freq, float amp, float drift, int lines) {
    float best = 1e5;
    for (int i = 0; i < lines; i++) {
        float ph = float(i) / float(lines) * TAU;
        float a = freq * s + ph + drift;
        float curve = amp * sin(a) + amp * .22 * sin(a * 3. - ph);
        float slope = amp * freq * cos(a) + amp * .66 * freq * cos(a * 3. - ph);
        float d = abs(v - curve) * w / sqrt(1. + slope * slope * .0025 * w * w);
        best = min(best, d);
    }
    return best;
}
`

function start() {
    const pointer = trackPointer()

    const paper = program(gl, `${HEAD}
    ${NOISE}
    uniform sampler2D u_mark;
    uniform vec2 u_markSize;
    void main() {
        vec2 css = cssOf();
        vec2 page = css + vec2(0., u_scroll);
        vec3 base = vec3(.953, .925, .847);
        float cloud = fbm(page * .004);
        float fine = fbm(page * vec2(.55, .3));
        base *= .972 + cloud * .045;
        base -= (fine - .5) * .022;

        // A fine background tint of crossed waves, the first thing a forger
        // has to reproduce.
        float w1 = sin(page.y * .78 + sin(page.x * .022 + u_t * .05) * 7.);
        float w2 = sin(page.y * .78 - sin(page.x * .017 - u_t * .04) * 9. + 1.);
        float tint = smoothstep(.72, 1., w1) + smoothstep(.72, 1., w2);
        base = mix(base, vec3(.72, .8, .68), tint * .11);

        // Hold to the light.
        float d = length(css - u_ptr);
        float lamp = smoothstep(320., 60., d) * u_near;
        vec2 markUv = fract(page / u_markSize);
        float mark = texture(u_mark, markUv).r;
        base += lamp * vec3(.05, .05, .035);
        base = mix(base, base * vec3(.9, .91, .86), lamp * mark);

        // Security fibers, faint until lit.
        vec2 cell = page / 54.;
        vec2 id = floor(cell);
        vec2 f = fract(cell) - .5;
        float seed = hash12(id);
        float ang = seed * 40.;
        vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * (f + (vec2(hash12(id + 4.), hash12(id + 9.)) - .5) * .5);
        q.y += sin(q.x * 14.) * .03;
        float fiber = smoothstep(.02, .006, abs(q.y)) * smoothstep(.2, .14, abs(q.x)) * step(.74, seed);
        vec3 fc = hash12(id + 2.) > .5 ? vec3(.63, .16, .12) : vec3(.12, .3, .55);
        base = mix(base, fc, fiber * (.07 + lamp * .4));
        o = vec4(base, 1.);
    }`)

    const INK = 'vec3(.09, .212, .165)'
    const SEAL = 'vec3(.557, .173, .11)'

    // A rectangular guilloche frame just inside an element, with rosettes
    // covering the corners.
    const frame = program(gl, `${HEAD}
    float rosette(vec2 p, float r0, float r1, float n) {
        float r = length(p), th = atan(p.y, p.x);
        float w = (r1 - r0) * .5;
        float v = (r - (r0 + r1) * .5) / w;
        float d = weave(v, th, w, n, .78, u_t * .1, 9);
        float env = smoothstep(1.02, .97, abs(v));
        return smoothstep(.72 + aa(), .72 - aa(), d) * env;
    }
    void main() {
        vec2 css = cssOf();
        vec2 c = u_rect.xy + u_rect.zw * .5;
        vec2 inset = u_rect.zw * .5 - vec2(min(u_view.x * .018, 24.) + 16.);
        vec2 p = css - c;
        vec2 a = abs(p) - inset;
        float sd = length(max(a, 0.)) + min(max(a.x, a.y), 0.);
        float w = min(u_view.x * .009 + 7., 16.);
        float v = sd / w;
        float s = a.x > a.y ? p.y : p.x;
        vec2 toPtr = css - u_ptr;
        float bend = exp(-dot(toPtr, toPtr) / 22000.) * u_near;
        float drift = u_t * .14 + bend * 2.4;
        float freq = TAU / 74.;
        float d1 = weave(v + bend * .2 * sin(s * .06), s, w, freq, .86, drift, 8);
        float d2 = weave(v, s, w, freq, .86, -drift + 1., 8);
        float d = min(d1, d2);
        float env = smoothstep(1.02, .96, abs(v));
        float ink = smoothstep(.7 + aa(), .7 - aa(), d) * env;
        // Keylines either side.
        ink = max(ink, smoothstep(.55 + aa(), .55 - aa(), abs(sd - w - 3.)));
        ink = max(ink, smoothstep(.85 + aa(), .85 - aa(), abs(sd + w + 3.)));
        // Corner rosettes.
        vec2 corner = abs(p) - inset;
        float R = w * 3.3;
        float cr = length(corner);
        float plate = smoothstep(R + 1., R, cr);
        float ros = max(rosette(corner, R * .42, R, 13.), rosette(corner, 0., R * .46, 7.));
        ink = mix(ink, ros, plate);
        vec3 col = mix(${INK}, ${SEAL}, plate * .95);
        o = vec4(col * ink, ink * .95);
    }`)

    // A straight ribbon between sections.
    const band = program(gl, `${HEAD}
    void main() {
        vec2 css = cssOf();
        float w = u_rect.w * .5;
        float v = (css.y - u_rect.y - w) / w;
        float s = css.x;
        vec2 toPtr = css - u_ptr;
        float bend = exp(-dot(toPtr, toPtr) / 15000.) * u_near;
        float freq = TAU / 94.;
        float d = min(weave(v, s, w, freq, .9 - bend * .3, u_t * .16 + bend * 2.6, 10),
                      weave(v, s, w, freq * .5, .86, -u_t * .1, 6));
        float ink = smoothstep(.62 + aa(), .62 - aa(), d) * smoothstep(1., .94, abs(v));
        vec2 edge = abs(css - u_rect.xy - u_rect.zw * .5) - u_rect.zw * .5;
        ink *= smoothstep(0., -30., edge.x);
        o = vec4(${INK} * ink, ink * .95);
    }`)

    // Engraved solids.
    const scene = program(gl, `${HEAD}
    uniform int u_scene;
    mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
    float box(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - r; }
    float cyl(vec3 p, float r, float h) { vec2 d = vec2(length(p.xy) - r, abs(p.z) - h); return min(max(d.x, d.y), 0.) + length(max(d, 0.)); }
    float gear(vec3 p, float r, float teeth, float width, float spin) {
        p.xy = rot(spin) * p.xy;
        float th = atan(p.y, p.x);
        float rr = length(p.xy);
        float tooth = smoothstep(-.3, .3, sin(th * teeth));
        float rim = rr - (r + (tooth - .5) * .17 * r);
        float body = max(rim * .7, abs(p.z) - width);
        // Five round lightening holes, a recessed web and a raised hub.
        float sector = TAU / 5.;
        float a = mod(th + sector * .5, sector) - sector * .5;
        vec2 cell = vec2(cos(a), sin(a)) * rr - vec2(r * .56, 0.);
        body = max(body, -(length(cell) - r * .19));
        body = max(body, -max(abs(rr - r * .56) - r * .26, abs(p.z) - width * .4 < 0. ? -1. : p.z - width * .55));
        float hub = cyl(p, r * .2, width * 1.5);
        return max(min(body, hub), -(rr - r * .07));
    }
    float sceneGears(vec3 p) {
        float t = u_t * .28;
        float a = gear(p - vec3(-.42, .36, 0.), .62, 14., .12, t);
        float b = gear(p - vec3(.59, .1, 0.), .42, 9., .1, -t * 14. / 9. + .3);
        float c = gear(p - vec3(-.2, -.73, .0), .38, 8., .1, -t * 14. / 8. + .1);
        return min(a, min(b, c));
    }
    float sheet(vec3 p, float i) {
        p -= vec3(sin(i * 2.1) * .07, cos(i * 1.3) * .05, i * .1 - .24);
        p.xy = rot(sin(i * 3.3) * .14) * p.xy;
        vec3 q = p;
        float s = box(p, vec3(.5, .68, .022), .012);
        // the dog-eared corner
        s = max(s, dot(p.xy - vec2(.5, .68), normalize(vec2(1., 1.))) + .19);
        return s;
    }
    float sceneDocs(vec3 p) {
        float d = 1e5;
        for (float i = 0.; i < 5.; i++) d = min(d, sheet(p, i));
        return d;
    }
    float sceneEnvelope(vec3 p) {
        float body = box(p, vec3(.82, .54, .05), .03);
        float x = abs(p.x);
        // The top flap comes down to a point; the side folds rise to meet it.
        float flap = max(max(dot(vec2(x, p.y + .1), normalize(vec2(.64, -.82))), p.y - .54), abs(p.z - .066) - .018);
        float fold = max(dot(vec2(x, p.y - .04), normalize(vec2(.72, 1.))), abs(p.z - .056) - .012);
        fold = max(fold, max(x - .8, abs(p.y) - .52));
        float seal = cyl(p - vec3(0., -.1, .09), .14, .03);
        return min(min(min(body, flap), fold), seal);
    }
    float sceneLens(vec3 p) {
        p.z += .02;
        float bodyB = box(p, vec3(.74, .52, .3), .07);
        float top = box(p - vec3(-.32, .6, 0.), vec3(.2, .12, .2), .04);
        float barrel = cyl(p - vec3(.0, -.02, .45), .4, .3);
        float ring = cyl(p - vec3(.0, -.02, .72), .45, .08);
        float hollow = cyl(p - vec3(.0, -.02, .82), .33, .12);
        float glass = length(p - vec3(.0, -.02, .4)) - .46;
        float d = min(min(bodyB, top), max(min(barrel, ring), -hollow));
        d = min(d, max(glass, length(p.xy - vec2(0., -.02)) - .34));
        return d;
    }
    float sceneDie(vec3 p) {
        float d = box(p, vec3(.66), .14);
        float pip = 1e5;
        // five on the front, three on the top, two on the right
        vec2 grid[5] = vec2[5](vec2(0.), vec2(.3, .3), vec2(-.3, .3), vec2(.3, -.3), vec2(-.3, -.3));
        for (int i = 0; i < 5; i++) pip = min(pip, length(p - vec3(grid[i], .68)) - .12);
        for (int i = 0; i < 3; i++) { vec2 g = vec2(-.3 + .3 * float(i)); pip = min(pip, length(p - vec3(g.x, .68, g.y)) - .12); }
        pip = min(pip, length(p - vec3(.68, .3, .3)) - .12);
        pip = min(pip, length(p - vec3(.68, -.3, -.3)) - .12);
        return max(d, -pip);
    }
    uniform vec2 u_angle;
    float map(vec3 p) {
        p.xz = rot(u_angle.y) * p.xz;
        p.yz = rot(u_angle.x) * p.yz;
        if (u_scene == 0) return sceneGears(p);
        if (u_scene == 1) return sceneDocs(p);
        if (u_scene == 2) return sceneEnvelope(p);
        if (u_scene == 3) return sceneLens(p);
        return sceneDie(p);
    }
    vec3 normal(vec3 p) {
        vec2 e = vec2(.0025, 0.);
        return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
    }
    void main() {
        vec2 css = cssOf();
        vec2 p2 = (css - u_rect.xy - u_rect.zw * .5) / (u_rect.w * .5);
        p2.y = -p2.y;
        vec3 ro = vec3(0., 0., 3.6);
        vec3 rd = normalize(vec3(p2 * .56, -1.45));
        float zoom = u_scene == 0 ? 1. : 1.22;
        ro /= zoom;

        float t = 1.6;
        bool hit = false;
        for (int i = 0; i < 52 && t < 7.; i++) {
            float d = map(ro + rd * t);
            if (d < .0015) { hit = true; break; }
            t += d * .85;
        }
        float r = length(p2);
        // Line spacing in CSS pixels stays the same whatever the vignette's size.
        float px = u_rect.w;
        float spacing = clamp(u_rect.w / 130., 3., 4.2);
        vec2 cp = css;
        float line = 0.;
        vec3 col = vec3(${INK});

        if (hit) {
            vec3 p = ro + rd * t;
            vec3 n = normal(p);
            vec3 L = normalize(vec3(-.68, .62, .42));
            float diff = clamp(dot(n, L), 0., 1.);
            float ao = clamp(map(p + n * .1) / .1, 0., 1.);
            float st = .03;
            float sh = 1.;
            for (int i = 0; i < 12; i++) {
                float d = map(p + n * .01 + L * st);
                sh = min(sh, 9. * d / st);
                st += clamp(d, .02, .25);
                if (sh < .02) break;
            }
            sh = clamp(sh, 0., 1.);
            float rim = pow(1. - max(dot(n, -rd), 0.), 2.5);
            float spec = pow(max(dot(n, normalize(L - rd)), 0.), 34.);
            float lum = (.08 + diff * sh * .78) * (.45 + ao * .55) + spec * .75;
            lum -= rim * .32;
            lum = clamp(lum, 0., 1.);

            // Lines follow the form: their angle turns with the surface, and they
            // bow around it with depth.
            vec2 dir = vec2(cos(.92 + n.x * .35), sin(.92 + n.x * .35));
            float c1 = dot(cp, dir) / spacing + t * 6.;
            float width = pow(1. - lum, .85);
            float dist1 = abs(fract(c1) - .5);
            float aaw = aa() / spacing + .03;
            line = smoothstep(width * .52 + aaw, width * .52 - aaw, dist1);
            if (lum < .35) {
                vec2 dir2 = vec2(-dir.y, dir.x);
                float c2 = dot(cp, dir2) / (spacing * 1.1);
                float w2 = (.35 - lum) * 1.25;
                line = max(line, smoothstep(w2 + aaw, w2 - aaw, abs(fract(c2) - .5)));
            }
            o = vec4(col * line, line);
        } else {
            // A sunburst behind the works, as on every good old certificate.
            float a = atan(p2.y, p2.x);
            float env = smoothstep(1., .9, r);
            if (u_scene == 0) {
                float ray = abs(fract(a / TAU * 72. + u_t * .012) - .5) * r * 11.3;
                float ink = smoothstep(.09 + aa() * .04, .05, ray) * smoothstep(.2, .6, r);
                // cartouche ring
                float ringD = abs(r - .975) * px * .5;
                float ring = smoothstep(.7 + aa(), .7 - aa(), ringD);
                float ring2 = smoothstep(.45 + aa(), .45 - aa(), abs(r - .945) * px * .5);
                line = max(ink * env * .85, max(ring, ring2));
            } else {
                // A soft shadow of horizontal rule.
                float ground = abs(fract(css.y / spacing) - .5);
                float fall = smoothstep(.98, .25, length(vec2(p2.x * .8 + .1, p2.y * 1.4 + .3)));
                float wd = fall * .14;
                line = smoothstep(wd + .05, wd - .05, ground) * step(.012, wd) * env;
            }
            o = vec4(col * line, line);
        }
    }`)

    // The watermark: the monogram, tiled across the sheet.
    const mark = (() => {
        const size = 560
        const c = document.createElement('canvas')
        c.width = c.height = size
        const ctx = c.getContext('2d')
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, size, size)
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = '700 300px "Bodoni Moda", Georgia, serif'
        ctx.fillText('FI', size / 2, size / 2 + 8)
        ctx.font = '500 21px "Old Standard TT", Georgia, serif'
        ctx.save()
        ctx.translate(size / 2, size / 2)
        const words = 'YOUR FILES ARE YOURS  ·  YOUR FILES ARE YOURS  ·  '
        for (let i = 0; i < words.length; i++) {
            ctx.save()
            ctx.rotate(i / words.length * Math.PI * 2)
            ctx.fillText(words[i], 0, -188)
            ctx.restore()
        }
        ctx.restore()
        const t = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, t)
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, c)
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        return t
    })
    let markTexture = mark()
    document.fonts.ready.then(() => {
        Promise.all([document.fonts.load('500 230px "Bodoni Moda"'), document.fonts.load('21px "Old Standard TT"')]).then(() => { markTexture = mark() })
    })

    const places = [...document.querySelectorAll('[data-gl]')].map(el => ({ el, kind: el.dataset.gl, scene: Number(el.dataset.scene ?? 0), hover: 0, hovered: false }))
    for (const place of places) {
        const row = place.el.closest('a')
        if (row) {
            row.addEventListener('pointerenter', () => { place.hovered = true })
            row.addEventListener('pointerleave', () => { place.hovered = false })
        }
    }

    loop((time, dt) => {
        fit(canvas, 1.5)
        pointer.update(dt)
        const t = reducedMotion ? 4 : time
        const view = [canvas.clientWidth, canvas.clientHeight]
        const ratio = canvas.width / view[0]
        const common = {
            u_view: view, u_ptr: [pointer.smoothX, pointer.smoothY], u_scroll: scrollY, u_t: t, u_ratio: ratio,
            u_near: pointer.seen ? pointer.near : 0,
        }
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.disable(gl.SCISSOR_TEST)
        gl.disable(gl.BLEND)
        paper.use({ ...common, u_mark: markTexture, u_markSize: [560, 560] })
        drawTriangle(gl)

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        gl.enable(gl.SCISSOR_TEST)
        for (const place of places) {
            const r = place.el.getBoundingClientRect()
            if (r.bottom < 0 || r.top > view[1] || r.width === 0) continue
            const rect = [r.left, r.top, r.width, r.height]
            gl.scissor(Math.floor(r.left * ratio), Math.floor((view[1] - r.bottom) * ratio), Math.ceil(r.width * ratio) + 1, Math.ceil(r.height * ratio) + 1)
            if (place.kind === 'frame') {
                frame.use({ ...common, u_rect: rect })
            } else if (place.kind === 'band') {
                band.use({ ...common, u_rect: rect })
            } else {
                place.hover += ((place.hovered ? 1 : 0) - place.hover) * (1 - Math.exp(-dt * 5))
                const cx = r.left + r.width / 2, cy = r.top + r.height / 2
                const dx = pointer.seen ? Math.max(-1, Math.min(1, (pointer.smoothX - cx) / view[0])) : 0
                const dy = pointer.seen ? Math.max(-1, Math.min(1, (pointer.smoothY - cy) / view[1])) : 0
                let angle
                if (place.scene === 0) angle = [-.36 + dy * .16, .46 + dx * .3 + Math.sin(t * .2) * .05]
                else if (place.scene === 4) angle = [.5 + dy * .3, -.62 + dx * .4 + place.hover * .8 + t * .07 * (reducedMotion ? 0 : 1)]
                else angle = [.26 + dy * .22, -.5 + dx * .4 + place.hover * .55 + Math.sin(t * .3 + place.scene) * .1]
                scene.use({ ...common, u_rect: rect, u_scene: place.scene, u_angle: angle })
            }
            drawTriangle(gl)
        }
        gl.disable(gl.SCISSOR_TEST)
        pointer.endFrame()
        canvas.classList.add('on')
    })
}

if (gl) start()
