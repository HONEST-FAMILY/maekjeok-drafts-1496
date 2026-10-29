import { createInk } from './ink.js';

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const damp = (dt, k) => 1 - Math.exp(-dt * k);

const tasks = [];

/* ---------- 머리글: 내리면 숨고 올리면 나타남, 첫 화면을 지나면 먹 바탕 ---------- */
const hd = $('#hd');
const hero = $('.hero');
let lastY = window.scrollY;
function onScroll() {
  const y = window.scrollY;
  const solidAt = (hero ? hero.offsetHeight : 600) - 80;
  hd.classList.toggle('is-solid', y > solidAt);
  const goingDown = y > lastY + 4;
  const goingUp = y < lastY - 4;
  if (!hd.classList.contains('is-open') && !root.classList.contains('menu-open')) {
    if (goingDown && y > 160) hd.classList.add('is-hidden');
    else if (goingUp || y < 160) hd.classList.remove('is-hidden');
  }
  if (Math.abs(y - lastY) > 4) lastY = y;
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- 메가 메뉴(0.25초 안) ---------- */
const gnb = $('#gnb');
let closeTimer = 0;
const openMega = () => { clearTimeout(closeTimer); hd.classList.add('is-open'); hd.classList.remove('is-hidden'); };
const closeMega = (delay = 140) => { clearTimeout(closeTimer); closeTimer = setTimeout(() => hd.classList.remove('is-open'), delay); };
if (gnb) {
  gnb.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') openMega(); });
  hd.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') closeMega(); });
  $('.mega-bg', hd).addEventListener('pointerenter', () => clearTimeout(closeTimer));
  gnb.addEventListener('focusin', openMega);
  hd.addEventListener('focusout', (e) => { if (!hd.contains(e.relatedTarget)) closeMega(0); });
  $$('.hd__act a, .hd__logo', hd).forEach((a) => a.addEventListener('pointerenter', () => closeMega(60)));
  $$('a', gnb).forEach((a) => a.addEventListener('click', () => closeMega(0)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMega(0); closeMenu(); } });
}

/* ---------- 폰 전체 화면 메뉴 ---------- */
const burger = $('.hd__burger');
const mnav = $('#mnav');
const groups = $('#mnavGroups');
if (gnb && groups) {
  groups.innerHTML = $$('.gnb__item', gnb).map((item) => {
    const top = $('.gnb__top', item);
    const soon = $('.gnb__soon', item);
    const subs = $$('.gnb__sub a', item).map((a) => `<li><a class="sub" href="${a.getAttribute('href')}"${a.hasAttribute('data-soon') ? ' data-soon' : ''}>${a.textContent}</a></li>`).join('');
    return `<div class="mnav__g"><a class="mnav__h" href="${top.getAttribute('href')}">${top.textContent}${soon ? `<small>${soon.textContent}</small>` : ''}</a><ul>${subs}</ul></div>`;
  }).join('');
}
function openMenu() {
  mnav.hidden = false;
  requestAnimationFrame(() => mnav.classList.add('is-on'));
  root.classList.add('menu-open');
  hd.classList.add('is-open');
  hd.classList.remove('is-hidden');
  burger.setAttribute('aria-expanded', 'true');
  burger.setAttribute('aria-label', '전체 메뉴 닫기');
  document.body.style.overflow = 'hidden';
}
function closeMenu() {
  if (!mnav || mnav.hidden) return;
  mnav.classList.remove('is-on');
  root.classList.remove('menu-open');
  hd.classList.remove('is-open');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-label', '전체 메뉴 열기');
  document.body.style.overflow = '';
  setTimeout(() => { if (!mnav.classList.contains('is-on')) mnav.hidden = true; }, 260);
}
if (burger) burger.addEventListener('click', () => (mnav.hidden ? openMenu() : closeMenu()));
if (mnav) mnav.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });

/* 없는 하위 페이지(href="#")는 눌러도 아무 데도 가지 않게 */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-soon], a[href="#"]');
  if (a) e.preventDefault();
});

/* ---------- 첫 화면 제목 글자 마스크 등장(한 번) ---------- */
function splitTitle() {
  const el = $('[data-split]');
  if (!el) return;
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  el.classList.add('split');
  let i = 0;
  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) { el.append(' '); return; }
    const w = document.createElement('span');
    w.className = 'w';
    w.setAttribute('aria-hidden', 'true');
    [...part].forEach((ch) => {
      const c = document.createElement('span');
      c.className = 'c';
      c.textContent = ch;
      c.style.transitionDelay = `${120 + i * 55}ms`;
      i += 1;
      w.append(c);
    });
    el.append(w);
  });
  root.classList.add('js-intro');
  const go = () => requestAnimationFrame(() => { el.classList.add('is-in'); root.classList.add('is-ready'); });
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]).then(go);
}
if (!reduce) splitTitle();

