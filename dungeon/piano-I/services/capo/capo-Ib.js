// Palazzo Eterno — Anziano Scagliagrigia: IA autenticata + missioni verificate server-side.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  function initChat() {
    const form = $('capo-chat-form'), input = $('capo-chat-input'), log = $('capo-chat-log');
    if (!form || !input || !log) return;
    let busy = false;
    const history = [];
    const send = form.querySelector('button[type="submit"]');
    function append(kind, author, message) {
      const row = document.createElement('p');
      row.className = 'capo-chat-msg ' + (kind === 'player' ? 'capo-chat-player' : 'capo-chat-npc');
      const strong = document.createElement('strong'); strong.textContent = author;
      const span = document.createElement('span'); span.textContent = message;
      row.append(strong, span); log.appendChild(row); log.scrollTop = log.scrollHeight;
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message || busy) return;
      busy = true; if (send) send.disabled = true;
      append('player', 'TU', message); input.value = '';
      try {
        if (typeof supabaseClient === 'undefined') throw Error('Connessione Supabase assente.');
        const { data, error } = await supabaseClient.functions.invoke('anziano-ai', {
          body: { message, history }
        });
        if (error) {
          const info = await error.context?.json?.().catch(() => null);
          throw Error(info?.error || data?.error || error.message || 'Errore nella conversazione.');
        }
        if (!data?.ok || !data?.reply) throw Error(data?.error || 'Nessuna risposta.');
        append('npc', 'ANZIANO', data.reply);
        history.push({ role: 'user', content: message }, { role: 'assistant', content: data.reply });
        if (history.length > 8) history.splice(0, history.length - 8);
      } catch (e) {
        append('npc', 'ANZIANO', e.message || 'Non posso parlarti ora.');
      } finally { busy = false; if (send) send.disabled = false; input.focus(); }
    });
  }
  async function loadProgress() {
    const label = $('capo-quest-status');
    try {
      if (typeof supabaseClient === 'undefined') throw Error('Connessione Supabase assente.');
      const { data, error } = await supabaseClient.rpc('scagliagrigia_quest_status');
      if (error) throw error;
      const count = Math.max(0, Number(data?.total_completed) || 0);
      const capped = Math.min(5, count);
      $('capo-quest-count').textContent = capped + ' / 5';
      $('capo-progress-fill').style.width = capped * 20 + '%';
      $('capo-progress').setAttribute('aria-valuenow', String(capped));
      $('capo-pass-status').textContent = count >= 2 ? 'Requisito raggiunto — consegna da attivare' : 'Mancano ' + (2-count) + ' missioni';
      $('capo-rare-status').textContent = count >= 5 ? 'Requisito raggiunto — premio da definire' : 'Mancano ' + (5-count) + ' missioni';
      label.textContent = 'Progresso del ciclo attuale del Piano I.';
    } catch (e) {
      if (label) label.textContent = 'Impossibile caricare il progresso: ' + (e.message || 'errore');
    }
  }
  function init() { initChat(); loadProgress(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
