// Palazzo Eterno — Anziano Scagliagrigia: IA, missioni e Braci di Scintilla.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
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
  let braciBusy = false;
  async function loadBraci() {
    const label = $('capo-rare-status');
    const button = $('capo-braci-claim');
    const note = $('capo-braci-note');
    if (!label || !button) return;
    try {
      const { data, error } = await supabaseClient.rpc('scagliagrigia_braci_status');
      if (error) throw error;
      const current = Number(data?.level || 0);
      if (data?.claimed) {
        label.textContent = current > 0
          ? 'Braci ottenute in questo ciclo · Livello ' + current
          : 'Ricompensa riscattata in questo ciclo';
      } else if (data?.can_claim) {
        label.textContent = current >= 6 ? 'Livello massimo raggiunto' : 'Hai meritato le Braci di Scintilla!';
      } else {
        label.textContent = 'Mancano ' + Math.max(0,5-Number(data?.completed||0)) + ' missioni';
      }
      button.disabled = braciBusy || !data?.can_claim;
      button.hidden = !data?.can_claim;
      if (note) note.textContent = current
        ? 'Braci attuali: livello ' + current + '/6. Ogni nuova copia aumenta il livello di uno.'
        : 'La prima copia si ottiene completando tutte le cinque missioni della tribù.';
    } catch (e) {
      label.textContent = 'Impossibile leggere lo stato delle Braci.';
      button.disabled = true;
      if (note) note.textContent = e.message || 'Errore di connessione';
    }
  }
  function initBraci() {
    const label = $('capo-rare-status');
    if (!label || $('capo-braci-claim')) return;
    const milestone = label.closest('.quest-milestone') || label.parentElement;
    const heading = milestone.querySelector('span');
    if (heading) heading.textContent = 'Braci di Scintilla';
    const button = document.createElement('button');
    button.id = 'capo-braci-claim'; button.type = 'button';
    button.textContent = 'RITIRA BRACI DI SCINTILLA';
    button.disabled = true; button.hidden = true;
    button.style.cssText = 'margin:12px 0 6px;padding:10px 12px;background:#324e2e;color:#fff3d4;border:1px solid #b89f59;border-radius:4px;font-weight:700;cursor:pointer';
    const note = document.createElement('small');
    note.id = 'capo-braci-note'; note.style.cssText='display:block;margin-top:5px;line-height:1.5';
    milestone.append(button,note);
    button.addEventListener('click', async () => {
      if (braciBusy) return;
      braciBusy = true; button.disabled = true;
      note.textContent = 'Consegna in corso...';
      try {
        const {data,error} = await supabaseClient.rpc('scagliagrigia_braci_claim');
        if (error) throw error;
        note.textContent = data?.max_level
          ? 'Braci al livello massimo (6/6).'
          : data?.upgraded
            ? 'Braci potenziate! Nuovo livello: ' + data.level
            : 'Hai ricevuto le Braci di Scintilla, livello 1!';
        await loadProgress();
      } catch (e) {
        note.textContent = 'Consegna non riuscita: ' + (e.message || 'errore');
      } finally { braciBusy=false; await loadBraci(); }
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
      label.textContent = 'Progresso del ciclo attuale del Piano I.';
      await loadBraci();
    } catch (e) {
      if (label) label.textContent = 'Impossibile caricare il progresso: ' + (e.message || 'errore');
    }
  }
  function init() { initChat(); initBraci(); loadProgress(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
