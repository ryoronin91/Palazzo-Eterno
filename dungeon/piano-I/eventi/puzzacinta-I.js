// Puzzacinta — Piano I. Dialogo globale: cinque domande, anche vaghe o fuori tema.
// L'IA del Piano I è separata da quella del Dungeon.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const HOME = '../piano-Id.html';
  const OPENING = 'Il Piano sta per chiudersi! Puzzacinta non può restare intrappolato qui!';
  const FAREWELL = 'Il tempo di Puzzacinta è scaduto! Puzzacinta deve andare. Tieni, piccolo souvenir!';
  let music = null;
  let refreshTimer = null;
  let sending = false;
  let collecting = false;
  let authorized = false;
  let lastStatus = null;

  function notice(value) { $('rare-notice').textContent = value || ''; }
  function bubble(name, content, kind) {
    const node = document.createElement('div');
    node.className = `bubble ${kind}`;
    const title = document.createElement('strong');
    title.textContent = name;
    const text = document.createElement('p');
    text.textContent = content;
    node.append(title, text);
    $('rare-messages').appendChild(node);
  }

  function render(data) {
    if (!data) return;
    lastStatus = data;
    const answered = Math.max(0, Math.min(5, Number(data.answered ?? 0)));
    const remaining = 5 - answered;
    $('rare-remaining').textContent = String(remaining);
    [...$('rare-pips').children].forEach((el, i) => el.classList.toggle('remaining', i < remaining));
    $('rare-status').textContent = remaining > 0
      ? 'Cinque domande condivise fra tutti gli avventurieri. Anche domande vaghe o fuori tema consumano una risposta.'
      : 'Le cinque risposte sono finite. Puzzacinta se ne è andato.';
    const log = $('rare-messages');
    log.replaceChildren();
    bubble('PUZZACINTA', OPENING, 'npc');
    for (const q of data.questions || []) {
      bubble((q.character || 'Avventuriero') + ' · DOMANDA ' + q.number, q.question || '', 'player');
      bubble('PUZZACINTA', q.answer || '', 'npc');
    }
    if (remaining === 0) bubble('PUZZACINTA', FAREWELL, 'npc');
    const canAsk = authorized && remaining > 0 && !sending && !collecting;
    $('rare-question').disabled = !canAsk;
    $('rare-send').disabled = !canAsk;
    const ready = remaining === 0 && data.ready_to_collect === true;
    $('id-puzzacinta-reward').hidden = !ready;
    $('id-puzzacinta-collect').disabled = !ready || collecting;
    log.scrollTop = log.scrollHeight;
  }

  async function refresh({silent = false} = {}) {
    try {
      const {data, error} = await supabaseClient.rpc('piano_id_puzzacinta_status');
      if (error) throw error;
      render(data || {});
      return data;
    } catch (error) {
      console.warn('Stato Puzzacinta:', error);
      if (!silent) notice('Impossibile leggere le risposte di Puzzacinta: ' + (error.message || 'Errore'));
      return null;
    }
  }

  async function ask(event) {
    event.preventDefault();
    if (sending || !authorized || !lastStatus || Number(lastStatus.answered) >= 5) return;
    const question = $('rare-question').value.trim();
    if (question.length < 2 || question.length > 500) { notice('Scrivi una domanda da 2 a 500 caratteri.'); return; }
    sending = true;
    render(lastStatus);
    notice('Puzzacinta sta pensando…');
    try {
      const {data, error} = await supabaseClient.functions.invoke('puzzacinta-piano-i-ai', {
        body: {request_id: crypto.randomUUID(), message: question}
      });
      if (error) throw new Error(data?.error || error.message);
      if (!data?.ok) throw new Error(data?.error || 'La domanda non è stata accettata.');
      $('rare-question').value = '';
      await refresh({silent: true});
      notice(data.finished ? 'Puzzacinta ha lasciato un frammento: RACCOGLI!' : 'Puzzacinta ha risposto.');
    } catch (error) {
      console.error('Puzzacinta Piano I:', error);
      notice(error.message || 'Puzzacinta non riesce a rispondere.');
      await refresh({silent: true});
    } finally {
      sending = false;
      if (lastStatus) render(lastStatus);
    }
  }

  async function collect() {
    if (collecting || !lastStatus?.ready_to_collect) return;
    collecting = true;
    render(lastStatus);
    notice('Raccolta del terzo pezzo di mosaico…');
    try {
      const {data,error} = await supabaseClient.rpc('piano_id_collect_mosaic_piece3');
      if (error) throw error;
      if (!data?.collected) throw new Error('Il frammento non è stato raccolto.');
      notice('Hai raccolto il Pezzo di mosaico 3!');
      await refresh({silent:true});
    } catch (error) {
      notice(error.message || 'Il frammento non può essere raccolto.');
      await refresh({silent:true});
    } finally {
      collecting = false;
      if (lastStatus) render(lastStatus);
    }
  }

  function setupVolume() {
    let volume = .35;
    try {
      const stored = localStorage.getItem('palazzo-eterno-dungeon-volume');
      if (stored !== null && Number.isFinite(Number(stored))) volume = Math.min(1, Math.max(0, Number(stored)));
    } catch (_) {}
    music = new Audio('../../../music/puzzacinta.mp3');
    music.loop = true;
    const paint = () => {
      music.volume = volume;
      $('rare-volume-slider').value = String(Math.round(volume * 100));
      $('rare-volume-label').textContent = Math.round(volume * 100) + '%';
      $('rare-volume').textContent = volume === 0 ? '🔇' : volume < .5 ? '🔉' : '🔊';
    };
    paint();
    $('rare-volume').addEventListener('click', () => {
      const panel = $('rare-volume-controls');
      panel.hidden = !panel.hidden;
      if (!panel.hidden) music.play().catch(() => {});
    });
    $('rare-volume-slider').addEventListener('input', event => {
      volume = Number(event.target.value) / 100;
      paint();
      try { localStorage.setItem('palazzo-eterno-dungeon-volume', String(volume)); } catch (_) {}
    });
    music.play().catch(() => {});
    document.addEventListener('pointerdown', () => music.play().catch(() => {}), {once:true});
  }

  document.addEventListener('DOMContentLoaded', async () => {
    $('rare-question-form').addEventListener('submit', ask);
    $('id-puzzacinta-collect').addEventListener('click', collect);
    setupVolume();
    const {data:identity} = await supabaseClient.auth.getUser();
    if (!identity?.user) { window.location.replace('../../../login.html'); return; }
    const {data:character,error} = await supabaseClient.from('characters')
      .select('current_location,active_combat_id').eq('user_id',identity.user.id).maybeSingle();
    if (error || !character || character.current_location !== 'dungeon_Id') {
      window.location.replace(HOME); return;
    }
    if (character.active_combat_id) {
      window.location.replace('../../../combat.html?combat_id=' + encodeURIComponent(character.active_combat_id)); return;
    }
    authorized = true;
    await refresh();
    refreshTimer = setInterval(() => { if (!sending && !collecting) refresh({silent:true}); }, 4000);
  });
  window.addEventListener('beforeunload', () => {
    if (refreshTimer) clearInterval(refreshTimer);
    if (music) music.pause();
  });
})();
