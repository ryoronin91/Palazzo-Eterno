// Palazzo Eterno — Campione Scagliagrigia
// File completo da rinominare campione-Ib.js
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const history = [];
  let busy = false;

  function append(kind, label, message) {
    const log = $('campione-chat-log');
    if (!log) return;
    const p = document.createElement('p');
    p.className = 'campione-chat-msg ' + (kind === 'player' ? 'campione-chat-player' : 'campione-chat-npc');
    const s = document.createElement('strong');
    s.textContent = label;
    const m = document.createElement('span');
    m.textContent = message;
    p.append(s, m);
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function initChat() {
    const form = $('campione-chat-form');
    const input = $('campione-chat-input');
    const button = form?.querySelector('button[type="submit"]');
    if (!form || !input || !button) return;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const message = input.value.trim().slice(0, 500);
      if (!message || busy) return;
      busy = true;
      button.disabled = true;
      input.disabled = true;
      input.value = '';
      append('player', 'TU', message);
      try {
        if (typeof supabaseClient === 'undefined') throw new Error('Connessione al Palazzo non disponibile.');
        const { data, error } = await supabaseClient.functions.invoke('campione-ai', {
          body: { message, history }
        });
        if (error) {
          let detail = data?.error || error.message || 'Servizio temporaneamente non disponibile.';
          if (error.context && typeof error.context.json === 'function') {
            try { const response = await error.context.json(); detail = response?.error || detail; } catch (_) { /* keep original */ }
          }
          throw new Error(detail);
        }
        if (!data?.ok || !data.reply) throw new Error(data?.error || 'Nessuna risposta.');
        append('npc', 'CAMPIONE', data.reply);
        history.push({ role: 'user', content: message }, { role: 'assistant', content: data.reply });
        if (history.length > 8) history.splice(0, history.length - 8);
      } catch (error) {
        append('npc', 'CAMPIONE', error?.message || 'Non posso parlare ora.');
      } finally {
        busy = false;
        button.disabled = false;
        input.disabled = false;
        input.focus();
      }
    });
  }

  async function loadProgress() {
    const label = $('campione-progress-status');
    try {
      if (typeof supabaseClient === 'undefined') throw new Error('Connessione Supabase non disponibile');
      const { data, error } = await supabaseClient.rpc('scagliagrigia_quest_status');
      if (error) throw error;
      const count = Math.max(0, Math.min(5, Number(data?.total_completed) || 0));
      $('campione-quest-count').textContent = count + ' / 5';
      $('campione-quest-fill').style.width = count * 20 + '%';
      $('campione-quest-progress').setAttribute('aria-valuenow', String(count));
      label.textContent = 'Progresso delle missioni nel ciclo corrente del Piano I.';
    } catch (e) {
      if (label) label.textContent = 'Impossibile caricare il progresso: ' + (e.message || e);
    }
  }

  function init() {
    initChat();
    loadProgress();
    $('arena-enter')?.addEventListener('click', () => {
      $('arena-feedback').textContent = 'L’arena non è ancora disponibile. La sfida delle 10 ondate sarà collegata quando il combattimento sarà pronto.';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
