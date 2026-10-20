// Chatbox locale e progresso missioni Scagliagrigia.
// Nessuna ricompensa viene assegnata da questa pagina finché non esiste l'RPC dedicata.
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  function initChat(){
    const form=$('capo-chat-form'),input=$('capo-chat-input'),log=$('capo-chat-log');
    if(!form||!input||!log)return;
    function append(kind,author,message){
      const row=document.createElement('p');row.className='capo-chat-msg '+(kind==='player'?'capo-chat-player':'capo-chat-npc');
      const strong=document.createElement('strong');strong.textContent=author;
      const span=document.createElement('span');span.textContent=message;
      row.append(strong,span);log.appendChild(row);log.scrollTop=log.scrollHeight;
    }
    form.addEventListener('submit',event=>{
      event.preventDefault();const value=input.value.trim();if(!value)return;
      append('player','TU',value);input.value='';
      const normalized=value.toLocaleLowerCase('it-IT');
      let reply='«Non ho parole da sprecare. Mostra il tuo valore alla tribù.»';
      if(/mietitore|therizinosaur|predatore|leggendari|uccid|abbatt/.test(normalized)){
        reply='«Il Mietitore Smeraldo vaga fra la Giungla Bassa e quella Alta. Persino i miei guerrieri lo evitano. Abbattetelo insieme: ogni guerriero presente alla sua caduta avrà dimostrato il proprio valore.»';
      }else if(/mission|prova|compit|fiduc/.test(normalized)){
        reply='«Dimostra di meritare il rispetto di Scagliagrigia. Anche la caduta del Mietitore Smeraldo sarà una delle cinque prove della tribù.»';
      }else if(/lasciapassare|ricompens|premio/.test(normalized)){
        reply='«Due prove per il lasciapassare. Cinque per una ricompensa rara. Non credere che bastino belle parole.»';
      }else if(/scintilla/.test(normalized)){
        reply='«Scintilla veglia sulla tribù. Ma neppure il suo nome tiene lontani gli artigli del Mietitore.»';
      }
      append('npc','ANZIANO',reply);input.focus();
    });
  }
  async function loadProgress(){
    const label=$('capo-quest-status');
    try{
      const client=typeof supabaseClient!=='undefined'?supabaseClient:null;
      if(!client)throw new Error('Connessione Supabase non disponibile.');
      const {data,error}=await client.rpc('scagliagrigia_quest_status');
      if(error)throw error;
      const count=Math.max(0,Number(data?.total_completed)||0);
      const capped=Math.min(5,count);
      $('capo-quest-count').textContent=capped+' / 5';
      $('capo-progress-fill').style.width=(capped*20)+'%';
      $('capo-progress').setAttribute('aria-valuenow',String(capped));
      $('capo-pass-status').textContent=count>=2?'Requisito raggiunto — consegna da attivare':'Mancano '+(2-count)+' missioni';
      $('capo-rare-status').textContent=count>=5?'Requisito raggiunto — premio da definire':'Mancano '+(5-count)+' missioni';
      label.textContent='Progresso del ciclo attuale del Piano I.';
    }catch(err){if(label)label.textContent='Impossibile caricare il progresso: '+(err.message||'errore');}
  }
  function init(){initChat();loadProgress();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
