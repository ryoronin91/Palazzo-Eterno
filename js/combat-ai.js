// ============================================================
// PALAZZO ETERNO
// COMBAT-AI.JS
// IA E MOVIMENTO DEI NEMICI
// ============================================================


// ============================================================
// DISTANZA
//
// Chebyshev:
// diagonali comprese.
// ============================================================

// Ingombro nemici grandi: preserva le collisioni del branch main.
const COMBAT_LARGE_ENEMY_IDS = new Set(['anchilosauro', 'allosauro_dominante', 'miconide_grande','tiki_pietra']);
function getCombatFootprint(entity) {
    const large = entity?.entity_type === 'enemy' && COMBAT_LARGE_ENEMY_IDS.has(entity.enemy_id);
    return large ? 2 : 1;
}
function getCombatRectDistance(a, b) {
    const aw = getCombatFootprint(a), bw = getCombatFootprint(b);
    const ax = Number(a.x), ay = Number(a.y), bx = Number(b.x), by = Number(b.y);
    const dx = Math.max(0, bx - (ax + aw - 1), ax - (bx + bw - 1));
    const dy = Math.max(0, by - (ay + aw - 1), ay - (by + bw - 1));
    return Math.max(dx, dy);
}
function canCombatEntityOccupy(entity, x, y) {
    const size = getCombatFootprint(entity);
    if (x < 0 || y < 0 || x + size > COMBAT_COLUMNS || y + size > COMBAT_ROWS) return false;
    return !Array.from(combatEntities.values()).some(other => {
        if (other.id === entity.id || other.status !== 'alive' || Number(other.current_hp) <= 0) return false;
        const otherSize = getCombatFootprint(other);
        return x < Number(other.x) + otherSize && x + size > Number(other.x) &&
            y < Number(other.y) + otherSize && y + size > Number(other.y);
    });
}

function getCombatDistance(
    x1,
    y1,
    x2,
    y2
) {

    return Math.max(

        Math.abs(
            Number(x1) -
            Number(x2)
        ),

        Math.abs(
            Number(y1) -
            Number(y2)
        )

    );

}


// ============================================================
// IA GOBLIN BASE - UTILITÀ
// ============================================================

function chooseRandomEntity(
    entities
) {

    if (
        !entities ||
        entities.length === 0
    ) {

        return null;

    }


    const index =
        Math.floor(
            Math.random() *
            entities.length
        );


    return entities[index];

}


// ============================================================
// PG VIVI
// ============================================================

function getAliveCombatPlayers() {

    return Array.from(
        combatEntities.values()
    ).filter(
        entity =>
            entity.entity_type ===
                "player"
            &&
            entity.status ===
                "alive"
            &&
            Number(
                entity.current_hp
            ) > 0
    );

}


// ============================================================
// PG PIÙ VICINO
// ============================================================

function chooseNearestPlayer(
    enemy,
    players
) {

    if (
        !enemy ||
        !players?.length
    ) {

        return null;

    }


    let minimumDistance =
        Infinity;


    let candidates = [];


    players.forEach(
        player => {

            const distance =
                getCombatDistance(

                    enemy.x,
                    enemy.y,

                    player.x,
                    player.y

                );


            if (
                distance <
                minimumDistance
            ) {

                minimumDistance =
                    distance;

                candidates = [
                    player
                ];

            } else if (
                distance ===
                minimumDistance
            ) {

                candidates.push(
                    player
                );

            }

        }
    );


    return chooseRandomEntity(
        candidates
    );

}


// ============================================================
// PG CON PIÙ PF
// ============================================================

function choosePlayerWithMostHP(
    players
) {

    if (!players?.length) {

        return null;

    }


    const maxHP =
        Math.max(
            ...players.map(
                player =>
                    Number(
                        player.current_hp
                    ) || 0
            )
        );


    const candidates =
        players.filter(
            player =>
                (
                    Number(
                        player.current_hp
                    ) || 0
                ) ===
                maxHP
        );


    return chooseRandomEntity(
        candidates
    );

}


// ============================================================
// PG CON MENO PF
// ============================================================

function choosePlayerWithLeastHP(
    players
) {

    if (!players?.length) {

        return null;

    }


    const minHP =
        Math.min(
            ...players.map(
                player =>
                    Number(
                        player.current_hp
                    ) || 0
            )
        );


    const candidates =
        players.filter(
            player =>
                (
                    Number(
                        player.current_hp
                    ) || 0
                ) ===
                minHP
        );


    return chooseRandomEntity(
        candidates
    );

}


// ============================================================
// IA GOBLIN BASE - SCELTA BERSAGLIO
// ============================================================

function chooseGoblinTarget(
    goblin
) {

    if (!goblin) {

        return null;

    }


    const players =
        getAliveCombatPlayers();


    if (!players.length) {

        return null;

    }


    const currentHP =
        Number(
            goblin.current_hp
        ) || 0;


    // ========================================================
    // 7 - 10 PF
    // Attacca il PG più vicino
    // ========================================================

    if (currentHP >= 7) {

        return chooseNearestPlayer(
            goblin,
            players
        );

    }


    // ========================================================
    // 4 - 6 PF
    // Attacca il PG con più PF
    // ========================================================

    if (currentHP >= 4) {

        return choosePlayerWithMostHP(
            players
        );

    }


    // ========================================================
    // 1 - 3 PF
    // Attacca il PG con meno PF
    // ========================================================

    if (currentHP >= 1) {

        return choosePlayerWithLeastHP(
            players
        );

    }


    return null;

}


// ============================================================
// IA GOBLIN BASE - MOVIMENTO
// ============================================================

function isCombatCellOccupied(x, y, ignoreEntityId = null) {
    return Array.from(combatEntities.values()).some(entity => {
        if (entity.id === ignoreEntityId || entity.status !== 'alive' || Number(entity.current_hp) <= 0) return false;
        const n = getCombatFootprint(entity);
        return x >= Number(entity.x) && x < Number(entity.x) + n &&
               y >= Number(entity.y) && y < Number(entity.y) + n;
    });
}


// ============================================================
// PROSSIMA CASELLA VERSO IL BERSAGLIO
// ============================================================

