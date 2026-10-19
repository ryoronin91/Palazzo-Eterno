// Palazzo Eterno — Stanza dell'Orologio (prima versione indipendente)
// Mappa, movimento/collisioni, camera, personaggio e visualizzazione statistiche.
// NON scrive base_x/base_y, NON avvia servizi né realtime della Base.
(() => {
'use strict';
const COLS_DEFAULT=29, ROWS_DEFAULT=29;
const POSITION_KEY='palazzo_eterno_orologio_position';
let cols=COLS_DEFAULT,rows=ROWS_DEFAULT,view=13;
let imageWidth=1254,imageHeight=1254,gridX=20,gridY=20,cellPx=43.45;
let walkable=new Set(), blocked=new Set(),player=null, token=null, pos={x:14,y:26}, bonuses={};
const $=id=>document.getElementById(id);
const key=(x,y)=>`${x},${y}`;
function message(s,error=false){const e=$('dungeon-message');if(e){e.textContent=s;e.classList.toggle('error',error);}}
function put(id,value){const e=$(id);if(e)e.textContent=value;}
const isWalkable=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<cols&&y<rows&&walkable.has(key(x,y))&&!blocked.has(key(x,y));
async function loadMap(){
 const r=await fetch('orologio.json',{cache:'no-store'});if(!r.ok)throw Error('Impossibile caricare orologio.json');
 const data=await r.json();cols=Number(data.grid?.columns)||COLS_DEFAULT;rows=Number(data.grid?.rows)||ROWS_DEFAULT;
 const g=data.grid||{};imageWidth=Number(g.image_width_px)||1254;imageHeight=Number(g.image_height_px)||1254;gridX=Number(g.offset_x_px??20);gridY=Number(g.offset_y_px??20);cellPx=Number(g.cell_size_px)||43.45;
 walkable=new Set((data.walkable_cells||[]).map(c=>key(Number(c.x),Number(c.y))));
 blocked=new Set((data.blocked_cells||[]).map(c=>key(Number(c.x),Number(c.y))));
 const img=$('dungeon-map-image');if(img)img.src=data.image||'immagini/stanza_orologio.png';
 if(!walkable.size)throw Error('Nessuna casella percorribile in orologio.json');
 let stored=null;try{stored=JSON.parse(sessionStorage.getItem(POSITION_KEY)||'null');}catch{}
 if(stored&&isWalkable(stored.x,stored.y))pos=stored;
 else {const entry=(data.special_points||[]).find(p=>p.type==='spawn'&&isWalkable(p.coordinates?.x,p.coordinates?.y));
 const candidate=entry?.coordinates||{x:13,y:25};
 if(isWalkable(candidate.x,candidate.y))pos={x:candidate.x,y:candidate.y};
 else{let near=[...walkable].map(s=>s.split(',').map(Number)).filter(([x,y])=>isWalkable(x,y));near.sort((a,b)=>(a[0]-14)**2+(a[1]-26)**2-(b[0]-14)**2-(b[1]-26)**2);if(near.length)pos={x:near[0][0],y:near[0][1]};}}
}
async function loadCharacter(){
 if(typeof supabaseClient==='undefined')throw Error('Configurazione Supabase non caricata');
 const {data:{user},error:authErr}=await supabaseClient.auth.getUser();if(authErr)throw authErr;
 if(!user){location.href='../login.html';return false;}
 const {data,error}=await supabaseClient.from('characters').select('*').eq('user_id',user.id).maybeSingle();if(error)throw error;
 if(!data){location.href='../personaggio.html';return false;}player=data;return true;
}
async function loadEquipment(){
 const {data,error}=await supabaseClient.from('character_inventory').select('equipped_slot,item:items(attack_bonus,defense_bonus,forza_bonus,resistenza_bonus,costituzione_bonus,intelligenza_bonus,destrezza_bonus,fortuna_bonus)').eq('character_id',player.id);
 if(error){console.warn('Equipaggiamento non disponibile',error);return;}
 for(const row of data||[]){if(!row.equipped_slot||!row.item)continue;
 for(const name of ['attack','defense','forza','resistenza','costituzione','intelligenza','destrezza','fortuna'])bonuses[name]=(bonuses[name]||0)+(Number(row.item[name+'_bonus'])||0);}
}
function updateCharacter(){
 const attr=n=>Math.max(1,Math.min(30,(Number(player[n])||1)+(bonuses[n]||0)));
 const f=attr('forza'),r=attr('resistenza'),c=attr('costituzione'),i=attr('intelligenza'),d=attr('destrezza'),l=attr('fortuna');
 put('character-name',player.nome||'Avventuriero');put('character-name-panel',player.nome||'Avventuriero');put('character-level',player.livello||1);
 const portrait=$('character-token');if(portrait)portrait.src='../immagini/token/'+(player.token||'token_1.png');
 [['forza',f],['resistenza',r],['costituzione',c],['intelligenza',i],['destrezza',d],['fortuna',l],['attack',Math.ceil(f/2)+(bonuses.attack||0)],['defense',Math.ceil(7+r/2)+(bonuses.defense||0)],['movement',Math.ceil(4+d/2)],['critical',(Math.round(l*(50/30)*100)/100).toFixed(2)+'%'],['health',`${player.current_hp??Math.ceil(5*c/2)}/${Math.ceil(5*c/2)}`],['mana',`${player.current_pm??Math.ceil(5*i/2)}/${Math.ceil(5*i/2)}`]].forEach(([id,n])=>put(id+'-display',n));
}
function renderToken(){const map=$('dungeon-map');if(!map)return;
 token=document.createElement('div');token.className='dungeon-player-token orologio-token';
 const img=document.createElement('img');img.src='../immagini/token/'+(player.token||'token_1.png');img.alt=player.nome||'PG';img.draggable=false;token.appendChild(img);map.appendChild(token);positionToken();}
function tokenLeft(x){return (gridX+x*cellPx)/imageWidth*100;}
function tokenTop(y){return (gridY+y*cellPx)/imageHeight*100;}
function positionToken(){if(!token)return;token.style.left=tokenLeft(pos.x)+'%';token.style.top=tokenTop(pos.y)+'%';token.style.width=cellPx/imageWidth*100+'%';token.style.height=cellPx/imageHeight*100+'%';put('dungeon-player-coordinates',`Coordinate PG: X ${pos.x} · Y ${pos.y}`);}
function camera(immediate=false){const frame=document.querySelector('.dungeon-map-frame'),map=$('dungeon-map');if(!frame||!map)return;
 const fw=frame.clientWidth,fh=frame.clientHeight,mw=map.offsetWidth,mh=map.offsetHeight;
 const cx=(gridX+(pos.x+.5)*cellPx)/imageWidth*mw,cy=(gridY+(pos.y+.5)*cellPx)/imageHeight*mh;
 const dx=Math.max(0,Math.min(mw-fw,cx-fw/2)),dy=Math.max(0,Math.min(mh-fh,cy-fh/2));
 map.style.transition=immediate?'none':'transform 170ms ease-out';map.style.transform=`translate3d(${-dx}px,${-dy}px,0)`;}
function zoom(v){view=Math.max(5,Math.min(Math.max(cols,rows),Math.round(v)));const map=$('dungeon-map');if(!map)return;
 // Misura cella visibile effettiva: include il margine di 20px presente nell'immagine.
 const zoomFactor=imageWidth/(cellPx*view);
 map.style.setProperty('width',`${zoomFactor*100}%`,'important');map.style.setProperty('height',`${zoomFactor*100}%`,'important');
 map.style.setProperty('--orologio-view-cells',String(view));put('base-zoom-reset',`${view} × ${view}`);camera(true);positionToken();}
function move(dx,dy){const nx=pos.x+dx,ny=pos.y+dy;if(!isWalkable(nx,ny)){message('Passaggio bloccato.');return;}
 pos={x:nx,y:ny};sessionStorage.setItem(POSITION_KEY,JSON.stringify(pos));positionToken();camera();message('Stanza dell’Orologio');}
function controls(){
 $('base-zoom-out')?.addEventListener('click',()=>zoom(view+(view<20?2:8)));
 $('base-zoom-in')?.addEventListener('click',()=>zoom(view-(view<=20?2:8)));
 $('base-zoom-reset')?.addEventListener('click',()=>zoom(13));$('base-zoom-full')?.addEventListener('click',()=>zoom(Math.max(cols,rows)));
 document.addEventListener('keydown',e=>{if(e.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
 const directions={w:[0,-1],arrowup:[0,-1],a:[-1,0],arrowleft:[-1,0],s:[0,1],arrowdown:[0,1],d:[1,0],arrowright:[1,0]};let delta=directions[e.key.toLowerCase()];if(!delta)return;e.preventDefault();if(!e.repeat)move(...delta);});
 $('dungeon-map')?.addEventListener('click',e=>{const map=$('dungeon-map');const rect=map.getBoundingClientRect();const x=Math.floor(((e.clientX-rect.left)/rect.width*imageWidth-gridX)/cellPx),y=Math.floor(((e.clientY-rect.top)/rect.height*imageHeight-gridY)/cellPx);if(Math.abs(x-pos.x)+Math.abs(y-pos.y)===1)move(x-pos.x,y-pos.y);});
 window.addEventListener('resize',()=>camera(true),{passive:true});
}
async function init(){try{message('Caricamento Stanza dell’Orologio...');await loadMap();if(!await loadCharacter())return;await loadEquipment();updateCharacter();renderToken();controls();zoom(13);
 message('Stanza dell’Orologio caricata. Il disco centrale è inaccessibile.');
 }catch(e){console.error('Orologio:',e);message(e.message||'Errore caricamento',true);}}
document.addEventListener('DOMContentLoaded',init);
})();
