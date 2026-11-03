// Palazzo Eterno — Braci di Scintilla: messaggio corretto nella resurrezione.
// Caricare DOPO combat.js. La priorità Braci > Moneta è già garantita dal database.
'use strict';
tryConsumeCombatTemporalCoin = async function () {
  if (masterObserverMode || !currentCharacter || !currentCharacter.id || !combatId) return false;
  const {data,error} = await db.rpc('try_consume_temporal_coin', {
    p_character_id: currentCharacter.id, p_combat_id: combatId
  });
  if (error) throw error;
  if (!data || data.activated !== true) return false;
  currentCharacter.current_hp = Number(data.current_hp) || 0;
  currentCharacter.current_pm = Number(data.current_pm) || 0;
  const {error:resumeError} = await db.rpc('resume_combat_after_temporal_coin', {
    p_combat_id:combatId, p_character_id:currentCharacter.id
  });
  if (resumeError) throw resumeError;
  await Promise.all([loadCombatSession(), loadCombatEntities(), loadCharacterInventory()]);
  lastCombatEntitiesSnapshot = createCombatSnapshot();
  if (data.source === 'braci_scintilla') {
    const level = Number(data.braci_level) || 1;
    setCombatStatus('Le Braci di Scintilla divampano! Torni al massimo di PF e PM. Livello ' + level + '.');
  } else {
    setCombatStatus('La Moneta Temporale si frantuma: torni al massimo di PF e PM.');
  }
  renderCombat();
  updateActionButtons();
  return true;
};