function chooseGoblinNextStep(
    goblin,
    target
) {

    if (
        !goblin ||
        !target
    ) {

        return null;

    }


    const currentDistance =
        getCombatDistance(
            goblin.x,
            goblin.y,
            target.x,
            target.y
        );


    // È già adiacente:
    // non deve muoversi.
    if (currentDistance <= 1) {

        return null;

    }


    const directions = [

        { dx: -1, dy: -1 },
        { dx:  0, dy: -1 },
        { dx:  1, dy: -1 },

        { dx: -1, dy:  0 },
        { dx:  1, dy:  0 },

        { dx: -1, dy:  1 },
        { dx:  0, dy:  1 },
        { dx:  1, dy:  1 }

    ];


    let bestDistance =
        currentDistance;

    let candidates = [];


    directions.forEach(
        direction => {

            const newX =
                Number(goblin.x) +
                direction.dx;

            const newY =
                Number(goblin.y) +
                direction.dy;


            // Fuori dalla mappa.
            if (
                newX < 0 ||
                newX >= COMBAT_COLUMNS ||
                newY < 0 ||
                newY >= COMBAT_ROWS
            ) {

                return;

            }


            // Casella occupata.
            if (
                !canCombatEntityOccupy(goblin, newX, newY)
            ) {

                return;

            }


            const distance =
                getCombatDistance(
                    newX,
                    newY,
                    target.x,
                    target.y
                );


            // Accettiamo soltanto mosse
            // che avvicinano realmente.
            if (
                distance <
                bestDistance
            ) {

                bestDistance =
                    distance;

                candidates = [
                    {
                        x: newX,
                        y: newY,
                        dx: direction.dx,
                        dy: direction.dy
                    }
                ];

            } else if (
                distance === bestDistance
                &&
                distance < currentDistance
            ) {

                candidates.push(
                    {
                        x: newX,
                        y: newY,
                        dx: direction.dx,
                        dy: direction.dy
                    }
                );

            }

        }
    );


    return chooseRandomEntity(
        candidates
    );

}// ============================================================
// IA GOBLIN BASE - PERCORSO DEL TURNO
// ============================================================

function chooseGoblinMovementPath(
    goblin,
    target
) {

    if (
        !goblin ||
        !target
    ) {

        return [];

    }


    const movement =
        Math.max(
            0,
            Number(
                goblin.movement_remaining
            ) || 0
        );


    if (movement <= 0) {

        return [];

    }


    const path = [];


    const simulatedGoblin = {

        ...goblin,

        x:
            Number(
                goblin.x
            ),

        y:
            Number(
                goblin.y
            )

    };


    for (
        let stepNumber = 0;
        stepNumber < movement;
        stepNumber++
    ) {

        const distance =
            getCombatDistance(
                simulatedGoblin.x,
                simulatedGoblin.y,
                target.x,
                target.y
            );


        // È già abbastanza vicino per attaccare.
        if (
            distance <= 1
        ) {

            break;

        }


        const nextStep =
            chooseGoblinNextStep(
                simulatedGoblin,
                target
            );


        if (
            !nextStep
        ) {

            break;

        }


        path.push(
            nextStep
        );


        simulatedGoblin.x =
            nextStep.x;

        simulatedGoblin.y =
            nextStep.y;

    }


    return path;

}


// ============================================================
// SUPPORTO NUOVE IA — FUNZIONI CONDIVISE (FASE 1)
// Queste utility NON cambiano le IA Goblin già attive.
// Le azioni effettive restano soggette ai controlli RPC server.
// ============================================================

// Distanza in caselle, diagonali comprese.
function getAIEnemyDistance(a, b) {
    return getCombatRectDistance(a,b);
}

function getAliveAlliedEnemies(enemy = null) {
    return Array.from(combatEntities.values()).filter(entity =>
        entity.entity_type === "enemy" &&
        entity.status === "alive" &&
        Number(entity.current_hp) > 0 &&
        (!enemy || entity.id !== enemy.id)
    );
}

// Preferisce un valore alto o basso; spareggia per vicinanza,
// poi in maniera casuale (senza imporre un ordine artificiale).
function chooseAIPlayerByStat(enemy, players, field, preferHighest = false) {
    if (!players?.length) return null;
    const ranked = players.filter(p => Number.isFinite(Number(p[field])));
    if (!ranked.length) return null;
    const values = ranked.map(p => Number(p[field]));
    const best = preferHighest ? Math.max(...values) : Math.min(...values);
    const tied = ranked.filter(p => Number(p[field]) === best);
    const minDistance = Math.min(...tied.map(p => getAIEnemyDistance(enemy, p)));
    return chooseRandomEntity(tied.filter(p => getAIEnemyDistance(enemy, p) === minDistance));
}

// Per valori non presenti in combat_entities (es. Costituzione):
// passarli solo dopo averli caricati in modo autorizzato dal server.
function chooseAIPlayerByValue(enemy, players, getValue, preferHighest = false) {
    const withValue = players
        .map(p => ({ player: p, value: Number(getValue(p)) }))
        .filter(x => Number.isFinite(x.value));
    if (!withValue.length) return null;
    const best = preferHighest
        ? Math.max(...withValue.map(x => x.value))
        : Math.min(...withValue.map(x => x.value));
    const tied = withValue.filter(x => x.value === best).map(x => x.player);
    const distance = Math.min(...tied.map(p => getAIEnemyDistance(enemy, p)));
    return chooseRandomEntity(tied.filter(p => getAIEnemyDistance(enemy, p) === distance));
}

function hasAICombatEffect(entityId, effectType) {
    return combatEffects.some(effect =>
        effect.target_entity_id === entityId &&
        effect.effect_type === effectType &&
        Number(effect.remaining_rounds) > 0
    );
}

// Ricerca BFS su griglia: non attraversa caselle occupate.
// Può trovare un percorso anche aggirando ostacoli; non muove
// l'entità e non altera il MOV. La RPC deve validare ogni passo.
function findAIGridPath(enemy, isGoal, maximumSteps = Infinity) {
    if (!enemy || typeof isGoal !== "function") return [];
    const start = { x: Number(enemy.x), y: Number(enemy.y) };
    const encode = (x, y) => `${x},${y}`;
    const visited = new Set([encode(start.x, start.y)]);
    const queue = [{ ...start, path: [] }];
    const directions = [
        [-1,-1],[0,-1],[1,-1],
        [-1,0],        [1,0],
        [-1,1], [0,1], [1,1]
    ];
    let head = 0;
    while (head < queue.length) {
        const current = queue[head++];
        if (isGoal(current.x, current.y)) return current.path;
        if (current.path.length >= maximumSteps) continue;
        for (const [dx, dy] of directions) {
            const x = current.x + dx, y = current.y + dy;
            if (x < 0 || x >= COMBAT_COLUMNS || y < 0 || y >= COMBAT_ROWS) continue;
            const key = encode(x, y);
            if (visited.has(key) || !canCombatEntityOccupy(enemy, x, y)) continue;
            visited.add(key);
            queue.push({ x, y, path: [...current.path, { x, y, dx, dy }] });
        }
    }
    return [];
}

function findAIPathToRange(enemy, target, range, availableMovement) {
    const steps = Math.max(0, Number(availableMovement) || 0);
    return findAIGridPath(enemy, (x, y) =>
        getCombatRectDistance({...enemy,x,y}, target) <= range, steps);
}

