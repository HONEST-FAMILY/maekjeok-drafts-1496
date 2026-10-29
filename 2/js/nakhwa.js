// 낙화(烙畵) — 달군 인두로 한지를 그을려 그리는 장면
// 열 누적 장(Float32) 위에 인두가 가우스 모양으로 열을 더하고, 누적값을 3단 갈변(+선 자리 숯)으로 칠한다.
// 벽화의 어두운 선 자리는 더 빨리 그을려서, 문지를수록 357년 부엌 벽화가 떠오른다.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const NK = {
  radiusFrac: 0.04, radiusMin: 24, radiusMax: 70, // 인두 반경 = 무대 폭 4%
  pass: 0.35,      // 보통 빠르기로 한 번 지날 때 쌓이는 열
  base: 0.82,      // 바탕(벽화 선이 없는 곳)의 그을림 빠르기 → 세 번이면 짙은 갈 문턱
  lineGain: 1.0,   // 벽화 선 자리 = 0.82 + 1.0 = 1.82 (바탕의 약 2.2배)
  cap: 1.3,        // 바탕은 짙은 갈에서 멈춤(선 자리만 숯까지)
  th: [0.175, 0.525, 0.875, 1.47], // 연갈 · 갈 · 짙은 갈 · 숯 문턱
  w: 0.075,        // 단계 경계의 부드러움
  speedPC: 700, speedTouch: 450, // '보통 빠르기'(px/s)
  demoDur: 2.5, demoHeat: 0.9, // 시범 인두: 2.5초, 지나간 자리 누적 0.9(바탕 갈 + 선은 숯)
  follow: 30,      // 인두가 손을 따라가는 빠르기 1-exp(-dt*k)
  dwell: 0.9,      // 멈춘 채 이 시간이 지나면 인두를 든다(초)
};

// 곱하기 색 — 한지(약 #E5D9C2) 위에 곱해지면 목표색이 되도록 맞춘 값
const STOPS = [
  [255, 255, 255], // 그대로
  [226, 168, 104], // 연갈  ≈ #C68A4E
  [150, 96, 56],   // 갈    ≈ #7A4A28
  [92, 58, 36],    // 짙은 갈 ≈ 먹색 75% 수준
  [26, 16, 10],    // 숯(벽화 선 자리만)
];

function buildLUT() {
  const N = 1024, VMAX = 2.4;
  const lut = new Uint8ClampedArray(N * 3);
  for (let i = 0; i < N; i++) {
    const v = (i / (N - 1)) * VMAX;
    let stage = 0;
    for (const x of NK.th) stage += sstep(x - NK.w, x + NK.w, v);
    // 첫 단계 전에도 아주 옅게 누렇게 — 손이 닿은 걸 알 수 있게
    stage += 0.25 * sstep(0.02, NK.th[0], v) * (1 - sstep(NK.th[0] - NK.w, NK.th[0] + NK.w, v));
    // 단계 안에서도 조금씩 진해지게(평평한 판처럼 보이지 않게)
    const cont = clamp(v / NK.pass, 0, 4);
    const t = clamp(stage * 0.86 + cont * 0.14, 0, 4);
    const k = Math.min(3, Math.floor(t)), f = t - k;
    const a = STOPS[k], b = STOPS[k + 1];
    lut[i * 3] = a[0] + (b[0] - a[0]) * f;
    lut[i * 3 + 1] = a[1] + (b[1] - a[1]) * f;
    lut[i * 3 + 2] = a[2] + (b[2] - a[2]) * f;
  }
  return { lut, N, scale: (N - 1) / VMAX };
}

// 고정 씨앗 난수(그림이 매번 같게)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

// 표지 맞춤(cover) — 초점(fx, fy)을 기준으로 잘라낼 원본 영역
function coverSrc(iw, ih, w, h, fx, fy) {
  const ar = w / h, iar = iw / ih;
  if (ar > iar) {
    const sh = iw / ar;
    return [0, (ih - sh) * fy, iw, sh];
  }
  const sw = ih * ar;
  return [(iw - sw) * fx, 0, sw, ih];
}

