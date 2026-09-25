// ============================================================
// PALAZZO ETERNO
// COMBAT-ACTIONS.JS
// TARGETING, ATTACCHI, ABILITÀ E OGGETTI
// ============================================================


// ============================================================
// PORTATA MODALITÀ ATTUALE
// ============================================================

function getCurrentTargetRange() {

    if (
        combatTargetMode ===
        "basic_attack"
    ) {

        return 1;

    }


    if (
        combatTargetMode ===
        "fire_bolt"
    ) {

        return getCombatEffectiveAttribute(
            "intelligenza"
        );

    }


    if (
        combatTargetMode ===
        "heal"
    ) {

        return getCombatEffectiveAttribute(
            "intelligenza"
        );

    }


    if (
        combatTargetMode &&
        combatTargetMode.startsWith(
            "push_pull:"
        )
    ) {

        return getCombatEffectiveAttribute(
            "intelligenza"
        );

    }


    return 0;

}


// ============================================================
// ENTITÀ IN PORTATA?
// ============================================================

function isEntityInCurrentTargetRange(
    entity
) {

    const player =
        getMyPlayerEntity();


    const range =
        getCurrentTargetRange();


    if (
        !player ||
        !entity ||
        range <= 0
    ) {

        return false;

    }


    const distance =
        getCombatDistance(

            player.x,
            player.y,

            entity.x,
            entity.y

        );


    // Cura può essere usata
    // anche su se stessi.

    if (
        combatTargetMode ===
        "heal"
    ) {

        return (
            distance >= 0 &&
            distance <= range
        );

    }


    return (
        distance >= 1 &&
        distance <= range
    );

}


// ============================================================
// CELLE DELLA PORTATA
// ============================================================

function renderCombatRangeCells() {

    clearCombatRangeCells();


    if (!combatTargetMode) {

        return;

    }


    const map =
        document.getElementById(
            "combat-map"
        );


    const player =
        getMyPlayerEntity();


    const range =
        getCurrentTargetRange();


    if (
        !map ||
        !player ||
        range <= 0
    ) {

        return;

    }


    const rect =
        map.getBoundingClientRect();


    const cellWidth =
        rect.width /
        COMBAT_COLUMNS;


    const cellHeight =
        rect.height /
        COMBAT_ROWS;


    const playerX =
        Number(
            player.x
        );


    const playerY =
        Number(
            player.y
        );


    const minimumDistance =
        combatTargetMode === "heal"
            ? 0
            : 1;


    const isHeal =
        combatTargetMode ===
        "heal";


    for (
        let y = 0;
        y < COMBAT_ROWS;
        y++
    ) {

        for (
            let x = 0;
            x < COMBAT_COLUMNS;
            x++
        ) {

            const distance =
                getCombatDistance(

                    playerX,
                    playerY,

                    x,
                    y

                );


            if (
                distance < minimumDistance ||
                distance > range
            ) {

                continue;

            }


            const cell =
                document.createElement(
                    "div"
                );


            cell.className =
                "combat-range-cell";


            cell.style.position =
                "absolute";


            cell.style.left =
                `${x * cellWidth}px`;


            cell.style.top =
                `${y * cellHeight}px`;


            cell.style.width =
                `${cellWidth}px`;


            cell.style.height =
                `${cellHeight}px`;


            cell.style.boxSizing =
                "border-box";


            // =================================================
            // COLORE
            //
            // Verde = Cura
            // Oro = Attacchi
            // =================================================

            if (isHeal) {

                cell.style.background =
                    "rgba(112, 217, 139, 0.16)";


                cell.style.border =
                    "1px solid rgba(112, 217, 139, 0.40)";

            } else {

                cell.style.background =
                    "rgba(215, 176, 93, 0.18)";


                cell.style.border =
                    "1px solid rgba(215, 176, 93, 0.42)";

            }


            cell.style.pointerEvents =
                "none";


            cell.style.zIndex =
                "6";


            map.appendChild(
                cell
            );


            combatRangeCells.push(
                cell
            );

        }

    }

}


