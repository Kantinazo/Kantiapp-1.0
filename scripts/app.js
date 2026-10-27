'use strict';
(() => {
  const api = window.kantinazo;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const GAME_MODES = {
    salas: {
      title: 'Salas',
      text: 'Lista oficial de HaxBall. Buscá y filtrá con las herramientas del propio cliente: Kantinazo no puede leer esa lista.',
      join: false
    },
    jugar: {
      title: 'Jugar',
      text: 'Pegá el enlace de una sala para entrar directo, o elegí una desde el cliente oficial.',
      join: true
    }
  };

  const ERROR_TEXT = {
    '-106': 'No hay conexión a internet.',
    '-105': 'No se pudo encontrar el servidor de HaxBall. Revisá tu conexión o el DNS.',
    '-102': 'HaxBall rechazó la conexión.',
    '-7': 'HaxBall tardó demasiado en responder.',
    '-109': 'No se pudo llegar a la dirección de HaxBall.',
    '-200': 'El certificado de seguridad de HaxBall no es válido.'
  };

  const els = {
    welcome: $('#welcome'),
    app: $('#app'),
    stage: $('#stage'),
    stageError: $('#stage-error'),
    stageErrorText: $('#stage-error-text'),
    status: $('#game-status'),
    joinForm: $('#join-form'),
    joinUrl: $('#join-url'),
    joinMsg: $('#join-msg'),
    favForm: $('#fav-form'),
    favName: $('#fav-name'),
    favUrl: $('#fav-url'),
    favMsg: $('#fav-msg'),
    favList: $('#fav-list'),
    favEmpty: $('#fav-empty'),
    sAnim: $('#s-anim'),
    sSkip: $('#s-skip'),
    sZoom: $('#s-zoom'),
    sZoomLabel: $('#s-zoom-label'),
    sMsg: $('#s-msg'),
    offline: $('#offline')
  };

  let settings = null;
  let current = 'inicio';
  let gameState = { url: null, loading: false, error: null };

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const isGameView = (name) => Object.prototype.hasOwnProperty.call(GAME_MODES, name);

  function showMessage(el, text) {
    el.textContent = text || '';
    el.classList.toggle('hidden', !text);
  }

  function stageRect() {
    const r = els.stage.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }

  /* ---------- Navegación ---------- */

  async function setView(name, opts = {}) {
    const game = isGameView(name);
    const wasGame = isGameView(current);
    current = name;

    $$('.nav-btn[data-view]').forEach((b) => {
      const on = b.dataset.view === name;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $$('.view').forEach((v) => v.classList.toggle('hidden', v.dataset.view !== (game ? 'game' : name)));

    if (game) {
      const mode = GAME_MODES[name];
      $('#game-title').textContent = mode.title;
      $('#game-text').textContent = mode.text;
      els.joinForm.classList.toggle('hidden', !mode.join);
      showMessage(els.joinMsg, '');
      await nextFrame();
      if (current !== name) return; // el usuario ya cambió de pantalla
      const result = await api.game.show(stageRect(), opts.url);
      if (!result.ok) showMessage(els.joinMsg, result.error || 'No se pudo abrir el cliente de HaxBall.');
      else if (opts.url) els.joinUrl.value = '';
    } else if (wasGame) {
      api.game.hide();
    }
    if (name === 'favoritos') { showMessage(els.favMsg, ''); renderFavorites(); }
  }

  function enterApp() {
    els.welcome.classList.add('leaving');
    const done = () => {
      els.welcome.classList.add('hidden');
      document.body.classList.add('in-app');
      window.KantinazoBg.stop();
      els.app.classList.remove('hidden');
      requestAnimationFrame(() => els.app.classList.add('visible'));
    };
    if (settings.animations) setTimeout(done, 450); else done();
    setView('inicio');
  }

  function backToWelcome() {
    api.game.hide();
    els.app.classList.remove('visible');
    els.app.classList.add('hidden');
    document.body.classList.remove('in-app');
    els.welcome.classList.remove('hidden');
    requestAnimationFrame(() => els.welcome.classList.remove('leaving'));
    window.KantinazoBg.start();
    current = 'welcome';
  }

  /* ---------- Cliente oficial ---------- */

  function renderGameState() {
    const { loading, error } = gameState;
    if (error) {
      els.status.textContent = 'Sin conexión con HaxBall';
      els.stageErrorText.textContent = (ERROR_TEXT[String(error.code)] || 'Ocurrió un problema al cargar el cliente.') +
        (error.description ? ` (${error.description})` : '');
    } else {
      els.status.textContent = loading ? 'Cargando HaxBall…' : 'Cliente oficial de HaxBall (haxball.com)';
    }
    els.stageError.classList.toggle('hidden', !error);
  }

  /* ---------- Favoritos ---------- */

  function renderFavorites() {
    const favs = settings.favorites;
    els.favList.replaceChildren();
    els.favEmpty.classList.toggle('hidden', favs.length > 0);
    for (const fav of favs) {
      const li = document.createElement('li');
      const info = document.createElement('div');
      info.className = 'info';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = fav.name;
      const url = document.createElement('div');
      url.className = 'url';
      url.textContent = fav.url;
      info.append(name, url);

      const enter = document.createElement('button');
      enter.type = 'button';
      enter.className = 'btn-primary';
      enter.textContent = 'Entrar';
      enter.addEventListener('click', () => setView('jugar', { url: fav.url }));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn-ghost';
      remove.textContent = 'Quitar';
      remove.setAttribute('aria-label', `Quitar ${fav.name} de favoritos`);
      remove.addEventListener('click', async () => {
        const res = await api.removeFavorite(fav.id);
        if (res.ok) { settings.favorites = res.favorites; renderFavorites(); }
      });

      li.append(info, enter, remove);
      els.favList.append(li);
    }
  }

  /* ---------- Ajustes ---------- */

  function applySettings() {
    document.documentElement.classList.toggle('no-motion', !settings.animations);
    window.KantinazoBg.setEnabled(settings.animations);
    els.sAnim.checked = settings.animations;
    els.sSkip.checked = settings.skipWelcome;
    els.sZoom.value = String(settings.zoom);
    els.sZoomLabel.textContent = `${Math.round(settings.zoom * 100)}%`;
  }

  async function saveSetting(patch) {
    const next = await api.setSettings(patch);
    if (next) { settings = next; applySettings(); }
  }

  /* ---------- Eventos ---------- */

  function bindEvents() {
    $('#enter').addEventListener('click', enterApp);
    $('#back-welcome').addEventListener('click', backToWelcome);
    $$('.nav-btn[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $$('[data-goto]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.goto)));

    $('#g-list').addEventListener('click', () => api.game.home());
    $('#g-reload').addEventListener('click', () => api.game.reload());
    $('#g-retry').addEventListener('click', () => api.game.reload());
    $('#g-external').addEventListener('click', () => api.game.openExternal());

    els.joinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const value = els.joinUrl.value.trim();
      if (!value) { showMessage(els.joinMsg, 'Pegá el enlace de la sala.'); return; }
      showMessage(els.joinMsg, '');
      const result = await api.game.show(stageRect(), value);
      if (!result.ok) showMessage(els.joinMsg, result.error || 'No se pudo abrir la sala.');
      else els.joinUrl.value = '';
    });

    els.favForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await api.addFavorite({ name: els.favName.value, url: els.favUrl.value });
      if (!res.ok) { showMessage(els.favMsg, res.error); return; }
      settings.favorites = res.favorites;
      els.favName.value = '';
      els.favUrl.value = '';
      showMessage(els.favMsg, '');
      renderFavorites();
    });

    els.sAnim.addEventListener('change', () => saveSetting({ animations: els.sAnim.checked }));
    els.sSkip.addEventListener('change', () => saveSetting({ skipWelcome: els.sSkip.checked }));
    els.sZoom.addEventListener('input', () => { els.sZoomLabel.textContent = `${Math.round(Number(els.sZoom.value) * 100)}%`; });
    els.sZoom.addEventListener('change', () => saveSetting({ zoom: Number(els.sZoom.value) }));
    $('#s-clear').addEventListener('click', async () => {
      if (!window.confirm('Se borrarán el apodo, el avatar y la sesión que HaxBall guardó en Kantinazo. ¿Continuar?')) return;
      const res = await api.game.clearData();
      showMessage(els.sMsg, res.ok ? 'Datos del juego borrados.' : 'No se pudieron borrar los datos.');
    });

    new ResizeObserver(() => { if (isGameView(current)) api.game.setBounds(stageRect()); }).observe(els.stage);

    const updateOnline = () => els.offline.classList.toggle('hidden', navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();

    api.onGameState((state) => { gameState = state; renderGameState(); });
  }

  /* ---------- Inicio ---------- */

  async function init() {
    settings = await api.getSettings();
    const info = await api.getInfo();
    if (info) $('#about').textContent = `${info.name} ${info.version} · Electron ${info.electron} · Chromium ${info.chrome}`;
    applySettings();
    bindEvents();
    if (settings.skipWelcome) enterApp(); else window.KantinazoBg.start();
  }

  init().catch((err) => console.error('No se pudo iniciar Kantinazo:', err));
})();
