/* Palazzo Eterno - Passo Fantasma fuori dal combattimento. */
(function () {
  'use strict';
  const css = document.createElement('style');
  css.textContent = `
    #ghost-map-button{position:fixed;right:18px;bottom:18px;z-index:8400;padding:12px 18px;
      font:700 13px Georgia,serif;letter-spacing:.05em;color:#efdfb6;background:linear-gradient(#334b41,#162923);
      border:1px solid #9dba83;border-radius:9px;box-shadow:0 6px 24px #0009;cursor:pointer}
    #ghost-map-button:hover{background:#395c49}
    .ghost-map-backdrop{position:fixed;inset:0;z-index:8500;background:#050907c9;display:grid;
      place-items:center;padding:20px}
    .ghost-map-dialog{width:min(410px,100%);box-sizing:border-box;background:linear-gradient(#273b32,#151e1a);
      border:1px solid #b19d69;box-shadow:0 10px 50px #000;color:#eee1c2;border-radius:13px;padding:23px;
      font:15px Georgia,serif}
    .ghost-map-dialog h2{margin:0 0 12px;font:700 23px Georgia,serif;color:#e5ce91}
    .ghost-map-dialog p{line-height:1.5;color:#d6ceac}
    .ghost-map-dialog label{display:inline-flex;flex-direction:column;gap:5px;margin:4px 8px 12px 0}
    .ghost-map-dialog input{width:90px;padding:10px;background:#111a15;color:#fff;border:1px solid #74987b;
      border-radius:6px;font-size:16px}
    .ghost-map-dialog button{cursor:pointer;color:#f9e4ac;background:#344d39;border:1px solid #b09e6e;
      border-radius:7px;padding:11px 14px;margin-right:9px}
    .ghost-map-error{color:#ffaf9b!important;min-height:1.3em}
  `;
  document.head.append(css);
  function getCharacter() { try { return character || null; } catch { return null; } }
  function learned() {
    try { return characterAbilities.some(e => e.ability_id === 'passo_fantasma' || e.ability?.id === 'passo_fantasma'); }
    catch { return false; }
  }
  function getPos() {
    try { return {x: Number(playerX), y: Number(playerY)}; }
    catch { return {x: null,y: null}; }
  }
  function openDialog() {
    const c=getCharacter(); if (!c) return;
    const mov = Math.ceil(4 + Math.max(1,Math.min(30,Number(c.destrezza)||1))/2);
    const p=getPos();
    const bg=document.createElement('div'); bg.className='ghost-map-backdrop';
    bg.innerHTML=`<div class="ghost-map-dialog" role="dialog" aria-modal="true" aria-labelledby="ghost-title">
      <h2 id="ghost-title">PASSO FANTASMA</h2>
      <p>Teletrasportati su una casella percorribile, entro il tuo movimento e in linea di visuale. <strong>Costo: 3 PM.</strong></p>
      <p>Posizione attuale: ${Number.isFinite(p.x)?p.x:'?'} / ${Number.isFinite(p.y)?p.y:'?'} · MOV indicativo: ${mov}</p>
      <form><label>Colonna X<input name="x" type="number" min="0" step="1" required></label>
      <label>Riga Y<input name="y" type="number" min="0" step="1" required></label>
      <p class="ghost-map-error" role="status"></p>
      <button type="submit">TELETRASPORTATI</button><button type="button" class="ghost-cancel">ANNULLA</button></form></div>`;
    document.body.append(bg);
    const close=()=>bg.remove();
    bg.querySelector('.ghost-cancel').onclick=close;
    bg.addEventListener('click',e=>{if(e.target===bg)close();});
    bg.querySelector('form').addEventListener('submit',async e=>{
      e.preventDefault();
      const submit=bg.querySelector('button[type="submit"]'); submit.disabled=true;
      const message=bg.querySelector('.ghost-map-error'); message.textContent='';
      const x=Number(bg.querySelector('[name=x]').value), y=Number(bg.querySelector('[name=y]').value);
      try {
        const {error}=await db.rpc('cast_passo_fantasma_outside_combat', {
          p_character_id:c.id,p_x:x,p_y:y
        });
        if(error)throw error;
        close(); window.location.reload();
      }catch(err){message.textContent=err.message||String(err);submit.disabled=false;}
    });
    bg.querySelector('[name=x]').focus();
  }
  function syncButton() {
    const has=learned(), old=document.getElementById('ghost-map-button');
    if (!has) {if(old)old.remove();return;}
    if (old)return;
    const b=document.createElement('button');b.id='ghost-map-button';b.type='button';
    b.textContent='✦ PASSO FANTASMA (3 PM)';b.onclick=openDialog;document.body.append(b);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncButton);
  else syncButton();
  setInterval(syncButton,2500);
})();