// ============================================================
// CANCELLA CELLE RANGE
// ============================================================

function clearCombatRangeCells() {

    combatRangeCells.forEach(
        cell => {

            cell.remove();

        }
    );


    combatRangeCells = [];

}


// ============================================================
// CLICK TOKEN
// ============================================================

async function handleCombatTokenClick(
    entityId
) {

    if (!combatTargetMode) {

        return;

    }


    const entity =
        combatEntities.get(
            entityId
        );


    if (!entity) {

        return;

    }


    // ========================================================
    // CURA
    // ========================================================

    if (
        combatTargetMode ===
        "heal"
    ) {

        if (
            entity.entity_type !==
            "player"
        ) {

            addCombatLog(
                "Cura può essere usata soltanto su te stesso o su un alleato."
            );


            return;

        }


        if (
            entity.status !==
            "alive"
        ) {

            addCombatLog(
                "Questo personaggio non può essere curato."
            );


            return;

        }


        if (
            !isEntityInCurrentTargetRange(
                entity
            )
        ) {

            addCombatLog(
                "Il bersaglio è fuori portata."
            );


            return;

        }


        await performHeal(
            entity.id
        );


        return;

    }


    // ========================================================
    // BUFF
    // ========================================================

    if (
        combatTargetMode &&
        combatTargetMode.startsWith(
            "buff:"
        )
    ) {

        if (
            entity.entity_type !==
            "player"
        ) {

            addCombatLog(
                "Questa abilità può essere usata soltanto su te stesso o su un alleato."
            );

            return;

        }


        if (
            entity.status !==
            "alive"
        ) {

            addCombatLog(
                "Questo personaggio non può ricevere il buff."
            );

            return;

        }


        const abilityId =
            combatTargetMode.replace(
                "buff:",
                ""
            );


        await performCombatBuff(
            entity.id,
            abilityId
        );


        return;

    }


    // ========================================================
    // ATTRAZIONE / REPULSIONE
    // ========================================================

    if (
        combatTargetMode &&
        combatTargetMode.startsWith(
            "push_pull:"
        )
    ) {

        if (
            entity.entity_type !==
            "enemy"
        ) {

            addCombatLog(
                "Questa abilità può essere usata soltanto su un nemico."
            );

            return;

        }


        if (
            entity.status !==
            "alive"
            ||
            Number(
                entity.current_hp
            ) <= 0
        ) {

            addCombatLog(
                "Questo nemico non è un bersaglio valido."
            );

            return;

        }


        if (
            !isEntityInCurrentTargetRange(
                entity
            )
        ) {

            addCombatLog(
                "Il bersaglio è fuori portata."
            );

            return;

        }


        const abilityId =
            combatTargetMode.replace(
                "push_pull:",
                ""
            );


        await performPushPull(
            entity.id,
            abilityId
        );


        return;

    }


    // ========================================================
    // ATTACCHI
    // ========================================================

    if (
        entity.entity_type !==
        "enemy"
    ) {

        addCombatLog(
            "Devi selezionare un nemico."
        );


        return;

    }


    if (
        entity.status !==
        "alive" ||
        Number(
            entity.current_hp
        ) <= 0
    ) {

        addCombatLog(
            "Questo nemico è già sconfitto."
        );


        return;

    }


    if (
        !isEntityInCurrentTargetRange(
            entity
        )
    ) {

        addCombatLog(
            "Il bersaglio è fuori portata."
        );


        return;

    }


    // ========================================================
    // ATTACCO BASE
    // ========================================================

    if (
        combatTargetMode ===
        "basic_attack"
    ) {

        await performBasicAttack(
            entity.id
        );


        return;

    }


    // ========================================================
    // DARDO DI FUOCO
    // ========================================================

    if (
        combatTargetMode ===
        "fire_bolt"
    ) {

        await performFireBolt(
            entity.id
        );

    }

}


// ============================================================
// ATTACCO BASE
// ============================================================

