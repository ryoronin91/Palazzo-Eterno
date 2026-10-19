// Palazzo Eterno — Stanza dell'Orologio (prima versione indipendente)
// Mappa, movimento/collisioni, camera, personaggio e visualizzazione statistiche.
// NON scrive base_x/base_y, NON avvia servizi né realtime della Base.
(() => {
'use strict';
const COLS_DEFAULT=29, ROWS_DEFAULT=29;
const POSITION_KEY='palazzo_eterno_orologio_position';
let cols=COLS_DEFAULT,rows=ROWS_DEFAULT,view=13;
let imageWidth=1254,imageHeight=1254,gridX=19,gridY=19,cellWidthPx=43.44,cellHeightPx=43.44;
let walkable=new Set(), blocked=new Set(),player=null, token=null, pos={x:14,y:26}, bonuses={};
let savePositionPending=false,savePositionBusy=false;
window.OrologioState={get player(){return player;},get pos(){return {...pos};},get token(){return token;},get grid(){return {gridX,gridY,cellWidthPx,cellHeightPx,imageWidth,imageHeight};},get walkable(){return walkable;},get isWalkable(){return isWalkable;}};
const $=id=>document.getElementById(id);
const key=(x,y)=>`${x},${y}`;
function message(s,error=false){const e=$('dungeon-message');if(e){e.textContent=s;e.classList.toggle('error',error);}}
function put(id,value){const e=$(id);if(e)e.textContent=value;}
const isWalkable=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<cols&&y<rows&&walkable.has(key(x,y))&&!blocked.has(key(x,y));
async function loadMap(){
 const r=await fetch('orologio.json',{cache:'no-store'});if(!r.ok)throw Error('Impossibile caricare orologio.json');
 const data=await r.json();cols=Number(data.grid?.columns)||COLS_DEFAULT;rows=Number(data.grid?.rows)||ROWS_DEFAULT;
 const g=data.grid||{};imageWidth=Number(g.image_width_px)||1254;imageHeight=Number(g.image_height_px)||1254;gridX=Number(g.offset_x_px??19);gridY=Number(g.offset_y_px??19);cellWidthPx=Number(g.cell_width_px ?? g.cell_size_px ?? 43.44);cellHeightPx=Number(g.cell_height_px ?? g.cell_size_px ?? 43.44);
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
 if(!data){location.href='../personaggio.html';return false;}player=data;const saved={x:Number(data.orologio_x),y:Number(data.orologio_y)};if(data.orologio_x!=null&&data.orologio_y!=null&&isWalkable(saved.x,saved.y))pos=saved;return true;
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
function tokenLeft(x){return (gridX+x*cellWidthPx)/imageWidth*100;}
function tokenTop(y){return (gridY+y*cellHeightPx)/imageHeight*100;}
function positionToken(){if(!token)return;token.style.left=tokenLeft(pos.x)+'%';token.style.top=tokenTop(pos.y)+'%';token.style.width=cellWidthPx/imageWidth*100+'%';token.style.height=cellHeightPx/imageHeight*100+'%';put('dungeon-player-coordinates',`Coordinate PG: X ${pos.x} · Y ${pos.y}`);}
function camera(immediate=false){const frame=document.querySelector('.dungeon-map-frame'),map=$('dungeon-map');if(!frame||!map)return;
 const fw=frame.clientWidth,fh=frame.clientHeight,mw=map.offsetWidth,mh=map.offsetHeight;
 const cx=(gridX+(pos.x+.5)*cellWidthPx)/imageWidth*mw,cy=(gridY+(pos.y+.5)*cellHeightPx)/imageHeight*mh;
 const dx=Math.max(0,Math.min(mw-fw,cx-fw/2)),dy=Math.max(0,Math.min(mh-fh,cy-fh/2));
 map.style.transition=immediate?'none':'transform 170ms ease-out';map.style.transform=`translate3d(${-dx}px,${-dy}px,0)`;}
function zoom(v){view=Math.max(5,Math.min(Math.max(cols,rows),Math.round(v)));const map=$('dungeon-map');if(!map)return;
 // Misura cella visibile effettiva: include il margine di 20px presente nell'immagine.
 const zoomFactor=Math.min(imageWidth/(cellWidthPx*view), imageHeight/(cellHeightPx*view));
 map.style.setProperty('width',`${zoomFactor*100}%`,'important');map.style.setProperty('height',`${zoomFactor*100}%`,'important');
 map.style.setProperty('--orologio-view-cells',String(view));put('base-zoom-reset',`${view} × ${view}`);camera(true);positionToken();}
async function flushOrologioPosition(){
 if(savePositionBusy||!savePositionPending||!player)return;
 savePositionBusy=true;
 try{while(savePositionPending){savePositionPending=false;
   const snapshot={x:pos.x,y:pos.y};
   const {error}=await supabaseClient.from('characters').update({orologio_x:snapshot.x,orologio_y:snapshot.y,current_location:'orologio'}).eq('id',player.id);
   if(error)throw error;
   player.orologio_x=snapshot.x;player.orologio_y=snapshot.y;
 }}catch(error){console.error('Persistenza Orologio:',error);message('Errore salvataggio posizione: '+error.message,true);}
 finally{savePositionBusy=false;}
}
function queueOrologioPosition(){savePositionPending=true;void flushOrologioPosition();}
function move(dx,dy){const nx=pos.x+dx,ny=pos.y+dy;if(!isWalkable(nx,ny)){message('Passaggio bloccato.');return;}
 pos={x:nx,y:ny};sessionStorage.setItem(POSITION_KEY,JSON.stringify(pos));queueOrologioPosition();positionToken();camera();document.dispatchEvent(new CustomEvent('orologio:move',{detail:{...pos}}));message('Stanza dell’Orologio');}
function controls(){
 $('base-zoom-out')?.addEventListener('click',()=>zoom(view+(view<20?2:8)));
 $('base-zoom-in')?.addEventListener('click',()=>zoom(view-(view<=20?2:8)));
 $('base-zoom-reset')?.addEventListener('click',()=>zoom(13));$('base-zoom-full')?.addEventListener('click',()=>zoom(Math.max(cols,rows)));
 document.addEventListener('keydown',e=>{if(e.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
 const directions={w:[0,-1],arrowup:[0,-1],a:[-1,0],arrowleft:[-1,0],s:[0,1],arrowdown:[0,1],d:[1,0],arrowright:[1,0]};let delta=directions[e.key.toLowerCase()];if(!delta)return;e.preventDefault();if(!e.repeat)move(...delta);});
 $('dungeon-map')?.addEventListener('click',e=>{const map=$('dungeon-map');const rect=map.getBoundingClientRect();const x=Math.floor((((e.clientX-rect.left)/rect.width)*imageWidth-gridX)/cellWidthPx),y=Math.floor((((e.clientY-rect.top)/rect.height)*imageHeight-gridY)/cellHeightPx);if(Math.abs(x-pos.x)+Math.abs(y-pos.y)===1)move(x-pos.x,y-pos.y);});
 window.addEventListener('resize',()=>camera(true),{passive:true});
}
async function init(){try{message('Caricamento Stanza dell’Orologio...');await loadMap();if(!await loadCharacter())return;await loadEquipment();updateCharacter();renderToken();controls();zoom(13);queueOrologioPosition();
 initOrologioNotes().catch(e=>console.warn('Note Orologio:',e));initSocial().catch(e=>console.warn('Funzioni sociali Orologio:',e));initActions().catch(e=>console.warn('Azioni Orologio:',e));message('Stanza dell’Orologio caricata. Il disco centrale è inaccessibile.');
 }catch(e){console.error('Orologio:',e);message(e.message||'Errore caricamento',true);}}
// --- OROLOGIO · CHAT, TOP 5 E PRESENCE (fase 2) ---
const floorId='orologio', channelName='palazzo-eterno-orologio';
const state=()=>({player,pos,grid:{gridX,gridY,cellWidthPx,cellHeightPx,imageWidth,imageHeight}});
const socialDb=()=>supabaseClient;
let user=null,channel=null,busy=false;
const seen=new Set();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const own=()=>state()?.player;
const current=()=>state()?.pos;
const tokenPath=t=>{
 const raw=String(t??'').trim();
 const name=raw.split(/[\/]/).pop().split('?')[0].split('#')[0];
 const numeric=/^\d+$/.test(name)?'token_'+name+'.png':name;
 const valid=/^token_\d+\.png$/i.test(numeric)?numeric:'token_1.png';
 return new URL('../immagini/token/'+valid,document.baseURI).href;
};
function safeTokenImage(img,t){
 img.onerror=null; img.src=tokenPath(t);
 img.onerror=()=>{img.onerror=null;img.src=tokenPath('token_1.png');};
}
function chatRow(r){const c=$('floor-chat-messages');if(!c||!r)return;
const id=String(r.id||'');if(id&&seen.has(id))return;if(id)seen.add(id);
if(c.querySelector('.chat-placeholder'))c.replaceChildren();
const div=document.createElement('div');div.className='floor-chat-message'+(r.character_id===own()?.id?' mine':'');
const name=document.createElement('strong');name.className='floor-chat-name';name.textContent=(r.sender_name||'Avventuriero')+': ';
const body=document.createElement('span');body.className='floor-chat-text';body.textContent=r.message_text||'';
div.append(name,body);c.prepend(div);while(c.children.length>100)c.lastElementChild.remove();}
async function history(){const {data,error}=await socialDb().from('dungeon_chat_messages').select('id,character_id,sender_name,message_text,created_at').eq('floor_id',floorId).order('created_at',{ascending:false}).limit(100);if(error)throw error;
const c=$('floor-chat-messages');if(c)c.innerHTML='';for(const r of [...(data||[])].reverse())chatRow(r);if(c&&!c.children.length)c.innerHTML='<div class="chat-placeholder">Nessun messaggio.</div>';}
async function sendChat(){const input=$('floor-chat-input');if(!input||busy)return;const value=input.value.trim();if(!value)return;busy=true;input.disabled=true;
try{const {data,error}=await socialDb().from('dungeon_chat_messages').insert({floor_id:floorId,character_id:own().id,user_id:user.id,sender_name:own().nome||'Avventuriero',message_text:value}).select('id,character_id,sender_name,message_text,created_at').single();if(error)throw error;chatRow(data);input.value='';}
catch(e){message('Chat: '+e.message,true);}finally{busy=false;input.disabled=false;input.focus();}}
function setupChat(){const input=$('floor-chat-input'),send=$('floor-chat-send');if(!input||!send)return;input.disabled=false;send.disabled=false;input.placeholder='Scrivi...';send.addEventListener('click',sendChat);input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();}});}
function renderTop(rows){
 const c=$('dungeon-leaderboard-list');if(!c)return;
 c.replaceChildren();
 if(!rows?.length){c.textContent='Nessun personaggio vivo in classifica.';return;}
 for(const r of rows){
   const num=Number(r.posizione)||0,score=Number(r.score)||0;
   const row=document.createElement('div');row.className='dungeon-leaderboard-row';
   const main=document.createElement('div');main.className='dungeon-leaderboard-main';
   const rank=document.createElement('span');rank.className='dungeon-leaderboard-position';rank.textContent='#'+num;
   const name=document.createElement('span');name.className='dungeon-leaderboard-name';name.textContent=r.character_name||'Avventuriero';name.title=name.textContent;
   const total=document.createElement('span');total.className='dungeon-leaderboard-score';total.textContent=score.toLocaleString('it-IT');
   main.append(rank,name,total);row.append(main);
   const badges=document.createElement('div');badges.className='dungeon-leaderboard-badges';
   for(const badge of Array.isArray(r.boss_badges)?r.boss_badges:[]){
     const wrap=document.createElement('span');wrap.className='dungeon-leaderboard-badge-wrap';
     wrap.title=(badge.badge_name||badge.display_name||'Boss sconfitto')+(Number(badge.floor_number)>0?' · Piano '+badge.floor_number:'');
     const img=document.createElement('img');img.className='dungeon-leaderboard-badge';img.alt=wrap.title;
     const raw=String(badge.icon_path||'').trim();
     const fallback=document.createElement('span');fallback.className='dungeon-leaderboard-badge-fallback';fallback.textContent='🛡';fallback.hidden=!!raw;
     if(raw){img.src=raw.startsWith('immagini/')?'../'+raw:raw;img.onerror=()=>{img.hidden=true;fallback.hidden=false;};wrap.append(img);}
     wrap.append(fallback);badges.append(wrap);
   }
   if(!badges.children.length){const none=document.createElement('span');none.className='dungeon-leaderboard-no-badges';none.textContent='Nessuna onorificenza';badges.append(none);}
   row.append(badges);c.append(row);
 }
}
async function leaderboard(){try{const [top,profile]=await Promise.all([socialDb().rpc('get_living_characters_leaderboard_with_badges',{p_limit:5}),socialDb().rpc('get_my_resonance_profile')]);if(top.error)throw top.error;renderTop(top.data||[]);const value=Number(profile.data?.score??own()?.score);const el=$('character-resonance');if(el)el.textContent='✧ Risonanza: '+(Number.isFinite(value)?value.toLocaleString('it-IT'):'—');}catch(e){console.warn('Top 5:',e);const el=$('dungeon-leaderboard-list');if(el)el.textContent='Classifica temporaneamente non disponibile.'}}
const peers=new Map(),tokens=new Map();
function presencePayload(){return {character_id:own().id,user_id:user.id,name:own().nome||'Avventuriero',token:own().token||'token_1.png',x:current().x,y:current().y,location:floorId,online_at:new Date().toISOString()};}
function coords(e,p){const g=state().grid; e.style.left=((g.gridX+p.x*g.cellWidthPx)/g.imageWidth*100)+'%';e.style.top=((g.gridY+p.y*g.cellHeightPx)/g.imageHeight*100)+'%';e.style.width=(g.cellWidthPx/g.imageWidth*100)+'%';e.style.height=(g.cellHeightPx/g.imageHeight*100)+'%';}
function renderOnline(){
 const c=$('orologio-online-list');if(!c||!own()||!user)return;
 c.replaceChildren();
 for(const p of [presencePayload(),...peers.values()]){
   const row=document.createElement('div');row.className='dungeon-online-player';
   const img=document.createElement('img');img.className='orologio-online-avatar';
   safeTokenImage(img,p.token);img.alt='';img.loading='lazy';
   const label=document.createElement('span');label.textContent=p.name+(p.character_id===own().id?' (tu)':'');
   row.append(img,label);c.append(row);
 }
}
function syncPeers(){if(!channel)return;const s=channel.presenceState();const next=new Map();for(const vals of Object.values(s)){for(const p of vals||[]){if(p.character_id&&p.character_id!==own().id&&p.location===floorId)next.set(p.character_id,p);}}
peers.clear();for(const [id,p] of next)peers.set(id,p);for(const [id,e] of tokens)if(!next.has(id)){e.remove();tokens.delete(id);}
for(const [id,p] of peers){let el=tokens.get(id);if(!el){el=document.createElement('div');el.className='orologio-other-token';el.dataset.characterId=id;const img=document.createElement('img');safeTokenImage(img,p.token);const name=document.createElement('span');name.className='other-player-name';name.textContent=p.name;el.append(img,name);$('dungeon-map').append(el);tokens.set(id,el);}else if(el.dataset.token!==p.token){safeTokenImage(el.querySelector('img'),p.token);}el.dataset.token=p.token;coords(el,p);}renderOnline();}
async function presence(){channel=socialDb().channel(channelName,{config:{presence:{key:own().id},broadcast:{self:false}}});channel.on('presence',{event:'sync'},syncPeers);
channel.on('broadcast',{event:'player-move'},({payload:p})=>{if(!p||!peers.has(p.character_id))return;peers.set(p.character_id,p);const t=tokens.get(p.character_id);if(t)coords(t,p);renderOnline();});
channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'dungeon_chat_messages',filter:'floor_id=eq.'+floorId},({new:r})=>chatRow(r));
await new Promise((resolve,reject)=>{channel.subscribe(async status=>{if(status==='SUBSCRIBED'){try{await channel.track(presencePayload());resolve();}catch(e){reject(e)}}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')reject(new Error('Presence non disponibile: '+status));});});}
async function moved(){if(!channel)return;const p=presencePayload();try{await channel.track(p);await channel.send({type:'broadcast',event:'player-move',payload:p});}catch(e){console.warn('Movimento Presence:',e)}}
async function initSocial(){if(!socialDb()||!own())return;try{const res=await socialDb().auth.getUser();user=res.data?.user;if(!user)return;
setupChat();await Promise.allSettled([history(),leaderboard()]);try{await presence();}catch(e){console.warn('Presence:',e);const c=$('orologio-online-list');if(c)c.textContent='Personaggi online temporaneamente non disponibili.';}
document.addEventListener('orologio:move',moved);window.addEventListener('beforeunload',()=>{if(channel)socialDb().removeChannel(channel)});setInterval(leaderboard,90000);
}catch(e){console.error('Social Orologio:',e);message('Funzioni sociali: '+e.message,true);}}


// STANZA OROLOGIO — abilità e consumabili; Cura usa RPC contesto orologio.
let inventoryRows=[],knownAbilities=[],actionsBusy=false,healMode=false;
const statMax=type=>{
 const attr=type==='hp'?'costituzione':'intelligenza';
 const equipped=Number(bonuses[attr]||0);
 return Math.ceil(5*Math.max(1,Math.min(30,(Number(own()?.[attr])||1)+equipped))/2);
};
const owned=id=>knownAbilities.some(r=>r.ability_id===id||r.ability?.id===id);
function itemFor(type){return inventoryRows.find(r=>Number(r.quantity)>0&&r.item&&r.item.id!=='frutto_carnoso'&&(type==='hp'?Number(r.item.heal_pf)>0:Number(r.item.heal_pm)>0));}
function actionButton(id){return $(id);}
function actionRefresh(){
 const heal=actionButton('dungeon-heal-button');if(heal){
  const cost=Number(knownAbilities.find(r=>r.ability_id==='cura'||r.ability?.id==='cura')?.ability?.pm_cost)||2;
  heal.style.display=owned('cura')?'':'none';heal.disabled=actionsBusy||!owned('cura')||(Number(own().current_pm??statMax('pm'))<cost);
  const small=heal.querySelector('small');if(small)small.textContent=cost+' PM';
  heal.classList.toggle('active',healMode);
 }
 for(const [type,id,countId] of [['hp','dungeon-health-potion-button','dungeon-health-potion-count'],['pm','dungeon-mana-potion-button','dungeon-mana-potion-count']]){
   const item=itemFor(type);const el=actionButton(id);const count=$(countId);
   if(count)count.textContent='x'+(item?Number(item.quantity):0);
   if(el)el.disabled=actionsBusy||!item||(Number(own()?.[type==='hp'?'current_hp':'current_pm'])>=statMax(type));
 }
 updateExtraConsumables();
 const payday=$('dungeon-giorno-paga-button');if(payday){payday.style.display=owned('giorno_paga')?'':'none';payday.disabled=actionsBusy||!owned('giorno_paga');}
}
async function actionData(){
 const [i,a]=await Promise.all([
  socialDb().from('character_inventory').select('id,quantity,equipped_slot,item:items(id,name,heal_pf,heal_pm)').eq('character_id',own().id),
  socialDb().from('character_abilities').select('ability_id,level,ability:abilities(id,name,pm_cost)').eq('character_id',own().id)
 ]);
 if(i.error)throw i.error;if(a.error)throw a.error;
 inventoryRows=i.data||[];knownAbilities=a.data||[];actionRefresh();
}
async function drink(type){
 if(actionsBusy)return;const row=itemFor(type);if(!row)return;
 const currentKey=type==='hp'?'current_hp':'current_pm', maximum=statMax(type);
 const before=own()[currentKey]==null?maximum:Number(own()[currentKey]);if(before>=maximum)return;
 actionsBusy=true;actionRefresh();
 try{
   // Stessa RPC inventario della Base; aggiorna prima l'inventario sul server.
   const used=await socialDb().rpc('use_inventory_item',{p_inventory_id:row.id});if(used.error)throw used.error;
   const amount=Number(type==='hp'?row.item.heal_pf:row.item.heal_pm)||0;
   const next=Math.min(maximum,before+amount);
   const result=await socialDb().from('characters').update({[currentKey]:next}).eq('id',own().id);
   if(result.error)throw result.error;
   own()[currentKey]=next;updateCharacter();message(`Recuperi ${next-before} ${type==='hp'?'PF':'PM'}.`);
 }catch(e){console.error('Pozione Orologio:',e);message('Errore consumabile: '+e.message,true);}
 finally{actionsBusy=false;await actionData().catch(console.warn);}
}
async function castPayday(){
 if(actionsBusy||!owned('giorno_paga'))return;actionsBusy=true;actionRefresh();
 try{const result=await socialDb().rpc('cast_giorno_paga_outside_combat',{p_character_id:own().id});
 if(result.error)throw result.error;if(result.data?.current_pm!=null)own().current_pm=Number(result.data.current_pm);
 updateCharacter();message('Giorno Paga attivato.');}
 catch(e){message('Giorno Paga: '+e.message,true);}
 finally{actionsBusy=false;actionRefresh();}
}

// Consumabili condivisi, mantenendo le RPC server-side di Palazzo Eterno.
function addExtraButton(id,title,icon,text,onClick){
 let button=$(id);if(button)return button;
 const panel=document.querySelector('.dungeon-actions-panel');if(!panel)return null;
 button=document.createElement('button');button.id=id;button.className='dungeon-action-card';button.type='button';
 const ico=document.createElement('span');ico.className='action-card-icon';ico.textContent=icon;
 const txt=document.createElement('span');txt.className='action-card-content';
 const strong=document.createElement('strong');strong.textContent=title;
 const small=document.createElement('small');small.textContent=text;
 txt.append(strong,small);button.append(ico,txt);
 panel.insertBefore(button,panel.querySelector('.dungeon-action-pagination'));
 button.addEventListener('click',onClick);
 return button;
}
function quantityOf(id){return inventoryRows.filter(r=>r.item?.id===id&&!r.equipped_slot).reduce((n,r)=>n+(Number(r.quantity)||0),0);}
function updateExtraConsumables(){
 const f=$('dungeon-fruit-button'),s=$('dungeon-spatial-coin-button');
 if(f){const q=quantityOf('frutto_carnoso');f.style.display=q?'':'none';f.disabled=actionsBusy||!q||(Number(own()?.current_hp)>=statMax('hp')&&Number(own()?.current_pm)>=statMax('pm'));f.querySelector('small').textContent='x'+q;}
 if(s){const q=quantityOf('moneta_spaziale');s.style.display=q?'':'none';s.disabled=actionsBusy||!q||Boolean(own()?.active_combat_id);s.querySelector('small').textContent='x'+q;}
}
async function eatFruit(){
 if(actionsBusy)return;const row=inventoryRows.find(r=>r.item?.id==='frutto_carnoso'&&!r.equipped_slot&&Number(r.quantity)>0);if(!row)return;
 actionsBusy=true;actionRefresh();
 try{const {data,error}=await socialDb().rpc('use_piano_ia_fruit',{p_inventory_id:row.id});if(error)throw error;
  if(data?.current_pf!=null)own().current_hp=Number(data.current_pf);
  if(data?.current_pm!=null)own().current_pm=Number(data.current_pm);
  updateCharacter();message('Frutto Carnoso utilizzato. PF e PM aggiornati.');
 }catch(e){console.error('Frutto Orologio:',e);message(e.message||'Frutto non disponibile qui.',true);}
 finally{actionsBusy=false;await actionData().catch(console.warn);}
}
async function spatialCoin(){
 if(actionsBusy||!quantityOf('moneta_spaziale')||!window.confirm('Usare una Moneta Spaziale per tornare alla Base?'))return;
 actionsBusy=true;actionRefresh();
 try{const {data,error}=await socialDb().rpc('use_spatial_coin');if(error)throw error;
 if(data?.ok===false)throw new Error('Teletrasporto non riuscito.');
 window.location.replace('../base/base.html');
 }catch(e){console.error('Moneta Spaziale Orologio:',e);message(e.message||'Impossibile usare la Moneta Spaziale.',true);actionsBusy=false;await actionData().catch(console.warn);}
}

async function castOrologioHeal(targetId,targetName){
 if(actionsBusy||!owned('cura'))return;
 actionsBusy=true;healMode=false;actionRefresh();
 try{await flushOrologioPosition();
  const {data,error}=await socialDb().rpc('use_heal',{p_target_character_id:targetId,p_context:'orologio'});
  if(error)throw error;
  if(data?.caster_current_pm!=null)own().current_pm=Number(data.caster_current_pm);
  if(targetId===own().id&&data?.target_current_hp!=null)own().current_hp=Number(data.target_current_hp);
  updateCharacter();message(`Cura su ${targetName||'alleato'}: +${data?.healed_amount??0} PF.`);
 }catch(e){message('Cura: '+e.message,true);}finally{actionsBusy=false;actionRefresh();}
}
function setupOrologioHeal(){
 const button=$('dungeon-heal-button');if(!button)return;
 button.addEventListener('click',()=>{
  if(button.disabled)return;healMode=!healMode;actionRefresh();
  message(healMode?'CURA: clicca su te stesso o su una pedina adiacente.':'Cura annullata.');
 });
 $('dungeon-map')?.addEventListener('click',e=>{
  if(!healMode||actionsBusy)return;
  const t=e.target.closest('.orologio-other-token,.orologio-token');if(!t)return;
  e.stopImmediatePropagation();
  if(t.classList.contains('orologio-token')){void castOrologioHeal(own().id,own().nome);return;}
  const id=t.dataset.characterId,p=peers.get(id);
  if(!p)return;
  if(Math.max(Math.abs(p.x-current().x),Math.abs(p.y-current().y))>1){message('Alleato fuori portata (massimo 1 casella).',true);return;}
  void castOrologioHeal(id,p.name);
 },true);
}
async function initActions(){
 setupOrologioHeal();
 addExtraButton('dungeon-fruit-button','FRUTTO CARNOSO','✿','x0',eatFruit);
 addExtraButton('dungeon-spatial-coin-button','MONETA SPAZIALE','✦','x0',spatialCoin);
 const mana=$('dungeon-mana-potion-button');
 if(mana&&!$('dungeon-giorno-paga-button')){
  const btn=mana.cloneNode(true);btn.id='dungeon-giorno-paga-button';btn.dataset.action='giorno-paga';btn.querySelector('strong').textContent='GIORNO PAGA';btn.querySelector('.action-card-icon').textContent='¤';
  btn.querySelector('small').textContent='3 PM';btn.style.display='none';mana.after(btn);btn.addEventListener('click',castPayday);
 }
 $('dungeon-health-potion-button')?.addEventListener('click',()=>drink('hp'));
 $('dungeon-mana-potion-button')?.addEventListener('click',()=>drink('pm'));
 await actionData();
}
async function initOrologioNotes(){
 const field=$('character-notes'),btn=$('save-notes-button');if(!field||!btn||!player)return;
 field.disabled=false;btn.disabled=false;field.placeholder='Note del personaggio';
 field.value=player.notes||'';
 btn.addEventListener('click',async()=>{btn.disabled=true;
  const {error}=await supabaseClient.from('characters').update({notes:field.value}).eq('id',player.id);
  if(error)message('Note: '+error.message,true);else{player.notes=field.value;message('Note salvate.');}
  btn.disabled=false;
 });
}
document.addEventListener('DOMContentLoaded',init);
})();
