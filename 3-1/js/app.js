import { createSteam } from './steam.js';
import { createSsam } from './ssam.js';
import { createBurn } from './burn.js';

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (dt, k) => 1 - Math.exp(-dt * k);
const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eout = (t) => 1 - Math.pow(1 - t, 4);
const tasks = new Set();
let vw = window.innerWidth;
let vh = window.innerHeight;
const hd = $('#hd');
const EZ = 'cubic-bezier(.16,1,.3,1)';

const smooth = (() => {
  if (!fine || reduce) return null;
  let target = window.scrollY;
  let cur = window.scrollY;
  let active = false;
  const maxY = () => document.documentElement.scrollHeight - window.innerHeight;
  function canScrollInside(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return true;
      el = el.parentElement;
    }
    return false;
  }
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.defaultPrevented) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (root.classList.contains('menu-open') || root.classList.contains('sheet-open')) return;
    if (canScrollInside(e.target)) return;
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
    if (!active) { cur = window.scrollY; target = cur; }
    target = clamp(target + clamp(d, -260, 260), 0, maxY());
    active = true;
  }, { passive: false });
  window.addEventListener('scroll', () => { if (!active) { cur = window.scrollY; target = cur; } }, { passive: true });
  ['keydown', 'pointerdown', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { active = false; }, { passive: true }));
  tasks.add((dt) => {
    if (!active) return;
    cur += (target - cur) * damp(dt, 10);
    if (Math.abs(target - cur) < 0.4) { cur = target; active = false; }
    window.scrollTo(0, cur);
  });
  return { to(y) { cur = window.scrollY; target = clamp(y, 0, maxY()); active = true; } };
})();

function scrollToY(y) {
  if (smooth) smooth.to(y);
  else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  const el = id ? document.getElementById(id) : null;
  if (!el) return;
  e.preventDefault();
  const off = id === 'home' ? 0 : (vw <= 980 ? 58 : 68) + 12;
  scrollToY(id === 'home' ? 0 : el.getBoundingClientRect().top + window.scrollY - off);
  history.replaceState(null, '', `#${id}`);
});

let lastY = window.scrollY;
function onScroll() {
  const y = window.scrollY;
  const down = y > lastY + 4;
  const up = y < lastY - 4;
  if (!hd.classList.contains('is-open') && !root.classList.contains('menu-open')) {
    if (down && y > 200) hd.classList.add('is-hidden');
    else if (up || y < 200) hd.classList.remove('is-hidden');
  }
  if (Math.abs(y - lastY) > 4) lastY = y;
}
window.addEventListener('scroll', onScroll, { passive: true });

const gnb = $('#gnb');
let closeTimer = 0;
const openMega = () => { clearTimeout(closeTimer); hd.classList.add('is-open'); hd.classList.remove('is-hidden'); };
const closeMega = (delay = 140) => { clearTimeout(closeTimer); closeTimer = setTimeout(() => hd.classList.remove('is-open'), delay); };
gnb.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') openMega(); });
hd.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') closeMega(); });
$('.mega-bg', hd).addEventListener('pointerenter', () => clearTimeout(closeTimer));
gnb.addEventListener('focusin', openMega);
hd.addEventListener('focusout', (e) => { if (!hd.contains(e.relatedTarget)) closeMega(0); });
$$('.hd-call, .hd-logo, .hd-open', hd).forEach((a) => a.addEventListener('pointerenter', () => closeMega(60)));
$$('a', gnb).forEach((a) => a.addEventListener('click', () => closeMega(0)));

const burger = $('.hd-burger');
const mnav = $('#mnav');
$('#mnavGroups').innerHTML = $$('.gnb-item', gnb).map((item, i) => {
  const top = $('.gnb-top', item);
  const soon = $('small', top);
  const label = top.firstChild.textContent.trim();
  const subs = $$('.gnb-sub a', item).map((a) => `<li><a href="${a.getAttribute('href')}">${a.textContent}</a></li>`).join('');
  return `<div class="mnav-g" style="--d:${60 + i * 70}ms"><a class="mnav-h" href="${top.getAttribute('href')}"><span>${label}${soon ? `<small>${soon.textContent}</small>` : ''}</span></a><ul>${subs}</ul></div>`;
}).join('');
function openMenu() {
  mnav.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => mnav.classList.add('is-on')));
  root.classList.add('menu-open');
  hd.classList.remove('is-hidden');
  burger.setAttribute('aria-expanded', 'true');
  burger.setAttribute('aria-label', '전체 메뉴 닫기');
  $('use', burger).setAttribute('href', '#i-close');
  document.body.style.overflow = 'hidden';
}
function closeMenu() {
  if (mnav.hidden) return;
  mnav.classList.remove('is-on');
  root.classList.remove('menu-open');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-label', '전체 메뉴 열기');
  $('use', burger).setAttribute('href', '#i-burger');
  document.body.style.overflow = '';
  setTimeout(() => { if (!mnav.classList.contains('is-on')) mnav.hidden = true; }, 300);
}
burger.addEventListener('click', () => (mnav.hidden ? openMenu() : closeMenu()));
mnav.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });

