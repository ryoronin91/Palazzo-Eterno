/* Palazzo Eterno — Piano Id. Prima base navigabile; nessuna mutazione Supabase. */
'use strict';
(() => {
  const COLS=67, ROWS=45, START={x:33,y:42};
  const $=id=>document.getElementById(id);
  let grid=null, x=START.x, y=START.y, zoom=1, walkableCount=0, character=null;
  const status=(message,error=false)=>{const el=$('id-status');el.textContent=message;el.style.color=error?'#ffb7aa':'#b4d3b9';};
  function bits(){ return grid?.cell_bit || {room:2,corridor:4,aperture:32,arch:65536,door:131072,stair_up:8388608,stair_down:4194304}; }
  function canWalk(cx,cy){
    if(!Number.isInteger(cx)||!Number.isInteger(cy)||cx<0||cy<0||cx>=COLS||cy>=ROWS)return false;
    const cell=Number(grid?.cells?.[cy]?.[cx]||0), b=bits();
    return (cell & (b.room|b.corridor|b.aperture|b.arch|b.door|b.stair_up|b.stair_down))!==0;
  }
  function token(){const el=$('id-token');el.style.left=`${(x+.5)*100/COLS}%`;el.style.top=`${(y+.5)*100/ROWS}%`; $('id-coords').textContent=`X${x} · Y${y}`;}
  function move(dx,dy){if(!grid)return;const nx=x+dx,ny=y+dy;if(!canWalk(nx,ny)){status('Qui il passaggio è bloccato.');return;}x=nx;y=ny;token();status('Esplora il Tempio di Scintilla.');save();}
  function storageKey(){return 'palazzo:Id:position:'+(character?.id||'preview');}
  function save(){try{localStorage.setItem(storageKey(),JSON.stringify({x,y}));}catch{}}
  function loadPosition(){try{const p=JSON.parse(localStorage.getItem(storageKey())||'null');if(p&&canWalk(p.x,p.y)){x=p.x;y=p.y;return;}}catch{}if(!canWalk(x,y)){const sx=x,sy=y;for(let r=0;r<Math.max(COLS,ROWS);r++){for(let cy=0;cy<ROWS;cy++)for(let cx=0;cx<COLS;cx++)if(Math.abs(cx-sx)+Math.abs(cy-sy)===r&&canWalk(cx,cy)){x=cx;y=cy;return;}}}}
  function mapClick(event){const rect=$('id-map').getBoundingClientRect();const cx=Math.floor((event.clientX-rect.left)/rect.width*COLS),cy=Math.floor((event.clientY-rect.top)/rect.height*ROWS);if(Math.abs(cx-x)+Math.abs(cy-y)===1)move(cx-x,cy-y);else status('Seleziona una casella adiacente al personaggio.');}
  function applyZoom(){ $('id-map').style.transform=`scale(${zoom})`; }
  function controls(){document.addEventListener('keydown',e=>{if(/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||''))return;const m={w:[0,-1],ArrowUp:[0,-1],s:[0,1],ArrowDown:[0,1],a:[-1,0],ArrowLeft:[-1,0],d:[1,0],ArrowRight:[1,0]};const delta=m[e.key];if(delta){e.preventDefault();move(...delta);}});$('id-map-viewport').addEventListener('click',mapClick);$('id-zoom-in').onclick=()=>{zoom=Math.min(2.5,+(zoom+.2).toFixed(2));applyZoom();};$('id-zoom-out').onclick=()=>{zoom=Math.max(1,+(zoom-.2).toFixed(2));applyZoom();};$('id-zoom-reset').onclick=()=>{zoom=1;applyZoom();};}
  async function loadCharacter(){if(typeof supabaseClient==='undefined')return;try{const {data:{user},error}=await supabaseClient.auth.getUser();if(error||!user)return;const r=await supabaseClient.from('characters').select('*').eq('user_id',user.id).maybeSingle();if(r.error)throw r.error;character=r.data;if(!character)return;$('id-name').textContent=character.name||character.character_name||'AVVENTURIERO';$('id-hp').textContent=character.current_hp??character.hp??'—';$('id-mp').textContent=character.current_mp??character.mp??'—';$('id-score').textContent=character.score??'—';}catch(e){console.warn('[ID] Personaggio non disponibile:',e);}}
  async function boot(){controls();try{const response=await fetch('piano-Id.json',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}: piano-Id.json`);grid=await response.json();if(!Array.isArray(grid.cells)||grid.cells.length!==ROWS||grid.cells.some(row=>!Array.isArray(row)||row.length!==COLS))throw new Error('Il JSON deve contenere 45 righe da 67 celle.');for(let yy=0;yy<ROWS;yy++)for(let xx=0;xx<COLS;xx++)if(canWalk(xx,yy))walkableCount++;$('id-walkable').textContent=walkableCount;await loadCharacter();loadPosition();token();status('Tempio caricato. Nessun nemico o evento ancora configurato.');}catch(e){console.error('[ID]',e);status('Errore mappa: '+e.message,true);}}
  document.addEventListener('DOMContentLoaded',boot);
})();
