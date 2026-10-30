// 요소별 인터랙션 — 첫 화면(발묵) 아래 모든 섹션. 숨김은 html.mo 아래에서만, 한 번 나타나면 다시 숨지 않는다.
(() => {
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const anim = root.classList.contains('mo') && !reduce;
  const main = $('#main');
  const scope = (s) => $$(s).filter((el) => !el.closest('.hero'));

  /* ---------- 1. 표시 붙이기 ---------- */
  const mark = (els, type, step) => els.forEach((el) => { if (!el.dataset.mo) { el.dataset.mo = type; if (step) el.dataset.moStep = step; } });

  // 먹 번짐: 큰 한자 + 섹션 제목 두 곳
  mark(scope('.hanja'), 'ink');
  mark([$('#origin-h'), $('#jumak-h')].filter(Boolean), 'ink');

  // 큰 제목: 줄마다 선 아래에서 올라옴
  function splitLines(el) {
    const nodes = [...el.childNodes];
    el.textContent = '';
    nodes.forEach((n) => {
      if (n.nodeName === 'BR') { el.append(document.createElement('br')); return; }
      if (n.nodeType !== 3) { const o = document.createElement('span'); o.className = 'ml'; const i = document.createElement('span'); i.className = 'ml-i'; i.append(n); o.append(i); el.append(o); return; }
      n.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { el.append(' '); return; }
        const o = document.createElement('span');
        o.className = 'ml';
        const i = document.createElement('span');
        i.className = 'ml-i';
        i.textContent = part;
        o.append(i);
        el.append(o);
      });
    });
  }
  function lineIndex(el) {
    let top = null;
    let line = -1;
    $$('.ml', el).forEach((w) => {
      const t = w.offsetTop;
      if (top === null || Math.abs(t - top) > 6) { line += 1; top = t; }
      w.style.setProperty('--ld', `${line * 90}ms`);
    });
  }
  const titles = scope('.h2, .h3, .sign').filter((el) => !el.dataset.mo);
  if (anim) titles.forEach((el) => { splitLines(el); el.dataset.mo = 'lines'; });

  // 카드·메뉴 칸: 차례로(70ms)
  mark(scope('.step, .cut, .set, .side, .bz, .post'), 'card', 70);
  // 목록·줄: 차례로(80ms)
  mark(scope('.jumak__facts li, .hours tr, .store__dl > div, .fr__list li, .hist__list li, .fld, .agree, .ft__info p'), 'row', 80);
  // 작은 글·설명: 제목 다음에 16px 아래에서
  mark(scope('.lead, .body, .cite, .mural__cap, .grill__note, .menu__note, .store__addr, .store__small, .quote, .fr__state, .news__links, .store__btns, .ft__logo, .ft__copy').filter((el) => !el.closest('[data-mo]')), 'up');

  // 사진: 가림막이 한쪽으로 걷힘 + 안쪽 사진 1.08→1
  const framed = ['.step__ph', '.cut__ph', '.bz__ph'];
  const photos = [];
  scope('.step__ph img, .cut__ph img, .bz__ph img, .thennow__item img, .thennow__crop, .jumak__wide img, .jumak__ph img, .store__ph img, .side img').forEach((img) => {
    let frame = framed.map((s) => img.closest(s)).find(Boolean);
    if (!frame) {
      frame = document.createElement('div');
      frame.className = 'mo-ph';
      img.parentNode.insertBefore(frame, img);
      frame.append(img);
    }
    frame.dataset.mo = 'photo';
    img.classList.add('mo-img');
    photos.push({ frame, img, px: !!img.closest('.jumak__wide, .store__ph, .thennow__item') && fine });
  });
  photos.forEach((p) => { if (p.px) { p.img.classList.add('mo-px'); } });
  const mural = $('.mural__frame img');
  if (mural) mural.dataset.mo = 'curtain';
  mark(scope('.pin'), 'pin');
  const link = $('.thennow__link');
  if (link) link.dataset.mo = 'draw';

  // 숫자(실제 숫자만): 0에서 굴러 올라감 1.4s
  const nums = [];
  function wrapNumbers(el, re) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach((t) => {
      const s = t.textContent;
      re.lastIndex = 0;
      if (!re.test(s)) return;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      let m;
      while ((m = re.exec(s))) {
        const raw = m[1];
        const start = m.index + m[0].indexOf(raw);
        frag.append(s.slice(last, start));
        const span = document.createElement('span');
        span.className = 'mo-num';
        span.textContent = raw;
        frag.append(span);
        nums.push(span);
        last = start + raw.length;
      }
      frag.append(s.slice(last));
      t.parentNode.replaceChild(frag, t);
    });
  }
  scope('.cut__p, .cut__t span, .set__t span, .side__t span').forEach((el) => wrapNumbers(el, /(\d[\d,]*)(?=원|g)/g));
  scope('.set__p').forEach((el) => wrapNumbers(el, /(\d[\d,]*)/g));
  scope('.thennow__item figcaption b').forEach((el) => wrapNumbers(el, /(\d+)(?=년)/g));
  scope('.cut__d').forEach((el) => wrapNumbers(el, /(\d+)(?=mm|일)/g));
  nums.forEach((n) => { n.dataset.final = n.textContent; n.dataset.mo = 'num'; });

  window.__moReady = true;
  if (!anim) { root.classList.remove('mo'); return interactions(); }

  /* ---------- 2. 등장 ---------- */
  const targets = $$('[data-mo]');
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function countUp(span, instant) {
    const final = span.dataset.final;
    const target = parseInt(final.replace(/,/g, ''), 10);
    if (instant || !target) { span.textContent = final; span.style.minWidth = ''; return; }
    const comma = final.includes(',');
    span.style.minWidth = `${span.getBoundingClientRect().width}px`;
    span.classList.add('is-rolling');
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 1400);
      const v = Math.round(target * ease(t));
      span.textContent = t >= 1 ? final : (comma ? v.toLocaleString('ko-KR') : String(v));
      if (t < 1) requestAnimationFrame(tick);
      else { span.classList.remove('is-rolling'); span.style.minWidth = ''; }
    };
    requestAnimationFrame(tick);
  }
  nums.forEach((n) => { n.style.minWidth = `${n.getBoundingClientRect().width}px`; n.textContent = '0'; });

  const revealed = new WeakSet();
  const settle = (el, ms) => setTimeout(() => { el.removeAttribute('data-mo'); el.classList.remove('mo-in', 'mo-now'); el.style.removeProperty('--md'); }, ms);
  function show(el, delay, instant) {
    if (revealed.has(el)) return;
    revealed.add(el);
    if (instant) el.classList.add('mo-now');
    else el.style.setProperty('--md', `${delay}ms`);
    if (el.dataset.mo === 'lines') lineIndex(el);
    el.classList.add('mo-in');
    if (el.dataset.mo === 'num') {
      if (instant) countUp(el, true);
      else setTimeout(() => countUp(el, false), delay);
    }
    $$('.mo-num', el).forEach((n) => { if (!revealed.has(n)) show(n, delay + 200, instant); });
    if (instant) setTimeout(() => el.classList.remove('mo-now'), 50);
    if (el.dataset.mo !== 'lines') settle(el, (instant ? 0 : delay) + 2400);
  }
  const io = new IntersectionObserver((entries) => {
    const batch = [];
    entries.forEach((e) => {
      if (revealed.has(e.target)) { io.unobserve(e.target); return; }
      if (e.boundingClientRect.bottom <= 0) { show(e.target, 0, true); io.unobserve(e.target); return; }
      if (e.isIntersecting) batch.push(e.target);
    });
    batch.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    let i = 0;
    batch.forEach((el) => {
      const step = +(el.dataset.moStep || 90);
      const type = el.dataset.mo;
      const delay = type === 'pin' ? 900 + i * 120 : type === 'draw' ? 700 : Math.min(i, 8) * step;
      show(el, delay, false);
      io.unobserve(el);
      if (type !== 'num') i += 1;
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  targets.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 && r.height > 0) show(el, 0, true);
    else io.observe(el);
  });

  // 안전망: 스크롤이 멈추면 화면 안·위의 숨은 요소를 전부 표시
  let stopTimer = 0;
  const sweep = () => {
    const vh = window.innerHeight;
    targets.forEach((el) => {
      if (revealed.has(el)) return;
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0) show(el, 0, true);
      else if (r.top < vh) show(el, 0, false);
    });
  };
  window.addEventListener('scroll', () => { clearTimeout(stopTimer); stopTimer = setTimeout(sweep, 160); }, { passive: true });
  window.addEventListener('load', () => setTimeout(sweep, 300));
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    $$('[data-mo="lines"]:not(.mo-in)').forEach(lineIndex);
  });

  interactions();

  /* ---------- 3. 손 반응 ---------- */
  function interactions() {
    // 밑줄이 그려지는 글 링크
    scope('.fr__tel, .post__more summary, .store__dl a, .ft__info a').forEach((a) => {
      if (a.querySelector('.ul-t')) return;
      const s = document.createElement('span');
      s.className = 'ul-t';
      while (a.firstChild) s.append(a.firstChild);
      a.append(s);
      a.classList.add('ul');
    });

    // 머리글: 지금 섹션 표시
    const tops = $$('.gnb__top');
    const owner = { origin: '브랜드', grill: '브랜드', menu: '브랜드', jumak: '브랜드', business: '비즈니스', store: '컴퍼니', franchise: '프랜차이즈', news: '커뮤니티' };
    const secIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const name = owner[e.target.id];
        tops.forEach((t) => t.classList.toggle('is-current', t.textContent.trim() === name));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(owner).forEach((id) => { const s = document.getElementById(id); if (s) secIo.observe(s); });
    const heroEl = $('.hero');
    if (heroEl) new IntersectionObserver(([e]) => { if (e.isIntersecting && e.intersectionRatio > 0.5) tops.forEach((t) => t.classList.remove('is-current')); }, { threshold: [0, 0.5, 1] }).observe(heroEl);

    // PC에서 옆으로 넘기는 줄은 끌어 넘기기(관성)
    $$('.scroller').forEach((sc) => {
      let down = false; let sx = 0; let sl = 0; let v = 0; let lx = 0; let lt = 0; let moved = false; let raf = 0;
      sc.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || sc.scrollWidth <= sc.clientWidth + 2) return;
        down = true; moved = false; sx = lx = e.clientX; sl = sc.scrollLeft; v = 0; lt = performance.now();
        cancelAnimationFrame(raf);
        sc.classList.add('is-drag');
      });
      window.addEventListener('pointermove', (e) => {
        if (!down) return;
        const now = performance.now();
        const dx = e.clientX - sx;
        if (Math.abs(dx) > 4) moved = true;
        sc.scrollLeft = sl - dx;
        v = (e.clientX - lx) / Math.max(1, now - lt);
        lx = e.clientX; lt = now;
      }, { passive: true });
      window.addEventListener('pointerup', () => {
        if (!down) return;
        down = false;
        sc.classList.remove('is-drag');
        let vel = -v * 16;
        const glide = () => {
          if (Math.abs(vel) < 0.4) return;
          sc.scrollLeft += vel;
          vel *= 0.92;
          raf = requestAnimationFrame(glide);
        };
        glide();
      });
      sc.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
      sc.addEventListener('dragstart', (e) => e.preventDefault());
    });

    if (!fine || reduce) return;

    // rAF 하나로 손 움직임·스크롤 묶기(필요할 때만 돈다)
    const pointer = { x: -1e4, y: -1e4 };
    const damp = (dt, k) => 1 - Math.exp(-dt * k);
    scope('.hanja').forEach((h) => h.setAttribute('data-tilt', ''));
    const tilts = scope('.step, .cut, .bz, .hanja').map((el) => ({ el, rx: 0, ry: 0, tx: 0, ty: 0, live: false }));
    const mags = scope('.btn, .fr__tel, .post__more summary').filter((el) => !el.hasAttribute('data-magnetic')).map((el) => ({ el, x: 0, y: 0, tx: 0, ty: 0, live: false }));
    const pxs = photos.filter((p) => p.px);
    let raf = 0;
    let last = performance.now();
    let scrolling = 0;
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    window.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return; pointer.x = e.clientX; pointer.y = e.clientY; wake(); }, { passive: true });
    window.addEventListener('scroll', () => { scrolling = 6; wake(); }, { passive: true });
    document.addEventListener('pointerleave', () => { pointer.x = pointer.y = -1e4; wake(); });

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let busy = scrolling > 0;
      scrolling -= 1;
      const vh = window.innerHeight;
      // 카드: 손끝 쪽 기울기 최대 6°
      for (const t of tilts) {
        const r = t.el.getBoundingClientRect();
        const inside = pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
        t.tx = inside ? -((pointer.y - r.top) / r.height - 0.5) * 12 : 0;
        t.ty = inside ? ((pointer.x - r.left) / r.width - 0.5) * 12 : 0;
        const k = damp(dt, 9);
        t.rx += (t.tx - t.rx) * k;
        t.ry += (t.ty - t.ry) * k;
        if (Math.abs(t.rx) + Math.abs(t.ry) < 0.01 && !inside) {
          if (t.live) { t.el.style.transform = ''; t.live = false; }
          continue;
        }
        t.live = true;
        busy = true;
        t.el.style.transform = `perspective(900px) rotateX(${t.rx.toFixed(2)}deg) rotateY(${t.ry.toFixed(2)}deg)`;
      }
      // 버튼·링크: 자석(반경 크기/2+56px, 0.3배)
      for (const m of mags) {
        const r = m.el.getBoundingClientRect();
        if (!r.width) continue;
        const cx = r.left + r.width / 2 - m.x;
        const cy = r.top + r.height / 2 - m.y;
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const near = Math.hypot(dx, dy) < Math.max(r.width, r.height) / 2 + 56;
        m.tx = near ? dx * 0.3 : 0;
        m.ty = near ? dy * 0.3 : 0;
        const k = damp(dt, 14);
        m.x += (m.tx - m.x) * k;
        m.y += (m.ty - m.y) * k;
        if (!near && Math.abs(m.x) + Math.abs(m.y) < 0.05) {
          if (m.live) { m.el.style.translate = ''; m.live = false; }
          continue;
        }
        m.live = true;
        busy = true;
        m.el.style.translate = `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px`;
      }
      // 사진 시차(PC): 액자 안에서 ±4%
      for (const p of pxs) {
        const r = p.frame.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) continue;
        const prog = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
        p.img.style.translate = `0 ${(-prog * r.height * 0.04).toFixed(1)}px`;
      }
      raf = busy ? requestAnimationFrame(frame) : 0;
    }
    wake();
  }
})();
