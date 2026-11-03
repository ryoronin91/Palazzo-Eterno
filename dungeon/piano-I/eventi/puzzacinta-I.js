// Puzzacinta — Piano I: SOLO visualizzazione.
// Non chiama l'IA e non registra domande o ricompense in questa fase.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const HOME = '../piano-Id.html';
  let music;
  let refreshTimer;

  function bubble(name, text, kind) {
    const node = document.createElement('div');
    node.className = `bubble ${kind}`;
    const title = document.createElement('strong');
    title.textContent = name;
    const p = document.createElement('p');
    p.textContent = text;
    node.append(title, p);
    $('rare-messages').appendChild(node);
  }

  function render(data) {
    const answered = Math.max(0, Math.min(5, Number(data?.answered ?? 0)));
    const remaining = 5 - answered;
    $('rare-remaining').textContent = String(remaining);
    [...$('rare-pips').children].forEach((el, i) => el.classList.toggle('remaining', i < remaining));
    $('rare-status').textContent = remaining > 0
      ? 'Cinque risposte condivise tra gli avventurieri, tutte sul Piano I.'
      : 'Le cinque risposte sono terminate. Puzzacinta è scomparso.';
    const log = $('rare-messages');
    log.replaceChildren();
    bubble('PUZZACINTA', 'Ah, il Tempio! Dicono che qui ogni domanda faccia più rumore di un passo… Avanti, vediamo che cosa sai chiedere!', 'npc');
    for (const q of data?.questions || []) {
      bubble((q.character || 'Avventuriero') + ' · DOMANDA ' + q.number, q.question || '', 'player');
      bubble('PUZZACINTA', q.answer || '', 'npc');
    }
    $('id-puzzacinta-reward').hidden = remaining !== 0 || !data?.ready_to_collect;
    log.scrollTop = log.scrollHeight;
  }

  async function refresh() {
    try {
      const {data, error} = await supabaseClient.rpc('piano_id_puzzacinta_status');
      if (error) throw error;
      render(data || {});
    } catch (error) {
      console.warn('Stato grafico Puzzacinta:', error);
      $('rare-notice').textContent = 'Anteprima grafica: dialogo IA non ancora attivo.';
    }
  }

  function setupVolume() {
    let volume = 0.35;
    try {
      const saved = Number(localStorage.getItem('palazzo-eterno-dungeon-volume'));
      if (Number.isFinite(saved)) volume = Math.max(0, Math.min(1, saved));
    } catch (_) {}
    music = new Audio('../../../music/puzzacinta.mp3');
    music.loop = true;
    const paint = () => {
      if (music) music.volume = volume;
      $('rare-volume-slider').value = String(Math.round(volume * 100));
      $('rare-volume-label').textContent = Math.round(volume * 100) + '%';
      $('rare-volume').textContent = volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊';
    };
    paint();
    $('rare-volume').onclick = () => {
      const panel = $('rare-volume-controls');
      panel.hidden = !panel.hidden;
    };
    $('rare-volume-slider').oninput = e => {
      volume = Number(e.target.value) / 100;
      paint();
      try { localStorage.setItem('palazzo-eterno-dungeon-volume', String(volume)); } catch (_) {}
    };
    document.addEventListener('pointerdown', () => music?.play().catch(() => {}), {once:true});
  }

  document.addEventListener('DOMContentLoaded', async () => {
    $('rare-question-form').onsubmit = e => e.preventDefault();
    setupVolume();
    const {data:identity} = await supabaseClient.auth.getUser();
    if (!identity?.user) {window.location.replace('../../../login.html'); return;}
    const {data:character,error} = await supabaseClient.from('characters')
      .select('current_location,active_combat_id').eq('user_id',identity.user.id).maybeSingle();
    if (error || !character || character.current_location !== 'dungeon_Id') {
      window.location.replace(HOME); return;
    }
    if (character.active_combat_id) {
      window.location.replace('../../../combat.html?combat_id='+encodeURIComponent(character.active_combat_id));
      return;
    }
    await refresh();
    refreshTimer = setInterval(refresh,12000);
  });
  window.addEventListener('beforeunload',()=>{
    if (refreshTimer) clearInterval(refreshTimer);
    if (music) music.pause();
  });
})();
