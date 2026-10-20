(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  let busy = false;

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
      appendChatMessage('GUARDIANA', 'Bene. La covata non dimenticherà che hai riportato il piccolo sano e salvo.', 'npc');
      await update();
    } catch (e) {
      $('egg-progress').textContent = e.message || 'Impossibile consegnare l’uovo.';
    } finally {
      busy = false;
      await update();
    }
  }

  function handleChatSubmit(event) {
    event.preventDefault();
    const input = $('guardiana-chat-input');
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;
    appendChatMessage('TU', message, 'player');
    input.value = '';
    window.setTimeout(() => {
      appendChatMessage('GUARDIANA', 'La Guardiana inclina appena il capo, ma il suo sguardo resta vigile. Il suo dialogo completo sarà definito prossimamente.', 'npc');
    }, 250);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = $('egg-deliver');
    if (btn) btn.addEventListener('click', deliver);
    const form = $('guardiana-chat-form');
    if (form) form.addEventListener('submit', handleChatSubmit);
    update();
  });
})();
