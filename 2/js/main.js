import { createNakhwa, NK } from './nakhwa.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
const phoneMQ = matchMedia('(max-width: 768px)');

// ───────── rAF 루프 하나 ─────────
const tasks = new Set();
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tasks.forEach((t) => t(dt, now));
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ───────── 머리글: 내리면 숨고 올리면 나타남 + 메가 메뉴 ─────────
const hd = $('#hd');
const gnb = $('#gnb');
let lastY = window.scrollY;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (hd.classList.contains('is-mega')) { lastY = y; return; }
  if (y > lastY + 6 && y > 140) hd.classList.add('is-hidden');
  else if (y < lastY - 6 || y < 140) hd.classList.remove('is-hidden');
  lastY = y;
}, { passive: true });

const openMega = () => { if (!phoneMQ.matches) hd.classList.add('is-mega'); };
const closeMega = () => hd.classList.remove('is-mega');
gnb.addEventListener('mouseenter', openMega);
hd.addEventListener('mouseleave', closeMega);
gnb.addEventListener('focusin', openMega);
gnb.addEventListener('focusout', (e) => { if (!gnb.contains(e.relatedTarget)) closeMega(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeMega(); closeSheet(); }
});
$$('a', gnb).forEach((a) => a.addEventListener('click', () => { closeMega(); a.blur(); }));

// ───────── 폰 전체 메뉴 ─────────
const sheet = $('#sheet');
const menuBtn = $('.hd__menu');
$('.sheet__nav', sheet).append($('.gnb__list', gnb).cloneNode(true));
function openSheet() {
  sheet.hidden = false;
  menuBtn.setAttribute('aria-expanded', 'true');
  document.documentElement.style.overflow = 'hidden';
  $('.sheet__close', sheet).focus();
}
function closeSheet() {
  if (sheet.hidden) return;
  sheet.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
  document.documentElement.style.overflow = '';
}
menuBtn.addEventListener('click', openSheet);
$('.sheet__close', sheet).addEventListener('click', () => { closeSheet(); menuBtn.focus(); });
sheet.addEventListener('click', (e) => { if (e.target.closest('a')) closeSheet(); });

// 아직 없는 하위 페이지: 눌러도 깨지지 않게
const toast = $('.toast');
let toastT = 0;
function say(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { toast.hidden = true; }, 1800);
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-soon]');
  if (!a) return;
  e.preventDefault();
  say('준비 중인 페이지입니다');
});

// ───────── 2. 낙화 무대 ─────────
const stageEl = $('#nakhwa');
const hint = $('.nk__hint', stageEl);
let nk = null;
try {
  nk = createNakhwa(stageEl, {
    reduceMotion,
    isTouch,
    muralSrc: '../assets/art/anak3_kitchen_commons.jpg',
    tileSrc: '../assets/art/hanji_linen_tile.jpg',
    onFirstBurn: () => hint.classList.add('is-off'),
  });
  nk.loaded.catch((err) => { console.warn(err); stageEl.classList.add('is-still'); });
} catch (err) {
  stageEl.classList.add('is-still');
}
if (nk) {
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: '60px 0px' }).observe(stageEl);
  tasks.add((dt) => { if (visible) nk.update(dt); });
  $('.nk__reset').addEventListener('click', () => {
    hint.classList.remove('is-off');
    nk.reset();
  });
  window.__nk = { NK, stats: () => nk.stats() };
}

// ───────── 4. 3단 마이야르: 화면에 붙는 구간(PC만) ─────────
const film = $('.mf');
const track = $('.mf__track');
const photos = $$('.mf__ph');
const steps = $$('.mf__step');
const bars = $$('.mf__bar i');
let filmOn = false;
let filmStep = 0;
new IntersectionObserver(([en]) => { filmOn = en.isIntersecting; }, { rootMargin: '100px 0px' }).observe(film);
tasks.add(() => {
  if (!filmOn || phoneMQ.matches) return;
  const r = track.getBoundingClientRect();
  const span = r.height - window.innerHeight;
  const p = clamp(-r.top / Math.max(1, span), 0, 1);
  const o1 = sstep(0.27, 0.40, p);
  const o2 = sstep(0.60, 0.73, p);
  photos[1].style.opacity = o1.toFixed(3);
  photos[2].style.opacity = o2.toFixed(3);
  photos.forEach((ph, i) => {
    const local = clamp(p * 3 - i, 0, 1);
    ph.style.transform = reduceMotion ? '' : `scale(${(1.08 - local * 0.08).toFixed(4)})`;
  });
  bars.forEach((b, i) => b.style.setProperty('--f', clamp(p * 3 - i, 0, 1).toFixed(3)));
  // 글자는 진행률에 묶지 않고, 기준점을 넘을 때 시간으로 재생
  const idx = p < 0.335 ? 0 : p < 0.665 ? 1 : 2;
  if (idx !== filmStep) {
    filmStep = idx;
    steps.forEach((s, i) => s.classList.toggle('is-on', i === idx));
  }
});

// ───────── 폰 아래 앱바: 지금 보는 구역 ─────────
const appLinks = $$('.appbar a[data-sec]');
const secMap = { top: 'top', brand: 'top', maillard: 'menu', menu: 'menu', master: 'menu', business: 'visit', jumak: 'visit', visit: 'visit', franchise: 'franchise', news: 'franchise' };
const watched = Object.keys(secMap).map((id) => document.getElementById(id)).filter(Boolean);
const io = new IntersectionObserver((ens) => {
  ens.forEach((en) => {
    if (!en.isIntersecting) return;
    const key = secMap[en.target.id];
    appLinks.forEach((a) => {
      const on = a.dataset.sec === key;
      a.classList.toggle('is-on', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-45% 0px -50% 0px' });
watched.forEach((el) => io.observe(el));

// ───────── 창업 문의: 화면 안에서만 접수 표시 ─────────
const form = $('#inquiry');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const fields = $$('input', form);
  let ok = true;
  fields.forEach((f) => {
    const bad = f.type === 'checkbox' ? !f.checked : !f.value.trim();
    if (f.type !== 'checkbox') f.setAttribute('aria-invalid', bad ? 'true' : 'false');
    if (bad) ok = false;
  });
  $('.fr__err', form).hidden = ok;
  if (!ok) {
    const first = fields.find((f) => (f.type === 'checkbox' ? !f.checked : !f.value.trim()));
    first && first.focus();
    return;
  }
  form.classList.add('is-done');
  $('.fr__done', form).hidden = false;
  form.reset();
});

// ───────── 리사이즈: 200ms 디바운스, 폭이 같으면 다시 계산 안 함 ─────────
let rzT = 0;
let lastW = window.innerWidth;
window.addEventListener('resize', () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => {
    const w = window.innerWidth;
    if (w === lastW) return;
    lastW = w;
    if (!phoneMQ.matches) closeSheet();
    nk && nk.resize();
  }, 200);
});
