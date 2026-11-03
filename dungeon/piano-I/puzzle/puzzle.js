'use strict';
// Palazzo Eterno — Sigillo di Scintilla, 4x3, 11 pannelli + casella vuota.
// Tutti i pannelli sono disponibili. Completamento condiviso su Supabase.
(() => {
  const COLS=4, SIZE=12;
  const SOLUTION=[1,2,3,4,5,6,7,8,9,10,11,0];
  const grid=document.getElementById('puzzle-grid');
  const message=document.getElementById('puzzle-message');
  const reset=document.getElementById('reset-button');
  const verify=document.getElementById('verify-button');
  if(!grid||!message||!reset||!verify)return;
  let board=[...SOLUTION];
  let moves=0;
  let solved=false;
  let busy=false;
  const db = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
  const goBack = document.getElementById('puzzle-back');
  if (goBack) goBack.addEventListener('click', () => {});
  async function checkSolved() {
    if (!db) {notify('Connessione Supabase non disponibile.','error');return;}
    try {
      const { data, error } = await db.rpc('piano_id_mosaic_solved');
      if (error) throw error;
      if (data === true) {
        solved=true; board=[...SOLUTION]; render();
        reset.disabled=true; verify.disabled=true;
        notify('Il Sigillo delle Undici Memorie è già stato ricomposto! La barriera è aperta.','success');
      }
    } catch (error) { console.warn('Stato Sigillo:',error);notify('Impossibile verificare lo stato del Sigillo.','error'); }
  }
  const adjacent=(a,b)=>Math.abs(Math.floor(a/COLS)-Math.floor(b/COLS))+Math.abs(a%COLS-b%COLS)===1;
  const ordered=()=>board.every((n,i)=>n===SOLUTION[i]);
  function notify(text,type=''){
    message.hidden=false;
    message.textContent=text;
    message.className='puzzle-message'+(type?' '+type:'');
  }
  function render(){
    const empty=board.indexOf(0);
    grid.replaceChildren();
    board.forEach((id,index)=>{
      const tile=document.createElement('button');
      tile.type='button';
      tile.className='puzzle-tile';
      if(id===0){tile.classList.add('empty');tile.disabled=true;tile.setAttribute('aria-label','Spazio vuoto');}
      else{
        const img=document.createElement('img');
        img.src=`immagini/${id}I.png`;
        img.alt='';img.draggable=false;
        img.onerror=()=>notify(`Immagine mancante: ${id}I.png`,'error');
        tile.appendChild(img);
        tile.setAttribute('aria-label',`Pannello ${id}`);
        const movable=!solved&&adjacent(index,empty);
        tile.disabled=!movable;
        if(movable)tile.classList.add('can-move');
        tile.addEventListener('click',()=>move(index));
      }
      grid.appendChild(tile);
    });
  }
  function move(index){
    if(solved||busy)return;
    const empty=board.indexOf(0);
    if(!adjacent(index,empty))return;
    [board[index],board[empty]]=[board[empty],board[index]];
    moves++;
    message.hidden=true;
    render();
  }
  function shuffle(){
    if(solved||busy)return;
    board=[...SOLUTION];
    let last=-1;
    for(let step=0;step<180;step++){
      const empty=board.indexOf(0);
      const candidates=board.map((_,i)=>i).filter(i=>adjacent(i,empty)&&i!==last);
      const picked=candidates[Math.floor(Math.random()*candidates.length)];
      [board[empty],board[picked]]=[board[picked],board[empty]];
      last=empty;
    }
    if(ordered())return shuffle();
    solved=false;moves=0;message.hidden=true;
    render();
  }
  verify.addEventListener('click',async()=>{
    if(solved||busy)return;
    if(!ordered())return notify('Il Sigillo non è ancora ricomposto.','error');
    if(!db)return notify('Connessione Supabase non disponibile.','error');
    busy=true; verify.disabled=true; reset.disabled=true;
    notify('Il Sigillo si illumina... apertura della barriera in corso.');
    try {
      const {data,error}=await db.rpc('piano_id_mosaic_complete');
      if(error)throw error;
      if(data?.solved!==true)throw new Error('Completamento non confermato');
      solved=true;render();
      notify('Il Sigillo delle Undici Memorie è stato ricomposto! La barriera luminosa è scomparsa.','success');
      document.dispatchEvent(new CustomEvent('palazzo:puzzle-solved',{detail:{puzzleId:'scintilla-undici-memorie',moves}}));
    } catch(err) {
      console.warn('Impossibile completare il Sigillo:',err);
      notify('Il Sigillo è corretto, ma non è stato registrato: '+(err?.message||'errore di connessione')+'. Riprova VERIFICA SIGILLO.','error');
    } finally {busy=false; if(!solved){verify.disabled=false;reset.disabled=false;} }
  });
  reset.addEventListener('click',shuffle);
  document.addEventListener('keydown',event=>{
    if(solved||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    const offsets={ArrowUp:COLS,ArrowDown:-COLS,ArrowLeft:1,ArrowRight:-1};
    const offset=offsets[event.key];
    if(offset===undefined)return;
    event.preventDefault();
    const blank=board.indexOf(0),target=blank+offset;
    if(target>=0&&target<SIZE&&adjacent(blank,target))move(target);
  });
  shuffle();
  checkSolved();
})();


// Modulo audio integrato da puzzle-music.js originale.
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