// Per il mordi e fuggi: scelta di una casella raggiungibile
// che massimizza la distanza dal PG più vicino, entro il MOV
// realmente rimasto. Non implica un movimento gratuito.
function findAIRetreatPath(enemy, players, availableMovement) {
    const limit = Math.max(0, Number(availableMovement) || 0);
    if (!enemy || !players?.length || limit <= 0) return [];
    const start = { x: Number(enemy.x), y: Number(enemy.y) };
    const encode = (x, y) => `${x},${y}`;
    const visited = new Set([encode(start.x, start.y)]);
    const queue = [{ ...start, path: [] }];
    const dirs = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
    const score = c => Math.min(...players.map(p =>
        getCombatDistance(c.x, c.y, p.x, p.y)));
    let best = queue[0], bestScore = score(start), head = 0;
    while (head < queue.length) {
        const current = queue[head++];
        const s = score(current);
        if (s > bestScore || (s === bestScore && current.path.length < best.path.length)) {
            best = current; bestScore = s;
        }
        if (current.path.length >= limit) continue;
        for (const [dx,dy] of dirs) {
            const x = current.x + dx, y = current.y + dy;
            if (x < 0 || x >= COMBAT_COLUMNS || y < 0 || y >= COMBAT_ROWS) continue;
            const key = encode(x, y);
            if (visited.has(key) || !canCombatEntityOccupy(enemy, x, y)) continue;
            visited.add(key);
            queue.push({x,y,path:[...current.path,{x,y,dx,dy}]});
        }
    }
    return best.path;
}

// ============================================================
// NUOVE IA: motore di orchestrazione (nessuna modifica ai Goblin)
// ============================================================
const PE_NEW_AI_TYPES = new Set([
    'pianta_rossa','pianta_verde','pianta_nera',
    'compsognato','dilofosauro','anchilosauro','uccello_stigio',
    'miconide_grande','miconide_medio','miconide_piccolo',
    'lucertoloide_guerriero_1','lucertoloide_guerriero_2',
    'lucertoloide_sciamano','velociraptor','trex',
    'tiki_legno','tiki_pietra'
]);

async function peAIRpc(name, args = {}) {
    const { data, error } = await db.rpc(name, { p_combat_id: combatId, ...args });
    if (error) throw error;
    return data;
}

function peAIPath(enemy, target, range, budget) {
    if (!enemy || !target || budget <= 0) return [];
    // Ricerca completa sulla griglia: se la portata non è raggiungibile,
    // usa la casella percorribile più vicina, senza superare il MOV.
    const dirs = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
    const queue=[{x:+enemy.x,y:+enemy.y,path:[]}];
    const visited=new Set([`${enemy.x},${enemy.y}`]);
    let best=queue[0];
    const distance=p=>getCombatRectDistance({...enemy,x:p.x,y:p.y},target);
    for(let i=0;i<queue.length;i++) {
        const current=queue[i];
        if(distance(current)<=range) return current.path;
        if(distance(current)<distance(best) ||
           (distance(current)===distance(best) && current.path.length<best.path.length)) best=current;
        if(current.path.length>=budget) continue;
        for(const [dx,dy] of dirs) {
            const x=current.x+dx,y=current.y+dy,k=`${x},${y}`;
            if(x<0||x>=COMBAT_COLUMNS||y<0||y>=COMBAT_ROWS||visited.has(k)||!canCombatEntityOccupy(enemy,x,y))continue;
            visited.add(k);queue.push({x,y,path:[...current.path,{x,y}]});
        }
    }
    return best.path;
}

async function peAIMove(enemy, path) {
    if (!path?.length) return enemy;
    const result=await peAIRpc('move_new_enemy_ai_path',{p_path:path});
    if (result?.executed) {
        addCombatLog(`${enemy.display_name} si muove di ${result.steps} caselle.`);
        const updated={...enemy,x:result.x,y:result.y,movement_remaining:result.movement_remaining};
        combatEntities.set(enemy.id,updated);
        return updated;
    }
    return enemy;
}

async function peAIAttack(rpc, label) {
    const result=await peAIRpc(rpc);
    const attack=result?.attack?.executed ? result.attack : result;
    if (attack?.executed) {
        let message=`${attack.attacker_name || label} attacca ${attack.target_name || 'il bersaglio'}`;
        if (attack.ability) message+=` con ${attack.ability}`;
        message+=attack.hit===false ? ': MANCATO.' : `: ${Number(attack.damage)||0} danni.`;
        addCombatLog(message);
    }
    return result;
}


// FUGA UCCELLI PARASSITA — animazione dei passi fino al bordo.
// Il server ha già convalidato il percorso; questa funzione anima
// soltanto la rappresentazione locale, senza consumare movimento due volte.
async function peAIAnimateParasiticBirdEscape(before, after, path) {
    const steps = Array.isArray(path) ? path : [];
    const token = combatTokens.get(before.id);
    const last = steps[steps.length - 1];
    const moved = Number(before.x) !== Number(after.x) ||
        Number(before.y) !== Number(after.y);

    if (!moved || !steps.length || !last ||
        Number(last.x) !== Number(after.x) ||
        Number(last.y) !== Number(after.y) || !token) {
        renderCombatTokens();
        return;
    }

    const originalTransition = token.style.transition;
    const stepDuration = 220;
    token.style.transition = `left ${stepDuration - 20}ms linear, top ${stepDuration - 20}ms linear, filter .15s ease`;
    try {
        for (const step of steps) {
            combatEntities.set(before.id, { ...after, x: step.x, y: step.y });
            renderCombatTokens();
            await new Promise(resolve => setTimeout(resolve, stepDuration));
        }
    } finally {
        combatEntities.set(before.id, after);
        renderCombatTokens();
        token.style.transition = originalTransition;
    }
}

// Animazione visiva per assalitori mobili: il server convalida le caselle,
// poi il client le mostra una alla volta, senza un secondo movimento RPC.
async function peAIMoveAnimated(enemy, path) {
    const before = { ...enemy };
    const after = await peAIMove(enemy, path);
    if (path?.length && (before.x !== after.x || before.y !== after.y)) {
        await peAIAnimateParasiticBirdEscape(before, after, path);
    }
    return after;
}

