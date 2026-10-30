/* 맥적 3안 — 요소별 인터랙션 (첫 화면 제외, 외부 라이브러리 없음)
   등장: 제목 줄 마스크 / 글 16px 위로 / 사진 가림막 걷힘+1.08→1 / 메뉴 카드 접시 내려놓기 / 사업 줄 왼쪽에서 / 숫자 굴러 올라감
   손: 자석 버튼(PC) · 카드 기울기 6°(PC) · 사진 확대 · 사진 시차 8%(PC) · 사진 줄 끌어 넘기기(PC) · 머리글 현재 구역 */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  if (reduce) root.classList.remove('mo');
  const MO = root.classList.contains('mo');
  const hand = fine && !reduce;

  /* ── 1. 제목: 줄마다 마스크 ── */
  const titles = $$('main .sec .h2, main .sec .h3, .ssam-h');
  titles.forEach((h) => {
    const segs = h.innerHTML.split(/<br\s*\/?>/i);
    h.innerHTML = segs.map((s, i) => `<span class="mo-l"><span class="mo-li" style="--l:${i}">${s.trim()}</span></span>`).join('');
    h.classList.add('mo-ti');
  });

  /* ── 2. 글·목록: 차례로 ── */
  const texts = $$([
    'main .sec .lead', '.menu-notes p', '.ssam-quote', '.ssam-how', '.ssam-legend li', '.ssam-count',
    '.grill-notes > p', '.mural figcaption', '.step-n', '.rail p', '.vision', '.fr-block p', '.fr-logo',
    '.voice p', '.store-addr', '.hours', '.store-small', '.fr .cform .fld', '.fr .cform .agree',
    '.hist li', '.notice li', '.ft-info > div', '.ft-copy', '.ft-logo', '.tabs', '.rail-btns', '.store-btns',
  ].join(','));
  texts.forEach((e) => e.classList.add('mo-t'));
  const rows = $$('.biz li');
  rows.forEach((e) => e.classList.add('mo-r'));
  const cards = $$('.step, .store-card, .rail li');
  cards.forEach((e) => e.classList.add('mo-c'));

  /* 형제 안에서 시차(줄 70ms, 사진 줄 90ms) */
  const stagger = (list, step, base) => {
    const groups = new Map();
    list.forEach((e) => {
      const k = e.parentElement;
      const n = groups.get(k) || 0;
      groups.set(k, n + 1);
      e.style.setProperty('--d', `${base + n * step}ms`);
    });
  };
  stagger(texts, 70, 140);
  stagger(rows, 80, 60);
  stagger($$('.step'), 90, 0);
  stagger($$('.rail li'), 90, 0);

  /* ── 3. 사진: 감싸서 가림막 + 안쪽 확대 ── */
  const photos = [];
  $$('.dish img, .step img, .rail img, .mural img, .store-card img').forEach((img) => {
    const w = document.createElement('span');
    w.className = 'mo-ph';
    w.dataset.dir = (img.closest('.rail') || img.closest('.mural')) ? 'l' : (img.closest('.step') || img.closest('.store-card')) ? 'u' : 'n';
    w.style.borderRadius = getComputedStyle(img).borderRadius;
    const d = img.closest('.step, .rail li');
    if (d && d.style.getPropertyValue('--d')) w.style.setProperty('--d', d.style.getPropertyValue('--d'));
    img.parentNode.insertBefore(w, img);
    w.appendChild(img);
    img.draggable = false;
    w._par = !img.closest('.dish');
    photos.push(w);
  });
  $$('.dish, .store-card, .mural').forEach((e) => e.classList.add('mo-hz'));

  /* ── 4. 숫자: 실제 숫자만 0에서 굴러 올라감 ── */
  const nums = [];
  function wrapNum(el, re) {
    if (!el) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const m = node.nodeValue.match(re);
      if (!m) continue;
      const i = m.index + (m[0].length - m[1].length);
      const after = node.splitText(i);
      after.splitText(m[1].length);
      const span = document.createElement('span');
      span.className = 'mo-num';
      span.textContent = m[1];
      after.parentNode.replaceChild(span, after);
      nums.push(span);
      return;
    }
  }
  $$('.price').forEach((p) => wrapNum(p, /(\d[\d,]*)/));
  $$('.dish h3 .g').forEach((g) => wrapNum(g, /(\d+)/));
  $$('.dish-body > p').forEach((p) => wrapNum(p, /(\d+)(?=가지|일간)/));
  wrapNum(document.querySelector('#biz-meat p'), /(\d+)(?=일)/);
  wrapNum(document.querySelector('.mural small'), /\((\d{3})(?=년)/);
  nums.forEach((s) => {
    s.dataset.final = s.textContent;
    s.dataset.to = s.textContent.replace(/,/g, '');
  });

  /* ── 5. 등장: IO 0.12 / -8%, 한 번 나타나면 끝 ── */
  const targets = [...titles, ...texts, ...rows, ...cards, ...photos, ...nums, ...$$('.panels')];
  const counting = [];
  function show(el, instant) {
    if (el.classList.contains('mo-in')) return;
    if (instant) {
      el.classList.add('mo-now');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('mo-now')));
    }
    el.classList.add('mo-in');
    if (el.classList.contains('panels')) {
      const p = el.querySelector('.panel:not([hidden])');
      if (p) p.classList.add('is-in');
    }
    if (el.classList.contains('mo-num') && !instant && MO) {
      const w = el.getBoundingClientRect().width;
      el.style.minWidth = `${Math.ceil(w)}px`;
      el.textContent = '0';
      counting.push({ el, to: +el.dataset.to, comma: el.dataset.final.includes(','), t0: performance.now() });
      schedule();
    }
    if (el.classList.contains('mo-ph')) {
      const d = parseFloat(el.style.getPropertyValue('--d')) || 0;
      setTimeout(() => el.classList.add('mo-done'), instant ? 0 : 1150 + d);
    }
    if (io) io.unobserve(el);
  }
  let io = null;
  if (MO) {
    io = new IntersectionObserver((ents) => {
      for (const en of ents) {
        if (en.boundingClientRect.bottom < 0) show(en.target, true);
        else if (en.isIntersecting) show(en.target, false);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    targets.forEach((t) => io.observe(t));
  } else {
    targets.forEach((t) => t.classList.add('mo-in'));
  }
  /* 스크롤이 멈추면 화면 안·위의 남은 것 전부 표시(안전망) */
  function flush() {
    if (!MO) return;
    const vh = window.innerHeight;
    for (const el of targets) {
      if (el.classList.contains('mo-in')) continue;
      const r = el.getBoundingClientRect();
      if (r.top < vh) show(el, r.bottom < 0);
    }
    document.dispatchEvent(new Event('mo:flush'));
  }
  let stopT = 0;

  /* ── 6. 손: rAF 하나로 묶기 ── */
  let raf = 0, px = -1e5, py = -1e5, lastT = 0;
  const mags = hand ? $$('main .sec .btn, .tab, .rbtn, .hd-call, .hd-fr, .cbar .btn') : [];
  mags.forEach((m) => m.classList.add('mo-mag'));
  const tilts = hand ? $$('.dish, .store-card, .step') : [];
  let tiltEl = null;
  tilts.forEach((c) => {
    c.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') tiltEl = c; });
    c.addEventListener('pointerleave', () => { c.style.transform = ''; if (tiltEl === c) tiltEl = null; });
  });

  /* 사진 줄: PC에서 끌어 넘기기(관성) */
  const rails = [];
  if (hand) {
    $$('.rail').forEach((el) => {
      const R = { el, v: 0, drag: null };
      rails.push(R);
      el.classList.add('mo-drag');
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        e.preventDefault();
        R.v = 0;
        R.drag = { x: e.clientX, s: el.scrollLeft, moved: 0, samples: [[performance.now(), e.clientX]] };
        el.style.scrollSnapType = 'none';
        el.classList.add('is-grab');
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
      });
      el.addEventListener('pointermove', (e) => {
        if (!R.drag) return;
        const dx = e.clientX - R.drag.x;
        R.drag.moved = Math.max(R.drag.moved, Math.abs(dx));
        el.scrollLeft = R.drag.s - dx;
        const now = performance.now();
        R.drag.samples.push([now, e.clientX]);
        while (R.drag.samples.length > 2 && now - R.drag.samples[0][0] > 90) R.drag.samples.shift();
      });
      const end = () => {
        if (!R.drag) return;
        const s = R.drag.samples;
        const a = s[0], b = s[s.length - 1];
        const dt = Math.max((b[0] - a[0]) / 1000, 0.016);
        R.v = performance.now() - b[0] < 80 ? (b[1] - a[1]) / dt : 0;
        R.drag = null;
        el.classList.remove('is-grab');
        if (Math.abs(R.v) < 40) { R.v = 0; el.style.scrollSnapType = ''; }
        lastT = performance.now();
        schedule();
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    });
  }

  /* 머리글 현재 구역 */
  const gnbMap = [['brand', '#brand'], ['space', '#brand'], ['company', '#company'], ['business', '#business'], ['franchise', '#franchise'], ['community', '#community']]
    .map(([id, href]) => [document.getElementById(id), document.querySelector(`.gnb-top[href="${href}"]`)]);
  const menuSec = document.getElementById('menu');
  let gnbCur = null;

  function schedule() { if (!raf) raf = requestAnimationFrame(tick); }
  function fmt(n, comma) { return comma ? n.toLocaleString('en-US') : String(n); }

  function tick(now) {
    raf = 0;
    let again = false;
    const dt = Math.min((now - (lastT || now)) / 1000, 0.05);
    lastT = now;
    const vh = window.innerHeight;

    /* 자석: 반경 크기/2+56px, 0.3배 */
    for (const m of mags) {
      const r = m.getBoundingClientRect();
      const t = m._mt || [0, 0];
      let nx = 0, ny = 0;
      if (r.bottom > 0 && r.top < vh && r.width) {
        const cx = r.left + r.width / 2 - t[0], cy = r.top + r.height / 2 - t[1];
        const dx = px - cx, dy = py - cy;
        if (Math.hypot(dx, dy) < Math.max(r.width, r.height) / 2 + 56) { nx = dx * 0.3; ny = dy * 0.3; }
      }
      if (Math.abs(nx - t[0]) > 0.2 || Math.abs(ny - t[1]) > 0.2 || (nx === 0 && t[0] !== 0)) {
        m._mt = [nx, ny];
        m.style.translate = nx || ny ? `${nx.toFixed(1)}px ${ny.toFixed(1)}px` : '';
      }
    }
    /* 카드 기울기: 손끝 쪽, 최대 6° */
    if (tiltEl) {
      const r = tiltEl.getBoundingClientRect();
      const fx = Math.max(-0.5, Math.min(0.5, (px - r.left) / r.width - 0.5));
      const fy = Math.max(-0.5, Math.min(0.5, (py - r.top) / r.height - 0.5));
      tiltEl.style.transform = `perspective(900px) rotateX(${(-fy * 12).toFixed(2)}deg) rotateY(${(fx * 12).toFixed(2)}deg)`;
    }
    /* 사진 시차: 사진 높이의 ±4%(합 8%) */
    if (hand) {
      for (const w of photos) {
        if (!w._par) continue;
        const r = w.getBoundingClientRect();
        if (r.bottom < -40 || r.top > vh + 40) continue;
        const p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        w.firstElementChild.style.translate = `0 ${(-p * r.height * 0.04).toFixed(1)}px`;
      }
    }
    /* 숫자 1.4s, 끝이 느려지게 */
    for (let i = counting.length - 1; i >= 0; i--) {
      const c = counting[i];
      const t = Math.min(1, (now - c.t0) / 1400);
      const e = 1 - Math.pow(1 - t, 4);
      if (t >= 1) {
        c.el.textContent = c.el.dataset.final;
        c.el.style.minWidth = '';
        counting.splice(i, 1);
      } else {
        c.el.textContent = fmt(Math.round(c.to * e), c.comma);
        again = true;
      }
    }
    /* 사진 줄 관성 */
    for (const R of rails) {
      if (!R.v || R.drag) continue;
      R.el.scrollLeft -= R.v * dt;
      R.v *= Math.exp(-dt * 4.5);
      if (Math.abs(R.v) < 30) { R.v = 0; R.el.style.scrollSnapType = ''; } else again = true;
    }
    /* 머리글 현재 구역 */
    let cur = null;
    if (menuSec.getBoundingClientRect().top > vh * 0.4) cur = null;
    for (const [sec, a] of gnbMap) if (sec && sec.getBoundingClientRect().top < vh * 0.4) cur = a;
    if (cur !== gnbCur) {
      if (gnbCur) gnbCur.classList.remove('is-cur');
      if (cur) cur.classList.add('is-cur');
      gnbCur = cur;
    }
    if (again) schedule();
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX; py = e.clientY;
    schedule();
  }, { passive: true });
  window.addEventListener('scroll', () => {
    schedule();
    clearTimeout(stopT);
    stopT = setTimeout(flush, 140);
  }, { passive: true });
  document.addEventListener('mouseleave', () => { px = py = -1e5; schedule(); });
  schedule();

  window.__moReady = true;
})();
