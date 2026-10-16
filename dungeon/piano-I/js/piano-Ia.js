/*
 * Palazzo Eterno — Piano I / settore Ia
 * Prototipo di esplorazione indipendente: NON salva dungeon_x/y sul DB.
 * Si basa sul formato dungeon.json del Piano 1 (celle con bitmask e padding 4).
 * La mappa originale ha 63 x 81 celle logiche, dentro una matrice 71 x 89.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const app = $('jungle-app');
  if (!app) return;

  const state = {
    map: null, cols: 0, rows: 0, offsetX: 0, offsetY: 0,
    x: null, y: null, viewCells: 13, cellPx: 0,
    user: null, character: null, db: null, channel: null,
    connected: false, fogEnabled: true, visited: new Set(),
    remotePlayers: new Map(), token: null,
    storageKey: 'palazzo:piano-Ia:guest',
    messageTimeout: null, music: null,
    ready: false, equipmentBonuses: {},
    combatSlots: new Map(), combatTokens: new Map(), combatBusy: false,
    combatRefreshBusy: false
  };

  const viewport = $('map-viewport');
  const layer = $('map-layer');
  const image = $('map-background');
  const grid = $('map-grid');
  const fogCanvas = $('fog-canvas');
  const entityLayer = $('map-entities');
  const combatLayer = $('p1-combat-layer');
  const chatBox = $('floor-chat-messages');
  const chatInput = $('floor-chat-input');
  const chatSend = $('floor-chat-send');
  const loading = $('map-loading');
  const virtualKeys = Object.freeze({
    arrowup: [0, -1], w: [0, -1],
    arrowdown: [0, 1], s: [0, 1],
    arrowleft: [-1, 0], a: [-1, 0],
    arrowright: [1, 0], d: [1, 0]
  });

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
    state.messageTimeout = setTimeout(() => el.classList.remove('visible'), 2300);
  }

  function localRead(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch (_) { return fallback; }
  }
  function localWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* privacy mode */ }
  }
  function posKey(x, y) { return `${x},${y}`; }
  function inside(x, y) { return x >= 0 && y >= 0 && x < state.cols && y < state.rows; }
  function bits() { return state.map?.cell_bit || {}; }

  function walkable(x, y) {
    if (!state.map || !inside(x, y)) return false;
    const v = Number(state.map.cells[y + state.offsetY]?.[x + state.offsetX]);
    if (!Number.isFinite(v) || v === 0) return false;
    const mask = bits();
    // Identico criterio adottato da canMoveTo() nel JS del Piano 1.
    return [
      mask.room ?? 2, mask.corridor ?? 4, mask.aperture ?? 32,
      mask.arch ?? 65536, mask.door ?? 131072,
      mask.portcullis ?? 2097152, mask.stair_down ?? 4194304,
      mask.stair_up ?? 8388608
    ].some(bit => (v & bit) !== 0);
  }

  function getInitialPosition() {
    // Egress del generatore: lato ovest, row 67. La matrice ha un margine di 4 celle.
    // Cerchiamo la prima casella giocabile vicino all'uscita senza assumere che l'egress
    // stesso sia dentro l'area 63x81.
    const entry = (state.map.egress || []).find(e => e.dir === 'west') || state.map.egress?.[0];
    if (entry) {
      const ey = Number(entry.row) - state.offsetY;
      const ex = Math.max(0, Number(entry.col) - state.offsetX);
      for (let r = 0; r <= 9; r++) {
        for (let y = Math.max(0, ey - r); y <= Math.min(state.rows - 1, ey + r); y++) {
          for (let x = 0; x <= Math.min(state.cols - 1, 1 + r + ex); x++) {
            if (walkable(x, y)) return { x, y };
          }
        }
      }
    }
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        if (walkable(x, y)) return { x, y };
      }
    }
    throw new Error('Nessuna casella percorribile nel JSON.');
  }

  async function loadMap() {
    const mapPath = app.dataset.map || 'piano-Ia.json';
    const response = await fetch(mapPath, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Impossibile caricare ${mapPath} (HTTP ${response.status}).`);
    const data = await response.json();
    if (!Array.isArray(data.cells) || !data.cells.length || !Array.isArray(data.cells[0])) {
      throw new Error('Il file JSON non contiene una matrice cells valida.');
    }
    const cols = Number(data.settings?.n_cols);
    const rows = Number(data.settings?.n_rows);
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
      throw new Error('Dimensioni n_cols/n_rows mancanti nel JSON.');
    }
    const offsetX = (data.cells[0].length - cols) / 2;
    const offsetY = (data.cells.length - rows) / 2;
    if (!Number.isInteger(offsetX) || !Number.isInteger(offsetY) || offsetX < 0 || offsetY < 0) {
      throw new Error('La matrice del dungeon non corrisponde alle dimensioni dichiarate.');
    }
    state.map = data;
    state.cols = cols;
    state.rows = rows;
    state.offsetX = offsetX;
    state.offsetY = offsetY;
    fogCanvas.width = cols * 16;
    fogCanvas.height = rows * 16;
    grid.style.setProperty('--grid-columns', cols);
    image.onerror = () => {
      status('Errore: immagine della mappa non trovata in immagini/piano-Ia-hd-soft.png.', true);
    };
    if (image.complete && !image.naturalWidth) {
      throw new Error('Impossibile caricare immagini/piano-Ia-hd-soft.png.');
    }
    if (!image.complete) {
      await new Promise((resolve, reject) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', () => reject(new Error('Impossibile caricare immagini/piano-Ia-hd-soft.png.')), { once: true });
      });
    }
    const ratioMap = cols / rows;
    const ratioImg = image.naturalWidth / image.naturalHeight;
    if (Math.abs(ratioMap - ratioImg) > .04) {
      console.warn('Piano Ia: proporzioni PNG/JSON diverse. Verificare la sovrapposizione della griglia.', ratioImg, ratioMap);
      toast('Controlla l’allineamento tra immagine e JSON.');
    }
    return data;
  }

  function saveProgress() {
    if (!state.ready) return;
    localWrite(`${state.storageKey}:position`, { x: state.x, y: state.y });
    localWrite(`${state.storageKey}:visited`, [...state.visited]);
  }

  function loadProgress() {
    const saved = null; // Le coordinate ufficiali sono sempre lette da Supabase.
    const start = saved && walkable(Number(saved.x), Number(saved.y))
      ? { x: Number(saved.x), y: Number(saved.y) }
      : getInitialPosition();
    state.x = start.x;
    state.y = start.y;
    state.visited = new Set((localRead(`${state.storageKey}:visited`, []) || []).filter(v => typeof v === 'string'));
    revealAroundPlayer();
    updateCoordinates();
  }

  function revealAroundPlayer() {
    if (state.x === null) return;
    for (let y = Math.max(0, state.y - 6); y <= Math.min(state.rows - 1, state.y + 6); y++) {
      for (let x = Math.max(0, state.x - 6); x <= Math.min(state.cols - 1, state.x + 6); x++) {
        if ((x - state.x) ** 2 + (y - state.y) ** 2 <= 36) state.visited.add(posKey(x, y));
      }
    }
    drawFog();
  }

  function drawFog() {
    const ctx = fogCanvas.getContext('2d');
    if (!ctx) return;
    const z = 16;
    ctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
    if (!state.fogEnabled) return;
    ctx.fillStyle = 'rgba(0, 8, 3, .97)';
    ctx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
    for (const key of state.visited) {
      const [x, y] = key.split(',').map(Number);
      if (!inside(x, y)) continue;
      ctx.clearRect(x * z, y * z, z, z);
      if ((x - state.x) ** 2 + (y - state.y) ** 2 > 36) {
        ctx.fillStyle = 'rgba(0, 9, 2, .43)';
        ctx.fillRect(x * z, y * z, z, z);
      }
    }
  }

  function tokenUrl(name) {
    const safe = String(name || 'token_1.png').replace(/[^a-zA-Z0-9_.-]/g, '');
    return `../../immagini/token/${safe || 'token_1.png'}`;
  }

  function makeToken(imgFile, own, label) {
    const token = document.createElement('div');
    token.className = own ? 'player-token' : 'remote-token';
    token.title = label || 'Avventuriero';
    const img = document.createElement('img');
    img.src = tokenUrl(imgFile);
    img.alt = label || 'Personaggio';
    img.onerror = () => { img.onerror = null; img.src = tokenUrl('token_1.png'); };
    token.appendChild(img);
    entityLayer.appendChild(token);
    return token;
  }

  function positionToken(token, x, y) {
    if (!token || !inside(x, y)) return;
    token.style.left = `${x * state.cellPx + 1}px`;
    token.style.top = `${y * state.cellPx + 1}px`;
    token.style.width = `${state.cellPx - 2}px`;
    token.style.height = `${state.cellPx - 2}px`;
  }

  function renderTokens() {
    if (!state.token) state.token = makeToken(state.character?.token, true, state.character?.nome || 'Esploratore');
    positionToken(state.token, state.x, state.y);
    for (const [id, info] of state.remotePlayers) {
      if (!info.token) info.token = makeToken(info.image, false, info.name);
      positionToken(info.token, info.x, info.y);
    }
  }


  // =============================================================
  // PIANO I-A — INCONTRI ROTANTI
  // L'ID stanza viene letto dal bitmask del JSON: nessuna coordinata
  // di spawn viene indovinata dalla posizione grafica dell'immagine.
  // =============================================================
  const COMBAT_FAMILIES = Object.freeze({
    uccello_parassita: { icon: '🐦', name: 'Uccelli Parassita' },
    piante_carnivore: { icon: '🌿', name: 'Piante Carnivore' },
    lucertoloidi: { icon: '🦎', name: 'Pattuglie di Lucertoloidi' },
    dinosauri: { icon: '🦖', name: 'Dinosauri Selvaggi' },
    miconidi: { icon: '🍄', name: 'Miconidi Tossici' }
  });

  function currentRoomNumber() {
    if (!state.map || !inside(state.x, state.y)) return null;
    const cell = Number(state.map.cells[state.y + state.offsetY]?.[state.x + state.offsetX]);
    if (!Number.isFinite(cell) || !(cell & (bits().room ?? 2))) return null;
    return (cell & (bits().room_id ?? 65472)) >>> 6;
  }

  function combatTokenPosition(token, x, y) {
    if (!token || !state.cellPx || !inside(x, y)) return;
    // Il centro del token coincide con il centro esatto della casella.
    const diameter = Math.max(13, Math.min(38, state.cellPx * 1.5));
    token.style.left = `${(x + 0.5) * state.cellPx}px`;
    token.style.top = `${(y + 0.5) * state.cellPx}px`;
    token.style.width = `${diameter}px`;
    token.style.height = `${diameter}px`;
    token.style.fontSize = `${Math.max(9, Math.min(21, diameter * 0.57))}px`;
  }

  function renderCombatTokens() {
    if (!combatLayer) return;
    const visibleIds = new Set();
    for (const slot of state.combatSlots.values()) {
      if (!['active', 'engaged'].includes(slot.status)) continue;
      const x = Number(slot.x), y = Number(slot.y);
      if (!inside(x, y) || !walkable(x, y)) continue;
      const family = COMBAT_FAMILIES[slot.family];
      if (!family) continue;
      const id = String(slot.encounter_id || '');
      if (!id) continue;
      visibleIds.add(id);
      let token = state.combatTokens.get(id);
      if (!token) {
        token = document.createElement('button');
        token.type = 'button';
        token.className = 'p1-combat-token';
        token.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          enterRoomCombat(id);
        });
        combatLayer.appendChild(token);
        state.combatTokens.set(id, token);
      }
      const name = family.name;
      const difficulty = String(slot.difficulty || 'medio');
      const remaining = slot.expires_at ? Math.max(0, Math.ceil((new Date(slot.expires_at).getTime() - Date.now()) / 60000)) : null;
      const timer = slot.status === 'engaged' ? 'combattimento in corso' : `rotazione tra ${remaining ?? '?'} min`;
      token.className = `p1-combat-token p1-combat-${slot.family} p1-combat-${difficulty}${slot.status === 'engaged' ? ' p1-combat-engaged' : ''}`;
      token.textContent = family.icon;
      token.title = `${name} · ${difficulty} · stanza ${slot.room_number} · ${timer}`;
      token.setAttribute('aria-label', `Combattimento ${name} ${difficulty}, stanza ${slot.room_number}. ${timer}.`);
      combatTokenPosition(token, x, y);
    }
    for (const [id, token] of state.combatTokens) {
      if (visibleIds.has(id)) continue;
      token.remove();
      state.combatTokens.delete(id);
    }
    const counter = $('p1-combat-status');
    if (counter) counter.textContent = `Incontri: ${state.combatSlots.size}/20`;
  }

  async function refreshCombatSlots() {
    if (!state.db || !state.character || !state.ready || state.combatRefreshBusy || document.hidden) return;
    state.combatRefreshBusy = true;
    try {
      // L'RPC applica server-side i timer individuali, poi restituisce
      // l'elenco aggiornato. Non dipende dall'orologio del browser.
      const { data, error } = await state.db.rpc('p1_get_rotating_combats');
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Risposta incontri non valida');
      state.combatSlots = new Map(data.map(slot => [slot.encounter_id, slot]));
      renderCombatTokens();
    } catch (error) {
      console.warn('Piano I-A: incontri non aggiornati:', error);
      const counter = $('p1-combat-status');
      if (counter) counter.textContent = 'Incontri non disponibili';
    } finally {
      state.combatRefreshBusy = false;
    }
  }

  async function enterRoomCombat(encounterId) {
    if (state.combatBusy || !state.ready || !state.db) return;
    const slot = state.combatSlots.get(encounterId);
    if (!slot || !['active', 'engaged'].includes(slot.status)) {
      toast('Questo incontro è già scomparso.');
      await refreshCombatSlots();
      return;
    }
    if (currentRoomNumber() !== Number(slot.room_number)) {
      toast(`Raggiungi la stanza ${slot.room_number} per affrontare questo incontro.`);
      return;
    }
    state.combatBusy = true;
    try {
      // Supabase verifica nuovamente posizione, disponibilità e capienza.
      const { data, error } = await state.db.rpc('p1_enter_room_combat', {
        p_encounter_id: encounterId
      });
      if (error) throw error;
      if (!data) throw new Error('Nessuna sessione disponibile');
      window.location.assign(`../../combat.html?combat_id=${encodeURIComponent(data)}`);
    } catch (error) {
      toast('Ingresso nel combattimento: ' + (error.message || String(error)));
      await refreshCombatSlots();
    } finally {
      state.combatBusy = false;
    }
  }

  function startCombatRefresh() {
    refreshCombatSlots();
    // Un'unica richiesta ogni 15 secondi, soltanto quando la pagina è visibile.
    setInterval(refreshCombatSlots, 15000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshCombatSlots();
    });
  }

  function resizeMap(instant = false) {
    if (!state.map || !viewport) return;
    const frame = viewport.getBoundingClientRect();
    if (frame.width < 1) return;
    // Vista completa: adatta sia la larghezza (63) sia l'altezza (81) della mappa.
    const entireMap = state.viewCells >= Math.max(state.cols, state.rows);
    const px = entireMap
      ? Math.min(viewport.clientWidth / state.cols, viewport.clientHeight / state.rows)
      : frame.width / state.viewCells;
    state.cellPx = px;
    layer.style.width = `${state.cols * px}px`;
    layer.style.height = `${state.rows * px}px`;
    layer.style.setProperty('--cell', `${px}px`);
    renderTokens();
    renderCombatTokens();
    centerCamera(instant);
  }

  function centerCamera(instant = false) {
    if (state.x === null || !state.cellPx) return;
    const viewW = viewport.clientWidth;
    const viewH = viewport.clientHeight;
    const mapW = state.cols * state.cellPx;
    const mapH = state.rows * state.cellPx;
    const x = mapW <= viewW
      ? -(viewW - mapW) / 2
      : Math.max(0, Math.min((state.x + .5) * state.cellPx - viewW / 2, mapW - viewW));
    const y = mapH <= viewH
      ? -(viewH - mapH) / 2
      : Math.max(0, Math.min((state.y + .5) * state.cellPx - viewH / 2, mapH - viewH));
    layer.style.transition = instant ? 'none' : '';
    layer.style.transform = `translate3d(${-x}px, ${-y}px, 0)`;
  }

  function updateCoordinates() {
    $('player-coordinates').textContent = `X ${state.x} · Y ${state.y} / ${state.cols} × ${state.rows}`;
  }

  let movementBusy = false;
  async function loadServerPosition() {
    if (!state.db || !state.character) {
      state.ready = false;
      status('Accedi con un PG per esplorare il Piano I-A.', true);
      return false;
    }
    const {data,error} = await state.db.rpc('piano_ia_get_position');
    if (error) throw error;
    if (!data?.active) {
      state.ready = false;
      status('Non è possibile entrare nel Piano I-A con questo PG.', true);
      return false;
    }
    state.x = Number(data.x);
    state.y = Number(data.y);
    updateCoordinates();
    revealAroundPlayer();
    return true;
  }

  async function move(dx, dy) {
    if (!state.ready || movementBusy || state.x === null || !state.db) return;
    const x = state.x + dx, y = state.y + dy;
    if (!walkable(x,y)) { toast('Il sentiero è bloccato.'); return; }
    movementBusy = true;
    try {
      const {data,error}=await state.db.rpc('piano_ia_move',{p_x:x,p_y:y});
      if (error) throw error;
      state.x=Number(data.x);state.y=Number(data.y);
      positionToken(state.token,state.x,state.y);
      centerCamera();revealAroundPlayer();updateCoordinates();saveProgress();broadcastPosition();
    } catch(err) { toast('Movimento non riuscito: '+(err.message||err)); }
    finally { movementBusy=false; }
  }

  function setZoom(viewCells) {
    const limit = state.map ? Math.max(state.cols, state.rows) : 81;
    state.viewCells = Math.max(7, Math.min(limit, viewCells));
    $('map-zoom-reset').textContent = state.viewCells >= limit
      ? `${state.cols} × ${state.rows}`
      : `${state.viewCells} × ${state.viewCells}`;
    resizeMap(true);
  }

  function bindControls() {
    document.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const target = event.target;
      if (target?.closest?.('input, textarea, select, button, [contenteditable="true"]')) return;
      const d = virtualKeys[event.key.toLowerCase()];
      if (!d) return;
      event.preventDefault();
      move(...d);
    });
    viewport.addEventListener('click', event => {
      if (!state.ready) return;
      const rect = layer.getBoundingClientRect();
      const x = Math.floor((event.clientX - rect.left) / state.cellPx);
      const y = Math.floor((event.clientY - rect.top) / state.cellPx);
      if (!inside(x, y)) return;
      const dx = x - state.x, dy = y - state.y;
      if (Math.abs(dx) + Math.abs(dy) === 1) move(dx, dy);
      else toast('Clicca una casella adiacente per spostarti.');
      viewport.focus({ preventScroll: true });
    });
    document.querySelectorAll('[data-move]').forEach(button => {
      button.addEventListener('click', () => move(...button.dataset.move.split(',').map(Number)));
    });
    $('map-zoom-out').addEventListener('click', () => setZoom(state.viewCells + 2));
    $('map-zoom-in').addEventListener('click', () => setZoom(state.viewCells - 2));
    $('map-zoom-reset').addEventListener('click', () => setZoom(13));
    $('map-zoom-full').addEventListener('click', () => setZoom(Math.max(state.cols, state.rows)));
    $('toggle-grid').addEventListener('change', ev => grid.classList.toggle('visible', ev.target.checked));
    $('toggle-fog').addEventListener('change', ev => {
      state.fogEnabled = ev.target.checked;
      drawFog();
    });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => resizeMap(true)).observe(viewport);
    else window.addEventListener('resize', () => resizeMap(true));
    $('save-notes-button').addEventListener('click', () => {
      localWrite(`${state.storageKey}:notes`, $('character-notes').value);
      toast('Note salvate in questo browser.');
    });
    $('floor-chat-form').addEventListener('submit', sendChat);
    setupAudio();
  }

  function setupAudio() {
    const audio = new Audio('../../music/piano-Ia.mp3');
    audio.loop = true;
    audio.preload = 'none';
    audio.volume = (Number(localRead('palazzo:piano-Ia:volume', 35)) || 0) / 100;
    $('audio-volume').value = Math.round(audio.volume * 100);
    state.music = audio;
    let manuallyPaused = false;
    const setLabel = () => {
      $('audio-toggle').textContent = audio.paused ? '♫' : '♪';
      $('audio-toggle').setAttribute('aria-label', audio.paused ? 'Attiva la musica' : 'Disattiva la musica');
    };
    const tryStartMusic = async () => {
      if (manuallyPaused || !audio.paused) return;
      try {
        await audio.play();
        setLabel();
        document.removeEventListener('pointerdown', tryStartMusic);
        document.removeEventListener('keydown', tryStartMusic);
      } catch (error) {
        // L'autoplay può essere vietato: ritentiamo al primo gesto del giocatore.
        console.debug('Musica Piano I-A in attesa di interazione:', error);
      }
    };
    $('audio-toggle').addEventListener('click', async () => {
      if (!audio.paused) {
        manuallyPaused = true;
        audio.pause();
      } else {
        manuallyPaused = false;
        try {
          await audio.play();
          document.removeEventListener('pointerdown', tryStartMusic);
          document.removeEventListener('keydown', tryStartMusic);
        } catch (error) {
          console.warn('Impossibile riprodurre piano-Ia.mp3:', error);
          toast('Musica non disponibile: verifica il file piano-Ia.mp3.');
        }
      }
      setLabel();
    });
    document.addEventListener('pointerdown', tryStartMusic);
    document.addEventListener('keydown', tryStartMusic);
    tryStartMusic();
    $('audio-volume').addEventListener('input', e => {
      audio.volume = Number(e.target.value) / 100;
      localWrite('palazzo:piano-Ia:volume', Number(e.target.value));
    });
    window.addEventListener('pagehide', () => { audio.pause(); if (state.channel && state.db) state.db.removeChannel(state.channel); });
  }

  function textInto(id, value, fallback = '—') {
    $(id).textContent = value === undefined || value === null || value === '' ? fallback : String(value);
  }
  const firstValue = (obj, keys) => {
    for (const key of keys) if (obj && obj[key] !== null && obj[key] !== undefined) return obj[key];
    return null;
  };

  async function loadEquipmentBonuses() {
    const names = ['attack','defense','forza','resistenza','costituzione','intelligenza','destrezza','fortuna'];
    const bonuses = Object.fromEntries(names.map(n => [`${n}_bonus`, 0]));
    if (!state.character || !state.db) { state.equipmentBonuses = bonuses; return; }
    try {
      const { data, error } = await state.db.from('character_inventory')
        .select(`equipped_slot, item:items (${names.map(n => `${n}_bonus`).join(', ')})`)
        .eq('character_id', state.character.id);
      if (error) throw error;
      for (const entry of data || []) {
        if (!entry.equipped_slot || !entry.item) continue;
        for (const name of names) bonuses[`${name}_bonus`] += Number(entry.item[`${name}_bonus`]) || 0;
      }
    } catch (error) { console.warn('Bonus equipaggiamento non disponibili:', error); }
    state.equipmentBonuses = bonuses;
  }

  function calculatedStats() {
    const c = state.character || {};
    const bonus = state.equipmentBonuses;
    const eff = key => Math.min(30, Math.max(1, (Number(c[key]) || 1) + (Number(bonus[`${key}_bonus`]) || 0)));
    const forza = eff('forza'), resistenza = eff('resistenza'), costituzione = eff('costituzione');
    const intelligenza = eff('intelligenza'), destrezza = eff('destrezza'), fortuna = eff('fortuna');
    return {
      forza, resistenza, costituzione, intelligenza, destrezza, fortuna,
      attack: Math.ceil(forza / 2) + (Number(bonus.attack_bonus) || 0),
      defense: Math.ceil(7 + resistenza / 2) + (Number(bonus.defense_bonus) || 0),
      maxHealth: Math.ceil(5 * costituzione / 2),
      maxMana: Math.ceil(5 * intelligenza / 2),
      movement: Math.ceil(4 + destrezza / 2),
      critical: Math.round(fortuna * (50 / 30) * 100) / 100
    };
  }

  function fillCharacterPanel() {
    const c = state.character;
    if (!c) { textInto('character-name', 'ESPLORATORE'); return; }
    const st = calculatedStats();
    textInto('character-name', c.nome || c.name || 'AVVENTURIERO');
    textInto('character-level', `LV ${Number(c.livello) || 1}`);
    textInto('character-hp', `${c.current_hp ?? st.maxHealth} / ${st.maxHealth}`);
    textInto('character-mana', `${c.current_pm ?? st.maxMana} / ${st.maxMana}`);
    textInto('character-resonance', firstValue(c, ['resonance_score', 'resonance', 'score']) ?? '—');
    textInto('stat-att', st.attack);
    textInto('stat-dif', st.defense);
    textInto('stat-mov', st.movement);
    textInto('stat-crt', `${st.critical.toFixed(2)}%`);
    const attributes = {for:'forza', res:'resistenza', cos:'costituzione', int:'intelligenza', des:'destrezza', lck:'fortuna'};
    for (const [label, key] of Object.entries(attributes)) textInto(`attr-${label}`, st[key]);
    $('character-token').src = tokenUrl(c.token);
    $('character-token').onerror = e => { e.target.onerror = null; e.target.src = tokenUrl('token_1.png'); };
  }

  async function loadCharacter() {
    const db = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
    if (!db?.auth?.getUser) {
      status('Supabase non disponibile. Controlla config.js.', true);
      return;
    }
    state.db = db;
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      status('Accedi per entrare nel Piano I-A.', true);
      return;
    }
    state.user = auth.user;
    const { data: character, error } = await db.from('characters').select('*').eq('user_id', auth.user.id).maybeSingle();
    if (error) throw error;
    if (!character) { status('Nessun personaggio associato a questo account.', true); return; }
    state.character = character;
    state.storageKey = `palazzo:piano-Ia:${character.id}`;
    await loadEquipmentBonuses();
    fillCharacterPanel();
  }

  async function loadLeaderboard() {
    const target = $('dungeon-leaderboard-list');
    if (!state.db || !state.user) { target.innerHTML = '<p class="muted">Accedi per vedere la classifica.</p>'; return; }
    const { data, error } = await state.db.rpc('get_living_characters_leaderboard_with_badges', { p_limit: 5 });
    if (error) { target.textContent = 'Classifica non disponibile.'; return; }
    target.replaceChildren();
    if (!data?.length) { target.textContent = 'Nessun personaggio in classifica.'; return; }
    for (const row of data.slice(0, 5)) {
      const div = document.createElement('div'); div.className = 'leader-row';
      const rank = document.createElement('span'); rank.className = 'leader-rank'; rank.textContent = `#${row.posizione ?? '?'}`;
      const name = document.createElement('span'); name.className = 'leader-name'; name.textContent = `${row.level ? `Lv${row.level} ` : ''}${row.character_name || 'Avventuriero'}`;
      const score = document.createElement('span'); score.className = 'leader-score'; score.textContent = Number(row.score || 0).toLocaleString('it-IT');
      div.append(rank, name, score); target.append(div);
    }
  }

  function appendChat(name, text, time = Date.now()) {
    const row = document.createElement('div'); row.className = 'chat-line';
    const who = document.createElement('span'); who.className = 'chat-name'; who.textContent = name;
    const body = document.createElement('span'); body.className = 'chat-text'; body.textContent = text;
    const when = document.createElement('span'); when.className = 'chat-time'; when.textContent = new Date(time).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
    row.append(who, body, when);
    chatBox.append(row);
    while (chatBox.children.length > 100) chatBox.firstChild.remove();
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function sendChat(event) {
    event.preventDefault();
    const value = chatInput.value.trim();
    if (!value || !state.connected || !state.channel || !state.character) return;
    if (value.length > 300) return;
    chatInput.disabled = true;
    try {
      const result = await state.channel.send({ type: 'broadcast', event: 'floor-chat', payload: { id: state.character.id, name: state.character.nome || 'Avventuriero', text: value, sent_at: Date.now() } });
      if (result !== 'ok') throw new Error(`Invio fallito (${result})`);
      appendChat(state.character.nome || 'Tu', value);
      chatInput.value = '';
    } catch (error) { toast('Chat non inviata: ' + String(error.message || error)); }
    finally { chatInput.disabled = !state.connected; chatInput.focus(); }
  }

  function broadcastPosition() {
    if (!state.connected || !state.channel || !state.character) return;
    state.channel.track({ name: state.character.nome || 'Avventuriero', image: state.character.token || 'token_1.png', x: state.x, y: state.y });
  }

  function updateOnline() {
    const list = $('dungeon-online-list');
    const presence = state.channel?.presenceState?.() || {};
    state.remotePlayers.forEach(v => v.token?.remove());
    state.remotePlayers.clear();
    list.replaceChildren();
    let count = 0;
    for (const [id, entries] of Object.entries(presence)) {
      const p = entries?.[entries.length - 1];
      if (!p) continue;
      count += 1;
      const div = document.createElement('div'); div.className = 'online-row';
      const dot = document.createElement('span'); dot.className = 'online-dot';
      const text = document.createElement('span'); text.textContent = p.name || 'Avventuriero';
      div.append(dot, text); list.append(div);
      if (id !== state.character?.id && walkable(Number(p.x), Number(p.y))) {
        state.remotePlayers.set(id, { x: Number(p.x), y: Number(p.y), name: p.name, image: p.image, token: null });
      }
    }
    $('online-count').textContent = String(count);
    if (!count) list.textContent = 'Nessun esploratore collegato.';
    renderTokens();
  }

  async function connectRealtime() {
    if (!state.db || !state.character) {
      chatBox.textContent = 'Accedi per utilizzare la chat del Piano I.';
      return;
    }
    // Il canale è isolato dal piano_1: niente presenze o chat in comune.
    const channel = state.db.channel('palazzo-eterno-piano-Ia', {
      config: { presence: { key: state.character.id }, broadcast: { self: false } }
    });
    state.channel = channel;
    channel.on('presence', { event: 'sync' }, updateOnline);
    channel.on('broadcast', { event: 'floor-chat' }, ({ payload }) => {
      if (!payload || !payload.text || payload.id === state.character.id) return;
      appendChat(String(payload.name || 'Avventuriero'), String(payload.text).slice(0, 300), payload.sent_at || Date.now());
    });
    channel.subscribe(async result => {
      if (result === 'SUBSCRIBED') {
        state.connected = true;
        chatBox.replaceChildren();
        chatInput.disabled = false;
        chatSend.disabled = false;
        appendChat('Sistema', 'Chat temporanea del Piano I attiva. I messaggi non vengono archiviati.');
        await channel.track({ name: state.character.nome || 'Avventuriero', image: state.character.token || 'token_1.png', x: state.x, y: state.y });
      } else if (result === 'CHANNEL_ERROR' || result === 'TIMED_OUT' || result === 'CLOSED') {
        state.connected = false;
        chatInput.disabled = true;
        chatSend.disabled = true;
        chatBox.textContent = 'Chat non disponibile: connessione persa.';
      }
    });
  }

  // Il pulsante ESCI riporta davvero il PG alla Base nel database.
  document.querySelector('.jungle-exit')?.addEventListener('click', async event => {
    if (!state.db || !state.character || !state.ready) return;
    event.preventDefault();
    const exit = event.currentTarget;
    exit.style.pointerEvents = 'none';
    try {
      const { error } = await state.db.rpc('piano_ia_exit');
      if (error) throw error;
      window.location.assign(exit.href);
    } catch (error) {
      exit.style.pointerEvents = '';
      toast('Uscita non riuscita: ' + (error.message || error));
    }
  });

  async function main() {
    bindControls();
    try {
      await loadMap();
      try { await loadCharacter(); }
      catch (err) { console.error('Piano Ia: lettura PG:', err); status('Impossibile caricare il personaggio.', true); }
      loadProgress();
      let serverReady = false;
      try { serverReady = await loadServerPosition(); }
      catch (error) { status('Accesso al Piano I-A non riuscito: '+(error.message || error),true); console.error(error); }
      $('character-notes').value = localRead(`${state.storageKey}:notes`, '') || '';
      state.ready = serverReady;
      renderTokens();
      resizeMap(true);
      loading.hidden = true;
      if (serverReady) status(`Piano I-A · ${state.character?.nome || 'Avventuriero'} · X ${state.x} / Y ${state.y}`);
      if (serverReady) startCombatRefresh();
      await Promise.allSettled([loadLeaderboard(), connectRealtime()]);
    } catch (err) {
      console.error('Piano Ia:', err);
      loading.textContent = 'Impossibile caricare la mappa. Controlla i percorsi nella console.';
      status(err?.message || 'Errore sconosciuto durante il caricamento.', true);
    }
  }
  main();
})();