// ============================================================
// SCIAMANO LUCERTOLOIDE — VELENO, SUCCHIASANGUE E RITIRATA
// La RPC verifica costi, portata, bersaglio, effetti e azioni.
// ============================================================
async function peAIShamanTurn(enemy) {
    const players = getAliveCombatPlayers();
    if (!players.length) return;

    const distance = (a,b) => getCombatRectDistance(a,b);
    const nearest = list => list.slice().sort((a,b) =>
        distance(enemy,a)-distance(enemy,b))[0] || null;
    const pm = Math.max(0,Number(enemy.current_pm) || 0);
    const missingHp = Number(enemy.current_hp) < Number(enemy.max_hp);
    const budget = Math.max(0,Number(enemy.movement_remaining) || 0);
    const adjacent = players.filter(p => distance(enemy,p) === 1);
    const poisoned = p => hasAICombatEffect(p.id,'dot_veleno');

    // Nessun PM per alcuna magia: si comporta come un combattente aggressivo.
    if (pm < 2) {
        const target = nearest(players);
        if (!target) return;
        await peAIRpc('set_new_enemy_ai_target',{p_target_entity_id:target.id});
        enemy = await peAIMove(enemy,peAIPath(enemy,target,1,budget));
        if(distance(enemy,target)===1 && !enemy.action_used) {
            await peAIAttack('run_enemy_melee_attack_turn',enemy.display_name);
        }
        return;
    }

    // Prima si difende da un giocatore in corpo a corpo.
    const drainTarget = missingHp && pm >= 2
        ? nearest(adjacent.filter(poisoned)) : null;
    if(drainTarget && !enemy.action_used) {
        await peAIRpc('set_new_enemy_ai_target',{p_target_entity_id:drainTarget.id});
        const result=await peAIRpc('cast_enemy_special_ability',{
            p_target_entity_id:drainTarget.id,p_ability_id:'succhiasangue'
        });
        if(result?.executed) {
            addCombatLog(`${enemy.display_name} usa Succhiasangue su ${drainTarget.display_name}: ${result.damage||0} danni e ${result.healed||0} PF recuperati.`);
        }
    } else if(adjacent.length && !enemy.action_used) {
        const target=nearest(adjacent);
        await peAIRpc('set_new_enemy_ai_target',{p_target_entity_id:target.id});
        await peAIAttack('run_enemy_melee_attack_turn',enemy.display_name);
    } else if(pm >= 3 && !enemy.action_used) {
        const candidates=players.filter(p=>!poisoned(p));
        const target=nearest(candidates);
        if(target) {
            await peAIRpc('set_new_enemy_ai_target',{p_target_entity_id:target.id});
            // Intelligenza 2 = portata di Veleno: 2 caselle.
            enemy=await peAIMove(enemy,peAIPath(enemy,target,2,budget));
            if(distance(enemy,target)>=1 && distance(enemy,target)<=2) {
                const result=await peAIRpc('cast_enemy_special_ability',{
                    p_target_entity_id:target.id,p_ability_id:'veleno'
                });
                if(result?.executed)
                    addCombatLog(`${enemy.display_name} avvelena ${target.display_name}.`);
            }
        }
    }

    // Consumiamo soltanto i punti movimento rimasti sulla scheda server.
    // Scegliamo una casella che aumenti la distanza dal giocatore più vicino.
    const retreat=findAIRetreatPath(enemy,getAliveCombatPlayers(),
        Math.max(0,Number(enemy.movement_remaining)||0));
    await peAIMove(enemy,retreat);
}

// DINOSAURI PIANO I-C — gruppo Velociraptor e T-Rex.
async function peAIDinosaurTurn(enemy) {
    const type=String(enemy.enemy_id||enemy.monster_type||'').toLowerCase();
    const players=getAliveCombatPlayers();
    if (!players.length) return;
    const distance=(a,b)=>getCombatRectDistance(a,b);
    let target;
    if(type==='velociraptor') {
        // Tutti i membri del branco danno la priorità al PG con meno PF correnti.
        target=players.slice().sort((a,b)=>Number(a.current_hp)-Number(b.current_hp)
            || distance(enemy,a)-distance(enemy,b))[0];
    } else {
        // Il T-Rex attacca chi ha più PF massimi, non più PF correnti.
        target=players.slice().sort((a,b)=>Number(b.max_hp)-Number(a.max_hp)
            || distance(enemy,a)-distance(enemy,b))[0];
    }
    if(!target)return;
    const locked=await peAIRpc('set_new_enemy_ai_target',{p_target_entity_id:target.id});
    if(locked?.target_id && locked.target_id!==target.id)
        target=combatEntities.get(locked.target_id)||target; // Aggro prevale.
    if(type==='trex' && Number(enemy.current_hp)*4 < Number(enemy.max_hp)*3
        && Number(enemy.current_pm)>=2 && !hasAICombatEffect(enemy.id,'attack_bonus')
        && !enemy.action_used) {
        const buff=await peAIRpc('cast_trex_buff');
        if(buff?.executed){
            addCombatLog(`${enemy.display_name} usa Arma Potenziata! (+1 Attacco)`);
            return;
        }
    }
    // Sono entrambi attaccanti corpo a corpo: nessuna azione o movimento gratuito.
    enemy=await peAIMove(enemy,peAIPath(enemy,target,1,
        Math.max(0,Number(enemy.movement_remaining)||0)));
    if(distance(enemy,target)!==1 || enemy.action_used)return;
    if(type==='velociraptor') {
        const bleeding=hasAICombatEffect(target.id,'dot_sanguinamento');
        const ability=bleeding?'succhiasangue':'sanguinamento';
        const cost=2;
        if(Number(enemy.current_pm)>=cost) {
            const result=await peAIRpc('cast_enemy_special_ability',{
                p_target_entity_id:target.id,p_ability_id:ability
            });
            if(result?.executed) {
                addCombatLog(`${enemy.display_name} usa ${ability} su ${target.display_name}`+
                    (ability==='succhiasangue'?`: ${result.damage||0} danni e ${result.healed||0} PF recuperati.`:'.'));
                return;
            }
        }
    }
    await peAIAttack('run_enemy_melee_attack_turn',enemy.display_name);
}

// IA Tiki: potenziamento una sola volta finche' e' attivo, poi assalto al PG piu' vicino.
async function peAITikiTurn(enemy) {
    const players=getAliveCombatPlayers();
    if(!players.length || Number(enemy.current_hp)<=0 || enemy.status!=='alive') return;
    const power=enemy.monster_type==='tiki_legno'?'attack_bonus':'defense_bonus';
    const cost=2;
    if(!enemy.action_used && Number(enemy.current_pm)>=cost && !hasAICombatEffect(enemy.id,power)) {
        const buff=await peAIRpc('cast_tiki_buff');
        if(buff?.executed) {
            addCombatLog(`${enemy.display_name} usa ${buff.ability}.`);
            return;
        }
    }
    const target=players.slice().sort((a,b)=>getCombatRectDistance(enemy,a)-getCombatRectDistance(enemy,b))[0];
    if(!target) return;
    const selected=await peAIRpc('set_new_enemy_ai_target',{p_target_entity_id:target.id});
    const chosen=selected?.target_id ? combatEntities.get(selected.target_id)||target : target;
    enemy=await peAIMove(enemy,peAIPath(enemy,chosen,1,Math.max(0,Number(enemy.movement_remaining)||0)));
    if(getCombatRectDistance(enemy,chosen)<=1 && !enemy.action_used)
        await peAIAttack('run_enemy_melee_attack_turn',enemy.display_name);
}

