// 발묵(潑墨) — 불에서 피어오른 연기가 종이에 먹처럼 번진다.
// WebGL2 유체(ref/interactive-lab-1458/js/fluid.js)에서 빌린 부품 + 부력·먹 표현(빼기 섞기)·불씨.

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
uniform vec2 uTexel;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 outColor;
`;

const CLEAR = HEAD + `
uniform sampler2D uTexture; uniform float uValue;
void main() { outColor = uValue * texture(uTexture, vUv); }`;

const SPLAT = HEAD + `
uniform sampler2D uTarget; uniform float uAspect; uniform vec3 uColor; uniform vec2 uPoint; uniform float uRadius;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 s = exp(-dot(p, p) / uRadius) * uColor;
  outColor = vec4(texture(uTarget, vUv).xyz + s, 1.0);
}`;

const ADVECT = HEAD + `
uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 uStep; uniform float uDt; uniform vec3 uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uStep;
  outColor = vec4(texture(uSource, coord).xyz / (1.0 + uDissipation * uDt), 1.0);
}`;

// 연기는 뜬다: 먹(r)과 불씨(g) 농도만큼 위로 미는 힘 + 높이에 따라 살짝 흔들리는 바람
const BUOY = HEAD + `
uniform sampler2D uVelocity; uniform sampler2D uDye; uniform float uBuoy; uniform float uDt; uniform float uTime;
void main() {
  vec2 v = texture(uVelocity, vUv).xy;
  vec3 d = texture(uDye, vUv).rgb;
  float heat = d.r + d.g * 2.2;
  float wind = sin(vUv.y * 6.0 + uTime * 0.4) * 0.35 + sin(vUv.y * 13.0 - uTime * 0.7) * 0.15;
  v += vec2(wind, 1.0) * heat * uBuoy * uDt;
  outColor = vec4(v, 0.0, 1.0);
}`;

const DIVERGENCE = HEAD + `
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x; float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y; float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const CURL = HEAD + `
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).y; float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x; float B = texture(uVelocity, vB).x;
  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const VORTICITY = HEAD + `