export function createNakhwa(stage, opts = {}) {
  const { reduceMotion = false, isTouch = false, muralSrc, tileSrc, onFirstBurn } = opts;
  const paper = stage.querySelector('.nk__paper');
  const burn = stage.querySelector('.nk__burn');
  const fx = stage.querySelector('.nk__fx');
  const pctx = paper.getContext('2d');
  const bctx = burn.getContext('2d', { willReadFrequently: false });
  const fctx = fx.getContext('2d');
  if (!pctx || !bctx || !fctx) throw new Error('canvas 2d 불가');

  const { lut, N: LN, scale: LS } = buildLUT();
  const debugInk = /nkdebug/.test(location.search);

  let mural = null, tile = null;
  let W = 0, H = 0, dpr = 1, cs = 2, fw = 0, fh = 0;
  let rect = null; // 한지 사각형(CSS px)
  let heat = null, ink = null, grain = null, mask = null, img = null;
  let radius = 40, sigma = 20, portrait = false;
  let dirty = null;
  let ready = false;

  const iron = { x: 0, y: 0, tx: 0, ty: 0, on: false, act: 0, shown: 0, still: 0, down: false, mouse: false };
  const demo = { t: -1, pts: null, len: null, total: 0, R: 0 };
  let fade = -1; // 다시 굽기: 열이 식는 중
  let burnedByUser = 0, firstFired = false;
  const smoke = []; // 연기 가닥: {pts:[{x,y,vx,vy,age,seed}], born}
  let emitAcc = 0, strandAge = 0, strand = null;
  let fxDirty = false;
  let acc = 0;

  // ───────── 준비 ─────────
  const loaded = Promise.all([loadImage(muralSrc), loadImage(tileSrc)]).then(([m, t]) => {
    mural = m; tile = t;
    build();
    ready = true;
    startDemo();
  });

  function build() {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    portrait = W / H < 1.1;
    cs = W >= 700 ? 2 : 1.5; // 열 장 한 칸 = 2px(넓은 화면) / 1.5px(폰)
    fw = Math.ceil(W / cs);
    fh = Math.ceil(H / cs);
    radius = clamp(W * NK.radiusFrac, NK.radiusMin, NK.radiusMax);
    sigma = radius / 2;

    const pad = portrait ? 6 : Math.max(8, Math.round(W * 0.006));
    rect = { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 };

    paper.width = Math.round(W * dpr);
    paper.height = Math.round(H * dpr);
    fx.width = paper.width;
    fx.height = paper.height;
    burn.width = fw;
    burn.height = fh;

    heat = new Float32Array(fw * fh);
    buildMaskAndInk();
    buildGrain();
    drawPaper();
    img = bctx.createImageData(fw, fh);
    img.data.fill(255);
    if (debugInk) {
      for (let i = 0; i < fw * fh; i++) {
        const g = 255 - ink[i] * 220;
        img.data[i * 4] = g; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = g;
      }
    }
    bctx.putImageData(img, 0, 0);
    dirty = null;
    buildDemoPath();
  }

  // 한지 가장자리(손으로 뜬 종이처럼 살짝 울퉁불퉁)
  function deckle(ctx, s, ox = 0, oy = 0) {
    const r = rect, rand = rng(1496);
    const amp = 2.2, step = 7;
    ctx.beginPath();
    const edge = (x0, y0, x1, y1, first) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(2, Math.round(len / step));
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const o = (rand() - 0.5) * amp * (i === 0 || i === n ? 0 : 1);
        const x = (x0 + (x1 - x0) * t + nx * o) * s + ox;
        const y = (y0 + (y1 - y0) * t + ny * o) * s + oy;
        if (first && i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    };
    edge(r.x, r.y, r.x + r.w, r.y, true);
    edge(r.x + r.w, r.y, r.x + r.w, r.y + r.h, false);
    edge(r.x + r.w, r.y + r.h, r.x, r.y + r.h, false);
    edge(r.x, r.y + r.h, r.x, r.y, false);
    ctx.closePath();
  }

  function muralFocus() {
    // 가로 무대: 가운데, 세로 무대(폰): 부뚜막과 고기 걸이가 함께 들어오게
    return portrait ? [0.21, 0.5] : [0.5, 0.42];
  }

  function drawPaper() {
    const ctx = pctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, paper.width, paper.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 숯 바탕 위 그림자
    ctx.save();
    deckle(ctx, 1);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#E8DDC6';
    ctx.fill();
    ctx.restore();

    ctx.save();
    deckle(ctx, 1);
    ctx.clip();
    ctx.fillStyle = '#F2E7CF';
    ctx.fillRect(0, 0, W, H);
    // 한지 결: 800px 타일을 화면에서 400px로
    const tc = document.createElement('canvas');
    const ts = Math.round(400 * dpr);
    tc.width = ts; tc.height = ts;
    tc.getContext('2d').drawImage(tile, 0, 0, ts, ts);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = ctx.createPattern(tc, 'repeat');
    ctx.fillRect(0, 0, paper.width, paper.height);
    ctx.restore();
    // 한지 아래 비치는 벽화(아주 옅게)
    const [fxp, fyp] = muralFocus();
    const s = coverSrc(mural.width, mural.height, rect.w, rect.h, fxp, fyp);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.06;
    ctx.drawImage(mural, s[0], s[1], s[2], s[3], rect.x, rect.y, rect.w, rect.h);
    // 가장자리로 갈수록 조금 바랜 종이
    ctx.globalAlpha = 1;
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    const g = ctx.createRadialGradient(cx, cy, Math.min(rect.w, rect.h) * 0.25, cx, cy, Math.hypot(rect.w, rect.h) * 0.6);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(176,150,112,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function buildMaskAndInk() {
    const c = document.createElement('canvas');
    c.width = fw; c.height = fh;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const s = 1 / cs;
    // 한지 모양 마스크
    deckle(ctx, s);
    ctx.fillStyle = '#fff';
    ctx.fill();
    const md = ctx.getImageData(0, 0, fw, fh).data;
    mask = new Float32Array(fw * fh);
    for (let i = 0; i < fw * fh; i++) mask[i] = md[i * 4 + 3] / 255;

    // 벽화 → '미리 먹인 선'
    ctx.clearRect(0, 0, fw, fh);
    const [fxp, fyp] = muralFocus();
    const rx = rect.x * s, ry = rect.y * s, rw = rect.w * s, rh = rect.h * s;
    const src = coverSrc(mural.width, mural.height, rw, rh, fxp, fyp);
    ctx.drawImage(mural, src[0], src[1], src[2], src[3], rx, ry, rw, rh);
    const d = ctx.getImageData(0, 0, fw, fh).data;
    const n = fw * fh;
    const L = new Float32Array(n), red = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = d[i * 4] / 255, g = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255;
      L[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      red[i] = r - Math.max(g, b);
    }
    const M = boxBlur(boxBlur(L, fw, fh, Math.max(3, Math.round(7 / cs * 2))), fw, fh, Math.max(3, Math.round(7 / cs * 2)));
    ink = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const hp = sstep(0.035, 0.14, M[i] - L[i]);           // 둘레보다 어두운 곳 = 선
      const rd = sstep(0.13, 0.28, red[i]);                  // 붉은 안료(불·고기)만
      const dk = 0;
      ink[i] = clamp(Math.max(hp, rd) + dk, 0, 1);
    }
    // 선을 둥글게 한 칸 굵히고 잡티(얼룩 점)는 지움: 흐리게 → 대비 곡선
    const soft = boxBlur(ink, fw, fh, 1);
    for (let i = 0; i < n; i++) ink[i] = sstep(0.12, 0.62, ink[i] * 0.5 + soft[i] * 0.75) * mask[i];
    // 큰 숫자 '357' — 문지르면 낙인처럼 떠오른다
    ctx.clearRect(0, 0, fw, fh);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    let size, x, y;
    if (portrait) {
      size = rw * 0.44;
      ctx.font = `900 ${size}px "Pretendard Variable", Pretendard, sans-serif`;
      ctx.textAlign = 'center';
      x = rx + rw * 0.5; y = ry + rh * 0.955;
    } else {
      size = rh * 0.40;
      ctx.font = `900 ${size}px "Pretendard Variable", Pretendard, sans-serif`;
      ctx.textAlign = 'right';
      x = rx + rw * 0.965; y = ry + rh * 0.95;
    }
    ctx.fillText('357', x, y);
    const td = ctx.getImageData(0, 0, fw, fh).data;
    for (let i = 0; i < n; i++) {
      const a = td[i * 4 + 3] / 255;
      if (a > 0) ink[i] = Math.max(ink[i], a * 0.92 * mask[i]);
    }
  }

  function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    const inv = 1 / (r * 2 + 1);
    for (let y = 0; y < h; y++) {
      let acc = 0;
      const row = y * w;
      for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc * inv;
        acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc * inv;
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return out;
  }

  // 그을림이 고르지 않게 — 낮은 주파수 얼룩(0.86~1.14)
  function buildGrain() {
    const n = fw * fh, rand = rng(357);
    const g = 12;
    const gw = Math.ceil(fw / g) + 2, gh = Math.ceil(fh / g) + 2;
    const grid = new Float32Array(gw * gh);
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    grain = new Float32Array(n);
    for (let y = 0; y < fh; y++) {
      const gy = y / g, y0 = gy | 0, ty = sstep(0, 1, gy - y0);
      for (let x = 0; x < fw; x++) {
        const gx = x / g, x0 = gx | 0, tx = sstep(0, 1, gx - x0);
        const a = grid[y0 * gw + x0], b = grid[y0 * gw + x0 + 1];
        const c = grid[(y0 + 1) * gw + x0], d = grid[(y0 + 1) * gw + x0 + 1];
        const v = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
        grain[y * fw + x] = 0.86 + v * 0.28;
      }
    }
  }

  // ───────── 열 더하기 ─────────
  function stamp(cx, cy, amt) {
    const s = sigma / cs;
    const fxp = cx / cs, fyp = cy / cs;
    const r = Math.ceil(s * 2.6);
    const xa = Math.max(0, Math.floor(fxp - r)), xb = Math.min(fw - 1, Math.ceil(fxp + r));
    const ya = Math.max(0, Math.floor(fyp - r)), yb = Math.min(fh - 1, Math.ceil(fyp + r));
    if (xa > xb || ya > yb) return 0;
    const inv = 1 / (2 * s * s), r2 = r * r;
    let added = 0;
    for (let y = ya; y <= yb; y++) {
      const dy = y + 0.5 - fyp;
      let i = y * fw + xa;
      for (let x = xa; x <= xb; x++, i++) {
        const dx = x + 0.5 - fxp;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const m = mask[i];
        if (m <= 0) continue;
        const h0 = heat[i];
        if (h0 >= NK.cap) continue;
        const h1 = Math.min(NK.cap, h0 + amt * Math.exp(-d2 * inv) * m);
        heat[i] = h1;
        added += h1 - h0;
      }
    }
    if (!dirty) dirty = [xa, ya, xb + 1, yb + 1];
    else {
      if (xa < dirty[0]) dirty[0] = xa;
      if (ya < dirty[1]) dirty[1] = ya;
      if (xb + 1 > dirty[2]) dirty[2] = xb + 1;
      if (yb + 1 > dirty[3]) dirty[3] = yb + 1;
    }
    return added;
  }

  // 선분을 따라 여러 번 찍어 빠른 손놀림에도 끊기지 않게 (dt 기준 → 느릴수록 더 탄다)
  function burnSegment(x0, y0, x1, y1, amount) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(dist / (sigma * 0.35)));
    let added = 0;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      added += stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, amount / n);
    }
    return added;
  }

  function renderRect(x0, y0, x1, y1) {
    if (debugInk) return;
    const data = img.data;
    for (let y = y0; y < y1; y++) {
      let i = y * fw + x0;
      for (let x = x0; x < x1; x++, i++) {
        const v = heat[i] * (NK.base + NK.lineGain * ink[i]) * grain[i];
        let li = (v * LS) | 0;
        if (li > LN - 1) li = LN - 1;
        const o = i << 2, l = li * 3;
        data[o] = lut[l];
        data[o + 1] = lut[l + 1];
        data[o + 2] = lut[l + 2];
      }
    }
    bctx.putImageData(img, 0, 0, x0, y0, x1 - x0, y1 - y0);
  }

  // ───────── 시범 인두(S자) ─────────
  function buildDemoPath() {
    const wp = portrait
      ? [[0.30, 0.06], [0.72, 0.22], [0.80, 0.40], [0.50, 0.50], [0.20, 0.58], [0.26, 0.74], [0.56, 0.84], [0.80, 0.90]]
      : [[0.04, 0.30], [0.16, 0.52], [0.26, 0.60], [0.38, 0.47], [0.47, 0.42], [0.57, 0.56], [0.70, 0.78], [0.86, 0.80], [0.97, 0.70]];
    const P = wp.map(([u, v]) => [rect.x + u * rect.w, rect.y + v * rect.h]);
    const pts = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (let k = 0; k < 24; k++) {
        const t = k / 24, t2 = t * t, t3 = t2 * t;
        pts.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    pts.push(P[P.length - 1]);
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    demo.pts = pts; demo.len = len; demo.total = len[len.length - 1];
    // 지나간 자리 누적이 demoHeat 이 되도록: 누적 = R·√(2π)·σ / 속도
    const speed = demo.total / NK.demoDur;
    demo.R = NK.demoHeat * speed / (Math.sqrt(2 * Math.PI) * sigma);
  }

  function demoAt(s) {
    const d = clamp(s, 0, 1) * demo.total, L = demo.len, P = demo.pts;
    let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < d) lo = m; else hi = m; }
    const t = (d - L[lo]) / Math.max(1e-6, L[hi] - L[lo]);
    return [P[lo][0] + (P[hi][0] - P[lo][0]) * t, P[lo][1] + (P[hi][1] - P[lo][1]) * t];
  }

  function startDemo() {
    if (!ready) return;
    if (reduceMotion) {
      // 움직임 줄이기: 시범 자국만 한 번에 남긴다
      let [px, py] = demoAt(0);
      const steps = 240;
      for (let k = 1; k <= steps; k++) {
        const [x, y] = demoAt(k / steps);
        burnSegment(px, py, x, y, demo.R * (NK.demoDur / steps));
        px = x; py = y;
      }
      flush();
      return;
    }
    demo.t = 0;
    const [x, y] = demoAt(0);
    iron.x = iron.tx = x; iron.y = iron.ty = y;
  }

  // ───────── 입력 ─────────
  function local(e) {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  function onEnter(e) {
    if (e.pointerType !== 'mouse') return;
    const [x, y] = local(e);
    iron.mouse = true;
    iron.on = true;
    iron.x = iron.tx = x; iron.y = iron.ty = y;
    iron.still = 0;
  }
  function onMove(e) {
    const [x, y] = local(e);
    if (e.pointerType === 'mouse') {
      if (!iron.on) onEnter(e);
      iron.down = (e.buttons & 1) === 1;
    } else if (!iron.on) return;
    if (Math.hypot(x - iron.tx, y - iron.ty) > 0.5) iron.still = 0;
    iron.tx = x; iron.ty = y;
  }
  function onDown(e) {
    const [x, y] = local(e);
    if (e.pointerType !== 'mouse') {
      iron.on = true; iron.mouse = false;
      iron.x = iron.tx = x; iron.y = iron.ty = y;
      try { stage.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
    } else {
      iron.down = true;
    }
    iron.still = 0;
    if (demo.t >= 0) demo.t = -1; // 손이 닿으면 시범은 바로 멈춘다
  }
  function onUp(e) {
    if (e.pointerType === 'mouse') { iron.down = false; return; }
    iron.on = false;
  }
  function onLeave(e) {
    if (e.pointerType === 'mouse') { iron.on = false; iron.down = false; }
  }
  stage.addEventListener('pointerenter', onEnter);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  stage.addEventListener('pointerleave', onLeave);

  // ───────── 연기 ─────────
  function emitSmoke(h, strength) {
    if (reduceMotion) return;
    strandAge += h;
    if (!strand || strandAge > 0.42) {
      strand = { pts: [] };
      smoke.push(strand);
      strandAge = 0;
      if (smoke.length > 9) smoke.shift();
    }
    emitAcc += h * (18 + 26 * strength);
    while (emitAcc >= 1) {
      emitAcc -= 1;
      strand.pts.push({ x: iron.x, y: iron.y - 3, vx: (Math.random() - 0.5) * 8, vy: -(26 + Math.random() * 22), age: 0, seed: Math.random() * 6.28 });
    }
  }
  function stepSmoke(h) {
    for (const s of smoke) {
      for (const p of s.pts) {
        p.age += h;
        p.vx += Math.sin(p.age * 3.1 + p.seed) * 22 * h;
        p.x += p.vx * h;
        p.y += p.vy * h;
        p.vy *= 1 - 0.35 * h;
      }
      while (s.pts.length && s.pts[0].age > 1.6) s.pts.shift();
    }
    for (let i = smoke.length - 1; i >= 0; i--) if (!smoke[i].pts.length && smoke[i] !== strand) smoke.splice(i, 1);
  }

  // ───────── 갱신(60Hz 고정 스텝) ─────────
  function physics(h) {
    if (fade >= 0) {
      fade += h;
      const k = Math.exp(-h * 9);
      for (let i = 0; i < heat.length; i++) heat[i] *= k;
      dirty = [0, 0, fw, fh];
      if (fade > 0.5) {
        heat.fill(0);
        fade = -1;
        startDemo();
      }
      return;
    }
    let act = 0;
    if (demo.t >= 0) {
      demo.t += h / NK.demoDur;
      const [x, y] = demoAt(demo.t);
      iron.tx = x; iron.ty = y;
      act = 1;
      if (demo.t >= 1) { demo.t = -1; }
    } else if (iron.on) {
      iron.still += h;
      act = iron.still > NK.dwell ? 0 : 1;
      if (iron.mouse && iron.down) act *= 1.5;
    }
    const a = 1 - Math.exp(-h * NK.follow);
    const px = iron.x, py = iron.y;
    iron.x += (iron.tx - iron.x) * a;
    iron.y += (iron.ty - iron.y) * a;
    const showing = demo.t >= 0 || iron.on;
    iron.shown += ((showing ? 1 : 0) - iron.shown) * (1 - Math.exp(-h * 12));
    iron.act += (act - iron.act) * (1 - Math.exp(-h * 14));
    if (iron.act > 0.02) {
      const R = demo.t >= 0
        ? demo.R
        : NK.pass * (isTouch ? NK.speedTouch : NK.speedPC) / (Math.sqrt(2 * Math.PI) * sigma);
      const added = burnSegment(px, py, iron.x, iron.y, R * h * iron.act);
      emitSmoke(h, clamp(iron.act, 0, 1));
      if (demo.t < 0 && iron.on) {
        burnedByUser += added;
        if (!firstFired && burnedByUser > 40) { firstFired = true; onFirstBurn && onFirstBurn(); }
      }
    } else {
      strand = null;
    }
    stepSmoke(h);
  }

  function flush() {
    if (!dirty) return;
    renderRect(dirty[0], dirty[1], Math.min(fw, dirty[2]), Math.min(fh, dirty[3]));
    dirty = null;
  }

  function drawFx() {
    const ctx = fctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, fx.width, fx.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 연기 몇 가닥(위로)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of smoke) {
      const p = s.pts;
      if (p.length < 3) continue;
      // 가닥마다 한 번에 그려 이음매 얼룩이 없게(나이 든 쪽 → 굵고 옅게)
      for (let part = 0; part < 2; part++) {
        const a = part === 0 ? 0 : Math.floor(p.length / 2) - 1;
        const b = part === 0 ? Math.floor(p.length / 2) : p.length - 1;
        if (b - a < 2) continue;
        let age = 0;
        for (let i = a; i <= b; i++) age += p[i].age;
        age /= b - a + 1;
        const life = Math.max(0, 1 - age / 1.6);
        ctx.strokeStyle = `rgba(80,68,58,${(0.3 * life * Math.min(1, 0.35 + age * 4)).toFixed(3)})`;
        ctx.lineWidth = 2.5 + age * 12;
        ctx.beginPath();
        ctx.moveTo(p[a].x, p[a].y);
        for (let i = a + 1; i < b; i++) {
          const mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2;
          ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my);
        }
        ctx.lineTo(p[b].x, p[b].y);
        ctx.stroke();
      }
    }
    // 인두 끝 불씨
    if (iron.shown > 0.02) {
      const x = iron.x, y = iron.y, a = iron.shown;
      const flick = 0.9 + Math.sin(performance.now() * 0.023) * 0.06 + Math.sin(performance.now() * 0.051) * 0.04;
      const r = 26 * flick;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(245,151,68,${(0.75 * a).toFixed(3)})`);
      g.addColorStop(0.4, `rgba(245,151,68,${(0.3 * a).toFixed(3)})`);
      g.addColorStop(1, 'rgba(245,151,68,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(214,9,9,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(245,151,68,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function update(dt) {
    if (!ready) return;
    acc = Math.min(acc + dt * 60, 4);
    let stepped = false;
    while (acc >= 1) {
      physics(1 / 60);
      acc -= 1;
      stepped = true;
    }
    if (!stepped) return;
    flush();
    const live = iron.shown > 0.02 || smoke.some((s) => s.pts.length);
    if (live || fxDirty) {
      drawFx();
      fxDirty = live;
    }
  }

  function reset() {
    if (!ready) return;
    demo.t = -1;
    fade = 0;
  }

  function resize() {
    if (!ready) return;
    const r = stage.getBoundingClientRect();
    if (Math.round(r.width) === W && Math.abs(Math.round(r.height) - H) < 2) return;
    build();
    startDemo();
  }

  // 검수용: 현재 숫자와 상태
  function stats() {
    let s1 = 0, s2 = 0, s3 = 0;
    for (let i = 0; i < heat.length; i++) {
      const v = heat[i] * (NK.base + NK.lineGain * ink[i]);
      if (v > NK.th[2]) s3++; else if (v > NK.th[1]) s2++; else if (v > NK.th[0]) s1++;
    }
    return { W, H, fw, fh, cs, radius: Math.round(radius), sigma: Math.round(sigma), stage1: s1, stage2: s2, stage3: s3, demoR: +demo.R.toFixed(2) };
  }

  return { update, reset, resize, loaded, stats, get ready() { return ready; } };
}
