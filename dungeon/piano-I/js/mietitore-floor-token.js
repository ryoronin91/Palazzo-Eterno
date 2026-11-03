// Mietitore di Smeraldo — token condiviso per la Giungla Bassa e Alta.
// Il server decide visibilità, coordinate, scadenza e apertura dell'incontro.
(function(){
 'use strict';
 const floor=location.pathname.includes('piano-Ic')?'dungeon_Ic':'dungeon_Ia';
 const image='../../immagini/nemici/mietitore_smeraldo.png';
 let token=null, busy=false, lastSpawn=null;
 function draw(){
   const map=document.getElementById('dungeon-map');
   if(!map)return;
   if(!lastSpawn){
     if(token){token.remove();token=null;}return;
   }
   const cols=typeof MAP_COLUMNS!=='undefined'?Number(MAP_COLUMNS):null;
   const rows=typeof MAP_ROWS!=='undefined'?Number(MAP_ROWS):null;
   if(!cols||!rows)return;
   if(!token){
     token=document.createElement('button');
     token.type='button';token.className='mietitore-smeraldo-floor-token';
     token.title='Mietitore di Smeraldo';
     token.setAttribute('aria-label',token.title);
     token.style.cssText='position:absolute;z-index:45;transform:translate(-50%,-50%);'+
       'padding:0;border:0;background:transparent;box-shadow:none;cursor:pointer;'+
       'overflow:visible;aspect-ratio:1;';
     const img=document.createElement('img');
     img.src=image;img.alt='Mietitore di Smeraldo';img.draggable=false;
     img.style.cssText='display:block;width:100%;height:100%;object-fit:contain;'+
       'pointer-events:none;';
     token.appendChild(img);
     token.addEventListener('click',async event=>{
       event.preventDefault();event.stopPropagation();
       if(busy)return;
       if(!window.confirm('Affrontare il Mietitore di Smeraldo?'))return;
       busy=true;
       try{
         const {data,error}=await db.rpc('mietitore_enter_floor_combat',{p_floor_id:floor});
         if(error)throw error;
         if(!data)throw new Error('Combattimento non disponibile');
         window.location.assign('../../combat.html?combat_id='+encodeURIComponent(data));
       }catch(e){window.alert(e.message||'Impossibile affrontare il Mietitore');}
       finally{busy=false;}
     });
     map.appendChild(token);
   }
   token.style.left=((Number(lastSpawn.x)+0.5)/cols*100)+'%';
   token.style.top=((Number(lastSpawn.y)+0.5)/rows*100)+'%';
   token.style.width=(1.5/cols*100)+'%';
   token.style.height=(1.5/rows*100)+'%';
 }
 async function refresh(){
   if(typeof db==='undefined'||!db)return;
   try{
     const {data,error}=await db.rpc('mietitore_get_floor_spawn',{p_floor_id:floor});
     if(error)throw error;
     lastSpawn=data||null;
     draw();
   }catch(e){console.warn('[Mietitore floor]',e);}
 }
 // Aggiorna il token anche durante zoom, ricostruzioni della mappa e resize.
 document.addEventListener('DOMContentLoaded',()=>{
   void refresh();
   window.setInterval(()=>{if(!document.hidden)void refresh();},5000);
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 });
})();