async function performBasicAttack(
    targetEntityId
) {

    if (
        !currentCharacter ||
        !isMyTurn()
    ) {

        cancelCombatTargeting();

        return;

    }


    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "combat_basic_attack",
                {

                    p_combat_id:
                        combatId,

                    p_character_id:
                        currentCharacter.id,

                    p_target_entity_id:
                        targetEntityId

                }
            );


        if (error) {

            throw error;

        }


        cancelCombatTargeting();


        await loadCombatEntities();


        lastCombatEntitiesSnapshot =
            createCombatSnapshot();


        renderCombat();


        // ====================================================
        // MANCATO
        // ====================================================

        if (!data.hit) {

            addCombatLog(
                `${data.attacker_name} attacca ${data.target_name}: `
                +
                `1d10 (${data.roll}) + ATT ${data.attack} = ${data.total} `
                +
                `contro DIF ${data.defense}. MANCATO.`
            );


            return;

        }


        // ====================================================
        // COLPITO
        // ====================================================

        let text =
            `${data.attacker_name} attacca ${data.target_name}: `
            +
            `1d10 (${data.roll}) + ATT ${data.attack} = ${data.total} `
            +
            `contro DIF ${data.defense}. `
            +
            `${data.damage} danni`;


        if (
            data.critical
        ) {

            text +=
                " · CRITICO!";

        }


        text +=
            ` · PF ${data.target_hp}/${data.target_max_hp}`;


        if (
            data.target_dead
        ) {

            text +=
                ` · ${data.target_name} è sconfitto!`;

        }


        addCombatLog(
            text
        );


    } catch (error) {

        console.error(
            "Errore attacco base:",
            error
        );


        addCombatLog(
            cleanCombatError(
                error.message
            )
        );

    }

}


// ============================================================
// DARDO DI FUOCO
// ============================================================

async function performFireBolt(
    targetEntityId
) {

    if (
        !currentCharacter ||
        !isMyTurn()
    ) {

        cancelCombatTargeting();

        return;

    }


    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "combat_fire_bolt",
                {

                    p_combat_id:
                        combatId,

                    p_character_id:
                        currentCharacter.id,

                    p_target_entity_id:
                        targetEntityId

                }
            );


        if (error) {

            throw error;

        }


        cancelCombatTargeting();


        if (
            currentCharacter &&
            data?.current_pm !==
            undefined
        ) {

            currentCharacter.current_pm =
                Number(
                    data.current_pm
                );

        }


        await loadCombatEntities();


        lastCombatEntitiesSnapshot =
            createCombatSnapshot();


        renderCombat();


        // ====================================================
        // MANCATO
        // ====================================================

        if (!data.hit) {

            addCombatLog(
                `${data.attacker_name} usa Dardo di Fuoco contro ${data.target_name}: `
                +
                `1d10 (${data.roll}) + ATT ${data.attack} = ${data.total} `
                +
                `contro DIF ${data.defense}. MANCATO. `
                +
                `PM ${data.current_pm}/${data.max_pm}.`
            );


            return;

        }


        // ====================================================
        // COLPITO
        // ====================================================

        let text =
            `${data.attacker_name} usa Dardo di Fuoco contro ${data.target_name}: `
            +
            `1d10 (${data.roll}) + ATT ${data.attack} = ${data.total} `
            +
            `contro DIF ${data.defense}. `
            +
            `${data.damage} danni`;


        if (
            data.critical
        ) {

            text +=
                " · CRITICO!";

        }


        text +=
            ` · PF ${data.target_hp}/${data.target_max_hp}`;


        text +=
            ` · PM ${data.current_pm}/${data.max_pm}`;


        if (
            data.target_dead
        ) {

            text +=
                ` · ${data.target_name} è sconfitto!`;

        }


        addCombatLog(
            text
        );


    } catch (error) {

        console.error(
            "Errore Dardo di Fuoco:",
            error
        );


        addCombatLog(
            cleanCombatError(
                error.message
            )
        );

    }

}


// ============================================================
// CURA
// ============================================================

