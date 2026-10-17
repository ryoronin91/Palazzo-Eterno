// Evento delle guardie: sessione INDIVIDUALE, dialogo AI protetto lato server.
(()=>{'use strict';const $=id=>document.getElementById(id);const db=typeof supabaseClient !== "undefined" ? supabaseClient : null;
const id=new URLSearchParams(location.search).get('id');let active=true,busy=false,unlocked=false,accessToken=null;
db?.auth.getSession().then(({data})=>{accessToken=data.session?.access_token||null;}).catch(()=>{});
const feedback=(msg)=>{$('feedback').textContent=msg;};
function bubble(who,message){
 const el=document.createElement('div');el.className='bubble '+who;
 let text=String(message??'');
 if(who==='npc'){
   // Separa il brontolio dalla battuta precedente, anche nelle risposte salvate.
   text=text.replace(/\s*(\*?GRR{3,}[A-ZROOWL!]*\*?\s*\(Il suo stomaco brontola rumorosamente\.\))/gi,'\n\n$1');
 }
 el.textContent=text;$('messages').appendChild(el);$('messages').scrollTop=$('messages').scrollHeight;
}
async function rpc(name,args){const {data,error}=await db.rpc(name,args);if(error)throw error;return data;}
function setBusy(v){busy=v;$('send').disabled=v;$('pass').disabled=v;$('food').disabled=v;$('attack').disabled=v;}
const SCENE_IMAGES={initial:'immagini/gateA.png',food:'immagini/gateB.png',attack:'immagini/gateC.png'};
function showScene(scene){const portrait=$('guard-portrait');if(portrait)portrait.style.backgroundImage=`url('${SCENE_IMAGES[scene]}')`;}
const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
async function refresh(){const state=await rpc('ia2ib_state',{p_id:id});unlocked=!!state.food_unlocked;$('food').hidden=!unlocked;
$('messages').replaceChildren();bubble('npc','«Alt! Nessuno attraversa senza il nostro consenso.»');for(const h of state.history||[]){bubble('player',h.question);bubble('npc',h.answer)}
$('status').textContent='Sessione personale · Guardie in ascolto';
}
async function close(){if(!active)return;active=false;try{await rpc('ia2ib_close',{p_id:id});}catch(e){console.warn('Chiusura sessione:',e);}}
$('exit').addEventListener('click',async e=>{e.preventDefault();if(busy)return;await close();location.href='piano-Ia.html';});
$('talk').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const msg=$('message').value.trim();if(msg.length<2)return;setBusy(true);feedback('Le guardie stanno rispondendo...');try{
const {data,error}=await db.functions.invoke('guardie-ia2ib',{body:{session_id:id,message:msg}});if(error)throw error;if(data?.error)throw Error(data.error);
bubble('player',msg);bubble('npc',data.reply);unlocked=!!data.food_unlocked;$('food').hidden=!unlocked;$('message').value='';feedback(unlocked?'Hai scoperto cosa desiderano le guardie. Puoi consegnare il Lautopasto.':'');
}catch(err){feedback('Dialogo non riuscito: '+(err.message||err));}finally{setBusy(false);}});
async function pass(method){if(busy)return;setBusy(true);
const givingFood=method==='food';
if(givingFood){showScene('food');bubble('npc','Puoi passare, ma solo questa volta eh!');}
feedback(givingFood?'Le guardie accettano il Lautopasto…':'Le guardie controllano il lasciapassare…');
try{const data=await rpc('ia2ib_pass',{p_id:id,p_method:method});if(!data.passed)throw Error('Passaggio negato');
if(givingFood)await wait(5000);
active=false;location.assign('piano-Ib.html');
}catch(err){feedback(err.message||'Le guardie ti impediscono il passaggio');if(givingFood){showScene('initial');bubble('npc','Il passaggio è ancora sbarrato.');}setBusy(false);}}
$('food').addEventListener('click',()=>pass('food'));$('pass').addEventListener('click',()=>pass('pass'));
$('attack').addEventListener('click',async()=>{
  if(busy)return;
  setBusy(true);
  showScene('attack');
  bubble('npc','Allora ti faremo a pezzi!!');
  feedback('Le guardie estraggono le armi. Preparazione del combattimento…');
  try {
    const combatId=await rpc('ia2ib_attack',{p_id:id});
    if(!combatId)throw Error('Sessione di combattimento non disponibile');
    await wait(5000);
    active=false; // Non eliminare l'istanza: serve a riconoscere la vittoria.
    location.assign('../../combat.html?combat_id='+encodeURIComponent(combatId));
  }catch(err){feedback('Impossibile iniziare lo scontro: '+(err.message||err));showScene('initial');setBusy(false);}
});
if(!id||!db){feedback('Sessione non valida. Torna al Piano I-A.');setBusy(true);return;}
refresh().catch(e=>{feedback('Sessione scaduta o non valida: '+e.message);setBusy(true);});
window.addEventListener('pagehide',()=>{
 if(!active || !accessToken)return;
 // Best effort: non bloccare l'uscita del browser; il server invalida le sessioni scadute.
 fetch(db.supabaseUrl+'/rest/v1/rpc/ia2ib_close',{
  method:'POST',keepalive:true,
  headers:{'Content-Type':'application/json','apikey':db.supabaseKey,'Authorization':'Bearer '+accessToken},
  body:JSON.stringify({p_id:id})
 }).catch(()=>{});
});
})();
