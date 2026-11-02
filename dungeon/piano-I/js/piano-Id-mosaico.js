/* Palazzo Eterno — Barriera del Mosaico, Piano Id.
   Richiede RPC piano_id_mosaic_status e piano_id_mosaic_place_piece. */
(() => {
 "use strict";
 const CELLS=[32,33,34], Y=16;
 const IMAGE="puzzle/immagini/12I.png";
 let state=[false,false,false], dialog=null, busy=false, previousFocus=null;
 const style=document.createElement("style");
 style.textContent=`
 .id-mosaic-barrier{position:absolute;z-index:12;pointer-events:none;box-sizing:border-box;
 border:2px solid #ffdd72;background:linear-gradient(90deg,#f9db7433,#ffc53d99,#f9db7433);
 box-shadow:0 0 10px 3px #ffd45c, inset 0 0 8px #fff3b0;animation:idMosaicPulse 2s ease-in-out infinite}
 @keyframes idMosaicPulse{50%{filter:brightness(1.5);box-shadow:0 0 18px 5px #ffdf75}}
 .id-mosaic-overlay{position:fixed;inset:0;z-index:100700;display:flex;align-items:center;justify-content:center;
 background:#02050cda;backdrop-filter:blur(4px);padding:16px;box-sizing:border-box}
 .id-mosaic-panel{width:min(570px,96vw);max-height:92vh;overflow:auto;text-align:center;color:#f7ebd4;
 padding:30px 24px;border:2px solid #d9b957;border-radius:12px;
 background:linear-gradient(#060914b9,#060914da),url("${IMAGE}") center/cover no-repeat;
 box-shadow:0 15px 70px #000,inset 0 0 32px #f5c85b30}
 .id-mosaic-panel h2{font:700 27px Georgia,serif;color:#f9d681;margin:0 0 18px}
 .id-mosaic-panel p{font:19px/1.55 Georgia,serif;margin:0 0 20px}
 .id-mosaic-slots{display:flex;flex-direction:column;gap:10px;margin:20px auto;max-width:390px}
 .id-mosaic-panel button{border:1px solid #dfba59;background:#29334a;color:#fff0c6;border-radius:6px;
 padding:11px 15px;cursor:pointer;font-weight:700}
 .id-mosaic-panel button:disabled{opacity:.6;cursor:default}
 .id-mosaic-panel .id-mosaic-examine{background:#665012;color:#fff2a5}
 .id-mosaic-close{margin-top:8px}
 .id-mosaic-status{font:14px/1.45 Arial,sans-serif;color:#f9d681;min-height:18px}`;
 document.head.appendChild(style);
 const barrier=document.createElement("div");
 barrier.className="id-mosaic-barrier";
 barrier.setAttribute("aria-hidden","true");
 function updateBarrier(){
  const map=document.getElementById("dungeon-map");
  if(!map)return;
  if(barrier.parentElement!==map)map.appendChild(barrier);
  barrier.style.left=(32/67*100)+"%";barrier.style.top=(16/45*100)+"%";
  barrier.style.width=(3/67*100)+"%";barrier.style.height=(1/45*100)+"%";
 }
 async function refresh(){
  const {data,error}=await db.rpc("piano_id_mosaic_status");
  if(error)throw error;
  state=[Boolean(data?.piece1),Boolean(data?.piece2),Boolean(data?.piece3)];
 }
 function close(){
  if(busy)return;
  dialog?.remove();dialog=null;eventLocked=false;
  if(previousFocus?.isConnected)previousFocus.focus();
 }
 function render(){
  if(!dialog)return;
  const panel=dialog.querySelector(".id-mosaic-panel");
  panel.replaceChildren();
  const title=document.createElement("h2");title.textContent="Il mosaico incompleto";
  const desc=document.createElement("p");
  desc.textContent="C'è un mosaico con pannelli mobili. Sembra una sorta di puzzle. Forse risolvendolo la barriera si abbasserà. Però mancano dei pezzi....";
  const slots=document.createElement("div");slots.className="id-mosaic-slots";
  for(let n=1;n<=3;n++){
   const button=document.createElement("button");button.type="button";
   button.disabled=busy||state[n-1];
   button.textContent=state[n-1]?"✓ Pezzo di mosaico "+n+" inserito":"AGGIUNGI PEZZO DI MOSAICO "+n;
   button.addEventListener("click",()=>place(n));
   slots.appendChild(button);
  }
  const message=document.createElement("div");message.className="id-mosaic-status";message.id="id-mosaic-status";
  panel.append(title,desc,slots,message);
  if(state.every(Boolean)){
   const examine=document.createElement("button");examine.className="id-mosaic-examine";
   examine.textContent="ESAMINA IL MOSAICO";
   examine.addEventListener("click",()=>{window.location.href="puzzle/puzzle.html";});
   panel.appendChild(examine);
  }
  const closeButton=document.createElement("button");closeButton.type="button";closeButton.className="id-mosaic-close";
  closeButton.textContent="CHIUDI";closeButton.addEventListener("click",close);panel.appendChild(closeButton);
  closeButton.focus();
 }
 async function place(n){
  if(busy)return;
  busy=true;
  const message=document.getElementById("id-mosaic-status");
  if(message)message.textContent="Inserimento in corso...";
  try{
   const {data,error}=await db.rpc("piano_id_mosaic_place_piece",{p_piece:n});
   if(error)throw error;
   state=[Boolean(data?.piece1),Boolean(data?.piece2),Boolean(data?.piece3)];
   busy=false;render();
   const status=document.getElementById("id-mosaic-status");
   if(status)status.textContent="Il pezzo di mosaico "+n+" è stato inserito.";
  }catch(error){
   busy=false;render();const status=document.getElementById("id-mosaic-status");
   if(status)status.textContent=error.message||"Non puoi inserire questo pezzo.";
  }
 }
 async function open(){
  if(dialog||busy||eventLocked)return;
  eventLocked=true;movementQueue.length=0;previousFocus=document.activeElement;
  dialog=document.createElement("div");dialog.className="id-mosaic-overlay";
  const panel=document.createElement("section");panel.className="id-mosaic-panel";
  panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");
  panel.setAttribute("aria-label","Mosaico del Tempio");
  dialog.appendChild(panel);document.body.appendChild(dialog);
  dialog.addEventListener("click",e=>{if(e.target===dialog)close()});
  try{await refresh();render()}catch(err){
   state=[false,false,false];render();
   const status=document.getElementById("id-mosaic-status");
   if(status)status.textContent="Impossibile leggere lo stato del mosaico: "+err.message;
  }
 }
 document.addEventListener("keydown",e=>{if(dialog&&e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();close()}},true);
 function isBarrier(x,y){return y===Y&&CELLS.includes(x);}
 // Blocca il movimento prima della chiamata Supabase; non altera il JSON.
 const original=performMovement;
 performMovement=async function(dx,dy){
  if(isBarrier(playerX+dx,playerY+dy)){
   await open();return false;
  }
  return original.apply(this,arguments);
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",updateBarrier);
 else updateBarrier();
 window.addEventListener("resize",updateBarrier);
})();