async function peAINewEnemyTurn(enemy) {
    const type=String(enemy.monster_type||'').toLowerCase();
    if(type==='tiki_legno'||type==='tiki_pietra') { await peAITikiTurn(enemy); return; }
    if(type==='velociraptor' || type==='trex') {
        await peAIDinosaurTurn(enemy);
        return;
    }
    if(type==='lucertoloide_sciamano') {
        await peAIShamanTurn(enemy);
        return;
    }
    // Le piante riusano RPC dedicate, preservando integralmente i Goblin.
    if(type==='pianta_verde' || type==='pianta_nera') {
        const result=await peAIRpc(type==='pianta_verde'?'run_pianta_verde_turn':'run_pianta_nera_turn');
        if(result?.mode==='heal' && result.executed) {
            addCombatLog(`${enemy.display_name} cura ${result.target_name} di ${result.heal_amount} PF.`);
        } else if(result?.mode==='sanguinamento') {
            addCombatLog(`${enemy.display_name} applica Sanguinamento a ${result.attack?.target_name||'un giocatore'}.`);
        } else {
            if(Number(result?.move?.steps)>0) addCombatLog(`${enemy.display_name} si muove di ${result.move.steps} caselle.`);
            if(result?.attack?.executed) addCombatLog(`${enemy.display_name} attacca ${result.attack.target_name}: ${result.attack.damage||0} danni.`);
        }
        return;
    }
    if(type==='pianta_rossa') {
        const move=await peAIRpc('run_pianta_rossa_movement_turn');
        if(Number(move?.steps)>0) addCombatLog(`${enemy.display_name} si muove di ${move.steps} caselle.`);
        const data=await peAIRpc('run_pianta_rossa_attack_turn');
        if(data?.executed) addCombatLog(`${enemy.display_name} usa ${data.ability==='dardo_di_fuoco'?'Dardo di Fuoco':'attacco base'} contro ${data.target_name}: ${data.hit===false?'MANCATO':`${data.damage||0} danni`}.`);
        return;
    }
    const planner=type.startsWith('miconide_') ? 'plan_miconide_turn'
      : type.startsWith('lucertoloide_') ? 'plan_lizardfolk_turn' : 'plan_new_enemy_special_turn';
    let plan=await peAIRpc(planner);
    let mode=plan?.mode, target=plan?.target_id ? combatEntities.get(plan.target_id):null;
    const partner=plan?.partner_id ? combatEntities.get(plan.partner_id):null;
    // I potenziamenti consumano l'azione: non seguono attacchi nello stesso turno.
    if(type==='anchilosauro' && mode==='buff') {
        const buff=await peAIRpc('cast_new_enemy_buff',{p_ability_id:plan.ability});
        if(buff?.executed) addCombatLog(`${enemy.display_name} usa ${plan.ability}.`);
        return;
    }
    if(type.startsWith('lucertoloide_') && mode==='buff') {
        const buff=await peAIRpc('cast_lizardfolk_buff');
        if(buff?.executed) addCombatLog(`${enemy.display_name} usa ${buff.ability}.`);
        return;
    }
    if(type==='uccello_stigio' && mode==='escape') {
        // Fuga verso il bordo più vicino realmente raggiungibile.
        const edges=[];
        for(let x=0;x<COMBAT_COLUMNS;x++){edges.push({x,y:0},{x,y:COMBAT_ROWS-1});}
        for(let y=1;y<COMBAT_ROWS-1;y++){edges.push({x:0,y},{x:COMBAT_COLUMNS-1,y});}
        let best=null;
        for(const edge of edges) {
            const p=peAIPath(enemy,edge,0,Math.max(0,Number(enemy.movement_remaining)||0));
            const destination=p.length?p[p.length-1]:enemy;
            const remaining=getCombatDistance(destination.x,destination.y,edge.x,edge.y);
            if(!best||remaining<best.remaining||(remaining===best.remaining&&p.length<best.path.length)) best={path:p,remaining};
        }
        // Il movimento viene registrato prima sul server, ma mostrato
        // sulla mappa casella per casella. Il token non sparisce in anticipo.
        const beforeMove = { ...enemy };
        const escapePath = best?.path || [];
        enemy = await peAIMove(enemy, escapePath);
        await peAIAnimateParasiticBirdEscape(beforeMove, enemy, escapePath);

        const atEdge = Number(enemy.x) === 0 || Number(enemy.x) === COMBAT_COLUMNS - 1 ||
            Number(enemy.y) === 0 || Number(enemy.y) === COMBAT_ROWS - 1;
        if (!atEdge) return; // Non può ancora scappare: riproverà al turno seguente.

        // Rimane fermo e visibile al bordo per tre secondi interi.
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Prima il messaggio condiviso, poi la fuga sul server:
        // anche gli altri giocatori lo leggono prima che sparisca il token.
        await addSharedCombatLog(
            `${enemy.display_name} raggiunge il bordo e fugge dal combattimento senza lasciare bottino!`
        );
        const escaped = await peAIRpc('escape_parasitic_bird');
        if (escaped?.escaped) {
            combatEntities.set(enemy.id, { ...enemy, status: 'escaped' });
            renderCombatTokens();
        }
        return;
    }
    // Se tutti i giocatori sono già avvelenati/sanguinanti, rimane lontano.
    if(mode==='retreat') {
        const retreat=findAIRetreatPath(enemy,getAliveCombatPlayers(),Number(enemy.movement_remaining)||0);
        await peAIMove(enemy,retreat);
        return;
    }
    if(!target) return;
    if(type==='uccello_stigio' && mode==='special') {
        // Per Sanguisuga sceglie il primo giocatore raggiungibile in ordine PF massimi.
        const players=getAliveCombatPlayers().sort((a,b)=>
          Number(b.max_hp)-Number(a.max_hp) ||
          getAIEnemyDistance(enemy,a)-getAIEnemyDistance(enemy,b));
        target=players.find(p=>getCombatRectDistance(enemy,p)<=1 ||
          peAIPath(enemy,p,1,Number(enemy.movement_remaining)||0).length>0) || null;
        if(!target) return;
    }
    // Blocca la scelta nel server; rispetta bersagli già imposti dall'Aggro.
    const locked=await peAIRpc('set_new_enemy_ai_target',{p_target_entity_id:target.id});
    if(locked?.target_id && locked.target_id!==target.id) target=combatEntities.get(locked.target_id);
    if(!target) return;
    const range=mode==='special' && type==='dilofosauro' ? Math.max(1,Number(plan.range)||1)
       : mode==='poison' ? Math.max(1,Number(plan.range)||1):1;
    // Il difensore sceglie un percorso che protegga il compagno ove possibile.
    let path=peAIPath(enemy,target,range,Number(enemy.movement_remaining)||0);
    if(type==='lucertoloide_guerriero_1' && partner && path.length>0) {
        const guarded=path.findIndex(p=>getCombatRectDistance({...enemy,x:p.x,y:p.y},partner)<=1);
        if(guarded>=0) path=path.slice(0,guarded+1);
    }
    // Compsognati e Guerrieri 2 si avvicinano visibilmente prima di colpire.
    const skirmisher = type==='compsognato' || type==='lucertoloide_guerriero_2';
    enemy=skirmisher ? await peAIMoveAnimated(enemy,path) : await peAIMove(enemy,path);
    const dist=getCombatRectDistance(enemy,target);
    if(dist<=range && !enemy.action_used) {
        if(skirmisher) await new Promise(resolve => setTimeout(resolve,2000));
        if(mode==='special'||mode==='poison') {
            const ability=mode==='poison'?'veleno':plan.ability;
            const outcome=await peAIRpc('cast_enemy_special_ability',{
                p_target_entity_id:target.id,p_ability_id:ability
            });
            if(outcome?.executed) addCombatLog(`${enemy.display_name} usa ${ability} su ${target.display_name}.`);
        } else if(dist===1) await peAIAttack('run_enemy_melee_attack_turn',enemy.display_name);
    }
    // Ritirata dopo l'attacco: usa soltanto il MOV ancora disponibile.
    if((type==='compsognato'||type==='dilofosauro') && mode==='special') {
        const retreat=findAIRetreatPath(enemy,getAliveCombatPlayers(),Number(enemy.movement_remaining)||0);
        enemy = type==='compsognato' ? await peAIMoveAnimated(enemy,retreat) : await peAIMove(enemy,retreat);
    }
    if(type==='lucertoloide_guerriero_2' && partner && mode==='melee') {
        const retreat=peAIPath(enemy,partner,1,Number(enemy.movement_remaining)||0);
        enemy=await peAIMoveAnimated(enemy,retreat);
    }
}

