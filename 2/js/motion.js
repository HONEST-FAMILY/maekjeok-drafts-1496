// 2안 요소별 인터랙션 — 들어올 때 하나 + 손 반응 하나 이상. 숨김은 html.mo 아래에서만(스크립트가 죽어도 다 보임).
// 움직이는 것: translate · scale · opacity · clip-path · filter (레이아웃은 그대로)
// 기존 스크립트와 겹치지 않게: 머리글 transform·마이야르 사진 transform 은 main.js 가 쥐고, 여기선 translate/scale 개별 속성과 감싸는 요소만 쓴다.

const html = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const phone = matchMedia('(max-width: 768px)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ───────── rAF 하나(필요할 때만 돈다) ─────────
const jobs = new Set();
let raf = 0;
function kick() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(now) {
  raf = 0;
  jobs.forEach((j) => { if (j(now) === false) jobs.delete(j); });
  if (jobs.size) kick();
}
const run = (j) => { jobs.add(j); kick(); };

// ───────── 등장: IntersectionObserver + 안전망 ─────────
const pending = new Set();
const onIn = new Map(); // 요소 → 나타날 때 할 일
let io = null;
function reveal(el, instant) {
  if (!pending.has(el)) return;
  pending.delete(el);
  io && io.unobserve(el);
  if (instant) {
    el.classList.add('mo-now');
    el.classList.add('mo-in');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('mo-now')));
  } else {
    el.classList.add('mo-in');
    // 차례 지연은 등장에만 — 끝나면 지워서 손 반응(눌림 등)이 늦지 않게
    const d = parseFloat(el.style.transitionDelay) || 0;
    if (d) setTimeout(() => { el.style.transitionDelay = ''; }, d * 1000 + 1200);
  }
  const f = onIn.get(el);
  if (f) f(instant);
}
function watch(el, cls, delayMs = 0, then) {
  if (!el || el.classList.contains(cls)) return;
  el.classList.add(cls);
  if (then) onIn.set(el, then);
  if (!active) { el.classList.add('mo-in'); if (then) then(true); return; }
  if (delayMs) el.style.transitionDelay = `${delayMs}ms`;
  pending.add(el);
  io.observe(el);
}
function sweep() {
  // 스크롤이 멈추면: 화면 안·위에 남은 숨은 요소 전부 표시(위로 지나간 건 바로)
  const vh = window.innerHeight;
  pending.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < vh) reveal(el, r.bottom < 0);
  });
}

let active = false;

// ───────── 숫자: 0에서 굴러 올라감(최종 글자는 원래 문구 그대로) ─────────
const numbers = [];
function prepNumber(el) {
  const node = [...el.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.nodeValue));
  if (!node) return null;
  const text = node.nodeValue;
  const m = text.match(/\d[\d,]*/);
  const target = parseInt(m[0].replace(/,/g, ''), 10);
  const item = { node, text, pre: text.slice(0, m.index), post: text.slice(m.index + m[0].length), target, comma: m[0].includes(',') };
  numbers.push(item);
  if (active) node.nodeValue = item.pre + '0' + item.post;
  return item;
}
function countUp(item, instant) {
  if (!item) return;
  if (instant || !active) { item.node.nodeValue = item.text; return; }
  const t0 = performance.now(), dur = 1400;
  run((now) => {
    const t = clamp((now - t0) / dur, 0, 1);
    const e = 1 - Math.pow(1 - t, 4); // 끝이 느려지게
    const v = Math.round(item.target * e);
    item.node.nodeValue = t >= 1 ? item.text : item.pre + (item.comma ? v.toLocaleString('en-US') : String(v)) + item.post;
    return t < 1;
  });
}
function restoreNumbers() { numbers.forEach((n) => { n.node.nodeValue = n.text; }); }

