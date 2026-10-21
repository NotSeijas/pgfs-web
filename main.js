(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- Ruido 3D (value noise) compartido ---------- */
  const perm = new Uint8Array(512);
  {
    const p = [...Array(256).keys()];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  }
  const fade = t => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const h = (x, y, z) => perm[(perm[(perm[x & 255] + y) & 255] + z) & 255] / 255;
  function noise(x, y, z) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    const u = fade(x - X), v = fade(y - Y), w = fade(z - Z);
    return lerp(
      lerp(lerp(h(X, Y, Z), h(X + 1, Y, Z), u), lerp(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v),
      lerp(lerp(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), lerp(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v),
      w);
  }

  /* ---------- Pantalla de carga: anillos de crecimiento ---------- */
  const rings = $('#rings');
  const count = $('#count');
  const RINGS = 16;
  const NS = 'http://www.w3.org/2000/svg';
  const ringEls = [];
  for (let k = 1; k <= RINGS; k++) {
    const base = 5 + k * 6 + (k > 10 ? (k - 10) * 0.6 : 0);
    let d = '';
    const steps = 96;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      // irregularidad que crece hacia afuera, como un tronco real
      const wob = (noise(Math.cos(a) * 1.4 + 3, Math.sin(a) * 1.4 + 3, k * 0.08) - 0.5) * (2 + k * 0.9);
      const r = base + wob;
      const x = Math.cos(a) * r * 1.04, y = Math.sin(a) * r;
      d += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d + 'Z');
    rings.appendChild(path);
    path.style.setProperty('--len', Math.ceil(path.getTotalLength()));
    if (k > RINGS - 3) path.classList.add('late');
    ringEls.push(path);
  }
  const pith = document.createElementNS(NS, 'circle');
  pith.setAttribute('r', '3'); pith.setAttribute('class', 'pith');
  rings.appendChild(pith);

  const loaded = new Promise(res => (document.readyState === 'complete' ? res() : addEventListener('load', res, { once: true })));
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  const stepMs = reduce ? 20 : 95;

  function growRings() {
    return new Promise(res => {
      requestAnimationFrame(() => pith.classList.add('on'));
      let i = 0;
      const tick = () => {
        ringEls[i].classList.add('on');
        count.textContent = String(++i).padStart(2, '0');
        if (i < RINGS) setTimeout(tick, stepMs + i * (reduce ? 0 : 4));
        else setTimeout(res, reduce ? 50 : 650);
      };
      setTimeout(tick, reduce ? 0 : 250);
    });
  }

  Promise.all([growRings(), Promise.race([Promise.all([loaded, fonts]), new Promise(r => setTimeout(r, 5000))])]).then(() => {
    $('#loader').classList.add('is-done');
    document.body.classList.remove('is-loading');
    setTimeout(() => { document.body.classList.add('is-ready'); heroIntro(); }, reduce ? 0 : 350);
    setTimeout(() => $('#loader').remove(), 1400);
  });

  /* ---------- Hero: cordilleras con neblina ---------- */
  const hero = $('.hero');
  const ridgesBox = $('#ridges');
  const RIDGE_COLORS = ['#C3D1C2', '#A3BBA4', '#7E9E83', '#557D5E', '#2F5A3E', '#0B231A'];
  const RIDGE_BASE = [0.12, 0.3, 0.45, 0.6, 0.74, 0.88];
  const RIDGE_AMP = [0.2, 0.17, 0.14, 0.11, 0.09, 0.05];
  let ridgeEls = [];
  const mists = $$('.mist', hero);

  function buildRidges() {
    const w = ridgesBox.clientWidth, hgt = ridgesBox.clientHeight;
    ridgeEls.forEach(r => r.remove());
    ridgeEls = RIDGE_COLORS.map((color, i) => {
      const yAt = x => hgt * (RIDGE_BASE[i] + RIDGE_AMP[i] * (noise(x / (260 + i * 60), i * 3.7, 0.5) * 1.4 - 0.7 + noise(x / 90, i * 9, 2) * 0.3));
      let d = `M0 ${hgt} L0 ${yAt(0).toFixed(1)}`;
      for (let x = 8; x <= w; x += 8) d += ` L${x} ${yAt(x).toFixed(1)}`;
      d += ` L${w} ${hgt} Z`;
      // pinos sobre las crestas cercanas, agrupados en manchas de bosque
      if (i >= 2) {
        const step = 5 + i * 2.5;
        for (let x = 0; x < w; x += step) {
          if (noise(x / 120, i * 5, 7) < 0.48) continue;
          const jitter = h(Math.floor(x), i, 3);
          const th = (5 + i * 4.5) * (0.7 + jitter * 0.7);
          const y = yAt(x) + 2;
          d += ` M${(x - th * 0.26).toFixed(1)} ${y.toFixed(1)} L${x.toFixed(1)} ${(y - th).toFixed(1)} L${(x + th * 0.26).toFixed(1)} ${y.toFixed(1)} Z`;
        }
      }
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'ridge');
      svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.setProperty('--rise', `${30 + i * 22}px`);
      svg.style.setProperty('--rd', `${120 + i * 90}ms`);
      svg.innerHTML = `<path fill="${color}" d="${d}"/>`;
      ridgesBox.appendChild(svg);
      return svg;
    });
    // las capas de neblina se intercalan entre las cordilleras
    ridgeEls[1].after(mists[0]); ridgeEls[3].after(mists[1]); ridgeEls[4].after(mists[2]);
    if (document.body.classList.contains('is-ready')) ridgeEls.forEach(r => r.classList.add('moving'));
  }
  buildRidges();

  // parallax suave de las capas con el cursor
  const par = { x: 0, tx: 0 };
  hero.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') par.tx = e.clientX / innerWidth - 0.5; });
  hero.addEventListener('pointerleave', () => { par.tx = 0; });

  /* ---------- Piezas colgantes: péndulos con viento ---------- */
  const mobile = $('#mobile');
  const branch = $('.branch', mobile);
  const hangers = $$('.hanger', mobile).map((el, i) => ({
    el, piece: $('.piece', el), i,
    fx: +el.dataset.x, fy: +el.dataset.y, lenK: +el.dataset.len,
    a: 0, v: 0, b: 0, bv: 0, L: 200, ax: 0, ay: 0, drag: false,
  }));
  const ptr = { x: -9999, y: -9999, vx: 0, lastX: 0, lastT: 0 };

  function layoutHangers() {
    const bw = branch.clientWidth, bh = branch.clientHeight;
    const base = Math.max(innerWidth < 600 ? 40 : 90, Math.min(260, hero.clientHeight * 0.27, innerWidth * 0.16));
    hangers.forEach(p => {
      p.ax = p.fx * bw; p.ay = p.fy * bh;
      p.L = base * p.lenK;
      p.el.style.setProperty('--len', `${p.L}px`);
    });
  }
  layoutHangers();
  addEventListener('resize', () => { clearTimeout(layoutHangers.t); layoutHangers.t = setTimeout(() => { buildRidges(); layoutHangers(); }, 150); });

  addEventListener('pointermove', e => {
    const now = performance.now();
    const dt = Math.max(8, now - ptr.lastT);
    ptr.vx = ptr.vx * 0.6 + ((e.clientX - ptr.lastX) / dt) * 1000 * 0.4;
    ptr.lastX = e.clientX; ptr.lastT = now;
    ptr.x = e.clientX; ptr.y = e.clientY;
  }, { passive: true });

  hangers.forEach(p => {
    p.piece.addEventListener('pointerdown', e => {
      p.drag = true; p.piece.setPointerCapture(e.pointerId);
    });
    const release = () => { p.drag = false; };
    p.piece.addEventListener('pointerup', release);
    p.piece.addEventListener('pointercancel', release);
  });

  let heroVisible = true, lastT = performance.now(), clock = 0;
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);

  function physics(now) {
    requestAnimationFrame(physics);
    const dt = Math.min(0.033, (now - lastT) / 1000); lastT = now;
    if (!heroVisible || document.hidden) return;
    clock += dt;

    // parallax de cordilleras
    if (!reduce && document.body.classList.contains('is-ready')) {
      par.x += (par.tx - par.x) * 0.06;
      ridgeEls.forEach((r, i) => { if (r.classList.contains('moving')) r.style.transform = `translate3d(${(-par.x * (i + 1) * 9).toFixed(2)}px,0,0)`; });
    }
    if (reduce) {
      hangers.forEach(p => { p.el.style.transform = `translate(${p.ax}px, ${p.ay}px)`; });
      return;
    }

    const mRect = mobile.getBoundingClientRect();
    // brisa de fondo con ráfagas ocasionales
    const breeze = (noise(clock * 0.35, 1.3, 4) - 0.5) * 2.2 + Math.max(0, noise(clock * 0.12, 8, 1) - 0.62) * 9;
    ptr.vx *= 0.92;

    hangers.forEach(p => {
      const Lm = p.L / 260;
      const k = 9.8 / Lm;
      let acc;
      const px = mRect.left + p.ax, py = mRect.top + p.ay;
      if (p.drag) {
        const target = Math.max(-1.2, Math.min(1.2, -Math.atan2(ptr.x - px, Math.max(20, ptr.y - py))));
        acc = (target - p.a) * 60 - p.v * 10;
      } else {
        acc = -k * Math.sin(p.a) - p.v * 0.55 + breeze * (0.5 + p.i * 0.25) / (1 + p.lenK);
        // el cursor empuja como una corriente de aire
        const cx = px + Math.sin(-p.a) * (p.L + 40), cy = py + Math.cos(p.a) * (p.L + 40);
        const dist = Math.hypot(ptr.x - cx, ptr.y - cy);
        if (dist < 170) acc += (ptr.vx / 1000) * (1 - dist / 170) * 14;
      }
      p.v += acc * dt; p.a += p.v * dt;
      // la pieza se retrasa un poco respecto al hilo
      const bacc = -38 * p.b - 4 * p.bv - acc * 0.035;
      p.bv += bacc * dt; p.b += p.bv * dt;
      p.el.style.transform = `translate(${p.ax.toFixed(1)}px, ${p.ay.toFixed(1)}px) rotate(${p.a.toFixed(4)}rad)`;
      p.piece.style.transform = `rotate(${p.b.toFixed(4)}rad)`;
    });
  }
  requestAnimationFrame(physics);

  // al terminar la carga, una ráfaga hace que todo se mezca
  function heroIntro() {
    if (reduce) return;
    setTimeout(() => ridgeEls.forEach(r => r.classList.add('moving')), 2100);
    setTimeout(() => hangers.forEach((p, i) => { p.v = (i % 2 ? -1 : 1) * (1.4 + i * 0.3); }), 900);
  }

  /* ---------- Navegación ---------- */
  const nav = $('#nav');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    nav.classList.toggle('is-scrolled', y > 40);
    if (!nav.classList.contains('menu-open')) nav.classList.toggle('is-hidden', y > lastY && y > 400);
    lastY = y;
  }, { passive: true });
  const burger = $('#burger');
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', open);
  });
  $$('.nav__links a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false');
  }));

  /* ---------- Revelado al hacer scroll ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('.reveal').forEach(el => {
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
    el.style.setProperty('--d', `${sibs.indexOf(el) * 70}ms`);
    io.observe(el);
  });

  /* ---------- Servicios: acordeón ---------- */
  $$('.svc__item').forEach(item => {
    const btn = $('.svc__row', item);
    btn.addEventListener('click', () => {
      const open = !item.classList.contains('open');
      $$('.svc__item.open').forEach(o => { o.classList.remove('open'); $('.svc__row', o).setAttribute('aria-expanded', 'false'); });
      item.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open);
    });
  });

  /* ---------- Transecto + parallax ligados al scroll ---------- */
  const transect = $('#transect');
  const tPath = $('#transectPath');
  tPath.setAttribute('pathLength', '1');
  const stops = $$('.transect__stops li');
  const bandImg = $('#bandImg');
  const band = $('.band');
  let ticking = false;
  function onScroll() {
    ticking = false;
    const vh = innerHeight;
    const r = transect.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (vh * 0.9 - r.top) / (vh * 0.7)));
    tPath.style.strokeDashoffset = reduce ? 0 : 1 - p;
    if (p > 0.05) transect.classList.add('in');
    stops.forEach((s, i) => { if (reduce || p > 0.12 + i * 0.22) s.classList.add('in'); });
    const br = band.getBoundingClientRect();
    if (!reduce && br.bottom > 0 && br.top < vh) {
      const k = (br.top + br.height / 2 - vh / 2) / vh;
      bandImg.style.transform = `translate3d(0, ${(k * -10).toFixed(2)}%, 0)`;
    }
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- Formulario → WhatsApp ---------- */
  const form = $('#form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const err = $('#formError');
    const nombre = form.nombre, tel = form.tel;
    [nombre, tel].forEach(f => f.setAttribute('aria-invalid', !f.value.trim()));
    if (!nombre.value.trim() || !tel.value.trim()) {
      err.textContent = 'Complete su nombre y un teléfono para poder responderle.';
      (nombre.value.trim() ? tel : nombre).focus();
      return;
    }
    err.textContent = '';
    const msg = `Hola PGFS, soy ${nombre.value.trim()} (${tel.value.trim()}). Me interesa: ${form.tipo.value}.` +
      (form.msg.value.trim() ? `\n${form.msg.value.trim()}` : '');
    window.open(`https://wa.me/51900000000?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });

  $('#year').textContent = new Date().getFullYear();
})();