// ============================================================
// ESECUZIONE IA NEMICO
// ============================================================

async function runEnemyAI(
    currentEntity
) {

    if (
        !currentEntity ||
        currentEntity.entity_type !==
            "enemy" ||
        !combatSession ||
        combatSession.status !==
            "active"
    ) {

        return;

    }


    const aiTurnKey =
        `${combatSession.round_number}:${currentEntity.id}`;


    if (
        enemyAIInProgress ||
        enemyAITurnKey ===
            aiTurnKey
    ) {

        return;

    }


    const monsterType =
        String(
            currentEntity.monster_type ||
            ""
        ).toLowerCase();


    enemyAITurnKey =
        aiTurnKey;


    enemyAIInProgress =
        true;


    try {

        // Allosauro Dominante: l'intero turno è atomico lato database.
        if (monsterType === 'allosauro_dominante') {
            const { data, error } = await db.rpc('p1_run_allosauro_turn', {
                p_combat_id: combatId
            });
            if (error) throw error;
            if (data?.executed) {
                const stage = data.aggressive ? 'AGGRESSIVO' : 'TERRITORIALE';
                addCombatLog(`Allosauro Dominante · ${stage} · bersaglio: ${data.target_name || 'nessuno'}`);
                for (const action of data.actions || []) {
                    if (action?.executed === false) continue;
                    const type = action.type || 'azione';
                    if (type === 'melee') {
                        addCombatLog(`Allosauro attacca ${action.target_name}: ${action.hit ? `${action.damage} danni` : 'MANCATO'}.`);
                    } else if (type === 'repulsione') {
                        addCombatLog(`Allosauro usa Repulsione su ${action.target_name}${action.moved ? ': bersaglio respinto.' : ': movimento bloccato.'}`);
                    } else if (type === 'sanguinamento') {
                        addCombatLog(`Allosauro applica Sanguinamento su ${action.target_name}.`);
                    } else if (type === 'arma_potenziata') {
                        addCombatLog('Allosauro usa Arma Potenziata!');
                    }
                }
            }
            await loadCombatSession();
            await Promise.all([loadCombatEntities(),loadCombatEffects()]);
            lastCombatEntitiesSnapshot = createCombatSnapshot();
            renderCombat();
            if (combatSession?.status === 'active') {
                const {error: finishError} = await db.rpc('finish_enemy_turn', {
                    p_combat_id:combatId,
                    p_enemy_entity_id:currentEntity.id,
                    p_round_number:Number(combatSession.round_number)
                });
                if (finishError) throw finishError;
                await loadCombatSession();
                await loadCombatEntities();
                lastCombatEntitiesSnapshot = createCombatSnapshot();
                renderCombat();
            }
            return;
        }

        // ====================================================
        // BERSERK DI PUZZACINTA — IA TATTICA SERVER-SIDE
        // ====================================================
        // Incontro isolato: non modifica l'IA dei normali Goblin.
        // Il server decide percorso senza spuntoni, catena e fase.
        if (monsterType === "goblin_berserk") {

            const {
                data: berserkData,
                error: berserkError
            } = await db.rpc(
                "run_berserk_turn",
                { p_combat_id: combatId }
            );

            if (berserkError) {
                throw berserkError;
            }

            if (berserkData?.executed === true) {

                const bossName =
                    berserkData.enemy_name || "Berserk";

                if (Number(berserkData.phase) === 2) {
                    addCombatLog(
                        `${bossName} è in FURIA! Agisce due volte in questo turno.`
                    );
                }

                if (berserkData.move?.escaped_spikes) {
                    addCombatLog(
                        `${bossName} si allontana rapidamente dagli spuntoni!`
                    );
                } else if (Number(berserkData.move?.steps) > 0) {
                    addCombatLog(
                        `${bossName} avanza per ${berserkData.move.steps} caselle evitando gli spuntoni.`
                    );
                }

                for (const action of berserkData.actions || []) {

                    if (action?.executed !== true) {
                        continue;
                    }

                    if (action.type === "chain") {
                        const verb = action.ability === "attrazione"
                            ? "attira"
                            : "respinge";

                        let line =
                            `${bossName} usa ${action.ability}: ${verb} ${action.target_name}!`;

                        if (action.on_spikes) {
                            line += ` Il bersaglio finisce sugli spuntoni: ` +
                                `${Number(action.spike_damage) || 0} danni ` +
                                `· PF ${action.target_hp}.`;
                        } else {
                            line += " Lo avvicina agli spuntoni.";
                        }

                        if (action.target_dead) {
                            line += ` ${action.target_name} è sconfitto!`;
                        }

                        addCombatLog(line);
                    }

                    if (action.type === "melee") {
                        let line =
                            `${action.attacker_name || bossName} attacca ` +
                            `${action.target_name}: ` +
                            `1d10 (${action.roll}) + ATT ${action.attack} = ${action.total} ` +
                            `contro DIF ${action.defense}. `;

                        line += action.hit
                            ? `${action.damage} danni · PF ${action.target_hp}/${action.target_max_hp}.`
                            : "MANCATO.";

                        if (action.target_dead) {
                            line += ` ${action.target_name} è sconfitto!`;
                        }
                        addCombatLog(line);
                    }
                }
            }

            await loadCombatSession();
            await loadCombatEntities();
            lastCombatEntitiesSnapshot = createCombatSnapshot();
            renderCombat();

            // Se l'ultima azione ha causato la vittoria/sconfitta,
            // non bisogna forzare il passaggio a un nuovo turno.
            if (combatSession?.status === "active") {
                const {
                    error: endError
                } = await db.rpc("finish_enemy_turn", {
                    p_combat_id: combatId,
                    p_enemy_entity_id: currentEntity.id,
                    p_round_number: Number(berserkData?.round ?? combatSession.round_number)
                });

                if (endError) {
                    throw endError;
                }

                await loadCombatSession();
                await loadCombatEntities();
                lastCombatEntitiesSnapshot = createCombatSnapshot();
                renderCombat();
            }

            return;
        }

        // ====================================================
        // AGGRO
        // ====================================================

        const {
            data: aggroData,
            error: aggroError
        } =
            await db.rpc(
                "apply_current_enemy_aggro",
                {
                    p_combat_id:
                        combatId
                }
            );


        if (
            aggroError
        ) {

            throw aggroError;

        }


        if (
            aggroData?.applied ===
            true
        ) {

            addCombatLog(
                `${aggroData.enemy_name} è provocato da ${aggroData.target_name}!`
            );

        }


        // ====================================================
        // NUOVE IA: RPC isolate dai Goblin originali
        // ====================================================
        if (PE_NEW_AI_TYPES.has(monsterType)) {
            await peAINewEnemyTurn(currentEntity);
            await loadCombatSession();
            await loadCombatEntities();
            lastCombatEntitiesSnapshot = createCombatSnapshot();
            renderCombat();
            if (combatSession?.status === "active") {
                await peAIRpc("finish_enemy_turn", {
                    p_enemy_entity_id: currentEntity.id,
                    p_round_number: Number(combatSession.round_number)
                });
                await loadCombatSession();
                await loadCombatEntities();
                lastCombatEntitiesSnapshot = createCombatSnapshot();
                renderCombat();
            }
            return;
        }

        // ====================================================
        // GOBLIN BOSS
        // ====================================================

        if (
            monsterType ===
            "goblin_boss"
        ) {

            console.log(
                "IA: GOBLIN BOSS"
            );


            const {
                data: bossData,
                error: bossError
            } =
                await db.rpc(
                    "run_goblin_boss_turn",
                    {
                        p_combat_id:
                            combatId
                    }
                );


            if (
                bossError
            ) {

                throw bossError;

            }


            console.log(
                "AZIONE IA GOBLIN BOSS:",
                bossData
            );


            if (
                bossData?.spawned_enemy_name
            ) {

                addCombatLog(
                    `${bossData.boss_name || "Goblin Boss"} evoca ${bossData.spawned_enemy_name}!`
                );

            }


            const bossMove =
                bossData?.move ||
                null;


            if (
                bossMove?.executed ===
                true
                &&
                Number(
                    bossMove.steps
                ) > 0
            ) {

                addCombatLog(
                    `${bossMove.enemy_name || bossData.boss_name || "Goblin Boss"} si muove di ${bossMove.steps} ${
                        Number(bossMove.steps) === 1
                            ? "quadretto"
                            : "quadretti"
                    } verso ${bossMove.target_name}.`
                );

            }


            if (
                bossData?.mode ===
                "heal"
            ) {

                addCombatLog(
                    `${bossData.boss_name || "Goblin Boss"} usa Cura su se stesso: `
                    +
                    `+${bossData.heal_amount} PF `
                    +
                    `· PF ${bossData.current_hp}/${bossData.max_hp} `
                    +
                    `· PM ${bossData.current_pm}/${bossData.max_pm}.`
                );

            }


            if (
                bossData?.mode ===
                "fire_bolt"
                &&
                bossData?.attack
            ) {

                const attackData =
                    bossData.attack;


                if (
                    attackData.hit ===
                    true
                ) {

                    let attackText =
                        `${attackData.attacker_name} usa Dardo di Fuoco contro ${attackData.target_name}: `
                        +
                        `1d10 (${attackData.roll}) + ATT ${attackData.attack} = ${attackData.total} `
                        +
                        `contro DIF ${attackData.defense}. `
                        +
                        `${attackData.damage} danni`
                        +
                        ` · PF ${attackData.target_hp}/${attackData.target_max_hp}`
                        +
                        ` · PM ${attackData.current_pm}/${attackData.max_pm}`;


                    if (
                        attackData.target_dead
                    ) {

                        attackText +=
                            ` · ${attackData.target_name} è sconfitto!`;

                    }


                    addCombatLog(
                        attackText
                    );

                } else {

                    addCombatLog(
                        `${attackData.attacker_name} usa Dardo di Fuoco contro ${attackData.target_name}: `
                        +
                        `1d10 (${attackData.roll}) + ATT ${attackData.attack} = ${attackData.total} `
                        +
                        `contro DIF ${attackData.defense}. MANCATO. `
                        +
                        `PM ${attackData.current_pm}/${attackData.max_pm}.`
                    );

                }

            }


            if (
                bossData?.mode ===
                "fire_bolt_out_of_range"
            ) {

                addCombatLog(
                    `${bossData.boss_name || "Goblin Boss"} prova a prendere di mira ${bossData.target_name}, `
                    +
                    `ma resta fuori portata (${bossData.distance}/${bossData.range}).`
                );

            }


            if (
                bossData?.mode ===
                "double_melee"
            ) {

                const attacks = [
                    bossData.attack_1,
                    bossData.attack_2
                ];


                attacks.forEach(
                    (
                        attackData,
                        index
                    ) => {

                        if (
                            !attackData?.executed
                        ) {

                            return;

                        }


                        if (
                            attackData.hit ===
                            true
                        ) {

                            let attackText =
                                `${attackData.attacker_name} attacca ${attackData.target_name} `
                                +
                                `(colpo ${index + 1}/2): `
                                +
                                `1d10 (${attackData.roll}) + ATT ${attackData.attack} = ${attackData.total} `
                                +
                                `contro DIF ${attackData.defense}. `
                                +
                                `${attackData.damage} danni`
                                +
                                ` · PF ${attackData.target_hp}/${attackData.target_max_hp}`;


                            if (
                                attackData.target_dead
                            ) {

                                attackText +=
                                    ` · ${attackData.target_name} è sconfitto!`;

                            }


                            addCombatLog(
                                attackText
                            );

                        } else {

                            addCombatLog(
                                `${attackData.attacker_name} attacca ${attackData.target_name} `
                                +
                                `(colpo ${index + 1}/2): `
                                +
                                `1d10 (${attackData.roll}) + ATT ${attackData.attack} = ${attackData.total} `
                                +
                                `contro DIF ${attackData.defense}. MANCATO.`
                            );

                        }

                    }
                );

            }


            await loadCombatEntities();


            lastCombatEntitiesSnapshot =
                createCombatSnapshot();


            renderCombat();

        } else         // ====================================================
        // GOBLIN SCIAMANO
        //
        // La RPC dedicata decide autonomamente se:
        // - curare un Goblin ferito entro INT quadretti;
        // - muoversi e attaccare come un Goblin base;
        // - rispettare un eventuale Aggro già applicato.
        // ====================================================

        if (
            monsterType ===
            "goblin_sciamano"
        ) {

            console.log(
                "IA: GOBLIN SCIAMANO"
            );


            const {
                data: shamanData,
                error: shamanError
            } =
                await db.rpc(
                    "run_goblin_sciamano_turn",
                    {
                        p_combat_id:
                            combatId
                    }
                );


            if (
                shamanError
            ) {

                throw shamanError;

            }


            console.log(
                "AZIONE IA SCIAMANO:",
                shamanData
            );


            if (
                shamanData?.mode ===
                "heal"
                &&
                shamanData?.executed ===
                true
            ) {

                addCombatLog(
                    `${shamanData.enemy_name} usa Cura su ${shamanData.target_name}: `
                    +
                    `+${shamanData.heal_amount} PF `
                    +
                    `· PF ${shamanData.target_hp}/${shamanData.target_max_hp} `
                    +
                    `· PM ${shamanData.current_pm}/${shamanData.max_pm}.`
                );

            } else {

                const moveData =
                    shamanData?.move ||
                    null;


                if (
                    moveData?.executed ===
                    true
                ) {

                    if (
                        Number(
                            moveData.steps
                        ) > 0
                    ) {

                        addCombatLog(
                            `${moveData.enemy_name} si muove di ${moveData.steps} ${
                                Number(moveData.steps) === 1
                                    ? "quadretto"
                                    : "quadretti"
                            } verso ${moveData.target_name}.`
                        );

                    } else if (
                        moveData.target_name
                    ) {

                        addCombatLog(
                            `${moveData.enemy_name} prende di mira ${moveData.target_name}.`
                        );

                    }

                }


                const attackData =
                    shamanData?.attack ||
                    null;


                if (
                    attackData?.executed ===
                    true
                ) {

                    if (
                        attackData.hit ===
                        true
                    ) {

                        let attackText =
                            `${attackData.attacker_name} attacca ${attackData.target_name}: `
                            +
                            `1d10 (${attackData.roll}) + ATT ${attackData.attack} = ${attackData.total} `
                            +
                            `contro DIF ${attackData.defense}. `
                            +
                            `${attackData.damage} danni`
                            +
                            ` · PF ${attackData.target_hp}/${attackData.target_max_hp}`;


                        if (
                            attackData.target_dead
                        ) {

                            attackText +=
                                ` · ${attackData.target_name} è sconfitto!`;

                        }


                        addCombatLog(
                            attackText
                        );

                    } else {

                        addCombatLog(
                            `${attackData.attacker_name} attacca ${attackData.target_name}: `
                            +
                            `1d10 (${attackData.roll}) + ATT ${attackData.attack} = ${attackData.total} `
                            +
                            `contro DIF ${attackData.defense}. MANCATO.`
                        );

                    }

                }

            }


            await loadCombatEntities();


            lastCombatEntitiesSnapshot =
                createCombatSnapshot();


            renderCombat();

        } else {
                        // ====================================================
            // GOBLIN BASE / GOBLIN SPUTAFUOCO
            // ====================================================

            const isFireGoblin =
                monsterType ===
                "goblin_sputafuoco";


            if (
                isFireGoblin
            ) {

                console.log(
                    "IA: GOBLIN SPUTAFUOCO"
                );

            }


            // ====================================================
            // MOVIMENTO
            // ====================================================

            const movementRpc =
                isFireGoblin

                    ? "run_goblin_sputafuoco_movement_turn"

                    : "run_goblin_movement_turn";


            const {
                data: moveData,
                error: moveError
            } =
                await db.rpc(
                    movementRpc,
                    {
                        p_combat_id:
                            combatId
                    }
                );


            if (
                moveError
            ) {

                throw moveError;

            }


            console.log(
                "MOVIMENTO IA NEMICO:",
                moveData
            );


            // ====================================================
            // LOG MOVIMENTO
            // ====================================================

            if (
                moveData?.executed ===
                true
            ) {

                if (
                    Number(
                        moveData.steps
                    ) > 0
                ) {

                    addCombatLog(
                        `${moveData.enemy_name} si muove di ${moveData.steps} ${
                            Number(moveData.steps) === 1
                                ? "quadretto"
                                : "quadretti"
                        } verso ${moveData.target_name}.`
                    );

                } else if (
                    moveData.target_name
                ) {

                    addCombatLog(
                        `${moveData.enemy_name} prende di mira ${moveData.target_name}.`
                    );

                }

            }


            // ====================================================
            // ATTACCO
            // ====================================================

            let attackData =
                null;


            const fireGoblinHasMana =
                isFireGoblin
                &&
                Number(
                    currentEntity.current_pm
                ) > 0;


            const canAttack =
                isFireGoblin

                    ? (
                        fireGoblinHasMana
                            ? moveData?.in_range ===
                                true
                            : moveData?.adjacent ===
                                true
                    )

                    : moveData?.adjacent ===
                        true;


            if (
                canAttack
            ) {

                const attackRpc =
                    isFireGoblin

                        ? "run_goblin_sputafuoco_attack_turn"

                        : "run_goblin_attack_turn";


                const {
                    data: attackResult,
                    error: attackError
                } =
                    await db.rpc(
                        attackRpc,
                        {
                            p_combat_id:
                                combatId
                        }
                    );


                if (
                    attackError
                ) {

                    throw attackError;

                }


                attackData =
                    attackResult;


                console.log(
                    "ATTACCO IA NEMICO:",
                    attackData
                );

            }


            // ====================================================
            // AGGIORNA STATO VISIVO
            // ====================================================

            await loadCombatEntities();


            lastCombatEntitiesSnapshot =
                createCombatSnapshot();


            renderCombat();


            // ====================================================
            // LOG ATTACCO
            // ====================================================

            if (
                attackData?.executed ===
                true
            ) {

                const isFireBolt =
                    attackData.ability ===
                    "dardo_di_fuoco";


                const actionText =
                    isFireBolt

                        ? `${attackData.attacker_name} usa Dardo di Fuoco contro ${attackData.target_name}: `

                        : `${attackData.attacker_name} attacca ${attackData.target_name}: `;


                if (
                    attackData.hit ===
                    true
                ) {

                    let attackText =
                        actionText
                        +
                        `1d10 (${attackData.roll}) + ATT ${attackData.attack} = ${attackData.total} `
                        +
                        `contro DIF ${attackData.defense}. `
                        +
                        `${attackData.damage} danni`
                        +
                        ` · PF ${attackData.target_hp}/${attackData.target_max_hp}`;


                    if (
                        isFireBolt
                        &&
                        attackData.current_pm !==
                        undefined
                    ) {

                        attackText +=
                            ` · PM ${attackData.current_pm}/${attackData.max_pm}`;

                    }


                    if (
                        attackData.target_dead
                    ) {

                        attackText +=
                            ` · ${attackData.target_name} è sconfitto!`;

                    }


                    addCombatLog(
                        attackText
                    );

                } else {

                    let missText =
                        actionText
                        +
                        `1d10 (${attackData.roll}) + ATT ${attackData.attack} = ${attackData.total} `
                        +
                        `contro DIF ${attackData.defense}. MANCATO.`;


                    if (
                        isFireBolt
                        &&
                        attackData.current_pm !==
                        undefined
                    ) {

                        missText +=
                            ` · PM ${attackData.current_pm}/${attackData.max_pm}`;

                    }


                    addCombatLog(
                        missText
                    );

                }

            }

        }
                // ====================================================
        // FINE TURNO AUTOMATICA IA
        // ====================================================

        const {
            data: turnAdvanced,
            error: turnError
        } =
            await db.rpc(
                "finish_enemy_turn",
                {
                    p_combat_id:
                        combatId,

                    p_enemy_entity_id:
                        currentEntity.id,

                    p_round_number:
                        Number(
                            combatSession.round_number
                        )
                }
            );


        if (
            turnError
        ) {

            throw turnError;

        }


        console.log(
            "FINE TURNO IA:",
            turnAdvanced
        );


        if (
            turnAdvanced ===
            true
        ) {

            await loadCombatSession();


            await loadCombatEntities();


            lastCombatEntitiesSnapshot =
                createCombatSnapshot();


            renderCombat();

        }


    } catch (
        error
    ) {

        console.error(
            "Errore IA nemico:",
            error
        );


    } finally {

        enemyAIInProgress =
            false;

    }

}