async function performHeal(
    targetEntityId
) {

    if (
        !currentCharacter ||
        !isMyTurn()
    ) {

        cancelCombatTargeting();

        return;

    }


    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "combat_heal",
                {

                    p_combat_id:
                        combatId,

                    p_character_id:
                        currentCharacter.id,

                    p_target_entity_id:
                        targetEntityId

                }
            );


        if (error) {

            throw error;

        }


        cancelCombatTargeting();


        if (
            currentCharacter &&
            data?.current_pm !==
            undefined
        ) {

            currentCharacter.current_pm =
                Number(
                    data.current_pm
                );

        }


        await loadCombatEntities();


        lastCombatEntitiesSnapshot =
            createCombatSnapshot();


        renderCombat();


        addCombatLog(
            `${data.caster_name} usa Cura su ${data.target_name}: `
            +
            `+${data.heal_amount} PF `
            +
            `· PF ${data.target_hp}/${data.target_max_hp} `
            +
            `· PM ${data.current_pm}/${data.max_pm}.`
        );


    } catch (error) {

        console.error(
            "Errore Cura:",
            error
        );


        addCombatLog(
            cleanCombatError(
                error.message
            )
        );

    }

}


// ============================================================
// USA BUFF
// ============================================================

async function performCombatBuff(
    targetEntityId,
    abilityId
) {

    if (
        !currentCharacter ||
        !isMyTurn()
    ) {

        cancelCombatTargeting();

        return;

    }


    try {

        const {
            error
        } =
            await db.rpc(
                "cast_combat_buff",
                {

                    p_combat_id:
                        combatId,

                    p_character_id:
                        currentCharacter.id,

                    p_target_entity_id:
                        targetEntityId,

                    p_ability_id:
                        abilityId

                }
            );


        if (error) {

            throw error;

        }


        const abilityEntry =
            characterAbilities.find(
                entry =>
                    entry.ability_id ===
                    abilityId
            );


        const abilityName =
            abilityEntry?.ability?.name ||
            abilityId;


        cancelCombatTargeting();


        await Promise.all([

            loadCombatEntities(),

            loadCombatEffects(),

            loadCharacterPendingEffects()

        ]);


        lastCombatEntitiesSnapshot =
            createCombatSnapshot();


        renderCombat();


        addCombatLog(
            `${abilityName} applicata con successo.`
        );


    } catch (error) {

        console.error(
            "Errore buff:",
            error
        );


        addCombatLog(
            cleanCombatError(
                error.message
            )
        );

    }

}


// ============================================================
// USA ATTRAZIONE / REPULSIONE
// ============================================================

async function performPushPull(
    targetEntityId,
    abilityId
) {

    if (
        !currentCharacter ||
        !isMyTurn()
    ) {

        cancelCombatTargeting();

        return;

    }


    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "cast_combat_push_pull",
                {

                    p_combat_id:
                        combatId,

                    p_character_id:
                        currentCharacter.id,

                    p_target_entity_id:
                        targetEntityId,

                    p_ability_id:
                        abilityId

                }
            );


        if (error) {

            throw error;

        }


        cancelCombatTargeting();


        await loadCombatEntities();


        lastCombatEntitiesSnapshot =
            createCombatSnapshot();


        renderCombat();


        if (
            currentCharacter &&
            data?.current_pm !==
            undefined
        ) {

            currentCharacter.current_pm =
                Number(
                    data.current_pm
                );

        }


        if (
            data?.moved
        ) {

            addCombatLog(
                `${data.ability_name} sposta ${data.target_name} da (${data.old_x}, ${data.old_y}) a (${data.new_x}, ${data.new_y}).`
            );

        } else {

            addCombatLog(
                `${data.ability_name} colpisce ${data.target_name}, ma non può spostarlo: la casella di destinazione è bloccata.`
            );

        }


    } catch (error) {

        console.error(
            "Errore Attrazione/Repulsione:",
            error
        );


        addCombatLog(
            cleanCombatError(
                error.message
            )
        );

    }

}


// ============================================================
// GIORNO PAGA
// ============================================================

