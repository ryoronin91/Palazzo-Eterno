// Evento delle guardie: sessione INDIVIDUALE, dialogo AI protetto lato server.
(()=>{'use strict';const $=id=>document.getElementById(id);const db=window.supabaseClient;
const id=new URLSearchParams(location.search).get('id');let active=true,busy=false,unlocked=false,accessToken=null;
db?.auth.getSession().then(({data})=>{accessToken=data.session?.access_token||null;}).catch(()=>{});
const feedback=(msg)=>{$('feedback').textContent=msg;};
function bubble(who,message){const el=document.createElement('div');el.className='bubble '+who;el.textContent=message;$('messages').appendChild(el);$('messages').scrollTop=$('messages').scrollHeight;}
async function rpc(name,args){const {data,error}=await db.rpc(name,args);if(error)throw error;return data;}
function setBusy(v){busy=v;$('send').disabled=v;$('pass').disabled=v;$('food').disabled=v;$('attack').disabled=v;}
async function refresh(){const state=await rpc('ia2ib_state',{p_id:id});unlocked=!!state.food_unlocked;$('food').hidden=!unlocked;
$('messages').replaceChildren();bubble('npc','«Alt! Nessuno attraversa senza il nostro consenso.»');for(const h of state.history||[]){bubble('player',h.question);bubble('npc',h.answer)}
$('status').textContent='Sessione personale · Guardie in ascolto';
}
async function close(){if(!active)return;active=false;try{await rpc('ia2ib_close',{p_id:id});}catch(e){console.warn('Chiusura sessione:',e);}}
$('exit').addEventListener('click',async e=>{e.preventDefault();await close();location.href='piano-Ia.html';});
$('talk').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const msg=$('message').value.trim();if(msg.length<2)return;setBusy(true);feedback('Le guardie stanno rispondendo...');try{
const {data,error}=await db.functions.invoke('guardie-ia2ib',{body:{session_id:id,message:msg}});if(error)throw error;if(data?.error)throw Error(data.error);
bubble('player',msg);bubble('npc',data.reply);unlocked=!!data.food_unlocked;$('food').hidden=!unlocked;$('message').value='';feedback(unlocked?'Hai scoperto cosa desiderano le guardie. Puoi consegnare il Lautopasto.':'');
}catch(err){feedback('Dialogo non riuscito: '+(err.message||err));}finally{setBusy(false);}});
async function pass(method){if(busy)return;setBusy(true);try{const data=await rpc('ia2ib_pass',{p_id:id,p_method:method});if(!data.passed)throw Error('Passaggio negato');active=false;location.assign('piano-Ib.html');}catch(err){feedback(err.message||'Le guardie ti impediscono il passaggio');setBusy(false);}}
$('food').addEventListener('click',()=>pass('food'));$('pass').addEventListener('click',()=>pass('pass'));
$('attack').addEventListener('click',async()=>{
  if(busy)return;
  setBusy(true);
  feedback('Le guardie estraggono le armi. Preparazione del combattimento…');
  try {
    const combatId=await rpc('ia2ib_attack',{p_id:id});
    if(!combatId)throw Error('Sessione di combattimento non disponibile');
    active=false; // Non eliminare l'istanza: serve a riconoscere la vittoria.
    location.assign('../../combat.html?combat_id='+encodeURIComponent(combatId));
  }catch(err){feedback('Impossibile iniziare lo scontro: '+(err.message||err));setBusy(false);}
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