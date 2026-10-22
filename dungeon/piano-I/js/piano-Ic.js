/* Palazzo Eterno · Piano I-C · Giungla Alta
   MODALITÀ ANTEPRIMA: non scrive su Supabase, non altera coordinate o eventi del Piano I-A.
   Sostituire l'adapter di persistenza quando saranno pronti mappe e RPC specifiche di I-C. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORAGE = 'palazzo-eterno-ic-preview-v1';
  const VOLUME_KEY = 'palazzo-eterno-dungeon-volume';
  let mapData, x = 15, y = 15, view = 13, fogOn = true, explored = new Set();
  let map, marker, fog, noteTimer, character = null;
  const setText = (id, s) => { const el=$(id); if(el) el.textContent=String(s); };
  const message = s => setText('dungeon-message',s);
  function save() { try { localStorage.setItem(STORAGE, JSON.stringify({x,y,explored:[...explored],view})); } catch (_) {} }
  function read() { try{return JSON.parse(localStorage.getItem(STORAGE)||'{}')||{}}catch(_){return {}} }
  const valid = (a,b) => Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0&&a<mapData.columns&&b<mapData.rows&&!mapData.blocked.some(p=>p.x===a&&p.y===b);
  function position(el,a,b){el.style.left=(a/mapData.columns*100)+'%';el.style.top=(b/mapData.rows*100)+'%';el.style.width=(100/mapData.columns)+'%';el.style.height=(100/mapData.rows)+'%';}
  function reveal() {for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++)if(dx*dx+dy*dy<=36&&valid(x+dx,y+dy))explored.add(`${x+dx},${y+dy}`);}
  function fogPaint(){if(!fog)return;const ctx=fog.getContext('2d'); ctx.clearRect(0,0,fog.width,fog.height); if(!fogOn)return;
    for(let yy=0;yy<mapData.rows;yy++)for(let xx=0;xx<mapData.columns;xx++){
      const dist=Math.hypot(xx-x,yy-y),seen=explored.has(`${xx},${yy}`);
      ctx.fillStyle=dist<=6?'rgba(0,0,0,0)':seen?'rgba(4,19,12,.61)':'rgba(2,11,7,.96)';ctx.fillRect(xx,yy,1,1);
    }
  }
  function camera(){if(!map)return;const rect=map.parentElement.getBoundingClientRect();const cell=rect.width/view;const left=(x+.5)*cell-rect.width/2;const top=(y+.5)*cell-rect.height/2;
    const maxX=Math.max(0,mapData.columns*cell-rect.width),maxY=Math.max(0,mapData.rows*cell-rect.height);
    map.style.transform=`translate(${-Math.min(maxX,Math.max(0,left))}px,${-Math.min(maxY,Math.max(0,top))}px)`;
    setText('dungeon-player-coordinates',`Coordinate PG: X ${x} · Y ${y}`);
  }
  function zoom(n){view=Math.max(5,Math.min(Math.max(mapData.columns,mapData.rows),n));map.style.setProperty('width',`${mapData.columns*100/view}%`,'important');map.style.setProperty('height',`${mapData.rows*100/view}%`,'important');map.style.setProperty('--pic-visible',view);setText('pia-zoom-reset',`${view} × ${view}`);camera();save();}
  function update(){position(marker,x,y);reveal();fogPaint();camera();save();}
  function move(dx,dy){const nx=x+dx,ny=y+dy;if(!valid(nx,ny)){message('Passaggio non disponibile.');return;}x=nx;y=ny;update();message('Anteprima I-C: movimento locale, non sincronizzato con il server.');}
  function setupMap(){map=$('dungeon-map'); map.style.transition='transform 170ms ease';map.style.position='absolute';
    const image=$('dungeon-map-image');image.src='immagini/mappa-provvisoria.svg';
    const grid=document.createElement('div');grid.className='pic-grid';map.append(grid);
    marker=document.createElement('div');marker.className='pic-player';marker.textContent='◆';marker.setAttribute('aria-label','Personaggio');map.append(marker);
    fog=document.createElement('canvas');fog.className='pic-fog';fog.width=mapData.columns;fog.height=mapData.rows;map.append(fog);
    const state=read(),sx=mapData.spawn?.x??15,sy=mapData.spawn?.y??15;
    x=valid(state.x,state.y)?state.x:sx;y=valid(state.x,state.y)?state.y:sy;
    explored=new Set(Array.isArray(state.explored)?state.explored:[]);
    zoom(Number.isFinite(state.view)?state.view:13);update();
    $('pia-zoom-out')?.addEventListener('click',()=>zoom(view+2));
    $('pia-zoom-in')?.addEventListener('click',()=>zoom(view-2));
    $('pia-zoom-reset')?.addEventListener('click',()=>zoom(13));
    $('pia-zoom-full')?.addEventListener('click',()=>zoom(Math.max(mapData.columns,mapData.rows)));
    const masterToggle=$('pia-master-exploration');if(masterToggle){masterToggle.hidden=false;masterToggle.querySelector('input')?.addEventListener('change',e=>{fogOn=!e.target.checked;fogPaint();});}
    map.parentElement.addEventListener('click',e=>{if(e.target.closest('button'))return;const r=map.getBoundingClientRect();const tx=Math.floor((e.clientX-r.left)/r.width*mapData.columns);const ty=Math.floor((e.clientY-r.top)/r.height*mapData.rows);if(Math.max(Math.abs(tx-x),Math.abs(ty-y))===1)move(tx-x,ty-y);});
    document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
      const moves={w:[0,-1],ArrowUp:[0,-1],s:[0,1],ArrowDown:[0,1],a:[-1,0],ArrowLeft:[-1,0],d:[1,0],ArrowRight:[1,0]};if(moves[e.key]){e.preventDefault();move(...moves[e.key]);}});
    window.addEventListener('resize',camera,{passive:true});
  }
  function setupAudio(){let volume=.35;try{const v=Number(localStorage.getItem(VOLUME_KEY));if(Number.isFinite(v))volume=Math.max(0,Math.min(1,v));}catch(_){};
    const btn=$('dungeon-volume-button'), slider=$('dungeon-volume-slider'), value=$('dungeon-volume-value'),pop=$('dungeon-volume-popover');
    const refresh=()=>{if(slider)slider.value=Math.round(volume*100);if(value)value.textContent=Math.round(volume*100)+'%';if(btn)btn.textContent=volume===0?'🔇':volume<.5?'🔉':'🔊';};refresh();
    btn?.addEventListener('click',()=>{pop.hidden=!pop.hidden;btn.setAttribute('aria-expanded',String(!pop.hidden));});
    slider?.addEventListener('input',()=>{volume=Number(slider.value)/100;try{localStorage.setItem(VOLUME_KEY,String(volume));}catch(_){}refresh();});
    // Nessun brano associato a I-C finché non viene fornito un asset musicale.
  }
  async function loadCharacter(){const db=typeof supabaseClient!=='undefined'?supabaseClient:window.supabaseClient;if(!db?.auth)return;
    try{const {data:{user}}=await db.auth.getUser();if(!user)return;
      const {data,error}=await db.from('characters').select('*').eq('user_id',user.id).maybeSingle();if(error||!data)return;character=data;
      setText('character-name',data.name||data.character_name||'PERSONAGGIO');
      const el=$('character-token');if(el){const url=data.token_url||data.portrait_url||data.image_url;if(url)el.src=url;else el.style.visibility='hidden';}
      const mapping={'attack-display':['attack','attacco'],'defense-display':['defense','difesa'],'health-display':['current_hp','hp'],'mana-display':['current_mp','mp'],'movement-display':['movement','movimento'],'critical-display':['critical','critico'],'forza-display':['forza'],'resistenza-display':['resistenza'],'costituzione-display':['costituzione'],'intelligenza-display':['intelligenza'],'destrezza-display':['destrezza'],'fortuna-display':['fortuna']};
      for(const [id,fields] of Object.entries(mapping)){const f=fields.find(f=>data[f]!=null);if(f)setText(id,data[f]);}
      if(data.score!=null)setText('character-resonance',`✧ Risonanza: ${Number(data.score).toLocaleString('it-IT')}`);
    }catch(e){console.warn('[I-C] Scheda PG non disponibile in anteprima:',e);}
  }
  function setupPanels(){setText('dungeon-online-list','Anteprima locale · multiplayer I-C da collegare.');
    setText('dungeon-leaderboard-list','Classifica disponibile dopo integrazione con Supabase.');
    const buttons=document.querySelectorAll('.dungeon-action-card, #dungeon-actions-prev, #dungeon-actions-next, #dungeon-trade-add-item, #dungeon-trade-confirm, #dungeon-trade-cancel');
    buttons.forEach(b=>{b.disabled=true;b.title='Funzione in attesa dell’integrazione I-C con Supabase';});
    const notes=$('character-notes'),saveBtn=$('save-notes-button');if(notes){try{notes.value=localStorage.getItem(STORAGE+':notes')||''}catch(_){}}
    saveBtn?.addEventListener('click',()=>{try{localStorage.setItem(STORAGE+':notes',notes.value);message('Note salvate solo in questo browser.');}catch(_){message('Impossibile salvare le note.');}});
    const input=$('floor-chat-input'),send=$('floor-chat-send'),msgs=$('floor-chat-messages');
    const chat=()=>{const s=input?.value.trim();if(!s||!msgs)return;const line=document.createElement('div');line.className='floor-chat-message mine';line.textContent=`Anteprima (locale): ${s}`;if(msgs.querySelector('.chat-placeholder'))msgs.textContent='';msgs.append(line);input.value='';msgs.scrollTop=msgs.scrollHeight;};
    send?.addEventListener('click',chat);input?.addEventListener('keydown',e=>{if(e.key==='Enter')chat()});
    if(msgs)msgs.innerHTML='<div class="chat-placeholder">Chat di anteprima locale: non invia messaggi agli altri giocatori.</div>';
    const trade=$('dungeon-trade-status');if(trade)trade.textContent='Scambi I-C da integrare.';
  }
  async function start(){setupAudio();setupPanels();
    try{const res=await fetch('piano-Ic.json',{cache:'no-store'});if(!res.ok)throw new Error('File mappa mancante');mapData=await res.json();if(!Number.isInteger(mapData.columns)||!Number.isInteger(mapData.rows)||!Array.isArray(mapData.blocked))throw new Error('Griglia non valida');setupMap();await loadCharacter();message('Giungla Alta · anteprima esplorabile (nessun salvataggio su Supabase).');}
    catch(e){console.error('[I-C]',e);message(`Errore mappa: ${e.message}. Aprire la pagina da un server web, non con file://.`);}
  }
  document.addEventListener('DOMContentLoaded',start);
})();
