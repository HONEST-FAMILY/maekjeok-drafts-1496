export function createSsam(stage, { reduce, tasks }) {
  if (!stage) return null;
  const leafL = stage.querySelector('.leaf-l');
  const leafR = stage.querySelector('.leaf-r');
  const meat = stage.querySelector('.meat');
  const doneEl = document.getElementById('ssamDone');
  const againEl = document.getElementById('ssamAgain');
  const howEl = document.getElementById('ssamHow');
  const legend = {};
  document.querySelectorAll('#obList li').forEach((li) => { legend[li.dataset.key] = li; });
  const NAT = { kkaennip: [506, 712], paprika: [231, 542], pineapple: [317, 345], mu: [269, 498], cabbage: [481, 522] };
  const MAXD = { kkaennip: 222, paprika: 206, pineapple: 172, mu: 210, cabbage: 214 };
  const SLOT = {
    kkaennip: { x: -0.22, y: -0.06, r: -18, s: 0.56, z: 3 },
    cabbage: { x: -0.37, y: 0.08, r: 8, s: 0.5, z: 4 },
    mu: { x: -0.21, y: -0.31, r: -26, s: 0.52, z: 5 },
    paprika: { x: -0.06, y: -0.27, r: 24, s: 0.56, z: 6 },
    pineapple: { x: -0.25, y: 0.31, r: 20, s: 0.5, z: 7 },
  };
  const HOME_P = { kkaennip: [0.16, 0.24, -12], cabbage: [0.84, 0.22, 0], pineapple: [0.15, 0.76, 10], mu: [0.86, 0.7, 28], paprika: [0.5, 0.93, 84] };
  const DT = 1 / 60;
  const TH0 = -6;
  let TH = TH0;
  let G = 1;
  let pres = 0; let presV = 0; let presTo = 0;
  const pieces = [...stage.querySelectorAll('.piece')].map((el, i) => ({
    el, key: el.dataset.key, i, w: 0, h: 0, x: 0, y: 0, r: 0, s: 1, vx: 0, vy: 0, vr: 0, vs: 0,
    px: 0, py: 0, pr: 0, ps: 1, hx: 0, hy: 0, hr: 0, gx: 0, gy: 0, ox: 0, oy: 0,
    mode: 'wait', placed: false, arrived: false, z: 8, zShown: -1, delay: 0, phase: i * 1.37 + 0.4,
  }));
  const byEl = new Map(pieces.map((p) => [p.el, p]));
  let W = 0; let H = 0; let cx = 0; let cy = 0; let LW = 0; let LH = 0; let phone = false;
  let fold = 0; let foldTo = 0; let foldShown = -1; let presShown = -1;
  let mw = 0; let mh = 0;
  let state = 'wait';
  let introDone = reduce;
  let demoDone = reduce;
  let cos = 1;
  let sin = 0;
  const setPres = () => {
    TH = TH0 - 9 * pres;
    G = 1 + 0.1 * pres;
    cos = Math.cos((TH * Math.PI) / 180);
    sin = Math.sin((TH * Math.PI) / 180);
  };
  setPres();
  const toStage = (lx, ly) => [cx + G * (lx * cos - ly * sin), cy + G * (lx * sin + ly * cos)];
  function slotOf(p) {
    const sl = SLOT[p.key];
    const [x, y] = toStage(sl.x * LW, sl.y * LH);
    return [x, y, sl.r + TH, sl.s * G];
  }
  const textEl = document.querySelector('.ssam-text');
  let minX = 0;
  function layout() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    W = w; H = h;
    phone = W < 640;
    minX = 0;
    const sr = stage.getBoundingClientRect();
    const tr = textEl ? textEl.getBoundingClientRect() : null;
    if (tr && tr.width && tr.right > sr.left && tr.left < sr.left + W * 0.5 && tr.bottom > sr.top + 40 && tr.top < sr.bottom - 40) minX = tr.right - sr.left + 40;
    LH = phone ? Math.min(H * 0.64, W * 0.7 * (712 / 506)) : Math.min(560, Math.max(300, H * 0.64), (W - minX) * 0.42 * (712 / 506));
    LW = LH * (506 / 712);
    cx = minX + (W - minX) / 2;
    cy = H * 0.5 + (phone ? 4 : 10);
    howEl.style.left = `${cx}px`;
    doneEl.style.left = `${cx}px`;
    const base = phone ? Math.min(0.5, W / 760) : Math.min(1, Math.max(0.68, LH / 540));
    [leafL, leafR].forEach((im) => { im.style.width = `${LW}px`; im.style.height = `${LH}px`; });
    mh = LH * 0.58;
    mw = mh * (168 / 506);
    meat.style.width = `${mw}px`;
    meat.style.height = `${mh}px`;
    foldShown = -1;
    drawLeaf();
    let HOME;
    if (phone) {
      HOME = {};
      Object.keys(HOME_P).forEach((k) => { HOME[k] = [HOME_P[k][0] * W, HOME_P[k][1] * H, HOME_P[k][2]]; });
    } else {
      const lc = Math.max((minX + cx - LW / 2) / 2, cx - LW * 1.45);
      const rc = Math.min((cx + LW / 2 + W) / 2, cx + LW * 1.45);
      HOME = {
        kkaennip: [lc, cy - 0.26 * LH, -12], pineapple: [lc + LW * 0.06, cy + 0.3 * LH, 10],
        cabbage: [rc, cy - 0.34 * LH, 0], paprika: [rc + LW * 0.1, cy + 0.03 * LH, 74], mu: [rc - LW * 0.02, cy + 0.38 * LH, 28],
      };
    }
    pieces.forEach((p) => {
      const [nw, nh] = NAT[p.key];
      const k = (MAXD[p.key] * base) / Math.max(nw, nh);
      p.w = nw * k; p.h = nh * k;
      p.el.style.width = `${p.w}px`;
      p.el.style.height = `${p.h}px`;
      const [fx, fy, fr] = HOME[p.key];
      const ex = Math.max(p.w, p.h) * 0.5;
      p.hx = Math.min(Math.max(fx, minX + ex * 0.75), W - ex * 0.75);
      p.hy = Math.min(Math.max(fy, ex * 0.6 + 34), H - ex * 0.6);
      p.hr = fr;
      if (p.placed) {
        const [sx, sy, sr2, ss] = slotOf(p);
        p.x = sx; p.y = sy; p.r = sr2; p.s = ss; p.mode = 'slot'; p.arrived = true;
      } else if (!introDone) {
        p.x = p.hx; p.y = p.hy < cy ? -p.h * 0.8 : H + p.h * 0.8; p.r = p.hr + (p.hx > cx ? 40 : -40); p.s = 1; p.mode = 'wait';
      } else {
        p.x = p.hx; p.y = p.hy; p.r = p.hr; p.s = 1; p.mode = 'home';
      }
      p.vx = p.vy = p.vr = p.vs = 0;
      p.px = p.x; p.py = p.y; p.pr = p.r; p.ps = p.s;
    });
    draw(1, 0);
  }
  function drawLeaf() {
    if (Math.abs(fold - foldShown) < 0.0005 && Math.abs(pres - presShown) < 0.0005) return;
    foldShown = fold;
    presShown = pres;
    const a = -180 * fold;
    const base = `translate3d(${(cx - LW / 2).toFixed(1)}px, ${(cy - LH / 2).toFixed(1)}px, 0) rotate(${TH.toFixed(2)}deg) scale(${G.toFixed(4)})`;
    leafL.style.transform = base;
    leafR.style.transform = `${base} perspective(${(LW * 4.2).toFixed(0)}px) rotateY(${a.toFixed(2)}deg)`;
    const [mx, my] = toStage(-0.17 * LW, 0.07 * LH);
    meat.style.transform = `translate3d(${(mx - mw / 2).toFixed(1)}px, ${(my - mh / 2).toFixed(1)}px, 0) rotate(${(TH + 5).toFixed(2)}deg) scale(${G.toFixed(4)})`;
    const back = fold > 0.5;
    leafR.style.zIndex = back ? '20' : '1';
    leafR.style.filter = back ? 'brightness(1.12) saturate(.82) drop-shadow(-6px 10px 14px rgba(40,60,20,.28))' : '';
  }
  const placedCount = () => pieces.reduce((n, p) => n + (p.placed ? 1 : 0), 0);
  function updateUI() {
    pieces.forEach((p) => {
      if (legend[p.key]) legend[p.key].classList.toggle('on', p.placed);
      p.el.classList.toggle('is-placed', p.placed);
      p.el.setAttribute('aria-disabled', p.placed ? 'true' : 'false');
    });
  }
  let foldTimer = 0;
  function checkDone() {
    if (state === 'folding' || state === 'done') return;
    if (!pieces.every((p) => p.placed && p.arrived)) return;
    state = 'folding';
    clearTimeout(foldTimer);
    foldTimer = setTimeout(() => {
      foldTo = 1;
      if (reduce) { fold = 1; drawLeaf(); finishFold(); }
    }, reduce ? 0 : 160);
  }
  function finishFold() {
    state = 'done';
    presTo = 1;
    if (reduce) { pres = 1; setPres(); foldShown = -1; drawLeaf(); pieces.forEach((p) => { const [sx, sy, sr, ss] = slotOf(p); p.x = p.px = sx; p.y = p.py = sy; p.r = p.pr = sr; p.s = p.ps = ss; }); draw(1, 0); }
    doneEl.classList.add('on');
    howEl.style.opacity = '0';
  }
  function toSlot(p, kick) {
    if (p.placed) return;
    p.placed = true; p.arrived = false; p.mode = 'slot';
    p.z = SLOT[p.key].z;
    if (kick) {
      const [sx, sy] = slotOf(p);
      p.vx = (sx - p.x) * 1.1; p.vy = (sy - p.y) * 1.1 - 160; p.vr = 0;
    }
    if (reduce) {
      const [sx, sy, sr, ss] = slotOf(p);
      p.x = p.px = sx; p.y = p.py = sy; p.r = p.pr = sr; p.s = p.ps = ss; p.vx = p.vy = p.vr = p.vs = 0; p.arrived = true;
      draw(1, 0);
    }
    updateUI();
    checkDone();
  }
  function resetAll() {
    clearTimeout(foldTimer);
    doneEl.classList.remove('on');
    howEl.style.opacity = '';
    foldTo = 0;
    presTo = 0;
    if (reduce) { pres = 0; setPres(); }
    state = 'unfolding';
    const go = () => {
      state = 'user';
      pieces.forEach((p, i) => {
        p.placed = false; p.arrived = false; p.mode = 'home'; p.z = 8;
        p.vx = (i % 2 ? 1 : -1) * 140; p.vy = -260; p.vr = (i % 2 ? 1 : -1) * 80;
        if (reduce) { p.x = p.px = p.hx; p.y = p.py = p.hy; p.r = p.pr = p.hr; p.s = p.ps = 1; p.vx = p.vy = p.vr = 0; }
      });
      updateUI();
      if (reduce) draw(1, 0);
    };
    if (reduce) { fold = 0; drawLeaf(); go(); return; }
    setTimeout(go, 380);
  }
  againEl.addEventListener('click', resetAll);

  let drag = null;
  const local = (e) => { const b = stage.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  stage.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.piece');
    if (!el || drag || e.pointerType === 'touch') return;
    const p = byEl.get(el);
    if (!p || p.placed || state === 'folding' || state === 'done') return;
    if (e.button !== 0) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (err) { void err; }
    const [lx, ly] = local(e);
    drag = { p, id: e.pointerId, ox: p.x - lx, oy: p.y - ly, t0: performance.now(), sx: e.clientX, sy: e.clientY, moved: 0, samples: [[performance.now(), lx, ly]] };
    p.mode = 'drag'; p.gx = p.x; p.gy = p.y; p.z = 30;
    el.classList.add('is-drag');
    if (state === 'wait' || state === 'demo') state = 'user';
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const [lx, ly] = local(e);
    const p = drag.p;
    p.gx = Math.min(Math.max(lx + drag.ox, minX + p.w * 0.25), W - p.w * 0.25);
    p.gy = Math.min(Math.max(ly + drag.oy, p.h * 0.25), H - p.h * 0.25);
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
    const now = performance.now();
    drag.samples.push([now, lx, ly]);
    while (drag.samples.length > 2 && now - drag.samples[0][0] > 90) drag.samples.shift();
  });
  const onLeaf = (x, y) => {
    const dx = x - cx; const dy = y - cy;
    return Math.abs(dx) < LW * 0.5 && Math.abs(dy) < LH * 0.42;
  };
  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { p } = drag;
    p.el.classList.remove('is-drag');
    const now = performance.now();
    const quick = now - drag.t0 < 320 && drag.moved < 8;
    let vx = 0; let vy = 0;
    const sm = drag.samples;
    if (sm.length > 1) {
      const a = sm[0]; const b = sm[sm.length - 1];
      const dt = Math.max((b[0] - a[0]) / 1000, 0.016);
      if (now - b[0] < 80) { vx = (b[1] - a[1]) / dt; vy = (b[2] - a[2]) / dt; }
    }
    const sp = Math.hypot(vx, vy);
    if (sp > 2600) { vx *= 2600 / sp; vy *= 2600 / sp; }
    drag = null;
    if (e.type === 'pointercancel') { p.mode = 'free'; p.z = 8; p.vx = 0; p.vy = 0; return; }
    if (quick) { p.suppressClick = true; toSlot(p, true); return; }
    if (onLeaf(p.x, p.y)) { p.vx = vx * 0.3; p.vy = vy * 0.3; toSlot(p, false); return; }
    p.mode = 'free'; p.z = 8;
    p.vx = vx; p.vy = vy; p.vr = vx * 0.05;
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('click', (e) => {
    const el = e.target.closest('.piece');
    if (!el) return;
    const p = byEl.get(el);
    if (!p) return;
    if (p.suppressClick) { p.suppressClick = false; return; }
    if (state === 'folding' || state === 'done') return;
    if (state === 'wait' || state === 'demo') state = 'user';
    toSlot(p, true);
  });

  function springTo(p, tx, ty, tr, k, z) {
    const c = 2 * Math.sqrt(k) * z;
    p.vx += (k * (tx - p.x) - c * p.vx) * DT;
    p.vy += (k * (ty - p.y) - c * p.vy) * DT;
    p.vr += (k * (tr - p.r) - c * p.vr) * DT;
    p.x += p.vx * DT; p.y += p.vy * DT; p.r += p.vr * DT;
  }
  function step() {
    for (const p of pieces) {
      p.px = p.x; p.py = p.y; p.pr = p.r; p.ps = p.s;
      let sT = 1;
      if (p.mode === 'drag') {
        const f = 1 - Math.exp(-DT * 30);
        const nx = p.x + (p.gx - p.x) * f; const ny = p.y + (p.gy - p.y) * f;
        const vxNow = (nx - p.x) / DT;
        p.vx = vxNow; p.vy = (ny - p.y) / DT;
        p.x = nx; p.y = ny;
        const tilt = Math.max(-12, Math.min(12, vxNow * 0.012));
        p.r += (p.hr + tilt - p.r) * (1 - Math.exp(-DT * 12));
        sT = 1.06;
      } else if (p.mode === 'slot') {
        const [sx, sy, sr, ss] = slotOf(p);
        springTo(p, sx, sy, sr, 170, 0.72);
        sT = ss;
        if (!p.arrived && Math.hypot(sx - p.x, sy - p.y) < 5 && Math.hypot(p.vx, p.vy) < 220) {
          p.arrived = true;
          p.s *= 0.96; p.vs = 0;
          checkDone();
        }
      } else if (p.mode === 'intro') {
        if (p.delay > 0) p.delay -= DT;
        else {
          springTo(p, p.hx, p.hy, p.hr, 150, 0.7);
          if (Math.hypot(p.hx - p.x, p.hy - p.y) < 6 && Math.hypot(p.vx, p.vy) < 260) { p.mode = 'home'; p.s = 0.96; p.vs = 0; }
        }
      } else if (p.mode === 'home') {
        springTo(p, p.hx, p.hy, p.hr, 120, 0.8);
      } else if (p.mode === 'free') {
        const f = Math.exp(-DT * 4.4);
        p.vx *= f; p.vy *= f; p.vr *= Math.exp(-DT * 3);
        p.x += p.vx * DT; p.y += p.vy * DT; p.r += p.vr * DT;
        const ex = p.w * 0.35; const ey = p.h * 0.35;
        if (p.x < minX + ex) { p.x = minX + ex; p.vx = Math.abs(p.vx) * 0.3; }
        if (p.x > W - ex) { p.x = W - ex; p.vx = -Math.abs(p.vx) * 0.3; }
        if (p.y < ey) { p.y = ey; p.vy = Math.abs(p.vy) * 0.3; }
        if (p.y > H - ey) { p.y = H - ey; p.vy = -Math.abs(p.vy) * 0.3; }
        if (Math.hypot(p.vx, p.vy) < 9) {
          p.vx = p.vy = p.vr = 0;
          if (onLeaf(p.x, p.y)) toSlot(p, false);
          else { p.mode = 'rest'; p.hx = p.x; p.hy = p.y; p.hr = p.r; }
        }
      }
      if (p.mode === 'rest' || p.mode === 'wait') sT = p.s;
      const ks = 420; const cs = 2 * Math.sqrt(ks) * 0.42;
      p.vs += (ks * (sT - p.s) - cs * p.vs) * DT;
      p.s += p.vs * DT;
    }
    if (pres !== presTo || Math.abs(presV) > 0.001) {
      const kp = 160; const cp = 2 * Math.sqrt(kp) * 0.62;
      presV += (kp * (presTo - pres) - cp * presV) * DT;
      pres += presV * DT;
      if (Math.abs(presTo - pres) < 0.0005 && Math.abs(presV) < 0.002) { pres = presTo; presV = 0; }
      setPres();
    }
    if (fold !== foldTo) {
      const sp = DT / (foldTo > fold ? 0.6 : 0.5);
      fold = foldTo > fold ? Math.min(foldTo, fold + sp) : Math.max(foldTo, fold - sp);
      if (fold === 1 && foldTo === 1 && state === 'folding') finishFold();
    }
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function draw(alpha, t) {
    for (const p of pieces) {
      const x = p.px + (p.x - p.px) * alpha;
      const y = p.py + (p.y - p.py) * alpha;
      const r = p.pr + (p.r - p.pr) * alpha;
      const s = p.ps + (p.s - p.ps) * alpha;
      let by = 0;
      if (!reduce && (p.mode === 'home' || p.mode === 'rest')) by = Math.sin(t * 1.7 + p.phase) * 2;
      p.el.style.transform = `translate3d(${(x - p.w / 2).toFixed(2)}px, ${(y - p.h / 2 + by).toFixed(2)}px, 0) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(4)})`;
      if (p.z !== p.zShown) { p.el.style.zIndex = p.z; p.zShown = p.z; }
    }
    const fe = ease(fold);
    const keep = fold;
    fold = fe;
    drawLeaf();
    fold = keep;
  }
  function runDemo(wait) {
    if (demoDone || reduce) return;
    demoDone = true;
    state = 'demo';
    setTimeout(() => {
      if (state !== 'demo') return;
      ['kkaennip', 'paprika', 'pineapple', 'mu', 'cabbage'].forEach((k, i) => setTimeout(() => {
        if (state !== 'demo') return;
        const p = pieces.find((q) => q.key === k);
        if (p.mode === 'drag' || p.placed) return;
        toSlot(p, true);
      }, i * 90));
    }, wait);
  }
  function startIntro() {
    if (introDone) { if (state === 'user' && placedCount() === 0) runDemo(260); return; }
    introDone = true;
    pieces.forEach((p, i) => { if (p.mode === 'wait') { p.mode = 'intro'; p.delay = 0.04 + i * 0.07; } });
    runDemo(820);
  }
  function finishIntro() {
    if (introDone) return;
    introDone = true;
    state = 'user';
    pieces.forEach((p) => {
      if (p.mode === 'wait' || p.mode === 'intro') { p.x = p.px = p.hx; p.y = p.py = p.hy; p.r = p.pr = p.hr; p.vx = p.vy = p.vr = 0; p.mode = 'home'; }
    });
    draw(1, 0);
  }
  let visible = false;
  let acc = 0;
  let tSec = 0;
  const io = new IntersectionObserver((ents) => {
    const en = ents[ents.length - 1];
    visible = en.isIntersecting;
    if (!demoDone) {
      if (!introDone && en.boundingClientRect.bottom < 0) finishIntro();
      else if (en.intersectionRatio >= 0.35) startIntro();
    }
  }, { rootMargin: '60px 0px', threshold: [0, 0.35] });
  io.observe(stage);
  window.addEventListener('scroll', () => {
    if (introDone) return;
    const r = stage.getBoundingClientRect();
    if (r.bottom < 0) finishIntro();
  }, { passive: true });
  tasks.add((dt) => {
    if (!visible) return;
    acc += dt;
    tSec += dt;
    let n = 0;
    while (acc >= DT && n < 6) { step(); acc -= DT; n += 1; }
    if (n === 6) acc = 0;
    draw(acc / DT, tSec);
  });
  layout();
  if (reduce) {
    pieces.forEach((p) => { p.mode = 'home'; p.x = p.px = p.hx; p.y = p.py = p.hy; p.r = p.pr = p.hr; });
    state = 'user';
    draw(1, 0);
  }
  updateUI();
  window.__ssam = { pieces, toSlot: (k) => { const p = pieces.find((q) => q.key === k); if (p) toSlot(p, true); }, reset: resetAll, get state() { return state; }, get fold() { return fold; } };
  return { layout };
}