// ───────── 큰 제목: 줄마다 선 아래에서 올라옴 ─────────
function splitLines(h) {
  const parts = [[]];
  [...h.childNodes].forEach((n) => { if (n.nodeName === 'BR') parts.push([]); else parts[parts.length - 1].push(n); });
  h.textContent = '';
  parts.forEach((nodes, i) => {
    const line = document.createElement('span');
    line.className = 'mo-line';
    const inner = document.createElement('span');
    inner.className = 'mo-line__in';
    inner.style.transitionDelay = `${i * 90}ms`;
    nodes.forEach((n) => inner.append(n));
    line.append(inner);
    h.append(line);
  });
}

// 2안 재료: 제목 아래 그을린 선(인두가 왼→오, 끝에 불씨 점, 다 그리면 갈색으로 식음)
function addBurn(h) {
  const b = document.createElement('span');
  b.className = 'mo-burn';
  b.setAttribute('aria-hidden', 'true');
  b.innerHTML = '<i class="mo-burn__line"></i><i class="mo-burn__hot"></i><i class="mo-burn__run"><i class="mo-burn__dot"></i></i>';
  h.classList.add('mo-burn-host');
  h.append(b);
}

// ───────── 사진: 틀로 감싸 안쪽만 확대·시차 ─────────
function wrapFrame(img, extra = '') {
  if (img.parentElement.classList.contains('mo-frame')) return img.parentElement;
  const f = document.createElement('span');
  f.className = `mo-frame ${extra}`.trim();
  img.parentNode.insertBefore(f, img);
  f.append(img);
  return f;
}

