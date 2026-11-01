'use strict';
/* Palazzo Eterno — Il Sigillo delle Undici Memorie
   4 colonne x 3 righe, undici tessere (1I.png ... 11I.png) e uno spazio vuoto.
   La pagina è deliberatamente autonoma: nessun progresso Supabase viene inventato.
   Per integrarla, impostare window.PALAZZO_PUZZLE_FRAGMENTS con gli ID recuperati
   PRIMA di caricare puzzle.js, oppure emettere l'evento palazzo:puzzle-fragments.
   Evento di completamento: palazzo:puzzle-solved (client-side, da validare sul server).
*/
(() => {
  const COLS = 4, ROWS = 3, SIZE = COLS * ROWS;
  const SOLUTION = Array.from({ length: 11 }, (_, i) => i + 1).concat(0);
  const INITIAL_FRAGMENTS = [1, 2, 3, 4, 5, 6]; // 5 mancanti: 7-11
  const STORE_KEY = 'palazzo-eterno-puzzle-scintilla-v1';
  const $ = id => document.getElementById(id);
  const grid = $('puzzle-grid');
  if (!grid) return;
  const message = $('puzzle-message');
  const testMode = new URLSearchParams(location.search).get('test') === '1';
  const devPanel = $('dev-panel');
  if (testMode) devPanel.hidden = false;
  let fragments = new Set(INITIAL_FRAGMENTS);
  let board = [...SOLUTION];
  let moves = 0;
  let solved = false;
  const adjacent = (a,b) => Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)) + Math.abs(a % COLS - b % COLS) === 1;
  function validBoard(a) { return Array.isArray(a) && a.length === SIZE && a.every(x => Number.isInteger(x) && x >= 0 && x <= 11) && new Set(a).size === SIZE; }
  function allRecovered() { return fragments.size === 11; }
  function isOrdered() { return board.every((n,i) => n === SOLUTION[i]); }
  function say(text, type = '') { message.textContent = text; message.className = 'puzzle-message' + (type ? ' ' + type : ''); }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify({ board,moves })); } catch (_) {} }
  function restore() {
    try { const data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (data && validBoard(data.board)) {board = data.board; moves = Number.isSafeInteger(data.moves) && data.moves >= 0 ? data.moves : 0;return true;} } catch (_) {}
    return false;
  }
  function scramble(count = 140) {
    board = [...SOLUTION]; let lastBlank = -1;
    for (let i=0;i<count;i++) {
      const empty = board.indexOf(0);
      const choices = board.map((_,k)=>k).filter(k => adjacent(k,empty) && k !== lastBlank);
      const pick = choices[Math.floor(Math.random()*choices.length)];
      [board[empty],board[pick]]=[board[pick],board[empty]];
      lastBlank=empty;
    }
    if (isOrdered()) return scramble(count+10);
    moves = 0; solved = false; save();
  }
  function render() {
    grid.replaceChildren();
    const empty = board.indexOf(0);
    for (let i=0;i<SIZE;i++) {
      const id=board[i], el=document.createElement('button');
      el.type='button'; el.className='puzzle-tile';
      if (id === 0) {
        el.classList.add('empty'); el.setAttribute('aria-label','Spazio vuoto'); el.disabled=true;
      } else {
        el.setAttribute('aria-label', `Frammento ${id}${fragments.has(id) ? '' : ', non recuperato'}`);
        if (fragments.has(id)) {
          const img=document.createElement('img');img.src=`immagini/${id}I.png`;img.alt='';img.draggable=false;
          img.onerror=()=>{el.classList.add('is-broken');img.remove();el.textContent=`Immagine ${id}I.png mancante`;};
          el.append(img);
        } else {
          el.classList.add('missing');
          const label=document.createElement('span');label.className='missing-label';label.textContent='✧';el.append(label);
        }
        if (adjacent(i,empty) && !solved) el.classList.add('can-move');
        el.disabled=!adjacent(i,empty)||solved;
        el.addEventListener('click',()=>move(i));
      }
      grid.append(el);
    }
    grid.classList.toggle('solved', solved);
    $('pieces-counter').textContent=`Frammenti ${fragments.size} / 11`;
    $('moves-count').textContent=`Mosse: ${moves}`;
    $('verify-button').disabled=solved;
    const list=$('fragment-list');list.replaceChildren();
    for(let id=1;id<=11;id++){
      const chip=document.createElement('span');chip.className='fragment-chip'+(fragments.has(id)?'':' missing');
      chip.textContent=id;chip.title=fragments.has(id)?'Recuperato':'Da recuperare';list.append(chip);
    }
  }
  function move(i) {
    if (solved) return;
    const empty=board.indexOf(0);if(!adjacent(i,empty))return;
    [board[i],board[empty]]=[board[empty],board[i]];
    moves++;save();render();
  }
  function verify() {
    if(solved)return;
    if(!allRecovered())return say(`Mancano ancora ${11-fragments.size} frammenti. Ritrovali prima di verificare il sigillo.`, 'error');
    if(!isOrdered())return say('Le memorie non seguono ancora il loro destino. Riprova.', 'error');
    solved=true;render();say('Il Sigillo delle Undici Memorie risplende. Il cammino verso Scintilla è aperto!', 'success');
    document.dispatchEvent(new CustomEvent('palazzo:puzzle-solved', {detail:{puzzleId:'scintilla-undici-memorie',moves}}));
  }
  function setFragments(ids) {
    if(!Array.isArray(ids))return;
    fragments=new Set(ids.filter(n=>Number.isInteger(n)&&n>=1&&n<=11));
    if(solved && !allRecovered())solved=false;
    render();
  }
  // API di integrazione (solo stato visualizzato; concessioni e verifica definitive lato server).
  window.PalazzoScintillaPuzzle = Object.freeze({ setFragments, getBoard:()=>[...board], getFragments:()=>[...fragments], isOrdered });
  document.addEventListener('palazzo:puzzle-fragments', e=>setFragments(e.detail?.ids));
  if(Array.isArray(window.PALAZZO_PUZZLE_FRAGMENTS))setFragments(window.PALAZZO_PUZZLE_FRAGMENTS);
  if(!restore())scramble();
  render();
  $('verify-button').addEventListener('click',verify);
  $('reset-button').addEventListener('click',()=>{if(solved)return; scramble();render();say('Le memorie sono state rimescolate.');});
  document.addEventListener('keydown',e=>{
    if(solved || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    const d={ArrowUp:COLS,ArrowDown:-COLS,ArrowLeft:1,ArrowRight:-1}[e.key];
    if(d===undefined)return;
    e.preventDefault();const blank=board.indexOf(0), target=blank+d;
    if(target>=0&&target<SIZE&&adjacent(blank,target))move(target);
  });
  if(testMode){
    $('test-unlock').addEventListener('click',()=>{setFragments(SOLUTION.filter(Boolean));say('Prova locale: tutti i frammenti visibili. Nessun dato Supabase modificato.');});
    $('test-lock').addEventListener('click',()=>{setFragments(INITIAL_FRAGMENTS);say('Prova locale: cinque frammenti nuovamente nascosti.');});
  }
})();
