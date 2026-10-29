/* 맥적 3안 — 공통 동작 (외부 라이브러리 없음) */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const isPhone = () => window.innerWidth <= 768;

  /* ── 오늘의 맥적: 요일별 영업시간(공휴일 제외), 새벽 마감은 전날 영업 ── */
  // [여는 시각, 닫는 시각] — 분 단위, 같은 날 0시 기준(새벽 마감은 1440을 넘김)
  const SCHED = { 0: [960, 1500], 1: [960, 1620], 2: [960, 1620], 3: [960, 1680], 4: [960, 1680], 5: [960, 1680], 6: [960, 1680] };
  const DAY = ['일', '월', '화', '수', '목', '금', '토'];
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (m) => { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };

  function kstNow() {
    const q = new URLSearchParams(location.search).get('now'); // 검수용: ?now=2026-11-03T02:00
    const m = q && q.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (m) {
      return { mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], wd: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay() };
    }
    const t = new Date(Date.now() + 9 * 3600e3); // 한국 시간
    return { mo: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), wd: t.getUTCDay() };
  }

  function bizStatus(n) {
    const t = n.h * 60 + n.mi;
    const prev = (n.wd + 6) % 7;
    const [po, pc] = SCHED[prev];
    if (t + 1440 < pc) {
      const tt = t + 1440;
      return { state: tt >= pc - 60 ? 'lo' : 'open', day: prev, open: po, close: pc, carry: true, left: pc - tt };
    }
    const [o, c] = SCHED[n.wd];
    if (t >= o) return { state: t >= c - 60 ? 'lo' : 'open', day: n.wd, open: o, close: c, carry: false, left: c - t };
    return { state: 'ready', day: n.wd, open: o, close: c, carry: false, wait: o - t };
  }

  function renderToday() {
    const n = kstNow();
    const s = bizStatus(n);
    const el = $('#todayStatus');
    if (!el) return;
    $('#todayDate').textContent = `${n.mo}월 ${n.d}일 ${DAY[n.wd]}요일`;
    el.dataset.state = s.state;
    const label = $('#todayLabel');
    const when = $('#todayWhen');
    if (s.state === 'open') {
      label.textContent = '지금 영업 중';
      when.textContent = `${fmt(s.close)}까지 영업` + (s.carry ? ` (${DAY[s.day]}요일 영업)` : '');
    } else if (s.state === 'lo') {
      label.textContent = '주문 마감';
      when.textContent = `라스트오더가 지났어요. ${fmt(s.close)} 영업 종료`;
    } else {
      const h = Math.floor(s.wait / 60), m = s.wait % 60;
      label.textContent = '준비 중';
      when.textContent = `오늘 ${fmt(s.open)}에 문 열어요 (` + (h ? `${h}시간 ` : '') + `${m}분 뒤)`;
    }
    $('#todayHoursLabel').textContent = s.carry ? `${DAY[s.day]}요일 영업` : '오늘 영업';
    $('#todayHours').textContent = `${fmt(s.open)} – ${fmt(s.close)}`;
    $('#todayLO').textContent = fmt(s.close - 60);
    $$('.hours tr[data-days]').forEach((tr) => {
      tr.classList.toggle('is-today', tr.dataset.days.split(',').includes(String(s.day)));
    });
  }
  renderToday();
  setInterval(renderToday, 30000);

  /* ── 머리글: 내리면 숨고 올리면 나타남 ── */
  const hd = $('#hd');
  let lastY = window.scrollY;

  /* ── 폰 전체 메뉴(머리글 메뉴 그대로 복제) ── */
  const mnav = $('#mnav');
  const burger = $('.hd-burger');
  const mbody = $('.mnav-body', mnav);
  $$('.gnb-item').forEach((item) => {
    const g = document.createElement('div');
    g.className = 'mnav-group';
    const top = $('.gnb-top', item).cloneNode(true);
    top.removeAttribute('class');
    g.appendChild(top);
    g.appendChild($('.gnb-sub', item).cloneNode(true)).removeAttribute('class');
    mbody.appendChild(g);
  });
  let lastFocus = null;
  function openMenu() {
    lastFocus = document.activeElement;
    mnav.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    burger.setAttribute('aria-expanded', 'true');
    $('.mnav-close', mnav).focus();
  }
  function closeMenu(restore = true) {
    mnav.hidden = true;
    document.documentElement.style.overflow = '';
    burger.setAttribute('aria-expanded', 'false');
    if (restore && lastFocus) lastFocus.focus();
  }
  burger.addEventListener('click', openMenu);
  $('.mnav-close', mnav).addEventListener('click', () => closeMenu());
  mnav.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    closeMenu(false);
    if (a.hasAttribute('data-open-consult') || a.getAttribute('href') === '#fr-form') {
      if (isPhone()) { e.preventDefault(); openSheet(); }
    }
  });

  /* ── 눌러도 깨지지 않는 빈 링크 ── */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href="#"]');
    if (a) e.preventDefault();
  });

  /* ── 메뉴 탭 ── */
  const tabs = $$('.tab');
  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      const pn = document.getElementById(t.getAttribute('aria-controls'));
      pn.hidden = !on;
      pn.classList.remove('is-in');
      if (on) {
        pn.scrollLeft = 0;
        void pn.offsetWidth;
        pn.classList.add('is-in');
      }
    });
    if (focus) tab.focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(n, true);
    });
  });

  /* ── 신청 칸: 화면 안에서만 '접수되었습니다' (어디에도 보내지 않음) ── */
  function bindForm(f, okText) {
    if (!f) return;
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = $('.cform-msg', f);
      let bad = null, why = '';
      for (const el of f.elements) {
        if (!el.required) continue;
        if (el.type === 'checkbox' && !el.checked) { bad = el; why = '개인정보 수집·이용에 동의해 주세요.'; break; }
        if (el.type !== 'checkbox' && !el.value.trim()) { bad = el; why = '빈 칸을 채워 주세요.'; break; }
        if (el.type === 'tel' && el.value.replace(/\D/g, '').length < 9) { bad = el; why = '연락처를 숫자로 확인해 주세요.'; break; }
      }
      if (bad) {
        msg.textContent = why;
        msg.classList.add('err');
        bad.focus();
        return;
      }
      msg.classList.remove('err');
      msg.textContent = okText;
      f.classList.add('is-done');
      msg.setAttribute('tabindex', '-1');
      msg.focus({ preventScroll: true });
    });
  }
  bindForm($('#fr-form'), '상담 신청이 접수되었습니다.');
  bindForm($('#cbarForm'), '상담 신청이 접수되었습니다.');
  bindForm($('#sheetForm'), '상담 신청이 접수되었습니다.');
  bindForm($('#voiceForm'), '접수되었습니다. 남겨 주셔서 고맙습니다.');

  const voiceBtn = $('#voiceOpen');
  voiceBtn.addEventListener('click', () => {
    const f = $('#voiceForm');
    f.hidden = !f.hidden;
    voiceBtn.setAttribute('aria-expanded', String(!f.hidden));
    if (!f.hidden) $('textarea', f).focus();
  });

  /* ── 폰: 아래에서 올라오는 창업 문의 창 ── */
  const sheet = $('#sheet');
  let sheetFocus = null, sheetTimer = 0;
  function openSheet() {
    clearTimeout(sheetTimer);
    sheetFocus = document.activeElement;
    sheet.hidden = false;
    void sheet.offsetWidth;
    sheet.classList.add('on');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(() => { const i = $('input', sheet); if (i && !$('#sheetForm').classList.contains('is-done')) i.focus({ preventScroll: true }); }, 380);
  }
  function closeSheet() {
    sheet.classList.remove('on');
    document.documentElement.style.overflow = '';
    sheetTimer = setTimeout(() => { sheet.hidden = true; }, 400);
    if (sheetFocus) sheetFocus.focus({ preventScroll: true });
  }
  $$('[data-close-sheet]', sheet).forEach((b) => b.addEventListener('click', closeSheet));
  $$('[data-open-consult]').forEach((a) => a.addEventListener('click', (e) => {
    if (isPhone()) { e.preventDefault(); openSheet(); }
  }));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!sheet.hidden) closeSheet();
    else if (!mnav.hidden) closeMenu();
  });

  /* ── 공간 사진 넘기기 ── */
  $$('.rbtn').forEach((b) => b.addEventListener('click', () => {
    const rail = document.getElementById(b.dataset.rail);
    const li = rail.querySelector('li');
    rail.scrollBy({ left: (+b.dataset.dir) * (li.offsetWidth + 16), behavior: 'smooth' });
  }));

  /* ── 스크롤: 머리글 숨김 · PC 상담 줄 · 폰 앱바 현재 구역 ── */
  const cbar = $('#cbar');
  const fr = $('#franchise');
  const frForm = $('#fr-form');
  const secs = ['home', 'menu', 'brand', 'space', 'company', 'franchise', 'community'].map((id) => document.getElementById(id));
  const toBar = { home: 'home', menu: 'menu', brand: 'menu', space: 'store', company: '', franchise: 'franchise', community: 'store' };
  const barLinks = $$('.appbar a[data-sec]');
  let cbarOn = false, curBar = null;

  function setCbar(on) {
    if (on === cbarOn) return;
    cbarOn = on;
    cbar.classList.toggle('on', on);
    cbar.setAttribute('aria-hidden', on ? 'false' : 'true');
    document.body.classList.toggle('cbar-on', on);
    $$('input, button', cbar).forEach((el) => { el.tabIndex = on ? 0 : -1; });
  }

  function onScroll() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    if (mnav.hidden) {
      if (y > lastY + 6 && y > 240) hd.classList.add('is-hidden');
      else if (y < lastY - 6 || y < 120) hd.classList.remove('is-hidden');
    }
    lastY = y;

    if (!isPhone()) {
      const entered = fr.getBoundingClientRect().top < vh * 0.55;
      const fb = frForm.getBoundingClientRect();
      const formInView = fb.top < vh * 0.85 && fb.bottom > vh * 0.2;
      setCbar(entered && !formInView);
    } else if (cbarOn) setCbar(false);

    let cur = 'home';
    for (const s of secs) if (s.getBoundingClientRect().top < vh * 0.45) cur = s.id;
    const key = toBar[cur];
    if (key !== curBar) {
      curBar = key;
      barLinks.forEach((a) => {
        const on = a.dataset.sec === key;
        a.classList.toggle('on', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();
})();