uniform sampler2D uVelocity; uniform sampler2D uCurlMap; uniform float uStrength; uniform float uDt;
void main() {
  float L = texture(uCurlMap, vL).x; float R = texture(uCurlMap, vR).x;
  float T = texture(uCurlMap, vT).x; float B = texture(uCurlMap, vB).x;
  float C = texture(uCurlMap, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uStrength * C;
  force.y *= -1.0;
  vec2 v = texture(uVelocity, vUv).xy + force * uDt;
  outColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`;

const PRESSURE = HEAD + `
uniform sampler2D uPressure; uniform sampler2D uDivergence;
void main() {
  float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
  float div = texture(uDivergence, vUv).x;
  outColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT = HEAD + `
uniform sampler2D uPressure; uniform sampler2D uVelocity;
void main() {
  float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
  vec2 v = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  outColor = vec4(v, 0.0, 1.0);
}`;

// 종이 위 먹: 투명 캔버스에 먹색을 미리곱한 알파로 얹는다(밝은 종이를 어둡게만 = 빼기 섞기).
// 번진 자리 가장자리에 먹이 고이고(테두리), 종이 결(잡음)에 따라 스미는 정도가 다르다.
const DISPLAY = HEAD + `
uniform sampler2D uDye; uniform vec2 uTexel; uniform vec4 uMask; uniform float uMaskK;
uniform vec3 uInk; uniform vec3 uEmber; uniform float uInkK; uniform float uInkMax; uniform float uEmberK;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec3 c = texture(uDye, vUv).rgb;
  float d = max(c.r, 0.0);
  float e = max(c.g, 0.0);
  float dx = texture(uDye, vR).r - texture(uDye, vL).r;
  float dy = texture(uDye, vT).r - texture(uDye, vB).r;
  float rim = clamp(length(vec2(dx, dy)) * 2.4, 0.0, 0.5);
  vec2 fc = gl_FragCoord.xy;
  float g = vnoise(fc * 0.42) * 0.45 + vnoise(fc * 0.09) * 0.55;
  float a = 1.0 - exp(-d * uInkK);
  a *= 0.74 + 0.5 * g;
  a += rim * smoothstep(0.02, 0.25, a) * 0.6;
  a = clamp(a, 0.0, uInkMax);
  vec2 lo = smoothstep(uMask.xy - vec2(0.05, 0.07), uMask.xy, vUv);
  vec2 hi = 1.0 - smoothstep(uMask.zw, uMask.zw + vec2(0.05, 0.07), vUv);
  a *= 1.0 - uMaskK * lo.x * lo.y * hi.x * hi.y;
  float ea = clamp(1.0 - exp(-e * uEmberK), 0.0, 0.8);
  vec3 col = uEmber * ea + uInk * a * (1.0 - ea);
  outColor = vec4(col, ea + a * (1.0 - ea));
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name;
    uniforms[name] = gl.getUniformLocation(p, name);
  }
  return { program: p, uniforms };
}
const hex = (h) => { const v = parseInt(h.slice(1), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };

export function createInk(canvas, { isTouch = false, host = canvas } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null;

  // 숫자는 캡처를 보며 고친 값(첫 출발점: 격자128/물감1024/압력20/소용돌이20~28/감쇠0.96~0.985)
  const cfg = {
    sim: isTouch ? 96 : 128,
    dye: isTouch ? 512 : 1024,
    iterations: 20,
    curl: 22,
    pressure: 0.8,
    velDiss: 0.9,        // 속도 감쇠(1/s)
    inkDiss: 0.16,       // 먹 감쇠(1/s) → 프레임당 0.9973, 6초 뒤 약 38% 남음
    emberDiss: 3.6,      // 불씨는 빨리 꺼진다
    buoy: 32,            // 위로 뜨는 힘
    brush: 0.055,        // 붓 반경(작게)
    force: 3200,
    inkK: 1.25, inkMax: 0.76, emberK: 2.0,
  };

  let P;
  try {
    P = {
      clear: program(gl, VERT, CLEAR), splat: program(gl, VERT, SPLAT), advect: program(gl, VERT, ADVECT),
      buoy: program(gl, VERT, BUOY), divergence: program(gl, VERT, DIVERGENCE), curl: program(gl, VERT, CURL),
      vorticity: program(gl, VERT, VORTICITY), pressure: program(gl, VERT, PRESSURE), gradient: program(gl, VERT, GRADIENT),
      display: program(gl, VERT, DISPLAY),
    };
  } catch (err) {
    console.warn('ink: shader', err);
    return null;
  }

  const HALF = gl.HALF_FLOAT;
  const F = { rgba: [gl.RGBA16F, gl.RGBA], rg: [gl.RG16F, gl.RG], r: [gl.R16F, gl.RED] };
  function renderable([internal, format]) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, 4, 4, 0, format, HALF, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    gl.deleteTexture(tex);
    return ok;
  }
  if (!renderable(F.rgba)) return null;
  if (!renderable(F.rg)) F.rg = F.rgba;
  if (!renderable(F.r)) F.r = F.rgba;

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  function target(w, h, [internal, format], filter) {
    gl.activeTexture(gl.TEXTURE0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, HALF, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      tex, fbo, w, h,
      attach(unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); return unit; },
      dispose() { gl.deleteFramebuffer(fbo); gl.deleteTexture(tex); },
    };
  }
  function pair(w, h, format, filter) {
    let a = target(w, h, format, filter);
    let b = target(w, h, format, filter);
    return { w, h, get read() { return a; }, get write() { return b; }, swap() { const t = a; a = b; b = t; }, dispose() { a.dispose(); b.dispose(); } };
  }
  function resolution(base) {
    let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1 / aspect;
    const min = Math.round(base);
    const max = Math.round(base * aspect);
    return gl.drawingBufferWidth > gl.drawingBufferHeight ? [max, min] : [min, max];
  }

  let dye, velocity, divergence, curl, pressure;
  let size = [0, 0];
  const mask = [0, 0, 0, 0];
  let maskEl = null;

  function measureMask() {
    if (!maskEl) return;
    const c = canvas.getBoundingClientRect();
    const r = maskEl.getBoundingClientRect();
    if (!c.width || !c.height) return;
    const padX = 28, padY = 18;
    mask[0] = (r.left - padX - c.left) / c.width;
    mask[2] = (r.right + padX - c.left) / c.width;
    mask[1] = 1 - (r.bottom + padY - c.top) / c.height;
    mask[3] = 1 - (r.top - padY - c.top) / c.height;
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    measureMask();
    if (w === size[0] && h === size[1]) return false;
    size = [w, h];
    canvas.width = w;
    canvas.height = h;
    [dye, velocity, divergence, curl, pressure].forEach((t) => t && t.dispose());
    const [sw, sh] = resolution(cfg.sim);
    const [dw, dh] = resolution(cfg.dye);
    dye = pair(dw, dh, F.rgba, gl.LINEAR);
    velocity = pair(sw, sh, F.rg, gl.LINEAR);
    divergence = target(sw, sh, F.r, gl.NEAREST);
    curl = target(sw, sh, F.r, gl.NEAREST);
    pressure = pair(sw, sh, F.r, gl.NEAREST);
    return true;
  }

  function blit(dest) {
    if (dest) { gl.viewport(0, 0, dest.w, dest.h); gl.bindFramebuffer(gl.FRAMEBUFFER, dest.fbo); }
    else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }
  function use(p, tw, th) {
    gl.useProgram(p.program);
    if (p.uniforms.uTexel) gl.uniform2f(p.uniforms.uTexel, 1 / tw, 1 / th);
    return p.uniforms;
  }
  const aspect = () => canvas.width / canvas.height;
  function radius(r) { const a = aspect(); return (a > 1 ? r * a : r) / 100; }

  // x,y: 0..1 (y 위쪽이 1) / dx,dy: 속도 / ink: [먹, 불씨]
  function splat(x, y, dx, dy, ink, emb, r = cfg.brush) {
    let u = use(P.splat, velocity.w, velocity.h);
    gl.uniform1i(u.uTarget, velocity.read.attach(0));
    gl.uniform1f(u.uAspect, aspect());
    gl.uniform2f(u.uPoint, x, y);
    gl.uniform3f(u.uColor, dx, dy, 0);
    gl.uniform1f(u.uRadius, radius(r * 1.6));
    blit(velocity.write);
    velocity.swap();
    if (ink <= 0 && emb <= 0) return;
    u = use(P.splat, dye.w, dye.h);
    gl.uniform1i(u.uTarget, dye.read.attach(0));
    gl.uniform1f(u.uAspect, aspect());
    gl.uniform2f(u.uPoint, x, y);
    gl.uniform3f(u.uColor, ink, emb, 0);
    gl.uniform1f(u.uRadius, radius(r));
    blit(dye.write);
    dye.swap();
  }

  let time = 0;
  function simulate(dt) {
    gl.disable(gl.BLEND);
    const sw = velocity.w, sh = velocity.h;

    let u = use(P.buoy, sw, sh);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uDye, dye.read.attach(1));
    gl.uniform1f(u.uBuoy, cfg.buoy);
    gl.uniform1f(u.uDt, dt);
    gl.uniform1f(u.uTime, time);
    blit(velocity.write);
    velocity.swap();

    u = use(P.curl, sw, sh);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    blit(curl);

    u = use(P.vorticity, sw, sh);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uCurlMap, curl.attach(1));
    gl.uniform1f(u.uStrength, cfg.curl);
    gl.uniform1f(u.uDt, dt);
    blit(velocity.write);
    velocity.swap();

    u = use(P.divergence, sw, sh);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    blit(divergence);

    u = use(P.clear, sw, sh);
    gl.uniform1i(u.uTexture, pressure.read.attach(0));
    gl.uniform1f(u.uValue, cfg.pressure);
    blit(pressure.write);
    pressure.swap();

    u = use(P.pressure, sw, sh);
    gl.uniform1i(u.uDivergence, divergence.attach(0));
    for (let i = 0; i < cfg.iterations; i++) {
      gl.uniform1i(u.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    u = use(P.gradient, sw, sh);
    gl.uniform1i(u.uPressure, pressure.read.attach(0));
    gl.uniform1i(u.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    u = use(P.advect, sw, sh);
    gl.uniform2f(u.uStep, 1 / sw, 1 / sh);
    const v = velocity.read.attach(0);
    gl.uniform1i(u.uVelocity, v);
    gl.uniform1i(u.uSource, v);
    gl.uniform1f(u.uDt, dt);
    gl.uniform3f(u.uDissipation, cfg.velDiss, cfg.velDiss, cfg.velDiss);
    blit(velocity.write);
    velocity.swap();

    u = use(P.advect, dye.w, dye.h);
    gl.uniform2f(u.uStep, 1 / sw, 1 / sh);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uSource, dye.read.attach(1));
    gl.uniform1f(u.uDt, dt);
    gl.uniform3f(u.uDissipation, cfg.inkDiss, cfg.emberDiss, 1);
    blit(dye.write);
    dye.swap();
  }

  const INK = hex('#2B2926');
  const EMBER = hex('#F59744');
  function render() {
    gl.disable(gl.BLEND);
    const u = use(P.display, dye.w, dye.h);
    gl.uniform1i(u.uDye, dye.read.attach(0));
    gl.uniform4f(u.uMask, mask[0], mask[1], mask[2], mask[3]);
    gl.uniform1f(u.uMaskK, maskEl ? 0.78 : 0);
    gl.uniform3f(u.uInk, INK[0], INK[1], INK[2]);
    gl.uniform3f(u.uEmber, EMBER[0], EMBER[1], EMBER[2]);
    gl.uniform1f(u.uInkK, cfg.inkK);
    gl.uniform1f(u.uInkMax, cfg.inkMax);
    gl.uniform1f(u.uEmberK, cfg.emberK);
    blit(null);
  }

  // ---- 입력: 손이 지나가면 저어 주고(속도), 붓끝에 먹을 조금, 그 아래 불에서 연기를 더 올린다
  const pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, has: false, moved: false, speed: 0 };
  let lastInput = -10;
  let fan = 0;        // 손이 부채질한 만큼 불이 살아난다(0..1)
  let fanX = 0.5;

  function toLocal(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return [(cx - r.left) / r.width, 1 - (cy - r.top) / r.height, r];
  }
  function moveTo(cx, cy) {
    const [x, y, r] = toLocal(cx, cy);
    if (x < 0 || x > 1 || y < 0 || y > 1) { pointer.has = false; return; }
    if (!pointer.has) { pointer.x = pointer.px = x; pointer.y = pointer.py = y; pointer.has = true; return; }
    pointer.x = x;
    pointer.y = y;
    pointer.moved = true;
    lastInput = time;
  }
  host.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') moveTo(e.clientX, e.clientY); }, { passive: true });
  host.addEventListener('pointerleave', () => { pointer.has = false; }, { passive: true });
  host.addEventListener('touchstart', (e) => { pointer.has = false; moveTo(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  host.addEventListener('touchmove', (e) => { moveTo(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

  function inputStep() {
    if (!pointer.moved) return;
    pointer.moved = false;
    let dx = pointer.x - pointer.px;
    let dy = pointer.y - pointer.py;
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    const a = aspect();
    const dist = Math.hypot(dx * a, dy);
    if (dist < 1e-5) return;
    if (a < 1) dx *= a; else dy /= a;
    const ink = Math.min(dist * 5, 0.24);
    splat(pointer.x, pointer.y, dx * cfg.force, dy * cfg.force, ink, 0, cfg.brush);
    fan = Math.min(1, fan + dist * 3.2);
    fanX += (pointer.x - fanX) * 0.5;
  }

  // 불: 화면 아래 가운데(작은 지붕 아래)에서 저절로 피어오르는 연기 + 손 아래쪽 불
  function fireStep(dt) {
    const t = time;
    const puff = Math.max(0, Math.sin(t * 0.9) * 0.6 + Math.sin(t * 0.37 + 1.2) * 0.4);
    const idle = time - lastInput > 2.4 ? 1 : 0.55;
    const x = 0.5 + Math.sin(t * 0.53) * 0.012 + Math.sin(t * 1.9) * 0.004;
    const amt = (0.012 + 0.03 * puff) * idle * (isTouch ? 0.6 : 1);
    splat(x, 0.012, Math.sin(t * 1.3) * 2.5, 7 + puff * 6, amt, 0.011 * (0.3 + puff) * idle, 0.055);
    if (fan > 0.01) {
      const fx = Math.min(0.92, Math.max(0.08, fanX));
      splat(fx, 0.01, 0, 14 * fan, 0.05 * fan, 0.018 * fan, 0.06);
      fan *= Math.exp(-dt * 1.6);
    }
  }

  const STEP = 1 / 60;
  let acc = 0;
  let started = false;
  function update(dt) {
    if (!dye) return;
    acc = Math.min(acc + dt, STEP * 3);
    let stepped = false;
    while (acc >= STEP) {
      time += STEP;
      inputStep();
      fireStep(STEP);
      simulate(STEP);
      acc -= STEP;
      stepped = true;
    }
    if (stepped || !started) { render(); started = true; }
  }

  function prewarm(seconds) {
    if (!dye) return;
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) { time += STEP; fireStep(STEP); simulate(STEP); }
    render();
  }

  return {
    resize() { const changed = layout(); if (changed) prewarm(isTouch ? 2.6 : 3.2); else render(); },
    update,
    prewarm,
    setMask(el) { maskEl = el; measureMask(); },
    measure: measureMask,
    get info() { return { grid: velocity ? [velocity.w, velocity.h] : [0, 0], dye: dye ? [dye.w, dye.h] : [0, 0], cfg }; },
  };
}