async function performGiornoPaga() {

    if (
        !currentCharacter ||
        !isMyTurn()
    ) {

        return;

    }


    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "cast_giorno_paga",
                {

                    p_combat_id:
                        combatId,

                    p_character_id:
                        currentCharacter.id

                }
            );


        if (error) {

            throw error;

        }


        closeCombatDrawer();


        await Promise.all([

            loadCombatEntities(),

            loadCharacterPendingEffects()

        ]);


        lastCombatEntitiesSnapshot =
            createCombatSnapshot();


        renderCombat();


        addCombatLog(
            `${data.character_name} usa GIORNO PAGA! `
            +
            `L'oro dell'incontro sarà raddoppiato. `
            +
            `PM ${data.current_pm}/${data.max_pm}.`
        );


    } catch (error) {

        console.error(
            "Errore Giorno Paga:",
            error
        );


        addCombatLog(
            cleanCombatError(
                error.message
            )
        );

    }

}


// ============================================================
// GESTIONE ABILITÀ
// ============================================================

function handleAbilityButton(
    entry
) {

    const ability =
        entry?.ability;


    if (!ability) {

        return;

    }


    // ========================================================
    // DARDO DI FUOCO
    // ========================================================

    if (
        ability.id ===
        "dardo_di_fuoco"
    ) {

        startFireBoltTargeting(
            entry
        );


        return;

    }


    // ========================================================
    // CURA
    // ========================================================

    if (
        ability.id ===
        "cura"
    ) {

        startHealTargeting(
            entry
        );


        return;

    }


    // ========================================================
    // BUFF
    // ========================================================

    if (
        ability.id ===
            "affilatura"
        ||
        ability.id ===
            "arma_potenziata"
        ||
        ability.id ===
            "armatura_potenziata"
        ||
        ability.id ===
            "rapidita"
    ) {

        startCombatBuffTargeting(
            entry
        );

        return;

    }


    // ========================================================
    // ATTRAZIONE / REPULSIONE
    // ========================================================

    if (
        ability.id ===
            "attrazione"
        ||
        ability.id ===
            "repulsione"
    ) {

        startPushPullTargeting(
            entry
        );

        return;

    }


    // ========================================================
    // GIORNO PAGA
    // ========================================================

    if (
        ability.id ===
        "giorno_paga"
    ) {

        performGiornoPaga();

        return;

    }


    addCombatLog(
        `${ability.name}: questa abilità non è ancora implementata nel combattimento.`
    );

}


// ============================================================
// DARDO DI FUOCO - TARGET
// ============================================================

function startFireBoltTargeting(
    entry
) {

    const player =
        getMyPlayerEntity();


    if (
        !player ||
        !isMyTurn()
    ) {

        return;

    }


    if (
        player.action_used ===
        true
    ) {

        addCombatLog(
            "Hai già utilizzato la tua azione in questo turno."
        );


        return;

    }


    const ability =
        entry.ability;


    const pmCost =
        Number(
            ability.pm_cost
        ) || 1;


    const currentPM =
        Number(
            player.current_pm
        ) || 0;


    if (
        currentPM <
        pmCost
    ) {

        addCombatLog(
            "Non hai abbastanza PM per usare Dardo di Fuoco."
        );


        return;

    }


    combatTargetMode =
        "fire_bolt";


    closeCombatDrawer();


    const range =
        getCombatEffectiveAttribute(
            "intelligenza"
        );


    addCombatLog(
        `DARDO DI FUOCO: seleziona un nemico entro ${range} quadretti.`
    );


    updateTargetSelectionVisuals();

}


// ============================================================
// CURA - TARGET
// ============================================================

function startHealTargeting(
    entry
) {

    const player =
        getMyPlayerEntity();


    if (
        !player ||
        !isMyTurn()
    ) {

        return;

    }


    if (
        player.action_used ===
        true
    ) {

        addCombatLog(
            "Hai già utilizzato la tua azione in questo turno."
        );


        return;

    }


    const ability =
        entry.ability;


    const pmCost =
        Number(
            ability.pm_cost
        ) || 2;


    const currentPM =
        Number(
            player.current_pm
        ) || 0;


    if (
        currentPM <
        pmCost
    ) {

        addCombatLog(
            "Non hai abbastanza PM per usare Cura."
        );


        return;

    }


    combatTargetMode =
        "heal";


    closeCombatDrawer();


    const range =
        getCombatEffectiveAttribute(
            "intelligenza"
        );


    addCombatLog(
        `CURA: seleziona te stesso o un alleato entro ${range} quadretti.`
    );


    updateTargetSelectionVisuals();

}


