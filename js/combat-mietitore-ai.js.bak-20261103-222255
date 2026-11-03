// Palazzo Eterno — Mietitore di Smeraldo. Caricare dopo combat.js.
(function () {
  'use strict';
  if (typeof runEnemyAI !== 'function') return;
  const originalAI = runEnemyAI;
  runEnemyAI = async function (entity) {
    if (String(entity?.enemy_id || entity?.monster_type || '').toLowerCase() !== 'mietitore_smeraldo') {
      return originalAI(entity);
    }
    if (!combatSession || combatSession.status !== 'active' || entity.status !== 'alive' ||
        (typeof masterObserverMode !== 'undefined' && masterObserverMode)) return;
    const key = `${combatSession.round_number}:${entity.id}`;
    if (enemyAIInProgress || enemyAITurnKey === key) return;
    enemyAITurnKey = key;
    enemyAIInProgress = true;
    try {
      const {data, error} = await db.rpc('run_mietitore_smeraldo_turn', {p_combat_id:combatId});
      if (error) throw error;
      if (data?.executed) {
        const phases = {agguato:'AGGUATO', caccia:'CACCIA', frenesia:'FRENESIA'};
        addCombatLog(`Mietitore di Smeraldo — ${phases[data.phase] || data.phase}: ${data.action_slots} azioni.`);
        for (const action of data.actions || []) {
          if (!action?.executed) continue;
          if (action.type === 'invisibilita') addCombatLog('Il Mietitore svanisce nell’ombra!');
          else if (action.type === 'passo_fantasma') addCombatLog('Il Mietitore usa Passo Fantasma!');
          else if (action.type === 'sanguinamento') addCombatLog(`Il Mietitore infligge Sanguinamento a ${action.target_name}.`);
          else if (action.type === 'succhiasangue') addCombatLog(`Il Mietitore usa Succhiasangue su ${action.target_name}: ${action.damage || 0} danni, ${action.healed || 0} PF recuperati.`);
          else if (action.type === 'basic') addCombatLog(`Il Mietitore attacca ${action.target_name}: ${action.damage || 0} danni${action.invisibility_bonus ? ' (d20 dall’Invisibilità)' : ''}.`);
          else if (action.type === 'movement' && action.steps > 0) addCombatLog('Il Mietitore insegue la preda.');
        }
      }
      await loadCombatSession();
      await Promise.all([loadCombatEntities(),loadCombatEffects()]);
      lastCombatEntitiesSnapshot = createCombatSnapshot();
      renderCombat();
      if (combatSession?.status === 'active') {
        const {error: endError} = await db.rpc('finish_enemy_turn', {
          p_combat_id:combatId,p_enemy_entity_id:entity.id,
          p_round_number:Number(combatSession.round_number)
        });
        if (endError) throw endError;
        await loadCombatSession();
        await Promise.all([loadCombatEntities(),loadCombatEffects()]);
        lastCombatEntitiesSnapshot = createCombatSnapshot();
        renderCombat();
      }
    } catch (err) {
      console.error('[Mietitore] Errore IA:', err);
      addCombatLog(`Errore IA Mietitore: ${err?.message || err}`);
    } finally { enemyAIInProgress = false; }
  };
  if (typeof renderCombatTokens === 'function') {
    const oldTokens = renderCombatTokens;
    renderCombatTokens = function (...args) {
      const result = oldTokens(...args);
      if (typeof combatTokens === 'undefined' || !Array.isArray(combatEffects)) return result;
      for (const [id,token] of combatTokens) {
        const entity = combatEntities.get(id);
        if (entity?.enemy_id !== 'mietitore_smeraldo') continue;
        const hidden = combatEffects.some(f => f.target_entity_id === id && f.effect_type === 'invisibilita' && Number(f.remaining_rounds)>0);
        token.style.visibility = hidden ? 'hidden' : '';
      }
      return result;
    };
  }
}());