function init() {
  active = html.classList.contains('mo') && !reduce;
  if (active) {
    io = new IntersectionObserver((ens) => {
      ens.forEach((en) => {
        if (en.isIntersecting) reveal(en.target, false);
        else if (en.boundingClientRect.bottom < 0) reveal(en.target, true); // 이미 위로 지나감 → 바로
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  }

  // 큰 제목
  const burnIds = ['name-title', 'master-title', 'menu-title'];
  $$('main .h2').forEach((h) => {
    splitLines(h);
    const burn = burnIds.includes(h.id);
    if (burn) addBurn(h);
    watch(h, 'mo-h');
  });
  // 큰 한자(貊炙·匠人·酒幕): 달궈졌다 식으며 아래에서 타오름
  $$('.name__hanja, .hanja-big').forEach((el) => watch(el, 'mo-heat'));

  // 작은 글·설명(제목 다음에)
  const small = [
    '.name__text p', '.name__story', '.name__mural figcaption', '.mf__lead',
    '.sets__note', '.master__text > p:not(.hanja-big)', '.master__photo figcaption', '.biz__head p',
    '.jumak__text > p:not(.hanja-big)', '.fr__text > p', '.fr__form h3',
  ];
  $$(small.join(',')).forEach((el) => watch(el, 'mo-up', 120));
  if (!$('.mf.mf--film')) $$('.mf__step').forEach((el) => watch(el, 'mo-up', 80));

  // 사진
  const photoSel = ['.cut img', '.sets__img', '.side img', '.master__photo img', '.bz img', '.jumak__photo img', '.jumak__sub', '.visit__photo img'];
  $$(photoSel.join(',')).forEach((img) => wrapFrame(img));
  $$('.pair__img > .crop, .pair__img > img').forEach((el) => wrapFrame(el));
  $$('.mo-frame').forEach((f, i) => watch(f, 'mo-ph', f.closest('.pair__img') ? (f.previousElementSibling ? 140 : 0) : 0));
  watch($('.name__pan'), 'mo-ph');
  // 마이야르: 안쪽 사진은 main.js 가 움직이므로 바깥 틀만 걷힘
  if ($('.mf.mf--film')) watch($('.mf__photos'), 'mo-clip');
  else $$('.mf__ph').forEach((el) => watch(el, 'mo-clip'));
  // 사진 시차(PC만): 감싼 틀 안에서 사진만 위아래로
  const parallax = fine && active ? $$('.master__photo .mo-frame, .jumak__photo .mo-frame, .visit__photo .mo-frame, .sets .mo-frame') : [];
  parallax.forEach((f) => f.classList.add('mo-par'));

  // 카드·메뉴 칸·목록: 차례로
  const groups = [
    ['.cuts', '.cut', 70], ['.sets__list', '.set', 70], ['.sides', '.side', 70], ['.biz__list', '.bz', 70],
    ['.pairs', '.pair', 90], ['.news__list', 'li', 80], ['.info', ':scope > div', 60], ['.fr__links', 'li', 70],
    ['.fr__fields', '.fld', 80], ['.ft__text', 'p', 70],
  ];
  groups.forEach(([box, item, step]) => {
    $$(box).forEach((b) => $$(item, b).forEach((el, i) => watch(el, ['.cut', '.set', '.side', '.bz', '.pair', 'li'].includes(item) && box !== '.fr__links' ? 'mo-card' : 'mo-up', i * step)));
  });
  watch($('.agree'), 'mo-up', 240);
  watch($('#inquiry .btn'), 'mo-fade', 300); // 자석(translate)과 겹치지 않게 투명도만
  watch($('.visit__btns'), 'mo-up', 120);
  watch($('.ft__logo'), 'mo-up');

  // 숫자(실제 숫자만): 357 · 3mm · 15일 · 가격 · g
  $$('.num, .cut__num:not(.cut__num--word), .price, .cut h3 span, .set h3 span').forEach((el) => {
    const item = prepNumber(el);
    if (!item) return;
    // 카드 안 숫자는 카드가 나타날 때, 나머지는 자기 자신이 나타날 때
    const host = el.closest('.mo-card, .mo-up') || el;
    if (host === el) watch(el, 'mo-up', 0, (inst) => countUp(item, inst));
    else {
      const prev = onIn.get(host);
      onIn.set(host, (inst) => { prev && prev(inst); countUp(item, inst); });
      if (!active) countUp(item, true);
    }
  });

  if (active) {
    let st = 0;
    window.addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(sweep, 140); }, { passive: true });
    window.addEventListener('resize', () => { clearTimeout(st); st = setTimeout(sweep, 200); });
    setTimeout(sweep, 400);
  }

  hands(parallax);
  headerCurrent();
  window.__moReady = true;
}

// ───────── 손 반응 ─────────
function hands(parallax) {
  // 1) 버튼·링크 자석(PC만): 반경 = 크기/2 + 56px, 끌림 0.3배
  const pointer = { x: -1e4, y: -1e4, moved: false };
  if (fine && !reduce) {
    document.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = true; kick(); jobs.add(pointerJob); }, { passive: true });
  }
  const magnets = fine && !reduce ? $$('main .btn, .hd__cta .btn, .fr__links a').map((el) => ({ el, x: 0, y: 0 })) : [];
  const tilts = fine && !reduce ? $$('.cut').map((el) => ({ el, rx: 0, ry: 0, tx: 0, ty: 0, on: false })) : [];
  tilts.forEach((t) => {
    t.el.addEventListener('pointerenter', () => { t.on = true; });
    t.el.addEventListener('pointerleave', () => { t.on = false; t.tx = 0; t.ty = 0; jobs.add(pointerJob); kick(); });
  });
  let last = performance.now();
  function pointerJob(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const k = 1 - Math.exp(-dt * 14);
    let busy = false;
    const vh = window.innerHeight;
    magnets.forEach((m) => {
      const r = m.el.getBoundingClientRect();
      let gx = 0, gy = 0;
      if (r.bottom > 0 && r.top < vh) {
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = pointer.x - cx, dy = pointer.y - cy;
        const rad = Math.max(r.width, r.height) / 2 + 56;
        if (Math.hypot(dx, dy) < rad) { gx = dx * 0.3; gy = dy * 0.3; }
      }
      m.x += (gx - m.x) * k;
      m.y += (gy - m.y) * k;
      if (Math.abs(gx - m.x) > 0.05 || Math.abs(gy - m.y) > 0.05) busy = true;
      m.el.style.translate = Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05 && !gx && !gy ? '' : `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px`;
    });
    tilts.forEach((t) => {
      if (t.on) {
        const r = t.el.getBoundingClientRect();
        const nx = clamp((pointer.x - r.left) / r.width * 2 - 1, -1, 1);
        const ny = clamp((pointer.y - r.top) / r.height * 2 - 1, -1, 1);
        t.tx = nx * 6; t.ty = -ny * 6; // 손끝 쪽으로 최대 6°
      }
      t.rx += (t.ty - t.rx) * k;
      t.ry += (t.tx - t.ry) * k;
      if (Math.abs(t.ty - t.rx) > 0.02 || Math.abs(t.tx - t.ry) > 0.02) busy = true;
      t.el.style.transform = Math.abs(t.rx) < 0.02 && Math.abs(t.ry) < 0.02 && !t.on ? '' : `perspective(900px) rotateX(${t.rx.toFixed(2)}deg) rotateY(${t.ry.toFixed(2)}deg)`;
    });
    const go = busy || pointer.moved;
    pointer.moved = false;
    return go;
  }

  // 2) 사진 시차(PC만, 이동 폭 = 틀 높이의 6%)
  if (parallax.length) {
    const par = () => {
      const vh = window.innerHeight;
      parallax.forEach((f) => {
        const r = f.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const p = clamp(((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2), -1, 1);
        const img = f.firstElementChild;
        img.style.translate = `0 ${(-p * r.height * 0.03).toFixed(1)}px`;
      });
      return false;
    };
    window.addEventListener('scroll', () => run(par), { passive: true });
    run(par);
  }

  // 3) 옆으로 넘기는 줄: PC에서 끌어 넘기기(관성)
  if (fine) {
    $$('.cuts, .sides, .biz__list, .name__pan').forEach((row) => {
      let down = false, sx = 0, sl = 0, v = 0, lx = 0, lt = 0, moved = 0;
      row.addEventListener('dragstart', (e) => e.preventDefault());
      row.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || row.scrollWidth <= row.clientWidth + 2) return;
        down = true; moved = 0; sx = lx = e.clientX; sl = row.scrollLeft; v = 0; lt = performance.now();
        row.setPointerCapture(e.pointerId);
        row.classList.add('mo-drag');
      });
      row.addEventListener('pointermove', (e) => {
        if (!down) return;
        const now = performance.now();
        row.scrollLeft = sl - (e.clientX - sx);
        v = (e.clientX - lx) / Math.max(1, now - lt) * 16;
        lx = e.clientX; lt = now;
        moved = Math.max(moved, Math.abs(e.clientX - sx));
      });
      const up = () => {
        if (!down) return;
        down = false;
        row.classList.remove('mo-drag');
        run(() => { row.scrollLeft -= v; v *= 0.93; return Math.abs(v) > 0.3; });
      };
      row.addEventListener('pointerup', up);
      row.addEventListener('pointercancel', up);
      row.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    });
  }
}

// 머리글: 지금 보는 구역이 메뉴에 따라감
function headerCurrent() {
  const tops = $$('#gnb .gnb__top');
  const byHref = (h) => tops.find((a) => a.getAttribute('href') === h);
  const map = { brand: '#brand', maillard: '#brand', menu: '#brand', master: '#brand', business: '#business', jumak: '#brand', visit: '#about', franchise: '#franchise', news: '#news' };
  const cur = new IntersectionObserver((ens) => {
    ens.forEach((en) => {
      if (!en.isIntersecting) return;
      const a = byHref(map[en.target.id]);
      tops.forEach((t) => t.classList.toggle('is-cur', t === a));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(map).forEach((id) => { const el = document.getElementById(id); if (el) cur.observe(el); });
  const top = document.getElementById('top');
  if (top) new IntersectionObserver(([en]) => { if (en.isIntersecting) tops.forEach((t) => t.classList.remove('is-cur')); }, { rootMargin: '-45% 0px -50% 0px' }).observe(top);
}

try {
  init();
} catch (err) {
  console.warn(err);
  html.classList.remove('mo');
  restoreNumbers();
  window.__moReady = true;
}
