/* Palazzo Eterno: Invisibilita e Passo Fantasma (combat UI). */
(function () {
  'use strict';
  const previousHandler = window.handleAbilityButton;
  let awaitingDestination = false;
  let busy = false;

  function announce(msg) {
    if (typeof addCombatLog === 'function') addCombatLog(msg);
    else console.info(msg);
  }
  function actionReady() {
    const player = typeof getMyPlayerEntity === 'function' ? getMyPlayerEntity() : null;
    if (!player || !currentCharacter || typeof isMyTurn !== 'function' || !isMyTurn() || player.action_used) {
      announce('Non puoi usare questa abilità adesso.');
      return false;
    }
    return true;
  }
  async function refresh() {
    if (typeof cancelCombatTargeting === 'function') cancelCombatTargeting();
    await Promise.all([loadCombatEntities(), loadCombatEffects()]);
    if (typeof loadCharacterInventory === 'function') await loadCharacterInventory();
    if (typeof createCombatSnapshot === 'function') lastCombatEntitiesSnapshot = createCombatSnapshot();
    if (typeof createCombatEffectsSnapshot === 'function') lastCombatEffectsSnapshot = createCombatEffectsSnapshot();
    if (typeof renderCombat === 'function') renderCombat();
    if (typeof updateCombatTurnUI === 'function') await updateCombatTurnUI();
  }
  async function castInvisibility() {
    if (busy || !actionReady()) return;
    busy = true;
    try {
      const { data, error } = await db.rpc('cast_combat_invisibilita', {
        p_combat_id: combatId,
        p_character_id: currentCharacter.id
      });
      if (error) throw error;
      await refresh();
      if (typeof addSharedCombatLog === 'function')
        addSharedCombatLog(`${currentCharacter.nome || 'Il personaggio'} diventa invisibile (${data.remaining_turns} turni)!`);
    } catch (err) {
      console.error('Invisibilità:', err);
      announce('Invisibilità: ' + (err.message || String(err)));
    } finally { busy = false; }
  }
  function startGhostStep() {
    if (busy || !actionReady()) return;
    awaitingDestination = true;
    if (typeof closeCombatDrawer === 'function') closeCombatDrawer();
    announce('PASSO FANTASMA: clicca una casella libera e visibile entro il tuo MOV. ESC annulla.');
    document.getElementById('combat-map')?.classList.add('mietitore-ghost-targeting');
  }
  function endGhostStep() {
    awaitingDestination = false;
    document.getElementById('combat-map')?.classList.remove('mietitore-ghost-targeting');
  }
  async function castGhostStep(x, y) {
    if (busy) return;
    busy = true;
    endGhostStep();
    try {
      const { error } = await db.rpc('cast_combat_passo_fantasma', {
        p_combat_id: combatId,
        p_character_id: currentCharacter.id,
        p_x: x,
        p_y: y
      });
      if (error) throw error;
      await refresh();
      if (typeof addSharedCombatLog === 'function')
        addSharedCombatLog(`${currentCharacter.nome || 'Il personaggio'} utilizza Passo Fantasma!`);
    } catch (err) {
      console.error('Passo Fantasma:', err);
      announce('Passo Fantasma: ' + (err.message || String(err)));
    } finally { busy = false; }
  }
  window.handleAbilityButton = function (entry) {
    const id = entry?.ability?.id || entry?.ability_id;
    if (id === 'invisibilita') { castInvisibility(); return; }
    if (id === 'passo_fantasma') { startGhostStep(); return; }
    return previousHandler?.apply(this, arguments);
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && awaitingDestination) { endGhostStep(); announce('Passo Fantasma annullato.'); }
  });
  function bindMap() {
    const map = document.getElementById('combat-map');
    if (!map || map.dataset.mietitoreAbilityBound) return;
    map.dataset.mietitoreAbilityBound = '1';
    map.addEventListener('click', event => {
      if (!awaitingDestination) return;
      event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
      const p = typeof getCombatGridCoordinatesFromPointer === 'function'
        ? getCombatGridCoordinatesFromPointer(event.clientX, event.clientY) : null;
      if (p) castGhostStep(p.x, p.y);
      else announce('Seleziona una casella valida.');
    }, true);
  }
  const priorRenderTokens = window.renderCombatTokens;
  if (typeof priorRenderTokens === 'function') {
    window.renderCombatTokens = function () {
      priorRenderTokens.apply(this, arguments);
      if (!(combatEntities instanceof Map) || !Array.isArray(combatEffects)) return;
      const hidden = new Set(combatEffects.filter(e => e.effect_type === 'invisibilita' && Number(e.remaining_rounds) > 0)
        .map(e => e.target_entity_id));
      combatEntities.forEach(entity => {
        const token = combatTokens?.get(entity.id);
        if (!token) return;
        const invisible = hidden.has(entity.id);
        const mine = entity.character_id && currentCharacter && entity.character_id === currentCharacter.id;
        token.style.visibility = invisible && !mine ? 'hidden' : '';
        if (invisible && mine) token.style.opacity = '0.45';
      });
    };
  }
  const style = document.createElement('style');
  style.textContent = '.mietitore-ghost-targeting{cursor:crosshair!important;outline:2px solid #4fd6a0;outline-offset:-2px}';
  document.head.appendChild(style);
  document.addEventListener('DOMContentLoaded', bindMap);
  if (document.readyState !== 'loading') bindMap();
})();
