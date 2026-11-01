'use strict';
// Palazzo Eterno — Sigillo di Scintilla, 4x3, 11 pannelli + casella vuota.
// Tutti i pannelli sono disponibili; nessun collegamento al database.
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
    if(solved)return;
    const empty=board.indexOf(0);
    if(!adjacent(index,empty))return;
    [board[index],board[empty]]=[board[empty],board[index]];
    moves++;
    message.hidden=true;
    render();
  }
  function shuffle(){
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
  verify.addEventListener('click',()=>{
    if(!ordered())return notify('Il Sigillo non è ancora ricomposto.','error');
    solved=true;render();
    notify('Il Sigillo delle Undici Memorie è stato ricomposto!','success');
    document.dispatchEvent(new CustomEvent('palazzo:puzzle-solved',{detail:{puzzleId:'scintilla-undici-memorie',moves}}));
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
})();
