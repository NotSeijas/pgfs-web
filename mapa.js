/* Mapa de proyectos: carga Leaflet y /data/proyectos.json cuando la sección se acerca */
(() => {
  const root = document.getElementById('proyectos');
  if (!root) return;
  const $ = (s, el = root) => el.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = matchMedia('(max-width: 900px)');
  const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';

  // textos que arma el script; el resto de la sección se traduce con i18n.json
  const COPY = {
    es: { all: 'Todos', ha: 'hectáreas', trees: 'árboles', client: 'Cliente', close: 'Cerrar ficha', photo: 'Foto', touch: 'Toque para explorar el mapa' },
    en: { all: 'All', ha: 'hectares', trees: 'trees', client: 'Client', close: 'Close card', photo: 'Photo', touch: 'Tap to explore the map' },
  };
  const lang = () => (document.documentElement.lang.startsWith('en') ? 'en' : 'es');
  const t = k => COPY[lang()][k];
  const fmt = n => Number(n).toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const name = p => p.nombre[lang()] || p.nombre.es;
  const place = p => [...new Set([p.lugar.distrito, p.lugar.provincia, p.lugar.region].filter(Boolean))].join(', ');

  const card = $('#projCard');
  const filtersBox = $('#projFilters');
  let data, map, area = null, current = null;
  const layers = {};
  const markers = new Map();
  const filter = { cat: null, year: null };

  const loadCss = href => new Promise((ok, ko) => document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href, onload: ok, onerror: ko })));
  const loadJs = src => new Promise((ok, ko) => document.head.append(Object.assign(document.createElement('script'), { src, onload: ok, onerror: ko })));

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    io.disconnect();
    removeEventListener('scroll', near);
    Promise.all([
      fetch('/data/proyectos.json').then(r => r.json()),
      loadCss(LEAFLET + 'leaflet.min.css'),
      loadJs(LEAFLET + 'leaflet.min.js'),
    ]).then(([d]) => { data = d; init(); }).catch(err => console.error('Mapa de proyectos:', err));
  };
  // se carga al acercarse; el scroll es respaldo por si el navegador demora el observador
  const near = () => { if (root.getBoundingClientRect().top < innerHeight + 700) start(); };
  const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) start(); }, { rootMargin: '700px 0px' });
  io.observe(root);
  addEventListener('scroll', near, { passive: true });
  near();

  /* ---------- Mapa ---------- */
  function init() {
    data.proyectos.sort((a, b) => (b.anio || 0) - (a.anio || 0));
    map = L.map($('#projMap'), {
      zoomSnap: 0.5, minZoom: 4, maxZoom: 16, scrollWheelZoom: false,
      dragging: !coarse, touchZoom: !coarse, worldCopyJump: true,
    }).setView([-9.2, -74.5], 6); // vista provisional: sin ella Leaflet demora crear los puntos
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    layers.sat = L.layerGroup([
      L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics' }),
      L.tileLayer(ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, opacity: 0.85 }),
    ]).addTo(map);
    layers.mapa = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' });

    data.proyectos.forEach(p => {
      if (!p.coord) return;
      const color = data.categorias[p.categoria].color;
      const m = L.marker(p.coord, {
        icon: L.divIcon({ className: 'pin-wrap', html: `<div class="pin" style="background:${color}"></div>`, iconSize: [16, 16] }),
        title: name(p), keyboard: true, riseOnHover: true,
      });
      m.on('click', () => select(p.id));
      markers.set(p.id, m);
    });

    // rueda del mouse solo después de hacer clic en el mapa (no atrapa el scroll de la página)
    map.on('click focus', () => map.scrollWheelZoom.enable());
    map.getContainer().addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

    // en pantallas táctiles el mapa se mueve solo después de tocar el aviso
    if (coarse) {
      const touch = $('#projTouch');
      const lock = on => {
        touch.hidden = !on;
        map.dragging[on ? 'disable' : 'enable']();
        map.touchZoom[on ? 'disable' : 'enable']();
      };
      touch.innerHTML = `<span>${t('touch')}</span>`;
      touch.addEventListener('click', () => lock(false));
      new IntersectionObserver(([e]) => { if (!e.isIntersecting) lock(true); }).observe($('.projects__stage'));
      lock(true);
    }

    $$('.projects__layers button').forEach(b => b.addEventListener('click', () => setLayer(b.dataset.layer)));
    filtersBox.addEventListener('click', onFilter);
    card.addEventListener('click', onCard);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && current) close(); });
    document.addEventListener('pgfs:lang', relabel);

    $('#projSample').hidden = !data.ejemplo;
    renderChips();
    // en escritorio se abre el proyecto más reciente (antes de encuadrar, para dejarle espacio a la ficha);
    // en celular se espera a que toquen un punto
    if (!small.matches && data.proyectos[0]?.coord) select(data.proyectos[0].id, { fly: false });
    apply({ animate: false });
  }

  function $$(s) { return [...root.querySelectorAll(s)]; }

  function setLayer(key) {
    Object.entries(layers).forEach(([k, l]) => (k === key ? l.addTo(map) : l.remove()));
    $$('.projects__layers button').forEach(b => b.setAttribute('aria-pressed', b.dataset.layer === key));
  }

  // margen para que la ficha abierta no tape los puntos
  function padding() {
    const open = !card.hidden;
    if (small.matches) return { paddingTopLeft: [30, 60], paddingBottomRight: [30, open ? card.offsetHeight + 30 : 40] };
    return { paddingTopLeft: [open ? card.offsetWidth + 56 : 60, 60], paddingBottomRight: [60, 60] };
  }

  /* ---------- Filtros y cifras ---------- */
  const visible = () => data.proyectos.filter(p => p.coord && (!filter.cat || p.categoria === filter.cat) && (!filter.year || p.anio === filter.year));

  function renderChips() {
    const years = [...new Set(data.proyectos.map(p => p.anio).filter(Boolean))].sort((a, b) => b - a);
    const cats = Object.entries(data.categorias).filter(([k]) => data.proyectos.some(p => p.categoria === k));
    filtersBox.innerHTML =
      `<button type="button" class="chip" data-cat="" aria-pressed="${!filter.cat}">${t('all')}</button>` +
      cats.map(([k, c]) => `<button type="button" class="chip" data-cat="${k}" aria-pressed="${filter.cat === k}"><i style="background:${c.color}"></i>${esc(c[lang()])}</button>`).join('') +
      (years.length > 1 ? '<span class="projects__sep" aria-hidden="true"></span>' + years.map(y => `<button type="button" class="chip" data-year="${y}" aria-pressed="${filter.year === y}">${y}</button>`).join('') : '');
  }

  function onFilter(e) {
    const b = e.target.closest('.chip');
    if (!b) return;
    if ('cat' in b.dataset) filter.cat = b.dataset.cat || null;
    else filter.year = filter.year === +b.dataset.year ? null : +b.dataset.year;
    renderChips();
    apply();
  }

  function apply({ animate = true } = {}) {
    const list = visible();
    const ids = new Set(list.map(p => p.id));
    markers.forEach((m, id) => (ids.has(id) ? m.addTo(map) : m.remove()));
    markers.forEach((m, id) => m.getElement()?.classList.toggle('is-active', id === current));
    if (current && !ids.has(current)) close({ refit: false });
    countTo('proyectos', list.length, animate);
    countTo('hectareas', list.reduce((s, p) => s + (p.hectareas || 0), 0), animate);
    countTo('regiones', new Set(list.map(p => p.lugar.region).filter(Boolean)).size, animate);
    fit(list, animate);
  }

  function fit(list, animate) {
    if (!list.length) return;
    const b = L.latLngBounds(list.map(p => p.coord));
    const opts = { ...padding(), maxZoom: 9 };
    if (animate && !reduce) map.flyToBounds(b, { ...opts, duration: 0.9 });
    else map.fitBounds(b, opts);
  }

  function countTo(key, to, animate) {
    const el = $(`[data-stat="${key}"]`);
    const from = Number(el.dataset.value || 0);
    el.dataset.value = to;
    if (!animate || reduce || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 700);
      el.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- Ficha del proyecto ---------- */
  const byId = id => data.proyectos.find(p => p.id === id);

  function select(id, { fly = true } = {}) {
    const p = byId(id);
    current = id;
    markers.forEach((m, k) => m.getElement()?.classList.toggle('is-active', k === id));
    if (area) area.remove();
    area = p.area ? L.geoJSON(p.area, { interactive: false, style: { color: '#C9E265', weight: 2, dashArray: '6 5', fillColor: '#C9E265', fillOpacity: 0.2 } }).addTo(map) : null;
    const wasHidden = card.hidden;
    renderCard(p);
    card.hidden = false;
    if (wasHidden && !reduce) card.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    if (fly) {
      const b = area ? area.getBounds() : L.latLngBounds([p.coord, p.coord]);
      const opts = { ...padding(), maxZoom: area ? 12 : 9 };
      if (reduce) map.fitBounds(b, opts);
      else map.flyToBounds(b, { ...opts, duration: 0.9 });
    }
  }

  function renderCard(p) {
    const c = data.categorias[p.categoria];
    const fotos = p.fotos || [];
    const kv = [
      p.hectareas ? `<div><dt>${t('ha')}</dt><dd>${fmt(p.hectareas)}</dd></div>` : '',
      p.arboles ? `<div><dt>${t('trees')}</dt><dd>${fmt(p.arboles)}</dd></div>` : '',
    ].join('');
    card.innerHTML =
      `<button type="button" class="card__close" aria-label="${t('close')}"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>` +
      (fotos.length ? `<div class="card__media">${fotos.map((f, i) => `<img src="${esc(f)}" alt="" loading="lazy" class="${i ? '' : 'is-on'}">`).join('')}` +
        (fotos.length > 1 ? `<div class="card__dots">${fotos.map((_, i) => `<button type="button" data-photo="${i}" aria-label="${t('photo')} ${i + 1}" aria-current="${!i}"></button>`).join('')}</div>` : '') + '</div>' : '') +
      `<div class="card__body"><p class="card__tag"><i style="background:${c.color}"></i>${esc(c[lang()])}${p.anio ? ' · ' + p.anio : ''}</p>` +
      `<h3>${esc(name(p))}</h3><p class="card__place">${esc(place(p))}</p>` +
      (p.cliente ? `<p class="card__client">${t('client')}: ${esc(p.cliente)}</p>` : '') +
      (kv ? `<dl class="card__kv">${kv}</dl>` : '') + '</div>';
  }

  function onCard(e) {
    if (e.target.closest('.card__close')) return close();
    const dot = e.target.closest('[data-photo]');
    if (!dot) return;
    const i = +dot.dataset.photo;
    card.querySelectorAll('.card__media img').forEach((img, k) => img.classList.toggle('is-on', k === i));
    card.querySelectorAll('[data-photo]').forEach((b, k) => b.setAttribute('aria-current', k === i));
  }

  function close({ refit = false } = {}) {
    const id = current;
    current = null;
    card.hidden = true;
    if (area) { area.remove(); area = null; }
    markers.forEach(m => m.getElement()?.classList.remove('is-active'));
    markers.get(id)?.getElement()?.focus({ preventScroll: true });
    if (refit) fit(visible(), true);
  }

  /* ---------- Cambio de idioma sin recargar ---------- */
  function relabel() {
    renderChips();
    markers.forEach((m, id) => { const el = m.getElement(); if (el) el.title = name(byId(id)); });
    if (current) renderCard(byId(current));
    if (coarse) $('#projTouch').innerHTML = `<span>${t('touch')}</span>`;
  }
})();
