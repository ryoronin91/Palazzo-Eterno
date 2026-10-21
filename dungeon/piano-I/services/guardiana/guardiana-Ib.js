(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  let busy = false;
  const chatHistory = [];

  function appendChatMessage(author, text, type) {
    const log = $('guardiana-chat-log');
    if (!log) return;
    const row = document.createElement('p');
    row.className = 'guardian-chat-msg ' + (type === 'player' ? 'guardian-chat-player' : 'guardian-chat-npc');
    const strong = document.createElement('strong');
    strong.textContent = author;
    const span = document.createElement('span');
    span.textContent = text;
    row.append(strong, span);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  async function update() {
    const progress = $('egg-progress');
    const button = $('egg-deliver');
    try {
      const client = (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
      if (!client) throw Error('Connessione Supabase non disponibile');
      const { data, error } = await client.rpc('scagliagrigia_egg_status');
      if (error) throw error;
      const completed = !!data?.completed;
      const hasEgg = !!data?.has_egg;
      button.disabled = completed || !hasEgg || busy;
      button.textContent = completed ? 'MISSIONE COMPLETATA' : 'CONSEGNA UOVO';
      progress.textContent = completed
        ? 'Hai già riportato l’uovo durante questo ciclo. La covata è al sicuro.'
        : hasEgg
          ? 'Possiedi l’Uovo di lucertoloide: puoi consegnarlo.'
          : 'Non possiedi ancora l’Uovo di lucertoloide.';
      $('tribe-progress').textContent = 'Missioni della tribù completate: ' + (Number(data?.total_completed) || 0) + ' / 5';
    } catch (e) {
      progress.textContent = 'Impossibile verificare la missione: ' + (e.message || e);
      button.disabled = true;
    }
  }

  async function deliver() {
    if (busy) return;
    busy = true;
    const button = $('egg-deliver');
    button.disabled = true;
    try {
      const client = (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
      const { error } = await client.rpc('scagliagrigia_return_egg');
      if (error) throw error;
      appendChatMessage('GUARDIANA', 'L’uovo è tornato. Bene. Non aspettarti altro da me.', 'npc');
      await update();
    } catch (e) {
      $('egg-progress').textContent = e.message || 'Impossibile consegnare l’uovo.';
    } finally {
      busy = false;
      await update();
    }
  }

  async function handleChatSubmit(event) {
    event.preventDefault();
    const input = $('guardiana-chat-input');
    const button = $('guardiana-chat-submit');
    if (!input || busy) return;
    const message = input.value.trim();
    if (!message) return;
    busy = true;
    if (button) button.disabled = true;
    appendChatMessage('TU', message, 'player');
    input.value = '';
    try {
      const client = (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
      if (!client) throw Error('Connessione Supabase non disponibile');
      const {data,error} = await client.functions.invoke('vendor-ai', {
        body: {npc_id:'npc_guardiana_scagliagrigia',message,history:chatHistory}
      });
      if (error) {
        const details = await error.context?.json?.().catch(() => null);
        throw Error(details?.error || data?.error || error.message || 'La Guardiana non risponde.');
      }
      if (!data?.ok || !data.reply) throw Error(data?.error || 'La Guardiana non risponde.');
      appendChatMessage('GUARDIANA', data.reply, 'npc');
      chatHistory.push({role:'user',content:message},{role:'assistant',content:data.reply});
      if (chatHistory.length > 10) chatHistory.splice(0,chatHistory.length-10);
    } catch(e) {
      appendChatMessage('GUARDIANA', e?.message || 'Ora non posso parlarti.', 'npc');
    } finally {
      busy = false;
      if (button) button.disabled = false;
      input.focus();
      await update();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = $('egg-deliver');
    if (btn) btn.addEventListener('click', deliver);
    const form = $('guardiana-chat-form');
    if (form) form.addEventListener('submit', handleChatSubmit);
    update();
  });
})();
