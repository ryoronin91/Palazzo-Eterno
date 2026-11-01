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
  let movementBusy=false;
  async function move(dx,dy){
    if(!grid || movementBusy)return;
    const nx=x+dx,ny=y+dy;
    if(!canWalk(nx,ny)){status('Qui il passaggio è bloccato.');return;}
    if(!character){status('Devi accedere con un personaggio per muoverti.',true);return;}
    movementBusy=true;
    try{
      const {data,error}=await supabaseClient.rpc('piano_id_move',{p_x:nx,p_y:ny});
      if(error)throw error;
      if(!data?.moved)throw new Error('Movimento non confermato.');
      x=nx;y=ny;token();status('Esplora il Tempio di Scintilla.');
    }catch(e){console.error('[Id] Movimento:',e);status('Impossibile salvare lo spostamento: '+e.message,true);}
    finally{movementBusy=false;}
  }
  function mapClick(event){const rect=$('id-map').getBoundingClientRect();const cx=Math.floor((event.clientX-rect.left)/rect.width*COLS),cy=Math.floor((event.clientY-rect.top)/rect.height*ROWS);if(Math.abs(cx-x)+Math.abs(cy-y)===1)move(cx-x,cy-y);else status('Seleziona una casella adiacente al personaggio.');}
  function applyZoom(){ $('id-map').style.transform=`scale(${zoom})`; }
  function controls(){document.addEventListener('keydown',e=>{if(/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||''))return;const m={w:[0,-1],ArrowUp:[0,-1],s:[0,1],ArrowDown:[0,1],a:[-1,0],ArrowLeft:[-1,0],d:[1,0],ArrowRight:[1,0]};const delta=m[e.key];if(delta){e.preventDefault();move(...delta);}});$('id-map-viewport').addEventListener('click',mapClick);$('id-zoom-in').onclick=()=>{zoom=Math.min(2.5,+(zoom+.2).toFixed(2));applyZoom();};$('id-zoom-out').onclick=()=>{zoom=Math.max(1,+(zoom-.2).toFixed(2));applyZoom();};$('id-zoom-reset').onclick=()=>{zoom=1;applyZoom();};}
  async function loadCharacter(){if(typeof supabaseClient==='undefined')return;try{const {data:{user},error}=await supabaseClient.auth.getUser();if(error||!user)return;const r=await supabaseClient.from('characters').select('*').eq('user_id',user.id).maybeSingle();if(r.error)throw r.error;character=r.data;if(!character)return;$('id-name').textContent=character.nome||character.name||'AVVENTURIERO';$('id-hp').textContent=character.current_hp??character.hp??'—';$('id-mp').textContent=character.current_pm??character.current_mp??'—';$('id-score').textContent=character.score??'—';}catch(e){console.warn('[ID] Personaggio non disponibile:',e);}}
  async function boot(){controls();try{const response=await fetch('piano-Id.json',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}: piano-Id.json`);grid=await response.json();if(!Array.isArray(grid.cells)||grid.cells.length!==ROWS||grid.cells.some(row=>!Array.isArray(row)||row.length!==COLS))throw new Error('Il JSON deve contenere 45 righe da 67 celle.');for(let yy=0;yy<ROWS;yy++)for(let xx=0;xx<COLS;xx++)if(canWalk(xx,yy))walkableCount++;$('id-walkable').textContent=walkableCount;await loadCharacter();
    if(!character){status('Effettua l’accesso per entrare nel Tempio.',true);return;}
    if(character.current_location!=='dungeon_Id'){
      status('Il personaggio non si trova nel Tempio: entra dal teletrasporto di Ic.',true);
      return;
    }
    const {data:position,error:positionError}=await supabaseClient.rpc('piano_id_get_position');
    if(positionError)throw positionError;
    if(!canWalk(position.x,position.y))throw new Error('Posizione di ingresso fuori dalla mappa percorribile.');
    x=position.x;y=position.y;token();status('Benvenuto nel Tempio di Scintilla.');}catch(e){console.error('[ID]',e);status('Errore mappa: '+e.message,true);}}
  document.addEventListener('DOMContentLoaded',boot);
})();
