
/*
 * Palazzo Eterno — Piano I / settore Ia
 * Prototipo di esplorazione indipendente.
 * NON salva dungeon_x/y sul database.
 * Mappa logica: 63 x 81 celle.
 * Matrice JSON: 71 x 89, con padding di 4 celle.
 */

(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const app = $('jungle-app');
  if (!app) return;

  const state = {
    map: null,
    cols: 0,
    rows: 0,
    offsetX: 0,
    offsetY: 0,
    x: null,
    y: null,
    viewCells: 13,
    cellPx: 0,
    user: null,
    character: null,
    db: null,
    channel: null,
    connected: false,
    fogEnabled: true,
    visited: new Set(),
    remotePlayers: new Map(),
    token: null,
    storageKey: 'palazzo:piano-Ia:guest',
    messageTimeout: null,
    music: null,
    ready: false,
    equipmentBonuses: {}
  };

  const viewport = $('map-viewport');
  const layer = $('map-layer');
  const image = $('map-background');
  const grid = $('map-grid');
  const fogCanvas = $('fog-canvas');
  const entityLayer = $('map-entities');
  const chatBox = $('floor-chat-messages');
  const chatInput = $('floor-chat-input');
  const chatSend = $('floor-chat-send');
  const loading = $('map-loading');

  const virtualKeys = Object.freeze({
    arrowup: [0, -1],
    w: [0, -1],
    arrowdown: [0, 1],
    s: [0, 1],
    arrowleft: [-1, 0],
    a: [-1, 0],
    arrowright: [1, 0],
    d: [1, 0]
  });

  // --------------------------------------------------
  // MESSAGGI E SALVATAGGIO LOCALE
  // --------------------------------------------------

  function status(message, error = false) {
    const el = $('jungle-status');
    el.textContent = message;
    el.classList.toggle('error', error);
  }

  function toast(message) {
    const el = $('jungle-toast');
    el.textContent = message;
    el.classList.add('visible');

    clearTimeout(state.messageTimeout);

    state.messageTimeout = setTimeout(() => {
      el.classList.remove('visible');
    }, 2300);
  }

  function localRead(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function localWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // Browser in modalità privata.
    }
  }

  function posKey(x, y) {
    return `${x},${y}`;
  }

  function inside(x, y) {
    return (
      x >= 0 &&
      y >= 0 &&
      x < state.cols &&
      y < state.rows
    );
  }

  function bits() {
    return state.map?.cell_bit || {};
  }

  // --------------------------------------------------
  // COLLISIONI E CASELLE PERCORRIBILI
  // --------------------------------------------------

  function walkable(x, y) {
    if (!state.map || !inside(x, y)) return false;

    const value = Number(
      state.map.cells[y + state.offsetY]?.[
        x + state.offsetX
      ]
    );

    if (!Number.isFinite(value) || value === 0) {
      return false;
    }

    const mask = bits();

    return [
      mask.room ?? 2,
      mask.corridor ?? 4,
      mask.aperture ?? 32,
      mask.arch ?? 65536,
      mask.door ?? 131072,
      mask.portcullis ?? 2097152,
      mask.stair_down ?? 4194304,
      mask.stair_up ?? 8388608
    ].some(bit => (value & bit) !== 0);
  }

  // --------------------------------------------------
  // POSIZIONE INIZIALE
  // --------------------------------------------------

  function getInitialPosition() {
    const entry =
      (state.map.egress || []).find(
        e => e.dir === 'west'
      ) ||
      state.map.egress?.[0];

    if (entry) {
      const ey = Number(entry.row) - state.offsetY;
      const ex = Math.max(
        0,
        Number(entry.col) - state.offsetX
      );

      for (let radius = 0; radius <= 9; radius++) {
        for (
          let y = Math.max(0, ey - radius);
          y <= Math.min(state.rows - 1, ey + radius);
          y++
        ) {
          for (
            let x = 0;
            x <= Math.min(
              state.cols - 1,
              1 + radius + ex
            );
            x++
          ) {
            if (walkable(x, y)) {
              return { x, y };
            }
          }
        }
      }
    }

    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        if (walkable(x, y)) {
          return { x, y };
        }
      }
    }

    throw new Error(
      'Nessuna casella percorribile nel JSON.'
    );
  }

  // --------------------------------------------------
  // CARICAMENTO DELLA MAPPA
  // --------------------------------------------------

  async function loadMap() {
    const mapPath =
      app.dataset.map || 'piano-Ia.json';

    const response = await fetch(mapPath, {
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error(
        `Impossibile caricare ${mapPath} ` +
        `(HTTP ${response.status}).`
      );
    }

    const data = await response.json();

    if (
      !Array.isArray(data.cells) ||
      !data.cells.length ||
      !Array.isArray(data.cells[0])
    ) {
      throw new Error(
        'Il file JSON non contiene una matrice cells valida.'
      );
    }

    const cols = Number(data.settings?.n_cols);
    const rows = Number(data.settings?.n_rows);

    if (
      !Number.isInteger(cols) ||
      !Number.isInteger(rows) ||
      cols < 1 ||
      rows < 1
    ) {
      throw new Error(
        'Dimensioni n_cols/n_rows mancanti nel JSON.'
      );
    }

    const offsetX =
      (data.cells[0].length - cols) / 2;

    const offsetY =
      (data.cells.length - rows) / 2;

    if (
      !Number.isInteger(offsetX) ||
      !Number.isInteger(offsetY) ||
      offsetX < 0 ||
      offsetY < 0
    ) {
      throw new Error(
        'La matrice del dungeon non corrisponde ' +
        'alle dimensioni dichiarate.'
      );
    }

    state.map = data;
    state.cols = cols;
    state.rows = rows;
    state.offsetX = offsetX;
    state.offsetY = offsetY;

    fogCanvas.width = cols * 16;
    fogCanvas.height = rows * 16;

    grid.style.setProperty(
      '--grid-columns',
      cols
    );

    const imagePath =
      image.getAttribute('src') ||
      app.dataset.image ||
      'immagini/piano-Ia-01.png';

    image.onerror = () => {
      status(
        `Errore caricamento immagine: ${imagePath}`,
        true
      );
    };

    if (image.complete && !image.naturalWidth) {
      throw new Error(
        `Impossibile caricare ${imagePath}.`
      );
    }

    if (!image.complete) {
      await new Promise((resolve, reject) => {
        image.addEventListener(
          'load',
          resolve,
          { once: true }
        );

        image.addEventListener(
          'error',
          () => reject(
            new Error(
              `Impossibile caricare ${imagePath}.`
            )
          ),
          { once: true }
        );
      });
    }

    // Il background è soltanto un'immagine
    // tecnica. La grafica del Piano I-A
    // è composta dalle 9 immagini dell'HTML.

    return data;
  }

  // --------------------------------------------------
  // PROGRESSI LOCALI
  // --------------------------------------------------

  function saveProgress() {
    if (!state.ready) return;

    localWrite(
      `${state.storageKey}:position`,
      {
        x: state.x,
        y: state.y
      }
    );

    localWrite(
      `${state.storageKey}:visited`,
      [...state.visited]
    );
  }

  function loadProgress() {
    const saved = localRead(
      `${state.storageKey}:position`
    );

    const start =
      saved &&
      walkable(
        Number(saved.x),
        Number(saved.y)
      )
        ? {
            x: Number(saved.x),
            y: Number(saved.y)
          }
        : getInitialPosition();

    state.x = start.x;
    state.y = start.y;

    state.visited = new Set(
      (
        localRead(
          `${state.storageKey}:visited`,
          []
        ) || []
      ).filter(value => typeof value === 'string')
    );

    revealAroundPlayer();
    updateCoordinates();
  }

  // --------------------------------------------------
  // ESPLORAZIONE E NEBBIA
  // --------------------------------------------------

  function revealAroundPlayer() {
    if (state.x === null) return;

    for (
      let y = Math.max(0, state.y - 6);
      y <= Math.min(state.rows - 1, state.y + 6);
      y++
    ) {
      for (
        let x = Math.max(0, state.x - 6);
        x <= Math.min(state.cols - 1, state.x + 6);
        x++
      ) {
        const distance =
          (x - state.x) ** 2 +
          (y - state.y) ** 2;

        if (distance <= 36) {
          state.visited.add(posKey(x, y));
        }
      }
    }

    drawFog();
  }

  function drawFog() {
    const ctx = fogCanvas.getContext('2d');
    if (!ctx) return;

    const size = 16;

    ctx.clearRect(
      0,
      0,
      fogCanvas.width,
      fogCanvas.height
    );

    if (!state.fogEnabled) return;

    ctx.fillStyle = 'rgba(0, 8, 3, .97)';

    ctx.fillRect(
      0,
      0,
      fogCanvas.width,
      fogCanvas.height
    );

    for (const key of state.visited) {
      const [x, y] = key
        .split(',')
        .map(Number);

      if (!inside(x, y)) continue;

      ctx.clearRect(
        x * size,
        y * size,
        size,
        size
      );

      const distance =
        (x - state.x) ** 2 +
        (y - state.y) ** 2;

      if (distance > 36) {
        ctx.fillStyle = 'rgba(0, 9, 2, .43)';

        ctx.fillRect(
          x * size,
          y * size,
          size,
          size
        );
      }
    }
  }

  // --------------------------------------------------
  // TOKEN PERSONAGGIO
  // --------------------------------------------------

  function tokenUrl(name) {
    const safe = String(
      name || 'token_1.png'
    ).replace(/[^a-zA-Z0-9_.-]/g, '');

    return (
      `../../immagini/token/` +
      `${safe || 'token_1.png'}`
    );
  }

  function makeToken(imgFile, own, label) {
    const token = document.createElement('div');

    token.className = own
      ? 'player-token'
      : 'remote-token';

    token.title = label || 'Avventuriero';

    const img = document.createElement('img');

    img.src = tokenUrl(imgFile);
    img.alt = label || 'Personaggio';

    img.onerror = () => {
      img.onerror = null;
      img.src = tokenUrl('token_1.png');
    };

    token.appendChild(img);
    entityLayer.appendChild(token);

    return token;
  }

  function positionToken(token, x, y) {
    if (!token || !inside(x, y)) return;

    const px = state.cellPx;

    token.style.left = `${x * px + 1}px`;
    token.style.top = `${y * px + 1}px`;

    token.style.width =
      `${Math.max(1, px - 2)}px`;

    token.style.height =
      `${Math.max(1, px - 2)}px`;
  }

  function renderTokens() {
    if (!state.token) {
      state.token = makeToken(
        state.character?.token,
        true,
        state.character?.nome || 'Esploratore'
      );
    }

    positionToken(
      state.token,
      state.x,
      state.y
    );

    for (const [, info] of state.remotePlayers) {
      if (!info.token) {
        info.token = makeToken(
          info.image,
          false,
          info.name
        );
      }

      positionToken(
        info.token,
        info.x,
        info.y
      );
    }
  }

  // --------------------------------------------------
  // ZOOM E TELECAMERA
  // --------------------------------------------------

  function resizeMap(instant = false) {
    if (!state.map || !viewport) return;

    const frame = viewport.getBoundingClientRect();

    if (frame.width < 1) return;

    const entireMap =
      state.viewCells >= Math.max(
        state.cols,
        state.rows
      );

    const px = entireMap
      ? Math.min(
          viewport.clientWidth / state.cols,
          viewport.clientHeight / state.rows
        )
      : frame.width / state.viewCells;

    state.cellPx = px;

    layer.style.width =
      `${state.cols * px}px`;

    layer.style.height =
      `${state.rows * px}px`;

    layer.style.setProperty(
      '--cell',
      `${px}px`
    );

    renderTokens();
    centerCamera(instant);
  }

  function centerCamera(instant = false) {
    if (
      state.x === null ||
      !state.cellPx
    ) return;

    const viewW = viewport.clientWidth;
    const viewH = viewport.clientHeight;

    const mapW = state.cols * state.cellPx;
    const mapH = state.rows * state.cellPx;

    const x = mapW <= viewW
      ? -(viewW - mapW) / 2
      : Math.max(
          0,
          Math.min(
            (state.x + 0.5) * state.cellPx -
              viewW / 2,
            mapW - viewW
          )
        );

    const y = mapH <= viewH
      ? -(viewH - mapH) / 2
      : Math.max(
          0,
          Math.min(
            (state.y + 0.5) * state.cellPx -
              viewH / 2,
            mapH - viewH
          )
        );

    layer.style.transition =
      instant ? 'none' : '';

    layer.style.transform =
      `translate3d(${-x}px, ${-y}px, 0)`;
  }

  function setZoom(viewCells) {
    const limit = state.map
      ? Math.max(state.cols, state.rows)
      : 81;

    state.viewCells = Math.max(
      7,
      Math.min(limit, viewCells)
    );

    const full =
      state.viewCells >= limit;

    $('map-zoom-reset').textContent = full
      ? `${state.cols} × ${state.rows}`
      : `${state.viewCells} × ${state.viewCells}`;

    resizeMap(true);
  }

  // --------------------------------------------------
  // MOVIMENTO
  // --------------------------------------------------

  function updateCoordinates() {
    $('player-coordinates').textContent =
      `X ${state.x} · Y ${state.y} / ` +
      `${state.cols} × ${state.rows}`;
  }

  function move(dx, dy) {
    if (
      !state.ready ||
      state.x === null
    ) return;

    const x = state.x + dx;
    const y = state.y + dy;

    if (!walkable(x, y)) {
      toast('Il sentiero è bloccato.');
      return;
    }

    state.x = x;
    state.y = y;

    positionToken(
      state.token,
      x,
      y
    );

    centerCamera();
    revealAroundPlayer();
    updateCoordinates();
    saveProgress();
    broadcastPosition();
  }

  // --------------------------------------------------
  // CONTROLLI DELLA PAGINA
  // --------------------------------------------------

  function bindControls() {
    document.addEventListener(
      'keydown',
      event => {
        if (
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.repeat
        ) return;

        const target = event.target;

        if (
          target?.closest?.(
            'input, textarea, select, button, ' +
            '[contenteditable="true"]'
          )
        ) return;

        const key =
          event.key.toLowerCase();

        const direction = virtualKeys[key];

        if (!direction) return;

        event.preventDefault();
        move(...direction);
      }
    );

    viewport.addEventListener(
      'click',
      event => {
        if (!state.ready) return;

        const rect =
          layer.getBoundingClientRect();

        const x = Math.floor(
          (event.clientX - rect.left) /
            state.cellPx
        );

        const y = Math.floor(
          (event.clientY - rect.top) /
            state.cellPx
        );

        if (!inside(x, y)) return;

        const dx = x - state.x;
        const dy = y - state.y;

        if (Math.abs(dx) + Math.abs(dy) === 1) {
          move(dx, dy);
        } else {
          toast(
            'Clicca una casella adiacente per spostarti.'
          );
        }

        viewport.focus({
          preventScroll: true
        });
      }
    );

    document
      .querySelectorAll('[data-move]')
      .forEach(button => {
        button.addEventListener(
          'click',
          () => {
            const direction =
              button.dataset.move
                .split(',')
                .map(Number);

            move(...direction);
          }
        );
      });

    // Zoom normale.
    $('map-zoom-out').addEventListener(
      'click',
      () => setZoom(state.viewCells + 2)
    );

    $('map-zoom-in').addEventListener(
      'click',
      () => setZoom(state.viewCells - 2)
    );

    // Ripristina 13 x 13.
    $('map-zoom-reset').addEventListener(
      'click',
      () => setZoom(13)
    );

    // Visualizza tutta la mappa 63 x 81.
    $('map-zoom-full').addEventListener(
      'click',
      () => setZoom(
        Math.max(
          state.cols,
          state.rows
        )
      )
    );

    $('toggle-grid').addEventListener(
      'change',
      event => {
        grid.classList.toggle(
          'visible',
          event.target.checked
        );
      }
    );

    $('toggle-fog').addEventListener(
      'change',
      event => {
        state.fogEnabled =
          event.target.checked;

        drawFog();
      }
    );

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(
        () => resizeMap(true)
      ).observe(viewport);
    } else {
      window.addEventListener(
        'resize',
        () => resizeMap(true)
      );
    }

    $('save-notes-button').addEventListener(
      'click',
      () => {
        localWrite(
          `${state.storageKey}:notes`,
          $('character-notes').value
        );

        toast(
          'Note salvate in questo browser.'
        );
      }
    );

    $('floor-chat-form').addEventListener(
      'submit',
      sendChat
    );

    setupAudio();
  }

  // --------------------------------------------------
  // AUDIO
  // --------------------------------------------------

  function setupAudio() {
    const audio = new Audio(
      '../../music/dungeon.mp3'
    );

    audio.loop = true;
    audio.preload = 'none';

    audio.volume = (
      Number(
        localRead(
          'palazzo:piano-Ia:volume',
          35
        )
      ) || 0
    ) / 100;

    $('audio-volume').value =
      Math.round(audio.volume * 100);

    state.music = audio;

    const setLabel = () => {
      $('audio-toggle').textContent =
        audio.paused ? '♫' : '♪';

      $('audio-toggle').setAttribute(
        'aria-label',
        audio.paused
          ? 'Attiva la musica'
          : 'Disattiva la musica'
      );
    };

    $('audio-toggle').addEventListener(
      'click',
      async () => {
        try {
          if (audio.paused) {
            await audio.play();
          } else {
            audio.pause();
          }
        } catch (_) {
          toast(
            'Impossibile avviare la musica.'
          );
        }

        setLabel();
      }
    );

    $('audio-volume').addEventListener(
      'input',
      event => {
        audio.volume =
          Number(event.target.value) / 100;

        localWrite(
          'palazzo:piano-Ia:volume',
          Number(event.target.value)
        );
      }
    );

    window.addEventListener(
      'pagehide',
      () => {
        audio.pause();

        if (state.channel && state.db) {
          state.db.removeChannel(
            state.channel
          );
        }
      }
    );
  }

  // --------------------------------------------------
  // UTILITY PERSONAGGIO
  // --------------------------------------------------

  function textInto(
    id,
    value,
    fallback = '—'
  ) {
    $(id).textContent =
      value === undefined ||
      value === null ||
      value === ''
        ? fallback
        : String(value);
  }

  const firstValue = (obj, keys) => {
    for (const key of keys) {
      if (
        obj &&
        obj[key] !== null &&
        obj[key] !== undefined
      ) {
        return obj[key];
      }
    }

    return null;
  };

  // --------------------------------------------------
  // EQUIPAGGIAMENTO
  // --------------------------------------------------

  async function loadEquipmentBonuses() {
    const names = [
      'attack',
      'defense',
      'forza',
      'resistenza',
      'costituzione',
      'intelligenza',
      'destrezza',
      'fortuna'
    ];

    const bonuses = Object.fromEntries(
      names.map(
        name => [`${name}_bonus`, 0]
      )
    );

    if (
      !state.character ||
      !state.db
    ) {
      state.equipmentBonuses = bonuses;
      return;
    }

    try {
      const fields = names
        .map(name => `${name}_bonus`)
        .join(', ');

      const { data, error } = await state.db
        .from('character_inventory')
        .select(
          `equipped_slot, item:items (${fields})`
        )
        .eq(
          'character_id',
          state.character.id
        );

      if (error) throw error;

      for (const entry of data || []) {
        if (
          !entry.equipped_slot ||
          !entry.item
        ) continue;

        for (const name of names) {
          bonuses[`${name}_bonus`] +=
            Number(
              entry.item[`${name}_bonus`]
            ) || 0;
        }
      }
    } catch (error) {
      console.warn(
        'Bonus equipaggiamento non disponibili:',
        error
      );
    }

    state.equipmentBonuses = bonuses;
  }

  // --------------------------------------------------
  // STATISTICHE
  // --------------------------------------------------

  function calculatedStats() {
    const character =
      state.character || {};

    const bonus =
      state.equipmentBonuses;

    const effective = key => {
      return Math.min(
        30,
        Math.max(
          1,
          (Number(character[key]) || 1) +
            (Number(bonus[`${key}_bonus`]) || 0)
        )
      );
    };

    const forza =
      effective('forza');

    const resistenza =
      effective('resistenza');

    const costituzione =
      effective('costituzione');

    const intelligenza =
      effective('intelligenza');

    const destrezza =
      effective('destrezza');

    const fortuna =
      effective('fortuna');

    return {
      forza,
      resistenza,
      costituzione,
      intelligenza,
      destrezza,
      fortuna,

      attack:
        Math.ceil(forza / 2) +
        (Number(bonus.attack_bonus) || 0),

      defense:
        Math.ceil(7 + resistenza / 2) +
        (Number(bonus.defense_bonus) || 0),

      maxHealth:
        Math.ceil(5 * costituzione / 2),

      maxMana:
        Math.ceil(5 * intelligenza / 2),

      movement:
        Math.ceil(4 + destrezza / 2),

      critical:
        Math.round(
          fortuna * (50 / 30) * 100
        ) / 100
    };
  }

  // --------------------------------------------------
  // SCHEDA PERSONAGGIO
  // --------------------------------------------------

  function fillCharacterPanel() {
    const character = state.character;

    if (!character) {
      textInto(
        'character-name',
        'ESPLORATORE'
      );
      return;
    }

    const stats = calculatedStats();

    textInto(
      'character-name',
      character.nome ||
        character.name ||
        'AVVENTURIERO'
    );

    textInto(
      'character-level',
      `LV ${Number(character.livello) || 1}`
    );

    textInto(
      'character-hp',
      `${character.current_hp ?? stats.maxHealth} / ` +
      `${stats.maxHealth}`
    );

    textInto(
      'character-mana',
      `${character.current_pm ?? stats.maxMana} / ` +
      `${stats.maxMana}`
    );

    textInto(
      'character-resonance',
      firstValue(
        character,
        [
          'resonance_score',
          'resonance',
          'score'
        ]
      ) ?? '—'
    );

    textInto('stat-att', stats.attack);
    textInto('stat-dif', stats.defense);
    textInto('stat-mov', stats.movement);

    textInto(
      'stat-crt',
      `${stats.critical.toFixed(2)}%`
    );

    const attributes = {
      for: 'forza',
      res: 'resistenza',
      cos: 'costituzione',
      int: 'intelligenza',
      des: 'destrezza',
      lck: 'fortuna'
    };

    for (
      const [label, key] of
      Object.entries(attributes)
    ) {
      textInto(
        `attr-${label}`,
        stats[key]
      );
    }

    $('character-token').src =
      tokenUrl(character.token);

    $('character-token').onerror = event => {
      event.target.onerror = null;
      event.target.src =
        tokenUrl('token_1.png');
    };
  }

  // --------------------------------------------------
  // CARICAMENTO PG DA SUPABASE
  // --------------------------------------------------

  async function loadCharacter() {
    const db = window.supabaseClient;

    if (!db?.auth?.getUser) {
      status(
        'Esplorazione locale: autenticazione non disponibile.'
      );
      return;
    }

    state.db = db;

    const {
      data: auth,
      error: authError
    } = await db.auth.getUser();

    if (
      authError ||
      !auth?.user
    ) {
      status(
        'Esplorazione locale: accedi per mostrare ' +
        'il tuo PG e usare la chat.'
      );
      return;
    }

    state.user = auth.user;

    const {
      data: character,
      error
    } = await db
      .from('characters')
      .select('*')
      .eq(
        'user_id',
        auth.user.id
      )
      .maybeSingle();

    if (error) throw error;

    if (!character) {
      status(
        'Nessun personaggio associato a questo account.',
        true
      );
      return;
    }

    state.character = character;

    state.storageKey =
      `palazzo:piano-Ia:${character.id}`;

    await loadEquipmentBonuses();
    fillCharacterPanel();
  }

  // --------------------------------------------------
  // CLASSIFICA TOP 5
  // --------------------------------------------------

  async function loadLeaderboard() {
    const target =
      $('dungeon-leaderboard-list');

    if (
      !state.db ||
      !state.user
    ) {
      target.innerHTML =
        '<p class="muted">Accedi per vedere la classifica.</p>';

      return;
    }

    const {
      data,
      error
    } = await state.db.rpc(
      'get_living_characters_leaderboard_with_badges',
      {
        p_limit: 5
      }
    );

    if (error) {
      target.textContent =
        'Classifica non disponibile.';
      return;
    }

    target.replaceChildren();

    if (!data?.length) {
      target.textContent =
        'Nessun personaggio in classifica.';
      return;
    }

    for (const row of data.slice(0, 5)) {
      const div =
        document.createElement('div');

      div.className = 'leader-row';

      const rank =
        document.createElement('span');

      rank.className = 'leader-rank';
      rank.textContent =
        `#${row.posizione ?? '?'}`;

      const name =
        document.createElement('span');

      name.className = 'leader-name';

      name.textContent =
        `${row.level ? `Lv${row.level} ` : ''}` +
        `${row.character_name || 'Avventuriero'}`;

      const score =
        document.createElement('span');

      score.className = 'leader-score';

      score.textContent =
        Number(row.score || 0)
          .toLocaleString('it-IT');

      div.append(
        rank,
        name,
        score
      );

      target.append(div);
    }
  }

  // --------------------------------------------------
  // CHAT DEL PIANO I-A
  // --------------------------------------------------

  function appendChat(
    name,
    text,
    time = Date.now()
  ) {
    const row =
      document.createElement('div');

    row.className = 'chat-line';

    const who =
      document.createElement('span');

    who.className = 'chat-name';
    who.textContent = name;

    const body =
      document.createElement('span');

    body.className = 'chat-text';
    body.textContent = text;

    const when =
      document.createElement('span');

    when.className = 'chat-time';

    when.textContent =
      new Date(time).toLocaleTimeString(
        'it-IT',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      );

    row.append(
      who,
      body,
      when
    );

    chatBox.append(row);

    while (chatBox.children.length > 100) {
      chatBox.firstChild.remove();
    }

    chatBox.scrollTop =
      chatBox.scrollHeight;
  }

  async function sendChat(event) {
    event.preventDefault();

    const value =
      chatInput.value.trim();

    if (
      !value ||
      !state.connected ||
      !state.channel ||
      !state.character
    ) return;

    if (value.length > 300) return;

    chatInput.disabled = true;

    try {
      const result =
        await state.channel.send({
          type: 'broadcast',
          event: 'floor-chat',
          payload: {
            id: state.character.id,
            name:
              state.character.nome ||
              'Avventuriero',
            text: value,
            sent_at: Date.now()
          }
        });

      if (result !== 'ok') {
        throw new Error(
          `Invio fallito (${result})`
        );
      }

      appendChat(
        state.character.nome || 'Tu',
        value
      );

      chatInput.value = '';
    } catch (error) {
      toast(
        'Chat non inviata: ' +
        String(
          error.message || error
        )
      );
    } finally {
      chatInput.disabled =
        !state.connected;

      chatInput.focus();
    }
  }

  // --------------------------------------------------
  // POSIZIONE ONLINE
  // --------------------------------------------------

  function broadcastPosition() {
    if (
      !state.connected ||
      !state.channel ||
      !state.character
    ) return;

    state.channel.track({
      name:
        state.character.nome ||
        'Avventuriero',

      image:
        state.character.token ||
        'token_1.png',

      x: state.x,
      y: state.y
    });
  }

  function updateOnline() {
    const list =
      $('dungeon-online-list');

    const presence =
      state.channel?.presenceState?.() || {};

    state.remotePlayers.forEach(
      info => info.token?.remove()
    );

    state.remotePlayers.clear();
    list.replaceChildren();

    let count = 0;

    for (
      const [id, entries] of
      Object.entries(presence)
    ) {
      const player =
        entries?.[entries.length - 1];

      if (!player) continue;

      count++;

      const div =
        document.createElement('div');

      div.className = 'online-row';

      const dot =
        document.createElement('span');

      dot.className = 'online-dot';

      const name =
        document.createElement('span');

      name.textContent =
        player.name || 'Avventuriero';

      div.append(dot, name);
      list.append(div);

      if (
        id !== state.character?.id &&
        walkable(
          Number(player.x),
          Number(player.y)
        )
      ) {
        state.remotePlayers.set(
          id,
          {
            x: Number(player.x),
            y: Number(player.y),
            name: player.name,
            image: player.image,
            token: null
          }
        );
      }
    }

    $('online-count').textContent =
      String(count);

    if (!count) {
      list.textContent =
        'Nessun esploratore collegato.';
    }

    renderTokens();
  }

  // --------------------------------------------------
  // REALTIME SUPABASE
  // --------------------------------------------------

  async function connectRealtime() {
    if (
      !state.db ||
      !state.character
    ) {
      chatBox.textContent =
        'Accedi per utilizzare la chat del Piano I.';

      return;
    }

    const channel = state.db.channel(
      'palazzo-eterno-piano-Ia',
      {
        config: {
          presence: {
            key: state.character.id
          },
          broadcast: {
            self: false
          }
        }
      }
    );

    state.channel = channel;

    channel.on(
      'presence',
      {
        event: 'sync'
      },
      updateOnline
    );

    channel.on(
      'broadcast',
      {
        event: 'floor-chat'
      },
      ({ payload }) => {
        if (
          !payload ||
          !payload.text ||
          payload.id === state.character.id
        ) return;

        appendChat(
          String(
            payload.name ||
            'Avventuriero'
          ),
          String(payload.text)
            .slice(0, 300),
          payload.sent_at ||
            Date.now()
        );
      }
    );

    channel.subscribe(
      async result => {
        if (result === 'SUBSCRIBED') {
          state.connected = true;

          chatBox.replaceChildren();

          chatInput.disabled = false;
          chatSend.disabled = false;

          appendChat(
            'Sistema',
            'Chat temporanea del Piano I attiva. ' +
            'I messaggi non vengono archiviati.'
          );

          await channel.track({
            name:
              state.character.nome ||
              'Avventuriero',

            image:
              state.character.token ||
              'token_1.png',

            x: state.x,
            y: state.y
          });
        } else if (
          result === 'CHANNEL_ERROR' ||
          result === 'TIMED_OUT' ||
          result === 'CLOSED'
        ) {
          state.connected = false;

          chatInput.disabled = true;
          chatSend.disabled = true;

          chatBox.textContent =
            'Chat non disponibile: connessione persa.';
        }
      }
    );
  }

  // --------------------------------------------------
  // AVVIO DEL PIANO I-A
  // --------------------------------------------------

  async function main() {
    bindControls();

    try {
      await loadMap();

      try {
        await loadCharacter();
      } catch (error) {
        console.error(
          'Piano Ia: lettura PG:',
          error
        );

        status(
          'Errore caricamento personaggio. ' +
          'Esplorazione locale disponibile.',
          true
        );
      }

      loadProgress();

      $('character-notes').value =
        localRead(
          `${state.storageKey}:notes`,
          ''
        ) || '';

      state.ready = true;

      renderTokens();
      resizeMap(true);

      loading.hidden = true;

      status(
        `Piano I caricato · ` +
        `${state.cols} × ${state.rows} caselle · ` +
        `X ${state.x} / Y ${state.y}`
      );

      await Promise.allSettled([
        loadLeaderboard(),
        connectRealtime()
      ]);
    } catch (error) {
      console.error(
        'Piano Ia:',
        error
      );

      loading.textContent =
        'Impossibile caricare la mappa. ' +
        'Controlla i percorsi nella console.';

      status(
        error?.message ||
        'Errore sconosciuto durante il caricamento.',
        true
      );
    }
  }

  main();
})();
