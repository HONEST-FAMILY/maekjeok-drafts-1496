/* 맥적 3안 — 시그니처 '한 쌈 싸기' (마티스 컷아웃 처방)
   조각을 잡아 끌어 고기 위에 놓으면 스프링으로 자리 잡고 살짝 눌림(0.96→1).
   놓친 조각은 관성으로 미끄러지다 멈춤(벽 튕김 약하게). 탭하면 쌈 위로 날아감.
   rAF 루프 1개, 보일 때만 돈다. 물리 60Hz 고정 스텝 + 보간. */
(() => {
  'use strict';
  const stage = document.getElementById('ssamStage');
  if (!stage) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const meatEl = stage.querySelector('.ssam-meat');
  const doneEl = document.getElementById('ssamDone');
  const againEl = document.getElementById('ssamAgain');
  const countEl = document.getElementById('ssamN');
  const legend = {};
  document.querySelectorAll('.ssam-legend li').forEach((li) => { legend[li.dataset.key] = li; });

  /* 원본 픽셀 크기 — 한 배율로 줄여 실제 크기 비율을 지킨다(깻잎 최대, 파인애플 최소) */
  const NAT = { kkaennip: [506, 712], paprika: [231, 542], pineapple: [317, 345], mu: [269, 498], cabbage: [481, 522] };
  /* 쌈 위 자리(고기 반지름 R 단위) · 각도 · 쌓임. 깻잎은 고기 아래 = 쌈 바닥 */
  const SLOT = {
    kkaennip: { x: -0.40, y: -0.42, r: -36, z: 1 },
    cabbage: { x: 0.14, y: -0.24, r: 8, z: 4 },
    mu: { x: -0.40, y: 0.10, r: -50, z: 5 },
    paprika: { x: 0.46, y: 0.16, r: 30, z: 6 },
    pineapple: { x: 0.08, y: 0.46, r: 12, z: 7 },
  };
  /* 처음 자리(무대 비율) — 넓은 무대 / 정사각 무대 */
  const HOME_WIDE = {
    kkaennip: [0.14, 0.50, -10], pineapple: [0.36, 0.16, 14], cabbage: [0.80, 0.30, 0],
    mu: [0.80, 0.74, 62], paprika: [0.36, 0.84, 84],
  };
  const HOME_SQ = {
    kkaennip: [0.19, 0.22, -10], pineapple: [0.50, 0.12, 14], cabbage: [0.81, 0.19, 0],
    mu: [0.19, 0.81, 62], paprika: [0.81, 0.81, 84],
  };

  /* 물리 상수 */
  const DT = 1 / 60;
  const K_SLOT = 200, Z_SLOT = 0.8;       // 쌈 자리로 가는 스프링
  const K_HOME = 120, Z_HOME = 0.8;       // 제자리로 돌아가는 스프링
  const K_SCALE = 520, Z_SCALE = 0.34;    // 눌림 0.96 → 1 복원
  const FRICTION = 4.4;                   // 미끄러짐 감속(1/s)
  const BOUNCE = 0.32;                    // 벽 튕김(약하게)
  const FOLLOW = 30;                      // 끌 때 따라오기 1-exp(-dt*k)
  const MAX_V = 2600;

  const pieces = [...stage.querySelectorAll('.piece')].map((el, i) => ({
    el, key: el.dataset.key, i,
    w: 0, h: 0, x: 0, y: 0, r: 0, s: 1, vx: 0, vy: 0, vr: 0, vs: 0,
    px: 0, py: 0, pr: 0, ps: 1,
    hx: 0, hy: 0, hr: 0, gx: 0, gy: 0, tilt: 0,
    mode: 'home', placed: false, arrived: false, z: 8, zShown: -1,
    phase: i * 1.37 + 0.4,
  }));
  const byEl = new Map(pieces.map((p) => [p.el, p]));

  /* 그림이 없으면 같은 색의 원형 면만 보인다 */
  pieces.forEach((p) => {
    const img = p.el.querySelector('img');
    const ok = () => p.el.classList.add('has-img');
    const bad = () => p.el.classList.add('no-img');
    if (img.complete) { if (img.naturalWidth) ok(); else bad(); }
    img.addEventListener('load', ok);
    img.addEventListener('error', bad);
  });

  /* 가위로 오린 듯한 고기 테두리 */
  (() => {
    const n = 30, pts = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = 47.2 + rnd() * 2.8 - (k % 7 === 0 ? 1.6 : 0);
      pts.push(`${(50 + Math.cos(a) * rr).toFixed(2)}% ${(50 + Math.sin(a) * rr).toFixed(2)}%`);
    }
    meatEl.style.clipPath = `polygon(${pts.join(',')})`;
  })();

  let W = 0, H = 0, cx = 0, cy = 0, R = 0, S = 0;

  function halfExt(p, rot) {
    const a = rot * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    return [(p.w * c + p.h * s) / 2, (p.w * s + p.h * c) / 2];
  }
  function slotOf(p) {
    const sl = SLOT[p.key];
    return [cx + sl.x * R, cy + sl.y * R, sl.r];
  }

  function layout() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    W = w; H = h;
    const m = Math.min(W, H);
    const wide = W / H > 1.25;
    R = m * (wide ? 0.22 : 0.19);
    cx = W / 2; cy = H * (wide ? 0.5 : 0.5);
    S = (2 * R * 0.98) / 712;
    meatEl.style.width = meatEl.style.height = `${2 * R}px`;
    meatEl.style.transform = `translate3d(${cx - R}px, ${cy - R}px, 0) rotate(-8deg)`;
    const HOME = wide ? HOME_WIDE : HOME_SQ;
    pieces.forEach((p) => {
      p.w = NAT[p.key][0] * S; p.h = NAT[p.key][1] * S;
      p.el.style.width = `${p.w}px`; p.el.style.height = `${p.h}px`;
      const [fx, fy, fr] = HOME[p.key];
      const [ex, ey] = halfExt(p, fr);
      p.hx = Math.min(Math.max(fx * W, ex + 6), W - ex - 6);
      p.hy = Math.min(Math.max(fy * H, ey + 6), H - ey - 6);
      p.hr = fr;
      if (p.placed) {
        const [sx, sy, sr] = slotOf(p);
        p.x = sx; p.y = sy; p.r = sr; p.mode = 'slot'; p.arrived = true;
      } else {
        p.x = p.hx; p.y = p.hy; p.r = p.hr; p.mode = 'home';
      }
      p.vx = p.vy = p.vr = p.vs = 0; p.s = 1;
      p.px = p.x; p.py = p.y; p.pr = p.r; p.ps = p.s;
    });
    draw(1, 0);
  }

  /* ── 상태 ── */
  function placedCount() { return pieces.reduce((n, p) => n + (p.placed ? 1 : 0), 0); }
  function updateUI() {
    const n = placedCount();
    countEl.textContent = n;
    pieces.forEach((p) => {
      legend[p.key] && legend[p.key].classList.toggle('on', p.placed);
      p.el.classList.toggle('is-placed', p.placed);
      p.el.setAttribute('aria-disabled', p.placed ? 'true' : 'false');
    });
  }
  let doneTimer = 0;
  function checkDone() {
    if (pieces.every((p) => p.placed && p.arrived) && !doneEl.classList.contains('on')) {
      clearTimeout(doneTimer);
      doneTimer = setTimeout(() => doneEl.classList.add('on'), reduce ? 0 : 220);
    }
  }

  function toSlot(p, kick) {
    p.placed = true; p.arrived = false; p.mode = 'slot';
    p.z = SLOT[p.key].z;
    if (kick) {
      const [sx, sy] = slotOf(p);
      p.vx = (sx - p.x) * 1.25; p.vy = (sy - p.y) * 1.25 - 120; p.vr = 0;
    }
    if (reduce) {
      const [sx, sy, sr] = slotOf(p);
      p.x = p.px = sx; p.y = p.py = sy; p.r = p.pr = sr; p.vx = p.vy = p.vr = 0; p.arrived = true;
    }
    updateUI();
    checkDone();
    wake();
  }

  function resetAll() {
    clearTimeout(doneTimer);
    doneEl.classList.remove('on');
    pieces.forEach((p, i) => {
      p.placed = false; p.arrived = false; p.mode = 'home'; p.z = 8;
      p.vx = (i % 2 ? 1 : -1) * 120; p.vy = -220; p.vr = (i % 2 ? 1 : -1) * 60;
      if (reduce) { p.x = p.px = p.hx; p.y = p.py = p.hy; p.r = p.pr = p.hr; p.vx = p.vy = p.vr = 0; }
    });
    updateUI();
    wake();
  }
  againEl.addEventListener('click', resetAll);

  /* ── 입력: 조각을 잡았을 때만 막는다(그 외엔 페이지 스크롤) ── */
  let drag = null;
  function local(e) {
    const b = stage.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  }
  stage.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.piece');
    if (!el || drag) return;
    const p = byEl.get(el);
    if (!p || p.placed) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
    const [lx, ly] = local(e);
    drag = { p, id: e.pointerId, ox: p.x - lx, oy: p.y - ly, t0: performance.now(), sx: e.clientX, sy: e.clientY, moved: 0, samples: [[performance.now(), lx, ly]], vxp: 0 };
    p.mode = 'drag'; p.gx = p.x; p.gy = p.y; p.z = 30; p.tilt = 0;
    el.classList.add('is-drag');
    wake();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    const [lx, ly] = local(e);
    const p = drag.p;
    const [ex, ey] = halfExt(p, p.r);
    p.gx = Math.min(Math.max(lx + drag.ox, ex * 0.5), W - ex * 0.5);
    p.gy = Math.min(Math.max(ly + drag.oy, ey * 0.5), H - ey * 0.5);
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
    const now = performance.now();
    drag.samples.push([now, lx, ly]);
    while (drag.samples.length > 2 && now - drag.samples[0][0] > 90) drag.samples.shift();
  });
  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { p } = drag;
    p.el.classList.remove('is-drag');
    const now = performance.now();
    const quick = now - drag.t0 < 320 && drag.moved < 8;
    let vx = 0, vy = 0;
    const sm = drag.samples;
    if (sm.length > 1) {
      const a = sm[0], b = sm[sm.length - 1];
      const dt = Math.max((b[0] - a[0]) / 1000, 0.016);
      if (now - b[0] < 80) { vx = (b[1] - a[1]) / dt; vy = (b[2] - a[2]) / dt; }
    }
    const sp = Math.hypot(vx, vy);
    if (sp > MAX_V) { vx *= MAX_V / sp; vy *= MAX_V / sp; }
    drag = null;
    if (e.type === 'pointercancel') { p.mode = 'free'; p.z = 8; p.vx = 0; p.vy = 0; return; }
    if (quick) { toSlot(p, true); return; }
    if (Math.hypot(p.x - cx, p.y - cy) < R * 0.9) {
      p.vx = vx * 0.35; p.vy = vy * 0.35;
      toSlot(p, false);
      return;
    }
    p.mode = 'free'; p.z = 8;
    p.vx = vx; p.vy = vy; p.vr = vx * 0.06;
    wake();
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  /* 키보드: Enter/Space = 탭과 같다 */
  stage.addEventListener('click', (e) => {
    const el = e.target.closest('.piece');
    if (!el || e.detail !== 0) return;
    const p = byEl.get(el);
    if (p && !p.placed) toSlot(p, true);
  });

  /* ── 물리 한 스텝(60Hz 고정) ── */
  function springTo(p, tx, ty, tr, k, z) {
    const c = 2 * Math.sqrt(k) * z;
    p.vx += (k * (tx - p.x) - c * p.vx) * DT;
    p.vy += (k * (ty - p.y) - c * p.vy) * DT;
    p.vr += (k * (tr - p.r) - c * p.vr) * DT;
    p.x += p.vx * DT; p.y += p.vy * DT; p.r += p.vr * DT;
  }
  function step() {
    const ks = K_SCALE, cs = 2 * Math.sqrt(K_SCALE) * Z_SCALE;
    for (const p of pieces) {
      p.px = p.x; p.py = p.y; p.pr = p.r; p.ps = p.s;
      let sTarget = 1;
      if (p.mode === 'drag') {
        const f = 1 - Math.exp(-DT * FOLLOW);
        const nx = p.x + (p.gx - p.x) * f, ny = p.y + (p.gy - p.y) * f;
        const vxNow = (nx - p.x) / DT;
        p.vx = vxNow; p.vy = (ny - p.y) / DT;
        p.x = nx; p.y = ny;
        p.tilt += (Math.max(-12, Math.min(12, vxNow * 0.012)) - p.tilt) * (1 - Math.exp(-DT * 10));
        const baseR = p.hr;
        p.r += (baseR + p.tilt - p.r) * (1 - Math.exp(-DT * 12));
        sTarget = 1.06;
      } else if (p.mode === 'slot') {
        const [sx, sy, sr] = slotOf(p);
        springTo(p, sx, sy, sr, K_SLOT, Z_SLOT);
        const d = Math.hypot(sx - p.x, sy - p.y);
        if (!p.arrived && d < 6 && Math.hypot(p.vx, p.vy) < 300) {
          p.arrived = true;
          p.s = 0.96; p.vs = 0;               // 놓이는 순간 살짝 눌림
          checkDone();
        }
      } else if (p.mode === 'home') {
        springTo(p, p.hx, p.hy, p.hr, K_HOME, Z_HOME);
      } else if (p.mode === 'free') {
        const f = Math.exp(-DT * FRICTION);
        p.vx *= f; p.vy *= f; p.vr *= Math.exp(-DT * 3);
        p.x += p.vx * DT; p.y += p.vy * DT; p.r += p.vr * DT;
        const [ex, ey] = halfExt(p, p.r);
        if (p.x < ex) { p.x = ex; p.vx = Math.abs(p.vx) * BOUNCE; p.vr *= -0.5; }
        if (p.x > W - ex) { p.x = W - ex; p.vx = -Math.abs(p.vx) * BOUNCE; p.vr *= -0.5; }
        if (p.y < ey) { p.y = ey; p.vy = Math.abs(p.vy) * BOUNCE; }
        if (p.y > H - ey) { p.y = H - ey; p.vy = -Math.abs(p.vy) * BOUNCE; }
        if (Math.hypot(p.vx, p.vy) < 9) {
          p.vx = p.vy = p.vr = 0;
          if (Math.hypot(p.x - cx, p.y - cy) < R * 0.9) toSlot(p, false);
          else { p.mode = 'rest'; p.hx = p.x; p.hy = p.y; p.hr = p.r; }
        }
      }
      /* 눌림 복원 스프링 */
      p.vs += (ks * (sTarget - p.s) - cs * p.vs) * DT;
      p.s += p.vs * DT;
    }
  }

  /* ── 그리기(보간) ── */
  let tSec = 0;
  function draw(alpha, t) {
    for (const p of pieces) {
      const x = p.px + (p.x - p.px) * alpha;
      const y = p.py + (p.y - p.py) * alpha;
      const r = p.pr + (p.r - p.pr) * alpha;
      const s = p.ps + (p.s - p.ps) * alpha;
      let by = 0, br = 0;
      if (!reduce && p.mode !== 'drag') {
        const amp = p.placed ? 0.9 : 1.6;     // 숨쉬기 진폭 2px 이하
        by = Math.sin(t * 1.7 + p.phase) * amp;
        br = Math.sin(t * 1.1 + p.phase * 1.3) * (p.placed ? 0.25 : 0.6);
      }
      p.el.style.transform = `translate3d(${(x - p.w / 2).toFixed(2)}px, ${(y - p.h / 2 + by).toFixed(2)}px, 0) rotate(${(r + br).toFixed(2)}deg) scale(${s.toFixed(4)})`;
      if (p.z !== p.zShown) { p.el.style.zIndex = p.z; p.zShown = p.z; }
    }
  }

  /* ── 루프: 1개, 보일 때만 ── */
  let raf = 0, last = 0, acc = 0, visible = false;
  function frame(now) {
    raf = 0;
    if (!visible) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;
    tSec += dt;
    let n = 0;
    while (acc >= DT && n < 6) { step(); acc -= DT; n++; }
    if (n === 6) acc = 0;
    draw(acc / DT, tSec);
    const busy = pieces.some((p) => p.mode === 'drag' || p.mode === 'free' || Math.abs(p.vx) + Math.abs(p.vy) + Math.abs(p.vs) > 0.5 || (p.mode !== 'rest' && Math.abs(p.s - 1) > 0.002));
    if (busy || !reduce) raf = requestAnimationFrame(frame);
  }
  function wake() {
    if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  const io = new IntersectionObserver((ents) => {
    visible = ents[0].isIntersecting;
    if (visible) wake();
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }, { rootMargin: '80px 0px' });
  io.observe(stage);

  /* ── 리사이즈: 200ms 디바운스, 폭이 같으면 다시 계산 안 함 ── */
  let rt = 0, lastW = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (stage.clientWidth === lastW && stage.clientHeight === H) return;
      lastW = stage.clientWidth;
      layout();
    }, 200);
  });

  layout();
  lastW = stage.clientWidth;
  updateUI();

  /* 검수용 훅 */
  window.__ssam = { pieces, get geo() { return { W, H, cx, cy, R, S }; }, toSlot: (k) => { const p = pieces.find((q) => q.key === k); if (p && !p.placed) toSlot(p, true); }, reset: resetAll };
})();
