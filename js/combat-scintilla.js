// Palazzo Eterno — Boss Scintilla: quattro vite, IA multi-azione,
// musica dedicata e ritorno alla Base dopo la vittoria.
// Caricare dopo combat.js e combat-braci.js, prima di DOMContentLoaded.
(() => {
  'use strict';
  const ENCOUNTER = 'id_scintilla';
  const isScintilla = () => combatSession?.encounter_id === ENCOUNTER;
  const isScintillaEntity = entity =>
    /^scintilla_guardiano(?:_[2-4])?$/.test(String(entity?.enemy_id || entity?.monster_type || ''));

  // Stesso PNG per tutte e quattro le vite: il database cambia tipo di
  // nemico per aggiornare ATT/DIF, ma l'immagine resta quella di Scintilla.
  const originalRenderEnemyTokenContent = renderEnemyTokenContent;
  renderEnemyTokenContent = function (token, entity) {
    if (!isScintillaEntity(entity)) return originalRenderEnemyTokenContent(token, entity);
    const img = document.createElement('img');
    img.src = 'immagini/nemici/Scintilla.png';
    img.alt = 'Scintilla';
    img.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain';
    token.appendChild(img);
  };

  // La funzione originale viene richiamata dal bootstrap dopo aver letto
  // la sessione: scegliamo la colonna sonora soltanto per questo encounter.
  const originalStartBackgroundMusic = startBackgroundMusic;
  startBackgroundMusic = function (source) {
    return originalStartBackgroundMusic(isScintilla() ? 'music/custode.mp3' : source);
  };

  // Manteniamo la normale IA per qualunque altro nemico e incontro.
  const originalRunEnemyAI = runEnemyAI;
  runEnemyAI = async function (entity) {
    if (!isScintilla() || !isScintillaEntity(entity)) return originalRunEnemyAI(entity);
    if (!entity || !combatSession || combatSession.status !== 'active') return;
    const turnKey = `${combatSession.round_number}:${entity.id}`;
    if (enemyAIInProgress || enemyAITurnKey === turnKey) return;
    enemyAITurnKey = turnKey;
    enemyAIInProgress = true;
    try {
      const {data, error} = await db.rpc('run_scintilla_turn', {p_combat_id: combatId});
      if (error) throw error;
      if (data?.executed) {
        for (const action of data.actions || []) {
          if (action.type === 'melee' && action.result?.executed) {
            const hit = action.result;
            addCombatLog(`Scintilla attacca ${hit.target_name}: ${hit.hit ? hit.damage + ' danni' : 'MANCATO'}.`);
          } else if (action.type === 'approach') {
            addCombatLog('Scintilla si avvicina agli intrusi.');
          }
        }
      }
      await loadCombatSession();
      await Promise.all([loadCombatEntities(), loadCombatEffects()]);
      lastCombatEntitiesSnapshot = createCombatSnapshot();
      renderCombat();
      if (combatSession?.status === 'active') {
        const {error: finishError} = await db.rpc('finish_enemy_turn', {
          p_combat_id: combatId,
          p_enemy_entity_id: entity.id,
          p_round_number: Number(combatSession.round_number)
        });
        if (finishError) throw finishError;
        await loadCombatSession();
        await loadCombatEntities();
        lastCombatEntitiesSnapshot = createCombatSnapshot();
        renderCombat();
      }
    } catch (error) {
      console.error('Errore IA Scintilla:', error);
      enemyAITurnKey = null;
      setCombatStatus('Errore nel turno di Scintilla: ' + (error?.message || 'riprova'));
    } finally {
      enemyAIInProgress = false;
    }
  };

  // Avviso nel post-combat: il click su CHIUDI condurrà davvero alla Base.
  function showVictoryReturnNotice() {
    if (!isScintilla() || combatSession?.status !== 'victory') return;
    const button = document.getElementById('combat-victory-exit');
    if (!button) return;
    button.textContent = 'CHIUDI — TORNA ALLA BASE';
    if (document.getElementById('scintilla-return-info')) return;
    const note = document.createElement('p');
    note.id = 'scintilla-return-info';
    note.setAttribute('role', 'status');
    note.style.cssText = 'font:700 15px/1.5 Georgia,serif;color:#f4d894;text-align:center;padding:10px 14px;border:1px solid #b6924d;background:#171a14;margin:12px 0';
    note.textContent = 'Scintilla è stato sconfitto. Chiudendo il combattimento verrai riportato alla Base. Scintilla ritornerà dopo 4 ore.';
    button.parentElement?.insertBefore(note, button);
  }
  const originalRenderCombatVictory = renderCombatVictory;
  renderCombatVictory = function () {
    const result = originalRenderCombatVictory.apply(this, arguments);
    showVictoryReturnNotice();
    return result;
  };

  const originalSetupVictoryExitButton = setupVictoryExitButton;
  setupVictoryExitButton = function () {
    if (!isScintilla()) return originalSetupVictoryExitButton.apply(this, arguments);
    const button = document.getElementById('combat-victory-exit');
    if (!button) return;
    button.addEventListener('click', async () => {
      if (combatSession?.status !== 'victory') return;
      if (!window.confirm('Hai sconfitto Scintilla! Chiudendo lo scontro tornerai alla Base. Vuoi proseguire?')) return;
      button.disabled = true;
      try {
        const {error} = await db.rpc('piano_id_scintilla_return_to_base', {p_combat_id: combatId});
        if (error) throw error;
        window.location.assign('base/base.html');
      } catch (error) {
        console.error('Ritorno alla Base dopo Scintilla:', error);
        window.alert(error?.message || 'Impossibile tornare alla Base.');
        button.disabled = false;
      }
    });
  };

  // Indicazione della fase corrente basata sull'identità dell'entità server.
  const originalRenderCombat = renderCombat;
  renderCombat = function () {
    const result = originalRenderCombat.apply(this, arguments);
    if (!isScintilla()) return result;
    const boss = Array.from(combatEntities.values()).find(e => isScintillaEntity(e));
    let banner = document.getElementById('scintilla-life-banner');
    if (boss && boss.status === 'alive' && Number(boss.current_hp) > 0) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'scintilla-life-banner';
        banner.setAttribute('role','status');
        banner.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:600;color:#ffdf9c;background:#17120fef;border:1px solid #c5a15b;border-radius:6px;padding:8px 14px;font:700 14px Georgia,serif;pointer-events:none;white-space:nowrap';
        document.body.appendChild(banner);
      }
      const life = /^scintilla_guardiano_([2-4])$/.exec(String(boss.enemy_id))?.[1] || '1';
      banner.textContent = `SCINTILLA — VITA ${life}/4 — ${boss.current_hp}/${boss.max_hp} PF`;
    } else {
      banner?.remove();
    }
    return result;
  };
})();
