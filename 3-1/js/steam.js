const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v;
uniform float uT;
uniform vec2 uRes;
uniform vec3 uM;

float hash(float n){ return fract(sin(n * 127.1) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i.x + i.y * 57.0);
  float b = hash(i.x + 1.0 + i.y * 57.0);
  float c = hash(i.x + (i.y + 1.0) * 57.0);
  float d = hash(i.x + 1.0 + (i.y + 1.0) * 57.0);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main(){
  float asp = uRes.x / uRes.y;
  float X = v.x * asp;
  float acc = 0.0;
  for (int k = 0; k < 12; k++) {
    float fk = float(k);
    float period = 3.2 + hash(fk * 3.1) * 1.8;
    float tt = uT + hash(fk * 7.7) * period;
    float cyc = floor(tt / period);
    float ph = fract(tt / period);
    float seed = fk * 13.0 + cyc * 7.0;
    float sx = (0.14 + 0.72 * hash(seed + 0.3)) * asp;
    float sy = 0.12 + 0.46 * hash(seed + 1.9);
    float u = (v.y - sy) / 0.25;
    if (u < 0.0 || u > 1.0) continue;
    float rise = u - ph * 0.6;
    float wob = (noise(vec2(u * 2.2 + seed, uT * 0.35)) - 0.5) * 0.09 * u + sin(u * 7.0 + uT * 1.4 + seed) * 0.014 * u;
    float cx = sx + wob;
    vec2 m = vec2(uM.x * asp, uM.y);
    vec2 dm = vec2(cx, v.y) - m;
    float push = exp(-dot(dm, dm) / 0.012) * uM.z;
    cx += sign(dm.x + 0.0001) * push * 0.07;
    float w = 0.005 + 0.016 * u;
    float d = (X - cx) / w;
    float core = exp(-d * d);
    float puff = 0.45 + 0.55 * noise(vec2(rise * 6.0, seed));
    float fade = smoothstep(0.0, 0.1, u) * (1.0 - smoothstep(0.45, 1.0, u));
    float life = sin(3.14159 * ph);
    acc += core * puff * fade * life;
  }
  float a = min(acc * 0.35, 0.35);
  gl_FragColor = vec4(vec3(a), a);
}`;

export function createSteam(canvas, host) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
  gl.useProgram(pr);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uT = gl.getUniformLocation(pr, 'uT');
  const uRes = gl.getUniformLocation(pr, 'uRes');
  const uM = gl.getUniformLocation(pr, 'uM');
  gl.disable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  let w = 0;
  let h = 0;
  let t = 0;
  const ptr = { x: 0.5, y: -1, tx: 0.5, ty: -1, z: 0, tz: 0 };
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * 0.75;
    const nw = Math.max(2, Math.round(r.width * dpr));
    const nh = Math.max(2, Math.round(r.height * dpr));
    if (nw === w && nh === h) return;
    w = nw; h = nh;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  resize();
  const target = host || canvas;
  const setPtr = (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.tx = (e.clientX - r.left) / r.width;
    ptr.ty = 1 - (e.clientY - r.top) / r.height;
    ptr.tz = 1;
  };
  target.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') setPtr(e); }, { passive: true });
  target.addEventListener('pointerdown', setPtr, { passive: true });
  target.addEventListener('pointerleave', () => { ptr.tz = 0; });
  target.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') ptr.tz = 0; });
  function frame(dt) {
    t += dt;
    if (ptr.y < -0.5 && ptr.ty > -0.5) { ptr.x = ptr.tx; ptr.y = ptr.ty; }
    const k = 1 - Math.exp(-dt * 9);
    ptr.x += (ptr.tx - ptr.x) * k;
    ptr.y += (ptr.ty - ptr.y) * k;
    ptr.z += (ptr.tz - ptr.z) * (1 - Math.exp(-dt * 4));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uT, t);
    gl.uniform2f(uRes, w, h);
    gl.uniform3f(uM, ptr.x, ptr.y, ptr.z);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  return { frame, resize };
}
