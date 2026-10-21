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
    const status = $('arena-quest-status');
    if (status) status.textContent = '10 ONDATE · SFIDA INDIVIDUALE';
    const feedback = $('arena-feedback');
    if (feedback) feedback.textContent = 'Dieci ondate senza interruzioni. Nessuna fuga. La sconfitta causa la morte del personaggio.';
    $('arena-enter')?.addEventListener('click', async () => {
      const button = $('arena-enter');
      if (button.disabled) return;
      if (!window.confirm('ARENA SCAGLIAGRIGIA: 10 ondate, nessuna fuga e morte del PG in caso di sconfitta. Vuoi entrare?')) return;
      button.disabled = true;
      if (feedback) feedback.textContent = 'Preparazione della sfida...';
      try {
        if (typeof supabaseClient === 'undefined') throw new Error('Connessione al Palazzo non disponibile.');
        const { data: auth, error: authError } = await supabaseClient.auth.getUser();
        if (authError) throw authError;
        if (!auth?.user?.id) throw new Error('Devi effettuare l’accesso.');
        const { data: pg, error: pgError } = await supabaseClient
          .from('characters').select('id').eq('user_id', auth.user.id).maybeSingle();
        if (pgError) throw pgError;
        if (!pg?.id) throw new Error('Nessun personaggio disponibile.');
        const { data: combatId, error } = await supabaseClient.rpc(
          'scagliagrigia_arena_enter', { p_character_id: pg.id }
        );
        if (error) throw error;
        if (!combatId) throw new Error('La sessione non è stata creata.');
        window.location.href = '../../../../combat.html?combat_id=' + encodeURIComponent(combatId);
      } catch (error) {
        if (feedback) feedback.textContent = 'Non puoi entrare: ' + (error?.message || String(error));
        button.disabled = false;
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();