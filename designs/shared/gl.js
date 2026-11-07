// A small WebGL2 kit shared by the design prototypes: programs drawn as one
// triangle over their target, render targets, a frame loop that sleeps in
// background tabs, and a pointer tracker.

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

export const FULLSCREEN_VS = `#version 300 es
out vec2 v_uv;
void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    v_uv = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

export const NOISE = `
float hash12(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * .1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}
float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
    float a = 0.5, v = 0.0;
    for (int i = 0; i < 4; i++) {
        v += a * vnoise(p);
        p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3;
        a *= 0.5;
    }
    return v;
}`

// Returns a WebGL2 context, or null after marking the page for its CSS fallback.
export function context(canvas, options = {}) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'high-performance', ...options })
    if (!gl) document.documentElement.classList.add('no-gl')
    return gl
}

function shader(gl, type, source) {
    const s = gl.createShader(type)
    gl.shaderSource(s, source)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const numbered = source.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n')
        throw new Error(`${gl.getShaderInfoLog(s)}\n${numbered}`)
    }
    return s
}

export function program(gl, fragment, vertex = FULLSCREEN_VS) {
    const p = gl.createProgram()
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vertex))
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fragment))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p))
    const uniforms = {}
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < count; i++) {
        const u = gl.getActiveUniform(p, i)
        uniforms[u.name.replace('[0]', '')] = { location: gl.getUniformLocation(p, u.name), type: u.type }
    }
    return {
        handle: p,
        use(values = {}) {
            gl.useProgram(p)
            let unit = 0
            for (const name in values) {
                const u = uniforms[name]
                if (!u) continue
                const v = values[name]
                switch (u.type) {
                    case gl.FLOAT: v.length ? gl.uniform1fv(u.location, v) : gl.uniform1f(u.location, v); break
                    case gl.FLOAT_VEC2: gl.uniform2fv(u.location, v); break
                    case gl.FLOAT_VEC3: gl.uniform3fv(u.location, v); break
                    case gl.FLOAT_VEC4: gl.uniform4fv(u.location, v); break
                    case gl.INT: gl.uniform1i(u.location, v); break
                    case gl.SAMPLER_2D:
                        gl.activeTexture(gl.TEXTURE0 + unit)
                        gl.bindTexture(gl.TEXTURE_2D, v)
                        gl.uniform1i(u.location, unit++)
                        break
                }
            }
        },
    }
}

export const drawTriangle = gl => gl.drawArrays(gl.TRIANGLES, 0, 3)

// A texture that can be drawn into. `float` asks for 16-bit channels and falls
// back to 8-bit where the GPU can't render to them.
export function target(gl, width, height, { float = false, filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE } = {}) {
    const canFloat = float && gl.getExtension('EXT_color_buffer_float')
    gl.getExtension('OES_texture_float_linear')
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    if (canFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
    const framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return {
        texture, framebuffer, width, height,
        dispose() {
            gl.deleteTexture(texture)
            gl.deleteFramebuffer(framebuffer)
        },
    }
}

export function bindTarget(gl, t) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.framebuffer : null)
    gl.viewport(0, 0, t ? t.width : gl.drawingBufferWidth, t ? t.height : gl.drawingBufferHeight)
}

// Matches the canvas's drawing buffer to its CSS size. True when it changed.
export function fit(canvas, maxRatio = 1.5) {
    const ratio = Math.min(devicePixelRatio || 1, maxRatio)
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio))
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio))
    if (canvas.width === width && canvas.height === height) return false
    canvas.width = width
    canvas.height = height
    return true
}

// Calls fn(seconds, dt) every frame; a long gap (a background tab) counts as
// one short step, so simulations don't blow up.
export function loop(fn) {
    let last = performance.now()
    let time = 0
    const tick = now => {
        requestAnimationFrame(tick)
        if (document.hidden) {
            last = now
            return
        }
        const dt = Math.min((now - last) / 1000, 1 / 20)
        last = now
        time += dt
        fn(time, dt)
    }
    requestAnimationFrame(tick)
}

// The pointer in CSS pixels. `smooth` eases after it; `near` fades to 0 when
// it's been still or has left the window.
export function trackPointer() {
    const p = {
        x: innerWidth * 0.62, y: innerHeight * 0.4, fromX: 0, fromY: 0,
        smoothX: innerWidth * 0.62, smoothY: innerHeight * 0.4,
        speed: 0, near: 0, lastMove: -1e9, seen: false, down: false,
        update(dt) {
            const k = 1 - Math.exp(-dt * 7)
            p.smoothX += (p.x - p.smoothX) * k
            p.smoothY += (p.y - p.smoothY) * k
            p.speed = Math.hypot(p.x - p.fromX, p.y - p.fromY) / Math.max(dt, 1e-3)
            const target = performance.now() - p.lastMove < 2500 ? 1 : 0
            p.near += (target - p.near) * (1 - Math.exp(-dt * 3))
        },
        endFrame() {
            p.fromX = p.x
            p.fromY = p.y
        },
    }
    p.fromX = p.x
    p.fromY = p.y
    addEventListener('pointermove', e => {
        if (!p.seen) {
            p.fromX = p.smoothX = e.clientX
            p.fromY = p.smoothY = e.clientY
            p.seen = true
        }
        p.x = e.clientX
        p.y = e.clientY
        p.lastMove = performance.now()
    }, { passive: true })
    addEventListener('pointerdown', e => {
        p.down = true
        p.x = p.fromX = e.clientX
        p.y = p.fromY = e.clientY
        p.lastMove = performance.now()
    }, { passive: true })
    addEventListener('pointerup', () => { p.down = false }, { passive: true })
    return p
}
