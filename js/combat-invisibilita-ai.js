// Palazzo Eterno - Protezione dell'Invisibilita' contro le IA nemiche.
// Caricare DOPO combat.js e gli altri script combat.
// Nessuna modifica richiesta ai JSON delle mappe.
(function () {
    "use strict";

    if (typeof getAliveCombatPlayers !== "function" ||
        typeof runEnemyAI !== "function") {
        console.warn("[Invisibilita IA] Script di combattimento non ancora caricati.");
        return;
    }

    function invisible(entityId) {
        return Array.isArray(combatEffects) && combatEffects.some(effect =>
            effect.target_entity_id === entityId &&
            effect.effect_type === "invisibilita" &&
            Number(effect.remaining_rounds) > 0
        );
    }

    const originalAlivePlayers = getAliveCombatPlayers;
    getAliveCombatPlayers = function () {
        return originalAlivePlayers().filter(player => !invisible(player.id));
    };

    // I planner SQL di alcune specie possono restituire un ID memorizzato.
    // Non lo utilizziamo per pathfinding se nel frattempo è invisibile.
    if (typeof peAIRpc === "function") {
        const originalAIRpc = peAIRpc;
        peAIRpc = async function (name, args = {}) {
            const data = await originalAIRpc(name, args);
            if (name.startsWith("plan_") && data && typeof data === "object" &&
                data.target_id && invisible(data.target_id)) {
                const enemy = combatEntities.get(combatSession?.current_turn_entity_id);
                const options = getAliveCombatPlayers().slice().sort((a,b) =>
                    (enemy ? getCombatRectDistance(enemy,a) -
                             getCombatRectDistance(enemy,b) : 0));
                return {...data, target_id: options[0]?.id || null,
                    mode: options.length ? "melee" : "none"};
            }
            return data;
        };
    }

    // Anche un bersaglio scelto dall'IA prima dell'aggiornamento effetti
    // deve passare dal server: la protezione SQL e' autoritativa.
    function aliveVisible() {
        return getAliveCombatPlayers();
    }

    async function searchLastKnownPosition(enemy) {
        const response = await db.rpc("get_enemy_last_seen", {
            p_combat_id: combatId,
            p_enemy_entity_id: enemy.id
        });
        if (response.error) throw response.error;

        const last = Array.isArray(response.data) ? response.data[0] : null;
        if (!last || !Number.isFinite(Number(last.x)) ||
            !Number.isFinite(Number(last.y))) {
            return false;
        }

        const targetX = Number(last.x), targetY = Number(last.y);
        let x = Number(enemy.x), y = Number(enemy.y);
        let moves = Math.max(0, Number(enemy.movement_remaining) || 0);
        let moved = false;

        while (moves-- > 0 && aliveVisible().length === 0) {
            const oldDistance = Math.max(Math.abs(x - targetX), Math.abs(y - targetY));
            if (oldDistance === 0) break;

            const directions = [
                [-1,-1], [0,-1], [1,-1], [-1,0], [1,0],
                [-1,1], [0,1], [1,1]
            ];
            const options = directions.map(([dx,dy]) => ({
                dx, dy, x:x+dx, y:y+dy,
                distance:Math.max(Math.abs(x+dx-targetX), Math.abs(y+dy-targetY))
            })).filter(option => option.distance < oldDistance &&
                (typeof canCombatEntityOccupy !== "function" ||
                 canCombatEntityOccupy(enemy, option.x, option.y))
            ).sort((a,b) => a.distance-b.distance);

            let stepDone = false;
            for (const option of options) {
                const step = await db.rpc("mietitore_search_step", {
                    p_combat_id: combatId,
                    p_dx: option.dx,
                    p_dy: option.dy
                });
                if (step.error) throw step.error;
                if (step.data?.moved) {
                    x = Number(step.data.x);
                    y = Number(step.data.y);
                    enemy = {...enemy, x, y,
                        movement_remaining:Math.max(0,
                          (Number(enemy.movement_remaining)||0)-1)};
                    combatEntities.set(enemy.id, enemy);
                    if (typeof renderCombatTokens === "function") renderCombatTokens();
                    moved = stepDone = true;
                    break;
                }
                if (step.data?.reason === "target_visible") return moved;
            }
            if (!stepDone) break;
        }
        return moved;
    }

    const originalRunEnemyAI = runEnemyAI;
    runEnemyAI = async function (enemy) {
        if (!enemy || enemy.entity_type !== "enemy" ||
            (typeof masterObserverMode !== "undefined" && masterObserverMode) ||
            !combatSession || combatSession.status !== "active" ||
            aliveVisible().length > 0) {
            return originalRunEnemyAI(enemy);
        }

        const turnKey = `${combatSession.round_number}:${enemy.id}`;
        if (enemyAIInProgress || enemyAITurnKey === turnKey) return;
        enemyAIInProgress = true;
        enemyAITurnKey = turnKey;

        try {
            // I potenziamenti personali rimangono possibili anche senza
            // bersagli visibili; non sono attacchi mirati.
            const type = String(enemy.monster_type || enemy.enemy_id || "").toLowerCase();
            if ((type === "tiki_legno" || type === "tiki_pietra") &&
                Number(enemy.current_pm) >= 2 &&
                typeof hasAICombatEffect === "function") {
                const buff = type === "tiki_legno" ? "attack_bonus" : "defense_bonus";
                if (!hasAICombatEffect(enemy.id, buff)) {
                    await peAIRpc("cast_tiki_buff");
                }
            } else if (type === "trex" &&
                Number(enemy.current_pm) >= 2 &&
                Number(enemy.current_hp) * 4 < Number(enemy.max_hp) * 3 &&
                typeof hasAICombatEffect === "function" &&
                !hasAICombatEffect(enemy.id, "attack_bonus")) {
                await peAIRpc("cast_trex_buff");
            }

            // Nessuna IA conosce magicamente le coordinate attuali dei PG.
            // Se possibile, l'avversario indaga dove aveva visto la preda.
            const moved = await searchLastKnownPosition(enemy);
            if (typeof addCombatLog === "function") {
                addCombatLog(moved ?
                    `${enemy.display_name} cerca gli avventurieri nell'ultima posizione conosciuta.` :
                    `${enemy.display_name} non vede alcun avventuriero.`);
            }
        } catch (error) {
            console.warn("[Invisibilita IA] Ricerca non eseguita:", error);
        } finally {
            try {
                const result = await db.rpc("finish_enemy_turn", {
                    p_combat_id:combatId,
                    p_enemy_entity_id:enemy.id,
                    p_round_number:Number(combatSession.round_number)
                });
                if (result.error) throw result.error;
                if (typeof loadCombatSession === "function") await loadCombatSession();
                if (typeof loadCombatEntities === "function") await loadCombatEntities();
                if (typeof loadCombatEffects === "function") await loadCombatEffects();
                if (typeof createCombatSnapshot === "function")
                    lastCombatEntitiesSnapshot = createCombatSnapshot();
                if (typeof renderCombat === "function") renderCombat();
            } catch (finishError) {
                console.error("[Invisibilita IA] Errore fine turno:", finishError);
            }
            enemyAIInProgress = false;
        }
    };

    // Nasconde il token del PG invisibile a tutti GLI ALTRI giocatori.
    // Al proprietario rimane una sagoma molto tenue per poter controllare
    // il movimento. Questo codice non modifica lo stato delle pedine.
    if (typeof renderCombatTokens === "function") {
        const originalRenderTokens = renderCombatTokens;
        renderCombatTokens = function (...args) {
            const result = originalRenderTokens(...args);
            if (!combatTokens || !combatEntities) return result;
            for (const [id, token] of combatTokens) {
                const entity = combatEntities.get(id);
                const hidden = entity?.entity_type === "player" && invisible(id);
                const own = hidden && entity.character_id === currentCharacter?.id;
                token.style.visibility = hidden && !own ? "hidden" : "";
                token.style.opacity = own ? "0.22" : "";
            }
            return result;
        };
    }

    console.info("[Invisibilita IA] Filtro bersagli, ricerca e protezione token attivi.");
}());
