// Musica condivisa dagli enigmi del Tempio di Scintilla.
// Non modifica movimenti, sequenze, ricompense o Supabase.
(() => {
  'use strict';
  const KEY = 'palazzo-eterno-dungeon-volume';
  const url = '../../../music/puzzacinta.mp3';
  const music = new Audio(url);
  music.loop = true;
  music.preload = 'auto';
  let volume = 0.35;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) {
      const value = Number(saved);
      if (Number.isFinite(value)) volume = Math.max(0, Math.min(1, value));
    }
  } catch (_) {}
  music.volume = volume;

  const style = document.createElement('style');
  style.textContent = `
    #id-puzzle-audio { position:fixed; top:12px; right:12px; z-index:10000;
      display:flex; align-items:center; gap:5px; font:12px Arial,sans-serif;
      color:#f4e9cd; }
    #id-puzzle-audio button { border:1px solid #b8a06a; border-radius:7px;
      background:#1b2929ef; color:#f4e9cd; padding:9px 11px; cursor:pointer;
      box-shadow:0 2px 8px #0008; }
    #id-puzzle-audio button:focus-visible {outline:2px solid #fce4a2;outline-offset:2px}
    #id-puzzle-audio-panel { display:none; align-items:center; gap:7px;
      background:#1b2929f7; padding:8px; border:1px solid #b8a06a; border-radius:7px; }
    #id-puzzle-audio-panel[data-open="true"] { display:flex; }
    #id-puzzle-audio-slider { accent-color:#e7c46e; width:115px; }
    @media(max-width:540px) {#id-puzzle-audio {top:7px;right:7px;}
      #id-puzzle-audio-panel {position:absolute;right:0;top:42px;}}
  `;
  document.head.appendChild(style);
  const wrapper = document.createElement('div');
  wrapper.id = 'id-puzzle-audio';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Attiva musica o regola volume');
  toggle.title = 'Musica e volume';
  const panel = document.createElement('div');
  panel.id = 'id-puzzle-audio-panel';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0'; slider.max = '100'; slider.step = '5';
  slider.id = 'id-puzzle-audio-slider';
  slider.setAttribute('aria-label','Volume musica');
  const number = document.createElement('span');
  panel.append(slider, number);
  wrapper.append(toggle, panel);
  const paint = () => {
    music.volume = volume;
    slider.value = String(Math.round(volume*100));
    number.textContent = `${Math.round(volume*100)}%`;
    toggle.textContent = music.paused ? '▶ ♪' : (volume===0 ? '🔇' : volume<0.5 ? '🔉' : '🔊');
  };
  const startMusic = () => {
    if (!music.paused) return;
    music.play().then(paint).catch(() => {});
  };
  toggle.addEventListener('click', () => {
    panel.dataset.open = panel.dataset.open === 'true' ? 'false' : 'true';
    if (music.paused) startMusic();
  });
  slider.addEventListener('input', () => {
    volume = Number(slider.value)/100;
    try { localStorage.setItem(KEY,String(volume)); } catch (_) {}
    paint();
  });
  music.addEventListener('play',paint);
  music.addEventListener('pause',paint);
  music.addEventListener('error', () => {
    toggle.title = 'File audio non trovato: ' + url;
  });
  document.body.appendChild(wrapper);
  paint();
  startMusic();
  document.addEventListener('pointerdown', startMusic, {once:true});
  document.addEventListener('keydown', startMusic, {once:true});
  window.addEventListener('pagehide', () => music.pause(), {once:true});
})();