// ============================================================
// BUFF - TARGET
// ============================================================

function startCombatBuffTargeting(
    entry
) {

    const player =
        getMyPlayerEntity();


    if (
        !player ||
        !isMyTurn()
    ) {

        return;

    }


    if (
        player.action_used ===
        true
    ) {

        addCombatLog(
            "Hai già utilizzato la tua azione in questo turno."
        );

        return;

    }


    const ability =
        entry?.ability;


    if (!ability) {

        return;

    }


    const pmCost =
        Number(
            ability.pm_cost
        ) || 2;


    const currentPM =
        Number(
            player.current_pm
        ) || 0;


    if (
        currentPM <
        pmCost
    ) {

        addCombatLog(
            `Non hai abbastanza PM per usare ${ability.name}.`
        );

        return;

    }


    combatTargetMode =
        `buff:${ability.id}`;


    closeCombatDrawer();


    addCombatLog(
        `${ability.name.toUpperCase()}: seleziona te stesso o un alleato.`
    );


    updateTargetSelectionVisuals();

}


// ============================================================
// ATTRAZIONE / REPULSIONE - TARGET
// ============================================================

function startPushPullTargeting(
    entry
) {

    const player =
        getMyPlayerEntity();


    if (
        !player ||
        !isMyTurn()
    ) {

        return;

    }


    if (
        player.action_used ===
        true
    ) {

        addCombatLog(
            "Hai già utilizzato la tua azione in questo turno."
        );

        return;

    }


    const ability =
        entry?.ability;


    if (!ability) {

        return;

    }


    const pmCost =
        Number(
            ability.pm_cost
        ) || 0;


    const currentPM =
        Number(
            player.current_pm
        ) || 0;


    if (
        currentPM <
        pmCost
    ) {

        addCombatLog(
            `Non hai abbastanza PM per usare ${ability.name}.`
        );

        return;

    }


    combatTargetMode =
        `push_pull:${ability.id}`;


    closeCombatDrawer();


    const range =
        getCombatEffectiveAttribute(
            "intelligenza"
        );


    addCombatLog(
        `${ability.name.toUpperCase()}: seleziona un nemico entro ${range} quadretti.`
    );


    updateTargetSelectionVisuals();

}


// ============================================================
// USA OGGETTO
// ============================================================

async function useCombatInventoryItem(
    inventoryId
) {

    if (!isMyTurn()) {

        addCombatLog(
            "Non è il tuo turno."
        );


        return;

    }


    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "use_combat_inventory_item",
                {

                    p_combat_id:
                        combatId,

                    p_inventory_id:
                        inventoryId

                }
            );


        if (error) {

            throw error;

        }


        if (
            currentCharacter &&
            data
        ) {

            if (
                data.current_hp !==
                undefined
            ) {

                currentCharacter.current_hp =
                    Number(
                        data.current_hp
                    );

            }


            if (
                data.current_pm !==
                undefined
            ) {

                currentCharacter.current_pm =
                    Number(
                        data.current_pm
                    );

            }

        }


        await Promise.all([

            loadCombatEntities(),

            loadCharacterInventory()

        ]);


        lastCombatEntitiesSnapshot =
            createCombatSnapshot();


        renderCombat();


        renderBackpackPanel();


        if (
            data
        ) {

            addCombatLog(
                `${data.item_name} utilizzata. `
                +
                `PF ${data.current_hp}/${data.max_hp} `
                +
                `· PM ${data.current_pm}/${data.max_pm}.`
            );

        }


    } catch (error) {

        console.error(
            "Errore utilizzo oggetto:",
            error
        );


        addCombatLog(
            cleanCombatError(
                error.message
            )
        );

    }

}