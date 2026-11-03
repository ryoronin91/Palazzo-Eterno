// Arena Mietitore di Smeraldo — configurazione esclusiva dell'incontro.
// Non interferisce con i JSON delle mappe del piano.
(function(){
  'use strict';
  const encounter='mietitore_smeraldo';
  const walls=[[10,1],[4,2],[10,2],[4,3],[3,4],[4,4],
    [7,5],[8,5],[9,5],[10,5],[11,5],[12,5],[7,6],[7,7],
    [1,9],[2,9],[3,9],[4,9],[9,10],[10,10],[9,11],[9,12]];
  // Le coordinate del documento sono 1-based; combat_entities usa 0-based.
  const blocked=new Set(walls.map(([x,y])=>`${x-1},${y-1}`));
  function inArena(){return combatSession?.encounter_id===encounter;}
  function refreshImage(){
    if(!inArena())return;
    const map=document.getElementById('combat-map');
    if(!map)return;
    map.style.backgroundImage='url("immagini/combat/combat_rare_I.png")';
    map.dataset.gridInsetLeft='0';
    map.dataset.gridInsetRight='0';
    map.dataset.gridInsetTop='0';
    map.dataset.gridInsetBottom='0';
  }
  // Calcolo percorsi per le altre IA: i muri non sono caselle occupabili.
  if(typeof canCombatEntityOccupy==='function'){
    const previous=canCombatEntityOccupy;
    canCombatEntityOccupy=function(entity,x,y){
      if(inArena() && blocked.has(`${x},${y}`))return false;
      return previous(entity,x,y);
    };
  }
  if(typeof loadCombatSession==='function'){
    const previous=loadCombatSession;
    loadCombatSession=async function(...args){
      const result=await previous(...args);
      refreshImage();
      return result;
    };
  }
  if(typeof renderCombat==='function'){
    const previous=renderCombat;
    renderCombat=function(...args){
      refreshImage();
      return previous(...args);
    };
  }
  document.addEventListener('DOMContentLoaded',refreshImage);
})();