/* Palazzo Eterno — forzieri di prova Piano I-A. Caricare DOPO piano-Ia.js. */
(() => {
  'use strict';
  const root = document.getElementById('jungle-app');
  const map = document.getElementById('map-layer');
  if (!root || !map) return;
  const COLS = 63, ROWS = 81;
  const $ = id => document.getElementById(id);
  const layer = document.createElement('div');
  layer.id = 'pia-chest-layer';
  Object.assign(layer.style, {position:'absolute',inset:'0',zIndex:'8',pointerEvents:'none'});
  map.appendChild(layer);
  const label = document.createElement('div');
  label.textContent = 'Forzieri: connessione…';
  Object.assign(label.style,{fontSize:'12px',color:'#e8d49b',margin:'6px 0'});
  document.querySelector('.map-footer')?.appendChild(label);
  let chests = [], busy = false;
  const client = () => supabaseClient;
  const notify = msg => { label.textContent=msg; };
  const pos = () => {
    const m = /X\s*(\d+)\s*[·\/]\s*Y\s*(\d+)/i.exec($('player-coordinates')?.textContent||'');
    return m ? {x:Number(m[1]),y:Number(m[2])} : null;
  };
  function render() {
    layer.replaceChildren();
    chests.filter(c=>c.available).forEach(c=>{
      const el=document.createElement('div');
      el.textContent='◆'; el.title=`Frutto Carnoso — X ${c.x}, Y ${c.y}`;
      Object.assign(el.style,{
        position:'absolute',left:((c.x+.5)/COLS*100)+'%',top:((c.y+.5)/ROWS*100)+'%',
        transform:'translate(-50%,-50%)',color:'#ffcd43',fontSize:'clamp(8px, 1.3vw, 20px)',
        textShadow:'0 0 3px #000, 0 0 5px #000',pointerEvents:'none'
      });
      layer.appendChild(el);
    });
  }
  async function refresh() {
    const db=client();
    if(!db) {notify('Forzieri: Supabase non disponibile');return;}
    const {data,error}=await db.rpc('piano_ia_chests_refresh');
    if(error){notify('Forzieri: '+error.message);return;}
    chests=Array.isArray(data)?data:[];
    render();
    notify(`Forzieri: ${chests.filter(c=>c.available).length}/12 disponibili • cooldown 5 min`);
  }
  async function collect() {
    if(busy) return;
    const p=pos(); if(!p) return;
    const chest=chests.find(c=>c.available&&c.x===p.x&&c.y===p.y);
    if(!chest) return;
    busy=true;
    try {
      const {data,error}=await client().rpc('piano_ia_chest_collect',{p_id:chest.id,p_x:p.x,p_y:p.y});
      if(error) notify('Raccolta fallita: '+error.message);
      else { notify(data?.message||data?.reason||'Forziere aggiornato'); if(data?.ok) window.dispatchEvent(new Event('piano-ia-inventory-changed')); }
      await refresh();
    } finally {busy=false;}
  }
  // Il prototipo conserva le coordinate localmente: leggiamo quelle mostrate sulla mappa.
  const coords=$('player-coordinates');
  if(coords){new MutationObserver(()=>{collect();}).observe(coords,{childList:true,characterData:true,subtree:true});}
  // Poll leggero condiviso; il DB rigenera soltanto se il timer è scaduto.
  setInterval(refresh,10000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setTimeout(refresh,1200);
})();


/* PIANO I-A — FRUTTO CARNOSO: CONSUMABILE */
(() => {
  'use strict';
  const panel = document.querySelector('.actions-panel');
  if (!panel) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'piano-ia-use-fruit';
  button.disabled = true;
  button.style.display = 'none'; // Non mostrarlo finche non risulta nell'inventario.
  button.innerHTML = '🍎 <span>FRUTTO CARNOSO</span> <small id="piano-ia-fruit-count">Quantità: —</small>';
  button.title = 'Recupera fino a 10 PF e 10 PM';
  panel.appendChild(button);

  const notice = document.createElement('div');
  notice.setAttribute('role','status');
  notice.style.cssText = 'font-size:12px;color:#e9d69b;margin-top:5px;';
  panel.appendChild(notice);
  let inventoryId = null;
  let characterId = null;
  let loading = false;
  const db = () => typeof supabaseClient !== 'undefined' ? supabaseClient : null;

  async function refresh() {
    if (loading || !db()) return;
    try {
      const { data: { user }, error: authError } = await db().auth.getUser();
      if (authError || !user) return;
      if (!characterId) {
        const result = await db().from('characters').select('id').eq('user_id',user.id).maybeSingle();
        if (result.error || !result.data) return;
        characterId = result.data.id;
      }
      const inv = await db().from('character_inventory')
        .select('id,quantity').eq('character_id',characterId)
        .eq('item_id','frutto_carnoso').is('equipped_slot',null);
      if (inv.error) { notice.textContent=inv.error.message; return; }
      const rows=inv.data||[];
      inventoryId=rows.find(item=>item.quantity>0)?.id||null;
      const count=rows.reduce((total,item)=>total+Math.max(0,Number(item.quantity)||0),0);
      document.getElementById('piano-ia-fruit-count').textContent='Quantità: '+count;
      button.style.display = count > 0 ? '' : 'none';
      button.disabled = count === 0;
    } catch(error) { console.error('Frutto Carnoso:',error); }
  }

  button.addEventListener('click',async()=>{
    if (loading || !inventoryId || !db()) return;
    loading=true;
    button.disabled=true;
    try {
      const {data,error}=await db().rpc('use_piano_ia_fruit',{p_inventory_id:inventoryId});
      if (error) throw error;
      notice.textContent='Frutto consumato! PF '+data.current_pf+'/'+data.max_pf+
        ' · PM '+data.current_pm+'/'+data.max_pm;
      const hp=document.getElementById('character-hp');
      const mana=document.getElementById('character-mana');
      if(hp) hp.textContent=data.current_pf+' / '+data.max_pf;
      if(mana) mana.textContent=data.current_pm+' / '+data.max_pm;
    } catch(error) {
      notice.textContent='Utilizzo non riuscito: '+(error.message||String(error));
    } finally {
      loading=false;
      await refresh();
    }
  });
  window.addEventListener('piano-ia-inventory-changed',refresh);
  setTimeout(refresh,1600);
  setInterval(refresh,12000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();