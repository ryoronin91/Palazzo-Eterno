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

  function ensureArenaModalStyles() {
    if (document.getElementById('arena-confirm-modal-style')) return;
    const style = document.createElement('style');
    style.id = 'arena-confirm-modal-style';
    style.textContent = `
      .arena-confirm-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(10, 7, 4, 0.82);
        backdrop-filter: blur(3px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        z-index: 5000;
      }
      .arena-confirm-dialog {
        width: min(560px, 100%);
        border: 2px solid rgba(180, 142, 82, 0.95);
        background:
          linear-gradient(180deg, rgba(39, 28, 18, 0.98), rgba(20, 14, 9, 0.98));
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.06);
        border-radius: 18px;
        padding: 22px 22px 18px;
        color: #f3e6c8;
        font-family: inherit;
      }
      .arena-confirm-kicker {
        margin: 0 0 6px;
        font-size: 0.78rem;
        letter-spacing: 0.18em;
        color: #d3b074;
        text-transform: uppercase;
      }
      .arena-confirm-title {
        margin: 0 0 12px;
        font-size: 1.45rem;
        line-height: 1.15;
        color: #fff2d1;
      }
      .arena-confirm-text {
        margin: 0 0 14px;
        color: rgba(243, 230, 200, 0.92);
        line-height: 1.55;
      }
      .arena-confirm-rules {
        margin: 0 0 18px;
        padding: 14px 16px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(180, 142, 82, 0.24);
      }
      .arena-confirm-rules ul {
        margin: 0;
        padding-left: 1.15rem;
      }
      .arena-confirm-rules li {
        margin: 0 0 8px;
        line-height: 1.45;
      }
      .arena-confirm-rules li:last-child { margin-bottom: 0; }
      .arena-confirm-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      .arena-confirm-btn {
        border: 1px solid rgba(180, 142, 82, 0.7);
        border-radius: 999px;
        padding: 10px 18px;
        font: inherit;
        font-weight: 700;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: transform .15s ease, filter .15s ease, background .15s ease;
      }
      .arena-confirm-btn:hover,
      .arena-confirm-btn:focus-visible {
        transform: translateY(-1px);
        filter: brightness(1.05);
      }
      .arena-confirm-btn-cancel {
        background: rgba(255,255,255,0.04);
        color: #f3e6c8;
      }
      .arena-confirm-btn-confirm {
        background: linear-gradient(180deg, #d7a856, #9f6d21);
        color: #1a1208;
        border-color: rgba(231, 194, 128, 0.95);
      }
    `;
    document.head.appendChild(style);
  }

  function showArenaConfirm() {
    ensureArenaModalStyles();
    return new Promise(resolve => {
      const backdrop = document.createElement('div');
      backdrop.className = 'arena-confirm-backdrop';
      backdrop.innerHTML = `
        <div class="arena-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="arena-confirm-title">
          <p class="arena-confirm-kicker">ARENA SCAGLIAGRIGIA</p>
          <h3 class="arena-confirm-title" id="arena-confirm-title">Entrare nell'arena?</h3>
          <p class="arena-confirm-text">Il Campione ti offre una prova degna della tribù. Varcata la soglia, resterai solo contro dieci ondate consecutive di nemici.</p>
          <div class="arena-confirm-rules">
            <ul>
              <li><strong>Solo un personaggio</strong> può affrontare la sfida.</li>
              <li><strong>Nessuna fuga, nessuna pausa:</strong> le ondate si susseguono senza interruzione.</li>
              <li><strong>PF e PM</strong> non vengono ripristinati tra un'ondata e l'altra.</li>
              <li><strong>La sconfitta causa la morte</strong> del personaggio.</li>
            </ul>
          </div>
          <div class="arena-confirm-actions">
            <button type="button" class="arena-confirm-btn arena-confirm-btn-cancel" data-action="cancel">TORNA INDIETRO</button>
            <button type="button" class="arena-confirm-btn arena-confirm-btn-confirm" data-action="confirm">⚔ ENTRA NELL'ARENA</button>
          </div>
        </div>`;
      const close = decision => {
        document.removeEventListener('keydown', onKeydown);
        backdrop.remove();
        resolve(decision);
      };
      const onKeydown = event => {
        if (event.key === 'Escape') close(false);
      };
      backdrop.addEventListener('click', event => {
        const action = event.target?.getAttribute?.('data-action');
        if (action === 'confirm') close(true);
        else if (action === 'cancel' || event.target === backdrop) close(false);
      });
      document.addEventListener('keydown', onKeydown);
      document.body.appendChild(backdrop);
      backdrop.querySelector('[data-action="confirm"]')?.focus();
    });
  }

    $('arena-enter')?.addEventListener('click', async () => {
      const button = $('arena-enter');
      if (button.disabled) return;
      const confirmed = await showArenaConfirm();
      if (!confirmed) return;
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