function splitLines(el) {
  const nodes = [...el.childNodes];
  el.textContent = '';
  const out = [];
  const add = (inner) => {
    const o = document.createElement('span');
    o.className = 'ln';
    const i = document.createElement('span');
    if (typeof inner === 'string') i.textContent = inner; else i.appendChild(inner);
    o.appendChild(i);
    el.appendChild(o);
    out.push(o);
  };
  nodes.forEach((n) => {
    if (n.nodeType === 3) {
      n.textContent.split(/(\s+)/).forEach((w) => {
        if (!w) return;
        if (/^\s+$/.test(w)) el.appendChild(document.createTextNode(' '));
        else add(w);
      });
    } else if (n.nodeName === 'BR') {
      el.appendChild(n);
    } else {
      add(n);
    }
  });
  return out;
}
function lineDelays(el, base = 0) {
  let line = -1;
  let lastTop = null;
  $$('.ln', el).forEach((w) => {
    const top = w.offsetTop;
    if (lastTop === null || Math.abs(top - lastTop) > 4) { line += 1; lastTop = top; }
    w.firstChild.style.setProperty('--d', `${base + line * 80}ms`);
  });
}
const lineEls = $$('[data-r="lines"]');
lineEls.forEach((el) => splitLines(el));
$$('[data-r="stagger"]').forEach((el) => {
  [...el.children].forEach((c, i) => c.style.setProperty('--d', `${Math.min(i * 60, 640)}ms`));
});
$$('.hist li').forEach((li, i) => {
  li.querySelector('.hl').style.setProperty('--d', `${i * 60}ms`);
  li.querySelector('.hy').style.setProperty('--d', `${i * 60 + 80}ms`);
  li.querySelector('.ht').style.setProperty('--d2', `${i * 60 + 120}ms`);
});
$$('.wk-rows li').forEach((li, i) => $('.wk-bar i', li).style.setProperty('--d', `${120 + i * 70}ms`));
const heroSeq = [['.hero-kicker', 0], ['.hero-sub', 260], ['#today', 360], ['#days', 520], ['.hero-btns', 640]];
heroSeq.forEach(([s, d]) => {
  const el = $(s);
  if (el.dataset.r === 'stagger') [...el.children].forEach((c, i) => c.style.setProperty('--d', `${d + i * 40}ms`));
  else el.style.setProperty('--d', `${d}ms`);
});
const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]);
fontsReady.then(() => lineEls.forEach((el) => lineDelays(el, el.id === 'hero-title' ? 80 : 0)));

const pending = new Set($$('[data-r], .hist, .wk'));
function reveal(el) {
  if (!pending.has(el)) return;
  pending.delete(el);
  el.classList.add('is-in');
  if (el.dataset.r === 'stagger') setTimeout(() => el.classList.add('is-done'), 1500);
  revealIO.unobserve(el);
}
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) reveal(e.target); });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
pending.forEach((el) => revealIO.observe(el));
let scanQueued = false;
function scanPassed() {
  scanQueued = false;
  pending.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < vh * 0.92) reveal(el);
  });
}
window.addEventListener('scroll', () => { if (!scanQueued) { scanQueued = true; requestAnimationFrame(scanPassed); } }, { passive: true });
if (reduce) pending.forEach((el) => reveal(el));
else requestAnimationFrame(() => $$('.hero [data-r]').forEach((el) => reveal(el)));
window.__mjReady = true;