/* ---------- 자석 버튼(마우스 기기만) ---------- */
function magnetic() {
  if (!fine || reduce) return;
  const items = $$('[data-magnetic]').map((el) => ({ el, inner: $('.mag-inner', el), x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, near: false, rest: true }));
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    for (const m of items) {
      const r = m.el.getBoundingClientRect();
      if (!r.width) continue;
      const dx = e.clientX - (r.left + r.width / 2 - m.x);
      const dy = e.clientY - (r.top + r.height / 2 - m.y);
      const reach = Math.max(r.width, r.height) * 0.5 + 40;
      m.near = Math.hypot(dx, dy) < reach;
      m.tx = m.near ? dx * 0.3 : 0;
      m.ty = m.near ? dy * 0.3 : 0;
    }
  }, { passive: true });
  let acc = 0;
  tasks.push((dt) => {
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
        if (!m.rest) { m.x = m.y = m.vx = m.vy = 0; m.el.style.transform = ''; if (m.inner) m.inner.style.transform = ''; m.rest = true; }
        continue;
      }
      m.rest = false;
      m.el.style.transform = `translate3d(${m.x.toFixed(2)}px, ${m.y.toFixed(2)}px, 0)`;
      if (m.inner) m.inner.style.transform = `translate3d(${(m.x * 0.4).toFixed(2)}px, ${(m.y * 0.4).toFixed(2)}px, 0)`;
    }
  });
}
magnetic();

/* ---------- 발묵 장면 ---------- */
let ink = null;
let inkVisible = true;
function initInk() {
  const canvas = $('#ink');
  if (!canvas || reduce) return;
  try {
    ink = createInk(canvas, { isTouch, host: hero });
  } catch (err) {
    console.warn(err);
    ink = null;
  }
  if (!ink) return;   // WebGL2 없으면 산수화 정지 그림 그대로
  ink.setMask($('.hero__title'));
  ink.resize();
  canvas.classList.add('is-on');
  new IntersectionObserver(([e]) => { inkVisible = e.isIntersecting; }, { rootMargin: '60px 0px' }).observe(hero);
  window.__ink = ink;
}

/* ---------- 앱바: 지금 보는 구역 ---------- */
function appbar() {
  const links = $$('#appbar a[data-sec]');
  const map = { top: 'top', menu: 'menu', store: 'store', franchise: 'franchise' };
  const sections = ['top', 'origin', 'grill', 'menu', 'business', 'jumak', 'store', 'franchise', 'news'].map((id) => document.getElementById(id)).filter(Boolean);
  const owner = { top: 'top', origin: 'top', grill: 'menu', menu: 'menu', business: 'menu', jumak: 'store', store: 'store', franchise: 'franchise', news: 'franchise' };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const key = map[owner[e.target.id]];
      links.forEach((a) => {
        const on = a.dataset.sec === key;
        a.classList.toggle('is-on', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => io.observe(s));
}
appbar();

/* ---------- 영업시간: 오늘 줄 표시 ---------- */
(function today() {
  const d = new Date().getDay();
  $$('.hours tr[data-days]').forEach((tr) => {
    if (tr.dataset.days.split(',').map(Number).includes(d)) tr.classList.add('is-today');
  });
})();

/* ---------- 창업 문의: 화면 안에서만 접수 표시(전송 없음) ---------- */
(function form() {
  const f = $('#inquiry');
  if (!f) return;
  const err = $('.inq__err', f);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = f.name.value.trim();
    const tel = f.tel.value.trim();
    const area = f.area.value.trim();
    let msg = '';
    if (!name) msg = '이름을 적어 주세요.';
    else if (tel.replace(/\D/g, '').length < 9) msg = '연락처를 확인해 주세요.';
    else if (!area) msg = '창업 희망 지역을 적어 주세요.';
    else if (!f.agree.checked) msg = '개인정보 수집·이용에 동의해 주세요.';
    err.textContent = msg;
    if (msg) return;
    f.classList.add('is-done');
    const done = $('.inq__done', f);
    done.hidden = false;
    done.setAttribute('tabindex', '-1');
    done.focus({ preventScroll: true });
  });
})();

/* ---------- 리사이즈: 200ms 디바운스, 폭이 같으면 다시 계산 안 함 ---------- */
let rw = window.innerWidth;
let rTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(rTimer);
  rTimer = setTimeout(() => {
    if (window.innerWidth === rw) { if (ink) ink.measure(); return; }
    rw = window.innerWidth;
    if (ink) ink.resize();
    if (window.innerWidth > 900) closeMenu();
  }, 200);
});

/* ---------- rAF 루프 1개 ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  for (const t of tasks) t(dt);
  if (ink && inkVisible && !document.hidden) ink.update(dt);
  requestAnimationFrame(frame);
}

initInk();
if (document.fonts) document.fonts.ready.then(() => { if (ink) ink.measure(); });
requestAnimationFrame(frame);
