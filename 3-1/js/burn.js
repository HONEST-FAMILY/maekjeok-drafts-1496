const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const GW = 40;
const GH = 40;
const DONE_AT = 0.52;
const MAX_LOG = 4000;

export function createBurn(host, { reduce = false } = {}) {
  if (!host) return null;
  const inner = host.querySelector('.hero-ph-in');
  const photo = host.querySelector('.hero-photo');
  const canvas = host.querySelector('.burn');
  const hint = host.querySelector('.burn-hint');
  const cap = host.querySelector('.origin-cap');
  const again = host.querySelector('.oc-again');
  if (!inner || !photo || !canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cells = new Uint8Array(GW * GH);
  let total = 1;
  let erased = 0;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let R = 40;
  let visTop = 0;
  let ready = false;
  let done = false;
  let rubbed = 0;
  let last = null;
  let raf = 0;
  const queue = [];
  const log = [];

  function size() {
    const bw = inner.offsetWidth;
    const bh = inner.offsetHeight;
    if (!bw || !bh) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const nw = Math.round(bw * dpr);
    const nh = Math.round(bh * dpr);
    const changed = nw !== w || nh !== h;
    w = nw;
    h = nh;
    if (changed) {
      canvas.width = w;
      canvas.height = h;
    }
    visTop = clamp(-inner.offsetTop / bh, 0, 0.5);
    R = clamp(Math.min(host.offsetWidth, host.offsetHeight) * 0.085, 34, 84) * dpr;
    total = 0;
    for (let gy = 0; gy < GH; gy++) {
      if ((gy + 0.5) / GH >= visTop) total += GW;
    }
    total = Math.max(total, 1);
    return changed;
  }

  function paintPhoto() {
    const iw = photo.naturalWidth;
    const ih = photo.naturalHeight;
    if (!iw || !ih || !w || !h) return false;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    const pos = getComputedStyle(photo).objectPosition.split(' ');
    const px = (parseFloat(pos[0]) || 50) / 100;
    const py = (parseFloat(pos[1]) || 50) / 100;
    const s = Math.max(w / iw, h / ih);
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(photo, (w - dw) * px, (h - dh) * py, dw, dh);
    return true;
  }

  function mark(x, y) {
    const rr = R * 0.62;
    const cw = w / GW;
    const ch = h / GH;
    const gx0 = Math.max(0, Math.floor((x - rr) / cw));
    const gx1 = Math.min(GW - 1, Math.floor((x + rr) / cw));
    const gy0 = Math.max(0, Math.floor((y - rr) / ch));
    const gy1 = Math.min(GH - 1, Math.floor((y + rr) / ch));
    for (let gy = gy0; gy <= gy1; gy++) {
      if ((gy + 0.5) / GH < visTop) continue;
      for (let gx = gx0; gx <= gx1; gx++) {
        const i = gy * GW + gx;
        if (cells[i]) continue;
        const dx = (gx + 0.5) * cw - x;
        const dy = (gy + 0.5) * ch - y;
        if (dx * dx + dy * dy <= rr * rr) {
          cells[i] = 1;
          erased++;
        }
      }
    }
  }

  function ring(x, y, r0, r1, stops) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r1, 0, Math.PI * 2);
    ctx.fill();
  }

  function stamp(x, y, record) {
    ctx.globalCompositeOperation = 'source-atop';
    ring(x, y, R * 0.5, R * 1.7, [[0, 'rgba(30,12,4,0.46)'], [0.4, 'rgba(56,24,7,0.22)'], [1, 'rgba(56,24,7,0)']]);
    ring(x, y, R * 0.6, R * 1.04, [[0, 'rgba(206,84,20,0.40)'], [1, 'rgba(206,84,20,0)']]);
    ctx.globalCompositeOperation = 'destination-out';
    ring(x, y, 0, R, [[0, 'rgba(0,0,0,1)'], [0.56, 'rgba(0,0,0,0.92)'], [1, 'rgba(0,0,0,0)']]);
    mark(x, y);
    if (record && log.length < MAX_LOG) log.push([x / w, y / h]);
  }

  function stroke(p) {
    if (!last) {
      stamp(p.x, p.y, true);
      last = p;
      return;
    }
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    const dist = Math.hypot(dx, dy);
    const step = R * 0.38;
    if (dist < step * 0.5) return;
    const n = Math.min(40, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) stamp(last.x + (dx * i) / n, last.y + (dy * i) / n, true);
    last = p;
  }

  function flush() {
    raf = 0;
    if (!ready || done) {
      queue.length = 0;
      return;
    }
    while (queue.length) {
      const q = queue.shift();
      if (q === null) last = null;
      else stroke(q);
    }
    rubbed++;
    if (rubbed === 3) host.classList.add('is-rubbed');
    if (erased / total >= DONE_AT) finish();
  }

  function push(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    queue.push({ x: ((clientX - r.left) / r.width) * w, y: ((clientY - r.top) / r.height) * h });
    if (!raf) raf = requestAnimationFrame(flush);
  }

  function lift() {
    queue.push(null);
    if (!raf) raf = requestAnimationFrame(flush);
  }

  function showCap(on) {
    if (!cap) return;
    if (on) {
      cap.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => cap.classList.add('is-on')));
    } else {
      cap.classList.remove('is-on');
      cap.hidden = true;
    }
  }

  function finish() {
    if (done) return;
    done = true;
    last = null;
    host.classList.add('is-origin');
    showCap(true);
    const clear = () => {
      if (done) ctx.clearRect(0, 0, w, h);
    };
    if (reduce) clear();
    else setTimeout(clear, 1200);
  }

  function reset() {
    done = false;
    erased = 0;
    rubbed = 0;
    cells.fill(0);
    log.length = 0;
    last = null;
    paintPhoto();
    host.classList.remove('is-origin');
    showCap(false);
  }

  function replay() {
    const saved = log.splice(0, log.length);
    erased = 0;
    cells.fill(0);
    last = null;
    for (const [nx, ny] of saved) stamp(nx * w, ny * h, true);
  }

  function start() {
    size();
    if (!paintPhoto()) return;
    ready = true;
    host.classList.add('is-burn');
  }

  if (photo.complete && photo.naturalWidth) start();
  else photo.addEventListener('load', start, { once: true });

  host.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    push(e.clientX, e.clientY);
  }, { passive: true });
  host.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') lift();
  }, { passive: true });
  host.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (!t) return;
    lift();
    push(t.clientX, t.clientY);
  }, { passive: true });
  host.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (t) push(t.clientX, t.clientY);
  }, { passive: true });
  host.addEventListener('touchend', lift, { passive: true });
  host.addEventListener('touchcancel', lift, { passive: true });
  if (again) again.addEventListener('click', reset);

  let rt = 0;
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (!ready) return;
      if (window.innerWidth === lastW && inner.offsetHeight * dpr === h) return;
      lastW = window.innerWidth;
      if (!size()) return;
      if (done) {
        ctx.clearRect(0, 0, w, h);
        return;
      }
      paintPhoto();
      replay();
    }, 200);
  });

  if (hint) hint.hidden = false;

  return { reset, finish, progress: () => erased / total };
}
