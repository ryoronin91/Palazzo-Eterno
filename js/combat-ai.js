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

function isCombatCellOccupied(
    x,
    y,
    ignoreEntityId = null
) {

    return Array.from(
        combatEntities.values()
    ).some(
        entity =>
            entity.id !== ignoreEntityId
            &&
            entity.status === "alive"
            &&
            Number(entity.current_hp) > 0
            &&
            Number(entity.x) === Number(x)
            &&
            Number(entity.y) === Number(y)
    );

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
                isCombatCellOccupied(
                    newX,
                    newY,
                    goblin.id
                )
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

}


// ============================================================
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


    enemyAITurnKey =
        aiTurnKey;


    enemyAIInProgress =
        true;


    try {

        // ====================================================
        // AGGRO
        //
        // Prima che il Goblin scelga il bersaglio normale,
        // controlliamo se esiste Aggro.
        //
        // Se esiste, apply_current_enemy_aggro salva il PG
        // provocatore come target del turno nella tabella
        // combat_enemy_turn_state.
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
        // MOVIMENTO
        // ====================================================

        const {
            data: moveData,
            error: moveError
        } =
            await db.rpc(
                "run_goblin_movement_turn",
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

            } else {

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


        if (
            moveData?.adjacent ===
                true
        ) {

            const {
                data: attackResult,
                error: attackError
            } =
                await db.rpc(
                    "run_goblin_attack_turn",
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


        // Se questo client ha realmente fatto avanzare il turno,
        // aggiorniamo subito lo stato.

        if (
            turnAdvanced === true
        ) {

            await loadCombatSession();


            await loadCombatEntities();


            lastCombatEntitiesSnapshot =
                createCombatSnapshot();


            renderCombat();

        }


    } catch (error) {

        console.error(
            "Errore IA nemico:",
            error
        );


    } finally {

        enemyAIInProgress =
            false;

    }

}