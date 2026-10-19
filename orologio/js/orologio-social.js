// Palazzo Eterno — Modulo sociale della Stanza dell'Orologio.
// Canale indipendente dalla Base. Non scrive base_x/base_y o dungeon_x/y.
(() => {
'use strict';
const floorId='orologio', channelName='palazzo-eterno-orologio';
const $=id=>document.getElementById(id), state=()=>window.OrologioState;
const db=typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient;
let user=null,channel=null, inventory=[],abilities=[],busy=false;
const seen=new Set();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const message=(s,err=false)=>{const e=$('dungeon-message');if(e){e.textContent=s;e.classList.toggle('error',err)}};
const own=()=>state()?.player;
const current=()=>state()?.pos;
const tokenPath=t=>'../immagini/token/'+String(t||'token_1.png').split('/').pop();
function chatRow(r){const c=$('floor-chat-messages');if(!c||!r)return;
const id=String(r.id||'');if(id&&seen.has(id))return;if(id)seen.add(id);
if(c.querySelector('.chat-placeholder'))c.replaceChildren();
const div=document.createElement('div');div.className='floor-chat-message'+(r.character_id===own()?.id?' mine':'');
const name=document.createElement('strong');name.className='floor-chat-name';name.textContent=(r.sender_name||'Avventuriero')+': ';
const body=document.createElement('span');body.className='floor-chat-text';body.textContent=r.message_text||'';
div.append(name,body);c.prepend(div);while(c.children.length>100)c.lastElementChild.remove();}
async function history(){const {data,error}=await db.from('dungeon_chat_messages').select('id,character_id,sender_name,message_text,created_at').eq('floor_id',floorId).order('created_at',{ascending:false}).limit(100);if(error)throw error;
const c=$('floor-chat-messages');if(c)c.innerHTML='';for(const r of [...(data||[])].reverse())chatRow(r);if(c&&!c.children.length)c.innerHTML='<div class="chat-placeholder">Nessun messaggio.</div>';}
async function sendChat(){const input=$('floor-chat-input');if(!input||busy)return;const value=input.value.trim();if(!value)return;busy=true;input.disabled=true;
try{const {data,error}=await db.from('dungeon_chat_messages').insert({floor_id:floorId,character_id:own().id,user_id:user.id,sender_name:own().nome||'Avventuriero',message_text:value}).select('id,character_id,sender_name,message_text,created_at').single();if(error)throw error;chatRow(data);input.value='';}
catch(e){message('Chat: '+e.message,true);}finally{busy=false;input.disabled=false;input.focus();}}
function setupChat(){const input=$('floor-chat-input'),send=$('floor-chat-send');if(!input||!send)return;input.disabled=false;send.disabled=false;input.placeholder='Scrivi...';send.addEventListener('click',sendChat);input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();}});}
function renderTop(rows){const c=$('dungeon-leaderboard-list');if(!c)return;c.innerHTML='';if(!rows?.length){c.textContent='Nessun personaggio in classifica.';return;}
for(const r of rows){const num=Number(r.posizione)||0,score=Number(r.score)||0;const badges=Array.isArray(r.boss_badges)?r.boss_badges:[];const div=document.createElement('div');div.className='dungeon-leaderboard-row';
const main=document.createElement('div');main.className='dungeon-leaderboard-main';main.innerHTML=`<span class="dungeon-leaderboard-position">#${num}</span><span class="dungeon-leaderboard-name">${esc(r.character_name||'Avventuriero')}</span><span class="dungeon-leaderboard-score">${score.toLocaleString('it-IT')}</span>`;
const b=document.createElement('div');b.className='dungeon-leaderboard-badges';for(const v of badges){if(!v.icon_path)continue;const icon=document.createElement('img');icon.className='dungeon-leaderboard-badge';const p=String(v.icon_path);icon.src=p.startsWith('immagini/')?'../'+p:p;icon.alt=v.badge_name||'Boss';icon.title=v.badge_name||'Boss sconfitto';icon.loading='lazy';b.append(icon);}
div.append(main,b);c.append(div);}}
async function leaderboard(){try{const [top,profile]=await Promise.all([db.rpc('get_living_characters_leaderboard_with_badges',{p_limit:5}),db.rpc('get_my_resonance_profile')]);if(top.error)throw top.error;renderTop(top.data||[]);const value=Number(profile.data?.score??own()?.score);const el=$('character-resonance');if(el)el.textContent='✧ Risonanza: '+(Number.isFinite(value)?value.toLocaleString('it-IT'):'—');}catch(e){console.warn('Top 5:',e);const el=$('dungeon-leaderboard-list');if(el)el.textContent='Classifica temporaneamente non disponibile.'}}
const peers=new Map(),tokens=new Map();
function presencePayload(){return {character_id:own().id,user_id:user.id,name:own().nome||'Avventuriero',token:own().token||'token_1.png',x:current().x,y:current().y,location:floorId,online_at:new Date().toISOString()};}
function coords(e,p){const g=state().grid; e.style.left=((g.gridX+p.x*g.cellWidthPx)/g.imageWidth*100)+'%';e.style.top=((g.gridY+p.y*g.cellHeightPx)/g.imageHeight*100)+'%';e.style.width=(g.cellWidthPx/g.imageWidth*100)+'%';e.style.height=(g.cellHeightPx/g.imageHeight*100)+'%';}
function renderOnline(){const c=$('dungeon-online-list');if(!c)return;c.replaceChildren();for(const p of [presencePayload(),...peers.values()]){const row=document.createElement('div');row.className='dungeon-online-player';row.textContent=p.name+(p.character_id===own().id?' (tu)':'');c.append(row);}}
function syncPeers(){if(!channel)return;const s=channel.presenceState();const next=new Map();for(const vals of Object.values(s)){for(const p of vals||[]){if(p.character_id&&p.character_id!==own().id&&p.location===floorId)next.set(p.character_id,p);}}
peers.clear();for(const [id,p] of next)peers.set(id,p);for(const [id,e] of tokens)if(!next.has(id)){e.remove();tokens.delete(id);}
for(const [id,p] of peers){let el=tokens.get(id);if(!el){el=document.createElement('div');el.className='orologio-other-token';const img=document.createElement('img');img.src=tokenPath(p.token);const name=document.createElement('span');name.className='other-player-name';name.textContent=p.name;el.append(img,name);$('dungeon-map').append(el);tokens.set(id,el);}coords(el,p);}renderOnline();}
async function presence(){channel=db.channel(channelName,{config:{presence:{key:own().id},broadcast:{self:false}}});channel.on('presence',{event:'sync'},syncPeers);
channel.on('broadcast',{event:'player-move'},({payload:p})=>{if(!p||!peers.has(p.character_id))return;peers.set(p.character_id,p);const t=tokens.get(p.character_id);if(t)coords(t,p);});
channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'dungeon_chat_messages',filter:'floor_id=eq.'+floorId},({new:r})=>chatRow(r));
await new Promise((resolve,reject)=>{channel.subscribe(async status=>{if(status==='SUBSCRIBED'){try{await channel.track(presencePayload());resolve();}catch(e){reject(e)}}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')reject(new Error('Presence non disponibile: '+status));});});}
async function moved(){if(!channel)return;const p=presencePayload();try{await channel.track(p);await channel.send({type:'broadcast',event:'player-move',payload:p});}catch(e){console.warn('Movimento Presence:',e)}}
async function loadInventory(){if(!own())return;const res=await Promise.all([db.from('character_inventory').select('id,quantity,item:items(id,name,heal_pf,heal_pm)').eq('character_id',own().id),db.from('character_abilities').select('ability_id,ability:abilities(id,name,pm_cost)').eq('character_id',own().id)]);if(res[0].error)console.warn('Inventario:',res[0].error);else inventory=res[0].data||[];if(res[1].error)console.warn('Abilità:',res[1].error);else abilities=res[1].data||[];updateActions();}
const findPotion=type=>inventory.find(r=>Number(r.quantity)>0&&r.item&&r.item.id!=='frutto_carnoso'&&Number(type==='health'?r.item.heal_pf:r.item.heal_pm)>0);
const hasAbility=id=>abilities.some(a=>a.ability_id===id||a.ability?.id===id);
function updateActions(){const health=findPotion('health'),mana=findPotion('mana');if($('dungeon-health-potion-count'))$('dungeon-health-potion-count').textContent='x'+(health?.quantity||0);if($('dungeon-mana-potion-count'))$('dungeon-mana-potion-count').textContent='x'+(mana?.quantity||0);
for(const [id,entry] of [['dungeon-health-potion-button',health],['dungeon-mana-potion-button',mana]]){const el=$(id);if(el){el.disabled=busy||!entry;el.title=!entry?'Non disponibile':'';}}
const heal=$('dungeon-heal-button');if(heal){heal.style.display=hasAbility('cura')?'':'none';heal.disabled=true;heal.title='Cura nell’Orologio richiede una RPC server-side dedicata alle coordinate di questa stanza';}
const label=$('orologio-actions-notice');if(label)label.textContent='Cura e altre abilità di posizione saranno abilitate dopo l’integrazione server-side delle coordinate Orologio.';}
async function potion(type){if(busy)return;const p=findPotion(type);if(!p)return;const char=own();const base=type==='health'?'current_hp':'current_pm';const attr=type==='health'?'costituzione':'intelligenza';const max=Math.ceil(5*Math.max(1,Number(char[attr])||1)/2);const old=Number(char[base]??max);if(old>=max){message('Valore già al massimo.');return;}
busy=true;updateActions();try{const {error:rpcErr}=await db.rpc('use_inventory_item',{p_inventory_id:p.id});if(rpcErr)throw rpcErr;const value=Math.min(max,old+Number(type==='health'?p.item.heal_pf:p.item.heal_pm));const {error}=await db.from('characters').update({[base]:value}).eq('id',char.id);if(error)throw error;char[base]=value;const display=$(type==='health'?'health-display':'mana-display');if(display)display.textContent=value+'/'+max;message('Recuperi '+(value-old)+(type==='health'?' PF.':' PM.'));await loadInventory();}catch(e){message('Consumabile: '+e.message,true);}finally{busy=false;updateActions();}}
function setupActions(){for(const [id,type] of [['dungeon-health-potion-button','health'],['dungeon-mana-potion-button','mana']])$(id)?.addEventListener('click',()=>potion(type));const heal=$('dungeon-heal-button');if(heal){heal.disabled=true;}const gp=document.getElementById('orologio-actions-notice')||document.createElement('div');gp.id='orologio-actions-notice';gp.className='orologio-action-notice';document.querySelector('.dungeon-actions-panel')?.append(gp);updateActions();}
async function init(){if(!db||!own())return;try{const res=await db.auth.getUser();user=res.data?.user;if(!user)return;
setupChat();setupActions();await Promise.allSettled([history(),leaderboard(),loadInventory()]);try{await presence();}catch(e){console.warn('Presence:',e);const c=$('dungeon-online-list');if(c)c.textContent='Personaggi online non disponibili.';}
document.addEventListener('orologio:move',moved);window.addEventListener('beforeunload',()=>{if(channel)db.removeChannel(channel)});setInterval(leaderboard,90000);
}catch(e){console.error('Modulo sociale Orologio:',e);message('Funzioni sociali: '+e.message,true);}}
document.addEventListener('orologio:ready',init);
})();