const HOURS = { 0: [16, 25], 1: [16, 27], 2: [16, 27], 3: [16, 28], 4: [16, 28], 5: [16, 28], 6: [16, 28] };
const DAYN = ['일', '월', '화', '수', '목', '금', '토'];
const fmt = (h) => `${String(Math.floor(((h % 24) + 24) % 24)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
function kstNow() {
  const q = new URLSearchParams(location.search).get('t');
  if (q && /^\d-\d{1,2}:\d{2}$/.test(q)) {
    const [d, hm] = q.split('-');
    const [h, m] = hm.split(':');
    return { d: +d, h: +h, m: +m };
  }
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' });
    const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { d: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday], h: +p.hour % 24, m: +p.minute };
  } catch (err) {
    const n = new Date();
    return { d: n.getDay(), h: n.getHours(), m: n.getMinutes() };
  }
}
function statusNow() {
  const n = kstNow();
  const t = n.h + n.m / 60;
  const prev = (n.d + 6) % 7;
  const st = { now: n, t, bizDay: n.d, open: false };
  let close = null;
  if (t < HOURS[prev][1] - 24) { st.open = true; st.bizDay = prev; close = HOURS[prev][1] - 24; }
  else if (t >= HOURS[n.d][0]) { st.open = true; close = HOURS[n.d][1]; }
  st.close = close;
  if (st.open) {
    st.toLO = Math.round((close - 1 - t) * 60);
    st.closeTxt = fmt(close);
    st.loTxt = fmt(close - 1);
    if (st.toLO > 60) { st.big = '지금 영업 중'; st.sub = `${st.closeTxt}까지`; st.short = `지금 영업 중 · ${st.closeTxt}까지`; }
    else if (st.toLO > 0) { st.big = `라스트오더까지\n${st.toLO}분`; st.sub = `${st.closeTxt} 마감`; st.short = `라스트오더까지 ${st.toLO}분`; }
    else { st.big = '라스트오더\n마감'; st.sub = `${st.closeTxt} 영업 종료`; st.short = `라스트오더 마감 · ${st.closeTxt} 종료`; }
    st.line = `지금 영업 중 · 라스트오더 ${st.loTxt} · ${st.closeTxt} 마감`;
  } else {
    const o = fmt(HOURS[n.d][0]);
    st.big = `오늘 ${o}에\n문 엽니다`;
    st.sub = `${fmt(HOURS[n.d][1])}까지 영업`;
    st.short = `오늘 ${o}에 문 엽니다`;
    st.line = `오늘 ${o}에 문을 엽니다 · ${fmt(HOURS[n.d][1])}까지`;
  }
  return st;
}

const clock = (() => {
  const arc = $('#ckArc');
  const lo = $('#ckLo');
  const hand = $('#ckHand');
  const big = $('#ckBig');
  const sub = $('#ckSub');
  const top = $('#ckTop');
  const ticks = $('#ckTicks');
  const days = $$('#days button');
  const C = 140;
  const R = 108;
  ticks.innerHTML = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const major = i % 6 === 0;
    const r1 = major ? 119 : 120;
    const r2 = major ? 127 : 124;
    return `<line class="ck-tick${major ? ' is-major' : ''}" x1="${(C + r1 * Math.cos(a)).toFixed(2)}" y1="${(C + r1 * Math.sin(a)).toFixed(2)}" x2="${(C + r2 * Math.cos(a)).toFixed(2)}" y2="${(C + r2 * Math.sin(a)).toFixed(2)}"/>`;
  }).join('');
  const pt = (h) => { const a = (h / 24) * Math.PI * 2 - Math.PI / 2; return [C + R * Math.cos(a), C + R * Math.sin(a)]; };
  function path(h0, h1) {
    if (h1 - h0 < 0.02) return `M${C} ${C - R}`;
    const [x0, y0] = pt(h0);
    const [x1, y1] = pt(h1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${h1 - h0 > 12 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  let st = statusNow();
  const s = { v: HOURS[st.bizDay][0], x: 0, t: HOURS[st.bizDay][0] };
  const e = { v: HOURS[st.bizDay][1], x: 0, t: HOURS[st.bizDay][1] };
  const hAng = st.t / 24 * 360;
  const h = { v: reduce ? hAng : hAng - 150, x: 0, t: hAng };
  let draw = reduce ? 1 : 0;
  let t0 = null;
  let pick = null;
  const D = { 0: '일요일', 1: '월요일', 2: '화요일', 3: '수요일', 4: '목요일', 5: '금요일', 6: '토요일' };
  function texts() {
    if (pick !== null) {
      const [o, c] = HOURS[pick];
      top.textContent = pick === st.bizDay ? `${D[pick]} · 오늘` : D[pick];
      big.textContent = `${fmt(o)}–${fmt(c)}`;
      big.classList.remove('is-open');
      sub.textContent = `라스트오더 ${fmt(c - 1)}`;
      return;
    }
    top.textContent = `${DAYN[st.now.d]}요일 ${fmt(st.t)}`;
    big.textContent = st.big;
    big.classList.toggle('is-open', st.open);
    sub.textContent = st.sub;
  }
  function apply() {
    st = statusNow();
    texts();
    $$('[data-open="short"]').forEach((el) => { el.textContent = st.short; el.classList.toggle('is-open', st.open); });
    $$('[data-open="line"]').forEach((el) => { el.textContent = st.line; el.classList.toggle('is-open', st.open); });
    const [o, c] = HOURS[st.bizDay];
    $('#tiDayLabel').textContent = `오늘(${DAYN[st.bizDay]}) 영업`;
    $('#tiHours').textContent = `${fmt(o)} – ${fmt(c)}`;
    $('#tiLO').textContent = `${fmt(c - 1)} (마감 1시간 전)`;
    days.forEach((b) => b.classList.toggle('is-today', +b.dataset.d === st.bizDay));
    $$('.wk-rows li').forEach((li) => li.classList.toggle('is-today', +li.dataset.d === st.bizDay));
    h.t = st.t / 24 * 360;
    if (pick === null) { s.t = o; e.t = c; }
  }
  apply();
  setInterval(apply, 60000);
  const choose = (d) => {
    pick = d;
    const [o, c] = d === null ? HOURS[st.bizDay] : HOURS[d];
    s.t = o; e.t = c;
    days.forEach((b) => b.classList.toggle('is-pick', d !== null && +b.dataset.d === d));
    texts();
  };
  days.forEach((b) => {
    b.addEventListener('pointerenter', (ev) => { if (ev.pointerType !== 'touch') choose(+b.dataset.d); });
    b.addEventListener('pointerleave', (ev) => { if (ev.pointerType !== 'touch') choose(null); });
    b.addEventListener('focus', () => choose(+b.dataset.d));
    b.addEventListener('blur', () => choose(null));
    b.addEventListener('click', () => choose(pick === +b.dataset.d ? null : +b.dataset.d));
  });
  const spring = (o, k, c, dt) => {
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h2 = dt / n;
    for (let i = 0; i < n; i += 1) { o.x += (k * (o.t - o.v) - c * o.x) * h2; o.v += o.x * h2; }
  };
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe($('#clock'));
  let lastArc = '';
  tasks.add((dt) => {
    if (!visible) return;
    if (t0 === null) t0 = performance.now();
    const el = (performance.now() - t0) / 1000;
    if (!reduce) {
      draw = eio(clamp((el - 0.3) / 0.9, 0, 1));
      spring(s, 170, 20, dt);
      spring(e, 170, 20, dt);
      if (el > 0.55) spring(h, 120, 13, dt);
    } else {
      s.v = s.t; e.v = e.t; h.v = h.t;
    }
    const end = s.v + (e.v - s.v) * draw;
    const loStart = Math.max(s.v, e.v - 1);
    const d1 = path(s.v, Math.min(end, loStart));
    const d2 = end > loStart ? path(loStart, end) : `M${C} ${C - R}`;
    const key = d1 + d2;
    if (key !== lastArc) { arc.setAttribute('d', d1); lo.setAttribute('d', d2); lastArc = key; }
    hand.setAttribute('transform', `rotate(${h.v.toFixed(2)} ${C} ${C})`);
    hand.style.opacity = el > 0.5 || reduce ? '1' : '0';
  });
  return { apply };
})();

function steam() {
  const canvas = $('#steam');
  if (!canvas || reduce) return;
  let st = null;
  try { st = createSteam(canvas, $('.hero-ph')); } catch (err) { st = null; }
  if (!st) return;
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: '40px 0px' }).observe(canvas);
  setTimeout(() => canvas.classList.add('is-on'), 500);
  tasks.add((dt) => { if (visible) st.frame(dt); });
  window.addEventListener('resize', () => st.resize());
}

const DISH = {
  maek: { t: '맥 세트', w: '세트 · 600g', p: '67,000원', d: '창호지목살 + 숙성세겹살 + 등심기왓살 + 토장찌개. 맥적 한식반상이 기본으로 함께 나오고, 고기는 직원이 직접 구워 드립니다.' },
  jeok: { t: '적 세트', w: '세트 · 400g', p: '45,000원', d: '창호지목살 + 숙성세겹살 + 토장찌개. 맥적 한식반상이 기본으로 함께 나오고, 고기는 직원이 직접 구워 드립니다.' },
  changhoji: { t: '창호지목살', w: '고기 · 150g', p: '16,000원', d: '최고등급 마블고기를 3mm로 저며 전주의 창호지 같은 질감을 표현한 목살입니다. 전주의 창호지처럼 얇게 저민 목살을 떡쌈과 싸먹을 수 있도록 고안했습니다.' },
  segyeop: { t: '세겹살', w: '고기 · 150g', p: '15,000원', d: '1+등급 선별 숙성된 마블고기를 15일간 숙성시킨 진품 삼겹살입니다.' },
  giwasal: { t: '등심기왓살', w: '고기 · 150g', p: '19,000원', d: '극소량만 나오는 명품 특수부위. 전주의 한옥 기와를 형상화하여 기와모양으로 자른 등심덧살입니다.' },
  jjigae: { t: '맥적 토장찌개', w: '찌개 · 우렁·차돌·냉이 중 선택', p: '7,000원', d: '5가지의 된장을 배합한 맥적의 시그니처 된장찌개입니다.' },
  guksu: { t: '사랑방 김치말이 국수', w: '식사', p: '6,000원', d: '주막에서 먹던 그 맛을 현대에서 구현한 김치말이 국수입니다.' },
  obang: { t: '오방쌈채', w: '곁들임 · 청·적·황·백·흑', p: '3,000원', d: '전통 오방색 쌈채소 — 청(깻잎), 적(파프리카·당근), 황(파인애플), 백(무채·양파), 흑(보라양배추). 삼겹살의 풍미를 살리고 돼지고기의 느끼함을 잡아줍니다.' },
  bibim: { t: '전주비빔볶음밥·불닭볶음면·치즈 반반', w: 'K-후식', p: '9,000원', d: '전주의 비빔밥을 형상화한 후식입니다.' },
};

function menu() {
  const tabs = $$('.tab');
  const ink = $('.tab-ink');
  const grid = $('#mgrid');
  const cards = $$('.mc', grid);
  let cur = 'all';
  let busy = false;
  function placeInk(t) {
    ink.style.width = `${t.offsetWidth}px`;
    ink.style.transform = `translateX(${t.offsetLeft}px)`;
  }
  const sel = () => tabs.find((t) => t.getAttribute('aria-selected') === 'true');
  fontsReady.then(() => placeInk(sel()));
  window.addEventListener('resize', () => placeInk(sel()));
  function filter(f) {
    if (f === cur || busy) return;
    cur = f;
    const show = (c) => f === 'all' || c.dataset.cat === f;
    const gr = grid.getBoundingClientRect();
    const first = new Map(cards.filter((c) => !c.hidden).map((c) => [c, c.getBoundingClientRect()]));
    const leaving = cards.filter((c) => !c.hidden && !show(c));
    const entering = cards.filter((c) => c.hidden && show(c));
    if (reduce || !grid.animate) {
      cards.forEach((c) => { c.hidden = !show(c); });
      return;
    }
    busy = true;
    leaving.forEach((c) => {
      const r = first.get(c);
      Object.assign(c.style, { position: 'absolute', left: `${r.left - gr.left}px`, top: `${r.top - gr.top}px`, width: `${r.width}px`, height: `${r.height}px`, zIndex: '0', pointerEvents: 'none', margin: '0' });
    });
    entering.forEach((c) => { c.hidden = false; });
    const gr2 = grid.getBoundingClientRect();
    cards.forEach((c) => {
      if (c.hidden || leaving.includes(c)) return;
      const last = c.getBoundingClientRect();
      if (entering.includes(c)) {
        const i = entering.indexOf(c);
        c.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 80 + i * 60, easing: EZ, fill: 'backwards' });
        return;
      }
      const f0 = first.get(c);
      const dx = f0.left - gr.left - (last.left - gr2.left);
      const dy = f0.top - gr.top - (last.top - gr2.top);
      const sx = f0.width / last.width;
      const sy = f0.height / last.height;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
      c.animate([{ transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transformOrigin: '0 0', transform: 'none' }], { duration: 360, easing: EZ });
    });
    leaving.forEach((c) => {
      c.animate([{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'scale(.92)', filter: 'blur(2px)' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }).onfinish = (ev) => {
        c.hidden = true;
        ['position', 'left', 'top', 'width', 'height', 'zIndex', 'pointerEvents', 'margin'].forEach((k) => { c.style[k] = ''; });
        ev.target.cancel();
      };
    });
    setTimeout(() => { busy = false; }, 420);
  }
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => { x.setAttribute('aria-selected', String(x === t)); x.tabIndex = x === t ? 0 : -1; });
    placeInk(t);
    filter(t.dataset.f);
  }));
  $('.tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.indexOf(sel());
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    n.focus();
    n.click();
  });

  const sheet = $('#sheet');
  const card = $('.sheet-card', sheet);
  const ph = $('#sheetPh');
  const phImg = $('img', ph);
  const quote = $('.sheet-quote', ph);
  let from = null;
  let sbusy = false;
  const D = 520;
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
  function ghost(src, r, paper, radius) {
    const g = document.createElement('div');
    g.className = `sheet-ghost${paper ? ' is-paper' : ''}`;
    if (!paper) { const im = document.createElement('img'); im.src = src; im.alt = ''; g.appendChild(im); }
    Object.assign(g.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: radius });
    document.body.appendChild(g);
    return g;
  }
  const kf = (a, b) => [
    { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` },
    { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` },
  ];
  function open(btn) {
    if (sbusy) return;
    sbusy = true;
    from = btn;
    const data = DISH[btn.dataset.dish];
    const srcPh = $('.mc-ph', btn);
    const srcImg = $('img', srcPh);
    const paper = !srcImg;
    if (paper) phImg.removeAttribute('src'); else phImg.src = srcImg.currentSrc || srcImg.src;
    phImg.alt = paper ? '' : srcImg.alt;
    ph.classList.toggle('is-paper', paper);
    quote.innerHTML = paper ? $('.mc-quote', srcPh).innerHTML : '';
    $('.sheet-w', sheet).textContent = data.w;
    $('.sheet-t', sheet).textContent = data.t;
    $('.sheet-p', sheet).textContent = data.p;
    $('.sheet-d', sheet).textContent = data.d;
    sheet.hidden = false;
    root.classList.add('sheet-open');
    document.body.style.overflow = 'hidden';
    history.pushState({ sheet: btn.dataset.dish }, '');
    const a = rectOf(srcPh);
    requestAnimationFrame(() => {
      sheet.classList.add('is-on');
      const b = rectOf(ph);
      if (reduce || !document.body.animate) {
        sheet.classList.add('is-text');
        sbusy = false;
        $('.sheet-x', sheet).focus({ preventScroll: true });
        return;
      }
      ph.style.visibility = 'hidden';
      const phone = vw <= 768;
      card.animate(phone ? [{ transform: 'translateY(40%)', opacity: 0 }, { transform: 'none', opacity: 1 }] : [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: D, easing: EZ });
      const g = ghost(phImg.getAttribute('src'), a, paper, '16px');
      g.animate(kf(a, phone ? rectOf(ph) : b), { duration: D, easing: EZ, fill: 'forwards' });
      setTimeout(() => sheet.classList.add('is-text'), 160);
      setTimeout(() => {
        ph.style.visibility = '';
        g.remove();
        sbusy = false;
        $('.sheet-x', sheet).focus({ preventScroll: true });
      }, D + 20);
    });
  }
  function close(fromPop) {
    if (sheet.hidden || sbusy) return;
    sbusy = true;
    const finish = () => {
      sheet.hidden = true;
      sheet.classList.remove('is-on', 'is-text');
      root.classList.remove('sheet-open');
      document.body.style.overflow = '';
      sbusy = false;
      if (from) from.focus({ preventScroll: true });
    };
    if (!fromPop && history.state && history.state.sheet) history.back();
    if (reduce || !document.body.animate || !from) { finish(); return; }
    const a = rectOf(ph);
    const b = rectOf($('.mc-ph', from));
    const paper = ph.classList.contains('is-paper');
    const g = ghost(phImg.getAttribute('src'), a, paper, '0px');
    ph.style.visibility = 'hidden';
    sheet.classList.remove('is-on', 'is-text');
    card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    g.animate([...kf(a, b)].map((k, i) => ({ ...k, borderRadius: i ? '16px' : '0px' })), { duration: 460, easing: EZ, fill: 'forwards' });
    setTimeout(() => {
      g.remove();
      ph.style.visibility = '';
      card.getAnimations().forEach((an) => an.cancel());
      finish();
    }, 470);
  }
  cards.forEach((c) => c.addEventListener('click', () => open(c)));
  sheet.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!sheet.hidden) close(false); closeMega(0); closeMenu(); } });
  window.addEventListener('popstate', () => { if (!sheet.hidden) close(true); });
  card.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = $$('a[href], button', card).filter((x) => x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
}

function sceneProgress(el) {
  const r = el.getBoundingClientRect();
  const span = r.height - window.innerHeight;
  return span > 0 ? clamp(-r.top / span, 0, 1) : 0;
}

function grill() {
  const sec = $('#brand');
  const cards = $$('.gcard', sec);
  const shades = cards.map((c) => $('.gshade', c));
  const imgs = cards.map((c) => $('img', c));
  const texts = $$('.gt', sec);
  const btns = $$('#gsteps button');
  texts.forEach((t) => {
    [$('.gt-k', t), $('.gt-h', t)].forEach((el, j) => {
      const inner = el.innerHTML;
      el.innerHTML = `<span class="gt-line"><span style="--d:${j * 80}ms">${inner}</span></span>`;
    });
  });
  const map = (p) => {
    if (p < 0.12) return 0;
    if (p < 0.42) return eio((p - 0.12) / 0.3);
    if (p < 0.58) return 1;
    if (p < 0.88) return 1 + eio((p - 0.58) / 0.3);
    return 2;
  };
  const stops = [0.04, 0.5, 0.97];
  let stage = -1;
  let sp = 0;
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '100px 0px' }).observe(sec);
  function setStage(s) {
    if (s === stage) return;
    stage = s;
    texts.forEach((t, i) => t.classList.toggle('is-on', i === s));
    btns.forEach((b, i) => { b.classList.toggle('is-on', i <= s); b.setAttribute('aria-current', i === s ? 'step' : 'false'); });
  }
  btns.forEach((b, i) => b.addEventListener('click', () => {
    const top = sec.getBoundingClientRect().top + window.scrollY;
    scrollToY(top + stops[i] * (sec.offsetHeight - window.innerHeight));
  }));
  setStage(0);
  tasks.add((dt) => {
    if (!visible) return;
    const target = sceneProgress(sec);
    sp += (target - sp) * (reduce ? 1 : damp(dt, 12));
    if (Math.abs(target - sp) < 0.0005) sp = target;
    const f = map(sp);
    setStage(f < 0.5 ? 0 : f < 1.5 ? 1 : 2);
    cards.forEach((c, i) => {
      const d = i - f;
      let x = 0;
      let s = 1;
      let dark = 0;
      if (d > 0) { x = Math.min(d, 1.05) * 104; }
      else { const q = Math.min(-d, 1); x = -q * 30; s = 1 - q * 0.1; dark = q * 0.55; }
      c.style.transform = `translate3d(${x.toFixed(2)}%, 0, 0) scale(${s.toFixed(4)})`;
      c.style.visibility = d > 1.04 || d < -1.6 ? 'hidden' : 'visible';
      shades[i].style.opacity = dark.toFixed(3);
      imgs[i].style.transform = d > 0 ? `translate3d(${(-Math.min(d, 1) * 30).toFixed(2)}%, 0, 0) scale(1.08)` : 'scale(1.08)';
    });
    btns.forEach((b, i) => b.style.setProperty('--f', clamp(f + 1 - i, 0, 1).toFixed(4)));
  });
}

function rail() {
  const box = $('#rail');
  const track = $('.rail-track', box);
  const items = $$('.rc', track);
  const thumb = $('.rail-bar i');
  let x = 0;
  let v = 0;
  let min = 0;
  let drag = null;
  let moved = 0;
  let tilt = 0;
  let idle = true;
  function bounds() { min = Math.min(0, box.clientWidth - track.scrollWidth); }
  bounds();
  box.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    bounds();
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: x, lx: e.clientX, lt: performance.now(), axis: null };
    moved = 0;
    v = 0;
    idle = false;
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (!drag.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.axis === 'y') { drag = null; return; }
      box.classList.add('is-drag');
      try { box.setPointerCapture(e.pointerId); } catch (err) { void err; }
    }
    moved = Math.max(moved, Math.abs(dx));
    let nx = drag.x0 + dx;
    if (nx > 0) nx *= 0.35;
    if (nx < min) nx = min + (nx - min) * 0.35;
    const now = performance.now();
    const ddt = Math.max(1, now - drag.lt);
    v = v * 0.4 + ((e.clientX - drag.lx) / ddt) * 16.67 * 0.6;
    drag.lx = e.clientX;
    drag.lt = now;
    x = nx;
  }, { passive: true });
  const end = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    drag = null;
    box.classList.remove('is-drag');
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  box.addEventListener('click', (e) => { if (moved > 8) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
  track.addEventListener('dragstart', (e) => e.preventDefault());
  let lastT = '';
  tasks.add((dt) => {
    if (!drag && !idle) {
      const f = Math.pow(0.92, dt * 60);
      x += v * dt * 60;
      v *= f;
      if (x > 0) { x += (0 - x) * damp(dt, 12); v *= 0.5; }
      if (x < min) { x += (min - x) * damp(dt, 12); v *= 0.5; }
      if (Math.abs(v) < 0.05 && x <= 0.2 && x >= min - 0.2) { v = 0; idle = true; x = clamp(x, min, 0); }
    }
    const tt = clamp(-v * (drag ? 0.2 : 0.14), -3, 3);
    tilt += (tt - tilt) * damp(dt, 10);
    if (idle && Math.abs(tilt) < 0.01) tilt = 0;
    const key = `${x.toFixed(2)}|${tilt.toFixed(3)}`;
    if (key === lastT) return;
    lastT = key;
    track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
    items.forEach((it) => { it.style.transform = tilt ? `rotate(${tilt.toFixed(3)}deg)` : ''; });
    const span = track.scrollWidth - box.clientWidth;
    const tw = clamp(box.clientWidth / track.scrollWidth, 0.12, 1);
    const bw = thumb.parentElement.clientWidth;
    thumb.style.width = `${tw * 100}%`;
    thumb.style.transform = `translate3d(${(span > 0 ? clamp(-x / span, 0, 1) : 0) * bw * (1 - tw)}px, 0, 0)`;
  });
  window.addEventListener('resize', () => { bounds(); x = clamp(x, min, 0); lastT = ''; });
}

function heroDrift() {
  if (reduce) return;
  const hero = $('.hero');
  const inner = $('.hero-ph-in');
  let cur = 0;
  tasks.add((dt) => {
    const h = hero.offsetHeight;
    const y = window.scrollY;
    if (y > h * 1.2 && cur > h * 0.2) return;
    const t = clamp(y, 0, h) * 0.22;
    cur += (t - cur) * damp(dt, 14);
    inner.style.transform = `translate3d(0, ${cur.toFixed(2)}px, 0)`;
  });
}

function photoDrift() {
  const figs = $$('.fr-ph, .store-ph').map((f) => ({ f, img: $('img', f) }));
  if (reduce) return;
  tasks.add(() => {
    figs.forEach(({ f, img }) => {
      if (!f.classList.contains('is-in')) return;
      const r = f.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) return;
      const q = clamp((vh - r.top) / (vh + r.height), 0, 1);
      img.style.transform = `translate3d(0, ${((q - 0.5) * -8).toFixed(2)}%, 0) scale(1.1)`;
    });
  });
}

function magnetic() {
  if (!fine || reduce) return;
  const items = $$('[data-mag]').map((el) => ({ el, inner: $('.mag-in', el), x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, near: false, rest: true }));
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    for (const m of items) {
      const r = m.el.getBoundingClientRect();
      if (!r.width) continue;
      const dx = e.clientX - (r.left + r.width / 2 - m.x);
      const dy = e.clientY - (r.top + r.height / 2 - m.y);
      const reach = Math.max(r.width, r.height) * 0.5 + 40;
      m.near = Math.hypot(dx, dy) < reach;
      m.tx = m.near ? clamp(dx * 0.18, -6, 6) : 0;
      m.ty = m.near ? clamp(dy * 0.18, -6, 6) : 0;
    }
  }, { passive: true });
  let acc = 0;
  tasks.add((dt) => {
    acc = Math.min(acc + dt * 60, 4);
    while (acc >= 1) {
      for (const m of items) {
        m.vx = (m.vx + (m.tx - m.x) * 0.16) * 0.74;
        m.vy = (m.vy + (m.ty - m.y) * 0.16) * 0.74;
        m.x += m.vx; m.y += m.vy;
      }
      acc -= 1;
    }
    for (const m of items) {
      const still = !m.near && Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05 && Math.abs(m.vx) < 0.05 && Math.abs(m.vy) < 0.05;
      if (still) {
        if (!m.rest) { m.x = m.y = m.vx = m.vy = 0; m.el.style.translate = ''; if (m.inner) m.inner.style.translate = ''; m.rest = true; }
        continue;
      }
      m.rest = false;
      m.el.style.translate = `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px`;
      if (m.inner) m.inner.style.translate = `${(m.x * 0.4).toFixed(2)}px ${(m.y * 0.4).toFixed(2)}px`;
    }
  });
}

function appbar() {
  const links = $$('#appbar a[data-sec]');
  const owner = { home: 'home', ssam: 'menu', menu: 'menu', community: 'store' };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const key = owner[e.target.id] || '';
      links.forEach((a) => {
        const on = a.dataset.sec === key;
        a.classList.toggle('is-on', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section').forEach((s) => io.observe(s));
}

steam();
createBurn($('#heroPh'), { reduce });
const ssam = createSsam($('#ssamStage'), { reduce, tasks });
menu();
grill();
rail();
heroDrift();
photoDrift();
magnetic();
appbar();
onScroll();

let rw = window.innerWidth;
let rTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(rTimer);
  rTimer = setTimeout(() => {
    vh = window.innerHeight;
    if (window.innerWidth === rw) return;
    rw = window.innerWidth;
    vw = rw;
    lineEls.forEach((el) => lineDelays(el));
    if (vw > 1100) closeMenu();
    if (ssam) ssam.layout();
  }, 200);
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, Math.max(0.001, (now - last) / 1000));
  last = now;
  requestAnimationFrame(frame);
  if (document.hidden) return;
  tasks.forEach((t) => {
    try { t(dt); } catch (err) { tasks.delete(t); console.error(err); }
  });
}
requestAnimationFrame(frame);
window.__mj3 = { clock, statusNow };
