(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const NS = 'http://www.w3.org/2000/svg';

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

  /* ---------- Video del inicio: versión según pantalla ---------- */
  const heroVideo = $('#heroVideo');
  heroVideo.src = innerWidth < 768 ? heroVideo.dataset.srcMobile : heroVideo.dataset.srcDesktop;
  heroVideo.load();

  /* ---------- Carga: los anillos siguen el progreso real ---------- */
  const rings = $('#rings');
  const count = $('#count');
  const RINGS = 16;
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
      d += (i ? 'L' : 'M') + (Math.cos(a) * r * 1.04).toFixed(2) + ' ' + (Math.sin(a) * r).toFixed(2);
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
  requestAnimationFrame(() => pith.classList.add('on'));

  // tareas que pesan en la carga: fuentes, póster, video listo para reproducir, página completa
  const tasks = { fonts: 0, poster: 0, video: 0, page: 0 };
  const weights = { fonts: 0.15, poster: 0.2, video: 0.5, page: 0.15 };
  const done = k => { tasks[k] = 1; };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => done('fonts'));
  { const img = new Image(); img.onload = img.onerror = () => done('poster'); img.src = heroVideo.poster; }
  if (heroVideo.readyState >= 3) done('video');
  else ['canplaythrough', 'canplay', 'error'].forEach(ev => heroVideo.addEventListener(ev, () => done('video'), { once: true }));
  if (document.readyState === 'complete') done('page'); else addEventListener('load', () => done('page'), { once: true });

  const loadStart = performance.now();
  let shown = 0, ringsOn = 0, lastTick = loadStart;
  function loaderTick(now) {
    const elapsed = now - loadStart;
    const tickDt = Math.min(1, (now - lastTick) / 1000); lastTick = now;
    let target = Object.keys(tasks).reduce((s, k) => s + tasks[k] * weights[k], 0);
    if (elapsed > 8000) target = 1; // conexión lenta: no retener al visitante
    const minTime = reduce ? 200 : 1800;
    // el contador nunca va más rápido que el tiempo mínimo, para que los anillos se lean
    const cap = Math.min(1, elapsed / minTime);
    shown += (Math.min(target, cap) - shown) * (reduce ? 1 : 1 - Math.exp(-tickDt * 5));
    if (Math.min(target, cap) - shown < 0.004) shown = Math.min(target, cap);
    const pct = Math.round(shown * 100);
    count.textContent = String(pct);
    const want = Math.round(shown * RINGS);
    while (ringsOn < want) ringEls[ringsOn++].classList.add('on');
    if (pct >= 100) { clearInterval(loaderTimer); setTimeout(finishLoading, reduce ? 0 : 450); }
  }
  // temporizador en vez de cuadros: la carga avanza aunque la pestaña esté en segundo plano
  const loaderTimer = setInterval(() => loaderTick(performance.now()), 16);

  function finishLoading() {
    $('#loader').classList.add('is-done');
    document.body.classList.remove('is-loading');
    heroVideo.play().catch(() => {});
    setTimeout(() => { document.body.classList.add('is-ready'); heroIntro(); }, reduce ? 0 : 300);
    setTimeout(() => $('#loader').remove(), 1500);
  }

  /* ---------- Piezas colgantes: péndulos con viento ---------- */
  const hero = $('.hero');
  const heroSticky = $('.hero__sticky');
  const mobile = $('#mobile');
  const hangers = $$('.hanger', mobile).map((el, i) => ({
    el, piece: $('.piece', el), i,
    fx: +el.dataset.x, fy: +el.dataset.y, lenK: +el.dataset.len,
    a: 0, v: 0, b: 0, bv: 0, L: 200, ax: 0, ay: 0, drag: false,
  }));
  const ptr = { x: -9999, y: -9999, vx: 0, lastX: 0, lastT: 0 };

  function layoutHangers() {
    // cables que bajan desde arriba de la pantalla, como colgados del dron
    const bw = mobile.clientWidth, bh = 0;
    const base = Math.max(innerWidth < 600 ? 70 : 110, Math.min(200, heroSticky.clientHeight * 0.2));
    hangers.forEach(p => {
      p.ax = p.fx * bw; p.ay = p.fy * bh;
      p.L = base * p.lenK;
      p.el.style.setProperty('--len', `${p.L}px`);
    });
  }
  layoutHangers();

  addEventListener('pointermove', e => {
    const now = performance.now();
    const dt = Math.max(8, now - ptr.lastT);
    ptr.vx = ptr.vx * 0.6 + ((e.clientX - ptr.lastX) / dt) * 1000 * 0.4;
    ptr.lastX = e.clientX; ptr.lastT = now;
    ptr.x = e.clientX; ptr.y = e.clientY;
  }, { passive: true });

  hangers.forEach(p => {
    p.piece.addEventListener('pointerdown', e => { p.drag = true; p.piece.setPointerCapture(e.pointerId); });
    const release = () => { p.drag = false; };
    p.piece.addEventListener('pointerup', release);
    p.piece.addEventListener('pointercancel', release);
  });

  let clock = 0;
  function swing(dt) {
    if (reduce) {
      hangers.forEach(p => { p.el.style.transform = `translate(${p.ax}px, ${p.ay}px)`; });
      return;
    }
    clock += dt;
    const mRect = mobile.getBoundingClientRect();
    // brisa de fondo con ráfagas ocasionales
    const breeze = (noise(clock * 0.35, 1.3, 4) - 0.5) * 2.2 + Math.max(0, noise(clock * 0.12, 8, 1) - 0.62) * 9;
    ptr.vx *= 0.92;
    hangers.forEach(p => {
      const k = 9.8 / (p.L / 260);
      const px = mRect.left + p.ax, py = mRect.top + p.ay;
      let acc;
      if (p.drag) {
        const target = clamp(-Math.atan2(ptr.x - px, Math.max(20, ptr.y - py)), -1.2, 1.2);
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

  function heroIntro() {
    if (reduce) return;
    setTimeout(() => hangers.forEach((p, i) => { p.v = (i % 2 ? -1 : 1) * (1.4 + i * 0.3); }), 900);
  }

  /* ---------- Quiénes somos: palabras que se encienden ---------- */
  const aboutText = $('#aboutText');
  aboutText.innerHTML = aboutText.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
  const words = $$('.w', aboutText);

  /* ---------- Franja: velocidad ligada al scroll ---------- */
  const ticker = $('#ticker');
  ticker.innerHTML += ticker.innerHTML;
  let tickX = 0, tickDir = 1;

  /* ---------- Servicios: pestañas y acordeón ---------- */
  const tabs = $$('.tab');
  const panels = $$('.svc');
  const media = $$('.svc-media img');
  panels.forEach(pn => $$('.svc__item', pn).forEach((li, i) => li.style.setProperty('--i', i)));
  tabs.forEach(t => t.addEventListener('click', () => {
    const n = +t.dataset.tab;
    tabs.forEach(o => { const on = o === t; o.classList.toggle('is-active', on); o.setAttribute('aria-selected', on); });
    panels.forEach(pn => pn.classList.toggle('is-active', +pn.dataset.panel === n));
    media.forEach((m, i) => {
      if (m.classList.contains('is-active') && i !== n) {
        m.classList.remove('is-active'); m.classList.add('is-leaving');
        setTimeout(() => m.classList.remove('is-leaving'), 900);
      }
    });
    media[n].classList.add('is-active');
  }));
  $$('.svc__item').forEach(item => {
    const btn = $('.svc__row', item);
    btn.addEventListener('click', () => {
      const open = !item.classList.contains('open');
      $$('.svc__item.open', item.parentElement).forEach(o => { o.classList.remove('open'); $('.svc__row', o).setAttribute('aria-expanded', 'false'); });
      item.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open);
    });
  });

  /* ---------- En campo ---------- */
  const fieldSec = $('#campo');
  const layers = $$('.field__layer');
  const steps = $$('.step');
  const fieldBar = $('#fieldBar');
  const fieldVideo = layers[0];
  let fieldVideoLoaded = false, activeStep = -1;

  /* ---------- Visión, galería, pie ---------- */
  const vision = $('.vision');
  const visionFrame = $('#visionFrame');
  const gallery = $('.gallery');
  const track = $('#galleryTrack');
  const shots = $$('.shot img');
  const footMark = $('#footMark');
  const footWord = $('#footWord');
  // la palabra ocupa exactamente el ancho disponible
  function fitWord() {
    footWord.style.setProperty('--fs', '100px');
    const ratio = footWord.getBoundingClientRect().width / 100;
    footWord.style.setProperty('--fs', `${(footMark.clientWidth / ratio).toFixed(2)}px`);
  }
  fitWord();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(fitWord);
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { footMark.classList.add('in'); o.disconnect(); } }, { rootMargin: '0px 0px -10% 0px' }).observe(footMark);
  /* ---------- Carrusel arrastrable con inercia ---------- */
  const viewport = $('#galleryViewport');
  const galPrev = $('#galPrev'), galNext = $('#galNext'), galBar = $('#galBar');
  const cards = $$('.shot', track);
  const gal = { x: 0, target: 0, dragging: false, startX: 0, startPos: 0, lastX: 0, lastT: 0, vel: 0, moved: 0 };
  const galMax = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
  const snapPoints = () => cards.map(c => Math.min(galMax(), c.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft)));
  function sizeGallery() { gal.target = clamp(gal.target, -galMax(), 0); }
  function snapTo(pos) {
    const pts = snapPoints();
    let best = pts[0];
    pts.forEach(p => { if (Math.abs(-p - pos) < Math.abs(-best - pos)) best = p; });
    gal.target = -best;
  }
  function step(dir) {
    const pts = snapPoints();
    const cur = -gal.target;
    const i = pts.findIndex(p => p > cur + 4);
    const idx = dir > 0 ? (i === -1 ? pts.length - 1 : i) : Math.max(0, pts.filter(p => p < cur - 4).length - 1);
    gal.target = -pts[idx];
  }
  viewport.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    gal.dragging = true; gal.moved = 0;
    gal.startX = gal.lastX = e.clientX; gal.startPos = gal.x; gal.lastT = performance.now(); gal.vel = 0;
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add('is-dragging');
  });
  viewport.addEventListener('pointermove', e => {
    if (!gal.dragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - gal.lastT);
    gal.vel = gal.vel * 0.7 + ((e.clientX - gal.lastX) / dt) * 0.3;
    gal.lastX = e.clientX; gal.lastT = now;
    gal.moved = Math.max(gal.moved, Math.abs(e.clientX - gal.startX));
    let pos = gal.startPos + (e.clientX - gal.startX);
    // resistencia elástica en los extremos
    const min = -galMax();
    if (pos > 0) pos *= 0.35;
    if (pos < min) pos = min + (pos - min) * 0.35;
    gal.x = gal.target = pos;
  });
  const endDrag = () => {
    if (!gal.dragging) return;
    gal.dragging = false;
    viewport.classList.remove('is-dragging');
    // inercia: proyecta el gesto y se asienta en la foto más cercana
    snapTo(clamp(gal.x + gal.vel * 320, -galMax(), 0));
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    gal.target = clamp(gal.target - e.deltaX, -galMax(), 0);
    clearTimeout(gal.wheelT);
    gal.wheelT = setTimeout(() => snapTo(gal.target), 160);
  }, { passive: false });
  viewport.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  galPrev.addEventListener('click', () => step(-1));
  galNext.addEventListener('click', () => step(1));

  /* ---------- Revelado al entrar ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('.reveal').forEach(el => {
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
    el.style.setProperty('--d', `${sibs.indexOf(el) * 70}ms`);
    io.observe(el);
  });

  /* ---------- Bucle único: todo lo que depende del scroll ---------- */
  const heroFrame = $('#heroFrame');
  const heroInner = $('#heroInner');
  const progressOf = (el, startOffset = 0) => {
    const r = el.getBoundingClientRect();
    const total = r.height - innerHeight;
    return clamp((-r.top + startOffset) / (total || 1), 0, 1);
  };
  let lastScroll = scrollY, scrollVel = 0, last = performance.now(), heroOnScreen = true;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    const y = scrollY;
    scrollVel = scrollVel * 0.85 + (y - lastScroll) * 0.15;
    lastScroll = y;
    const vh = innerHeight;

    // inicio: el video se recoge en un marco redondeado y el texto sube
    const hr = hero.getBoundingClientRect();
    heroOnScreen = hr.bottom > 0;
    if (heroOnScreen) {
      const p = reduce ? 0 : progressOf(hero);
      heroFrame.style.setProperty('--ci', `${(p * 7).toFixed(2)}vh`);
      heroFrame.style.setProperty('--cx', `${(p * 5).toFixed(2)}vw`);
      heroFrame.style.setProperty('--cr', `${(p * 28).toFixed(1)}px`);
      heroInner.style.setProperty('--ty', `${(-p * 140).toFixed(1)}px`);
      heroInner.style.setProperty('--op', (1 - p * 1.7).toFixed(3));
      mobile.style.setProperty('--my', `${(-p * 260).toFixed(1)}px`);
      swing(dt);
      if (heroVideo.paused && document.body.classList.contains('is-ready') && !document.hidden) heroVideo.play().catch(() => {});
    } else if (!heroVideo.paused) heroVideo.pause();

    // franja: avanza sola y acelera con el scroll
    if (!reduce) {
      if (Math.abs(scrollVel) > 0.5) tickDir = Math.sign(scrollVel);
      tickX -= (60 + Math.min(900, Math.abs(scrollVel) * 40)) * dt * tickDir;
      const half = ticker.scrollWidth / 2;
      if (tickX <= -half) tickX += half;
      if (tickX > 0) tickX -= half;
      ticker.style.transform = `translate3d(${tickX.toFixed(1)}px,0,0)`;
    }

    // palabras de "Quiénes somos"
    const ar = aboutText.getBoundingClientRect();
    if (ar.top < vh && ar.bottom > 0) {
      const p = reduce ? 1 : clamp((vh * 0.85 - ar.top) / (ar.height + vh * 0.35), 0, 1);
      const lit = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < lit));
    }

    // en campo: el paso más cercano al centro manda la imagen
    const fr = fieldSec.getBoundingClientRect();
    if (fr.top < vh && fr.bottom > 0) {
      let best = 0, bestD = Infinity;
      steps.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - vh * 0.55);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best !== activeStep) {
        activeStep = best;
        steps.forEach((s, i) => s.classList.toggle('is-active', i === best));
        layers.forEach((l, i) => l.classList.toggle('is-active', i === best));
      }
      if (!fieldVideoLoaded) { fieldVideo.src = fieldVideo.dataset.src; fieldVideoLoaded = true; }
      if (activeStep === 0 && fieldVideo.paused) fieldVideo.play().catch(() => {});
      if (activeStep !== 0 && !fieldVideo.paused) fieldVideo.pause();
      const fp = clamp(-fr.top / (fr.height - vh), 0, 1);
      fieldBar.style.setProperty('--p', fp.toFixed(3));
    } else if (fieldVideoLoaded && !fieldVideo.paused) fieldVideo.pause();

    // visión: la foto se abre hasta ocupar la pantalla
    const vr = vision.getBoundingClientRect();
    if (vr.top < vh && vr.bottom > 0) {
      const p = reduce ? 1 : clamp(-vr.top / (vr.height - vh) * 1.25, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      visionFrame.style.setProperty('--vi', `${(18 * (1 - e)).toFixed(2)}%`);
      visionFrame.style.setProperty('--vx', `${(22 * (1 - e)).toFixed(2)}%`);
      visionFrame.style.setProperty('--vr', `${(24 * (1 - e)).toFixed(1)}px`);
      visionFrame.style.setProperty('--vz', (1.25 - 0.25 * e).toFixed(4));
      visionFrame.style.setProperty('--vo', clamp((p - 0.45) / 0.4, 0, 1).toFixed(3));
    }

    // carrusel: se acerca a su destino y mueve la foto dentro de cada marco
    const gr = gallery.getBoundingClientRect();
    if (gr.top < vh && gr.bottom > 0) {
      if (!gal.dragging) gal.x += (gal.target - gal.x) * (reduce ? 1 : 1 - Math.exp(-dt * 9));
      track.style.transform = `translate3d(${gal.x.toFixed(1)}px,0,0)`;
      const max = galMax();
      const visible = viewport.clientWidth / track.scrollWidth;
      galBar.style.setProperty('--bw', `${(visible * 100).toFixed(1)}%`);
      galBar.style.setProperty('--bp', `${(clamp(-gal.x / (max || 1), 0, 1) * (1 / visible - 1) * 100).toFixed(1)}%`);
      galPrev.disabled = gal.target > -2;
      galNext.disabled = gal.target < -max + 2;
      if (!reduce) shots.forEach(img => {
        const r = img.parentElement.getBoundingClientRect();
        const c = (r.left + r.width / 2) / innerWidth - 0.5;
        img.style.setProperty('--sx', `${(c * -8).toFixed(2)}%`);
      });
    }

    // pie: la toma del río se desplaza dentro de las letras con el scroll y el cursor
    const fmr = footMark.getBoundingClientRect();
    if (fmr.top < vh && fmr.bottom > 0 && !reduce) {
      const p = clamp((vh - fmr.top) / (vh + fmr.height), 0, 1);
      const mx = ptr.x > -9999 ? ptr.x / innerWidth - 0.5 : 0;
      footWord.style.setProperty('--by', `${(20 + p * 60).toFixed(2)}%`);
      footWord.style.setProperty('--bx', `${(50 + mx * 30).toFixed(2)}%`);
    }
  }

  requestAnimationFrame(frame);

  addEventListener('resize', () => {
    clearTimeout(layoutHangers.t);
    layoutHangers.t = setTimeout(() => { layoutHangers(); sizeGallery(); fitWord(); }, 150);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { heroVideo.pause(); fieldVideo.pause(); } });

  /* ---------- Navegación ---------- */
  const nav = $('#nav');
  let navY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    nav.classList.toggle('is-scrolled', y > 40);
    if (!nav.classList.contains('menu-open')) nav.classList.toggle('is-hidden', y > navY && y > 400);
    navY = y;
  }, { passive: true });
  const burger = $('#burger');
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', open);
  });
  $$('.nav__links a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false');
  }));
  // anclas con desplazamiento suave (la galería y el inicio usan secciones altas)
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const top = a.getAttribute('href') === '#inicio' ? 0 : target.getBoundingClientRect().top + scrollY - (target.id === 'campo' ? 0 : 70);
    scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  }));

  // enlaces del pie que abren directamente un frente de servicios
  $$('[data-tab-link]').forEach(a => a.addEventListener('click', () => tabs[+a.dataset.tabLink].click()));

  /* ---------- Estadísticas: contactos como eventos en Google Analytics ---------- */
  const trackEvent = (name, params) => { if (window.gtag) window.gtag('event', name, params); };
  $$('a[href^="https://wa.me"]').forEach(a => a.addEventListener('click', () => trackEvent('contacto_whatsapp', { ubicacion: a.closest('footer') ? 'pie' : 'contacto' })));
  $$('a[href^="mailto:"]').forEach(a => a.addEventListener('click', () => trackEvent('contacto_correo')));

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
    trackEvent('solicitud_cotizacion', { servicio: form.tipo.value });
    window.open(`https://wa.me/51966740171?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });

  $('#year').textContent = new Date().getFullYear();
})();
