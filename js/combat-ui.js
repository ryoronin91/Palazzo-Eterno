// ============================================================
// PALAZZO ETERNO
// COMBAT-UI.JS
// TOKEN, MAPPA, PANNELLI, DRAWER, TURN ORDER, SCHEDA PG
// ============================================================


// ============================================================
// RENDER COMPLETO
// ============================================================

function renderCombat() {

    renderCombatTokens();

    renderCombatEntityList();

    renderPlayerCombatSheet();

    renderActiveCombatBuffs();

    updateActionButtons();

    updateTargetSelectionVisuals();

    renderCombatVictory();

}


// ============================================================
// TOKEN SULLA MAPPA
// ============================================================

function renderCombatTokens() {

    const map =
        document.getElementById(
            "combat-map"
        );


    if (!map) {

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


    const activeEntityIds =
        new Set();


    combatEntities.forEach(
        entity => {

            activeEntityIds.add(
                entity.id
            );


            // =================================================
            // ENTITÀ MORTA
            // =================================================

            if (
                entity.status ===
                    "dead"
                ||
                Number(
                    entity.current_hp
                ) <= 0
            ) {

                const oldToken =
                    combatTokens.get(
                        entity.id
                    );


                if (oldToken) {

                    oldToken.remove();


                    combatTokens.delete(
                        entity.id
                    );

                }


                return;

            }


            // =================================================
            // CREA TOKEN
            // =================================================

            let token =
                combatTokens.get(
                    entity.id
                );


            if (!token) {

                token =
                    document.createElement(
                        "div"
                    );


                token.className =
                    "combat-token";


                if (
                    entity.entity_type ===
                    "player"
                ) {

                    token.classList.add(
                        "player"
                    );


                    renderPlayerTokenContent(
                        token,
                        entity
                    );

                } else {

                    token.classList.add(
                        "enemy"
                    );


                    renderEnemyTokenContent(
                        token,
                        entity
                    );

                }


                token.title =
                    entity.display_name ||
                    "";


                token.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();


                        handleCombatTokenClick(
                            entity.id
                        );

                    }
                );


                map.appendChild(
                    token
                );


                combatTokens.set(
                    entity.id,
                    token
                );

            }


            // =================================================
            // DIMENSIONE
            // =================================================

            const size =
                Math.min(
                    cellWidth,
                    cellHeight
                ) *
                0.82;


            token.style.width =
                `${size}px`;


            token.style.height =
                `${size}px`;


            // =================================================
            // POSIZIONE
            // =================================================

            token.style.left =
                `${
                    (
                        Number(
                            entity.x
                        ) +
                        0.5
                    )
                    *
                    cellWidth
                    -
                    size / 2
                }px`;


            token.style.top =
                `${
                    (
                        Number(
                            entity.y
                        ) +
                        0.5
                    )
                    *
                    cellHeight
                    -
                    size / 2
                }px`;

        }
    );


    // ========================================================
    // RIMUOVE TOKEN NON PIÙ PRESENTI
    // ========================================================

    for (
        const [
            entityId,
            token
        ]
        of combatTokens
    ) {

        if (
            !activeEntityIds.has(
                entityId
            )
        ) {

            token.remove();


            combatTokens.delete(
                entityId
            );

        }

    }

}


// ============================================================
// TOKEN PG
// ============================================================

async function renderPlayerTokenContent(
    token,
    entity
) {

    const image =
        document.createElement(
            "img"
        );


    image.style.width =
        "100%";


    image.style.height =
        "100%";


    image.style.objectFit =
        "contain";


    image.style.display =
        "block";


    image.alt =
        entity.display_name ||
        "Personaggio";


    // Token di fallback.
    image.src =
        "immagini/token/token_1.png";


    if (
        entity.character_id
    ) {

        try {

            const {
                data,
                error
            } =
                await db
                    .from(
                        "characters"
                    )
                    .select(
                        "token"
                    )
                    .eq(
                        "id",
                        entity.character_id
                    )
                    .maybeSingle();


            if (error) {

                console.warn(
                    "Errore caricamento token PG:",
                    error
                );

            }


            if (
                data?.token
            ) {

                image.src =
                    `immagini/token/${data.token}`;

            }


        } catch (error) {

            console.warn(
                "Errore token personaggio:",
                error
            );

        }

    }


    token.appendChild(
        image
    );

}


// ============================================================
// TOKEN NEMICO
// ============================================================

function renderEnemyTokenContent(
    token,
    entity
) {

    const image =
        document.createElement(
            "img"
        );


    image.style.width =
        "100%";


    image.style.height =
        "100%";


    image.style.objectFit =
        "contain";


    image.style.display =
        "block";


    image.alt =
        entity.display_name ||
        "Nemico";


    image.src =
        entity.enemy_id

            ? `immagini/nemici/${entity.enemy_id}.png`

            : "immagini/nemici/goblin.png";


    token.appendChild(
        image
    );

}


// ============================================================
// VISUALI TARGET
// ============================================================

function updateTargetSelectionVisuals() {

    renderCombatRangeCells();


    combatTokens.forEach(
        (
            token,
            entityId
        ) => {

            // Reset.
            token.style.outline =
                "";


            token.style.outlineOffset =
                "";


            token.style.cursor =
                "default";


            if (
                !combatTargetMode
            ) {

                return;

            }


            const entity =
                combatEntities.get(
                    entityId
                );


            if (
                !entity
                ||
                entity.status !==
                    "alive"
                ||
                Number(
                    entity.current_hp
                ) <= 0
            ) {

                return;

            }


            // =================================================
            // CURA
            // =================================================

            if (
                combatTargetMode ===
                "heal"
            ) {

                if (
                    entity.entity_type !==
                    "player"
                ) {

                    return;

                }


                if (
                    isEntityInCurrentTargetRange(
                        entity
                    )
                ) {

                    token.style.outline =
                        "3px solid #70d98b";


                    token.style.outlineOffset =
                        "2px";


                    token.style.cursor =
                        "pointer";

                }


                return;

            }


            // =================================================
            // BUFF
            // =================================================

            if (
                combatTargetMode.startsWith(
                    "buff:"
                )
            ) {

                if (
                    entity.entity_type !==
                    "player"
                ) {

                    return;

                }


                token.style.outline =
                    "3px solid #7aa7ff";


                token.style.outlineOffset =
                    "2px";


                token.style.cursor =
                    "pointer";


                return;

            }


            // =================================================
            // ATTACCHI / ATTRAZIONE / REPULSIONE
            // =================================================

            if (
                entity.entity_type !==
                "enemy"
            ) {

                return;

            }


            if (
                isEntityInCurrentTargetRange(
                    entity
                )
            ) {

                token.style.outline =
                    "3px solid #d7b05d";


                token.style.outlineOffset =
                    "2px";


                token.style.cursor =
                    "pointer";

            }

        }
    );

}


// ============================================================
// ANNULLA TARGETING
// ============================================================

function cancelCombatTargeting() {

    combatTargetMode =
        null;


    clearCombatRangeCells();


    updateTargetSelectionVisuals();

}


// ============================================================
// TURN ORDER
// ============================================================

function renderCombatEntityList() {

    const container =
        document.getElementById(
            "combat-entity-list"
        );


    if (!container) {

        return;

    }


    container.replaceChildren();


    // ========================================================
    // ENTITÀ VIVE
    // ========================================================

    const aliveEntities =
        Array.from(
            combatEntities.values()
        )
            .filter(
                entity =>
                    entity.status ===
                        "alive"
                    &&
                    Number(
                        entity.current_hp
                    ) > 0
            );


    if (
        aliveEntities.length === 0
    ) {

        return;

    }


    // ========================================================
    // MAPPA ENTITÀ VIVE
    // ========================================================

    const aliveMap =
        new Map(
            aliveEntities.map(
                entity => [
                    entity.id,
                    entity
                ]
            )
        );


    // ========================================================
    // ORDINE BASE
    // ========================================================

    let orderedEntities =
        combatTurnOrder
            .map(
                entityId =>
                    aliveMap.get(
                        entityId
                    )
            )
            .filter(
                Boolean
            );


    // Eventuali entità non presenti nell'ordine iniziale.
    aliveEntities.forEach(
        entity => {

            if (
                !orderedEntities.some(
                    existing =>
                        existing.id ===
                        entity.id
                )
            ) {

                orderedEntities.push(
                    entity
                );

            }

        }
    );


    // ========================================================
    // PORTA IL TURNO ATTUALE IN CIMA
    // ========================================================

    const currentTurnId =
        combatSession
            ?.current_turn_entity_id;


    const currentIndex =
        orderedEntities.findIndex(
            entity =>
                entity.id ===
                currentTurnId
        );


    if (
        currentIndex > 0
    ) {

        orderedEntities = [

            ...orderedEntities.slice(
                currentIndex
            ),

            ...orderedEntities.slice(
                0,
                currentIndex
            )

        ];

    }


    // ========================================================
    // RENDER LISTA
    // ========================================================
console.log(
    "TURN ORDER VISIVO:",
    orderedEntities.map(
        entity =>
            entity.display_name
    ),
    "TURNO ATTUALE:",
    currentTurnId
);
    orderedEntities.forEach(
        entity => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "combat-entity-item";


            // =================================================
            // HOVER
            // =================================================

            item.addEventListener(
                "mouseenter",
                () => {

                    const token =
                        combatTokens.get(
                            entity.id
                        );


                    if (token) {

                        token.classList.add(
                            "turn-order-hover"
                        );

                    }

                }
            );


            item.addEventListener(
                "mouseleave",
                () => {

                    const token =
                        combatTokens.get(
                            entity.id
                        );


                    if (token) {

                        token.classList.remove(
                            "turn-order-hover"
                        );

                    }

                }
            );


            // =================================================
            // TURNO ATTUALE
            // =================================================

            if (
                entity.id ===
                currentTurnId
            ) {

                item.classList.add(
                    "current-turn"
                );

            }


            // =================================================
            // NOME
            // =================================================

            const name =
                document.createElement(
                    "strong"
                );


            name.textContent =
                entity.display_name;


            // =================================================
            // INFO
            // =================================================

            const meta =
                document.createElement(
                    "div"
                );


            meta.className =
                "combat-entity-meta";


            meta.textContent =
                `${
                    entity.entity_type ===
                    "enemy"
                        ? "Nemico"
                        : "Giocatore"
                } · PF ${
                    entity.current_hp
                }/${
                    entity.max_hp
                } · PM ${
                    entity.current_pm ?? 0
                }/${
                    entity.max_pm ?? 0
                } · MOV ${
                    entity.movement_remaining ?? 0
                }`;


            item.append(
                name,
                meta
            );


            container.appendChild(
                item
            );

        }
    );

}


// ============================================================
// ENTITÀ DEL MIO PG
// ============================================================

function getMyPlayerEntity() {

    if (
        !currentCharacter
    ) {

        return null;

    }


    return Array.from(
        combatEntities.values()
    ).find(
        entity =>
            entity.entity_type ===
                "player"
            &&
            entity.character_id ===
                currentCharacter.id
    ) || null;

}


// ============================================================
// SCHEDA PG
// ============================================================

function renderPlayerCombatSheet() {

    if (
        masterObserverMode ||
        !currentCharacter
    ) {

        return;

    }


    const playerEntity =
        getMyPlayerEntity();


    if (
        !playerEntity
    ) {

        return;

    }


    // ========================================================
    // ATTRIBUTI EFFETTIVI
    // ========================================================

    const forza =
        getCombatEffectiveAttribute(
            "forza"
        );


    const resistenza =
        getCombatEffectiveAttribute(
            "resistenza"
        );


    const costituzione =
        getCombatEffectiveAttribute(
            "costituzione"
        );


    const intelligenza =
        getCombatEffectiveAttribute(
            "intelligenza"
        );


    const destrezza =
        getCombatEffectiveAttribute(
            "destrezza"
        );


    const fortuna =
        getCombatEffectiveAttribute(
            "fortuna"
        );


    // ========================================================
    // BUFF
    // ========================================================

    const attackBuff =
        getCombatEffectBonus(
            playerEntity.id,
            "attack_bonus"
        );


    const defenseBuff =
        getCombatEffectBonus(
            playerEntity.id,
            "defense_bonus"
        );


    const criticalBuff =
        getCombatEffectBonus(
            playerEntity.id,
            "critical_bonus"
        );


    // ========================================================
    // ATTACCO
    // ========================================================

    const attack =
        Math.ceil(
            forza /
            2
        )
        +
        (
            Number(
                equipmentBonuses.attack_bonus
            ) || 0
        )
        +
        attackBuff;


    // ========================================================
    // DIFESA
    // ========================================================

    const defense =
        Math.ceil(
            7 +
            resistenza /
            2
        )
        +
        (
            Number(
                equipmentBonuses.defense_bonus
            ) || 0
        )
        +
        defenseBuff;


    // ========================================================
    // PF MASSIMI
    // ========================================================

    const fallbackMaxPF =
        Math.ceil(
            5 *
            (
                costituzione /
                2
            )
        );


    // ========================================================
    // PM MASSIMI
    // ========================================================

    const fallbackMaxPM =
        Math.ceil(
            5 *
            (
                intelligenza /
                2
            )
        );


    // ========================================================
    // MOVIMENTO
    // ========================================================

    const fallbackMovement =
        Math.ceil(
            4 +
            destrezza /
            2
        )
        +
        getCombatEffectBonus(
            playerEntity.id,
            "movement_bonus"
        );


    // ========================================================
    // CRITICO
    // ========================================================

    const critical =
        (
            fortuna *
            (
                50 /
                30
            )
            +
            criticalBuff
        )
            .toFixed(
                2
            );


    // ========================================================
    // RISORSE ATTUALI
    // ========================================================

    const currentPF =
        Math.max(
            0,
            Number(
                playerEntity.current_hp
            ) || 0
        );


    const maxPF =
        Number(
            playerEntity.max_hp
        )
        ||
        fallbackMaxPF;


    const currentPM =
        playerEntity.current_pm ===
            null
        ||
        playerEntity.current_pm ===
            undefined

            ? fallbackMaxPM

            : Math.max(
                0,
                Number(
                    playerEntity.current_pm
                )
            );


    const maxPM =
        Number(
            playerEntity.max_pm
        )
        ||
        fallbackMaxPM;


    const currentMovement =
        Number(
            playerEntity
                .movement_remaining
        ) || 0;


    // ========================================================
    // TESTI
    // ========================================================

    setText(
        "combat-character-name",
        currentCharacter.nome
    );


    setText(
        "combat-pf-value",
        `${currentPF} / ${maxPF}`
    );


    setText(
        "combat-pm-value",
        `${currentPM} / ${maxPM}`
    );


    setText(
        "combat-attack-value",

        attackBuff > 0

            ? `${
                attack -
                attackBuff
            } +${attackBuff}`

            : attack
    );


    setText(
        "combat-defense-value",

        defenseBuff > 0

            ? `${
                defense -
                defenseBuff
            } +${defenseBuff}`

            : defense
    );


    setText(
        "combat-movement-value",
        `${currentMovement} / ${fallbackMovement}`
    );


    setText(
        "combat-critical-value",

        criticalBuff > 0

            ? `${
                (
                    Number(
                        critical
                    )
                    -
                    criticalBuff
                ).toFixed(
                    2
                )
            }% +${criticalBuff}%`

            : `${critical}%`
    );


    // ========================================================
    // BARRE
    // ========================================================

    updateBar(
        "combat-pf-bar",
        currentPF,
        maxPF
    );


    updateBar(
        "combat-pm-bar",
        currentPM,
        maxPM
    );


    updateTurnResourceIndicators();

}


// ============================================================
// BUFF ATTIVI
// ============================================================

function renderActiveCombatBuffs() {

    const container =
        document.getElementById(
            "combat-active-buffs"
        );


    if (!container) {

        return;

    }


    container.replaceChildren();


    const player =
        getMyPlayerEntity();


    if (!player) {

        return;

    }


    // ========================================================
    // BUFF TEMPORANEI COMBAT
    // ========================================================

    const playerBuffs =
        combatEffects.filter(
            effect =>
                effect.target_entity_id ===
                    player.id
                &&
                Number(
                    effect.remaining_rounds
                ) > 0
        );


    // ========================================================
    // BUFF PERSISTENTI
    // ========================================================

    const pendingBuffs =
        characterPendingEffects.filter(
            effect =>
                effect.effect_type ===
                    "giorno_paga"
        );


    if (
        playerBuffs.length ===
            0
        &&
        pendingBuffs.length ===
            0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "combat-buff-empty";


        empty.textContent =
            "Nessun buff attivo.";


        container.appendChild(
            empty
        );


        return;

    }


    // ========================================================
    // NOMI BUFF
    // ========================================================

    const buffNames = {

        attack_bonus:
            "Arma Potenziata",

        defense_bonus:
            "Armatura Potenziata",

        critical_bonus:
            "Affilatura",

        movement_bonus:
            "Rapidità"

    };


    // ========================================================
    // TESTO VALORE BUFF
    // ========================================================

    const buffValues = {

        attack_bonus:
            value =>
                `+${value} ATT`,

        defense_bonus:
            value =>
                `+${value} DIF`,

        critical_bonus:
            value =>
                `+${value}% CRIT`,

        movement_bonus:
            value =>
                `+${value} MOV`

    };


    // ========================================================
    // RENDER BUFF COMBAT
    // ========================================================

    playerBuffs.forEach(
        effect => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "combat-buff-item";


            const left =
                document.createElement(
                    "div"
                );


            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "combat-buff-name";


            name.textContent =
                buffNames[
                    effect.effect_type
                ]
                ||
                effect.effect_type;


            const value =
                document.createElement(
                    "div"
                );


            value.style.marginTop =
                "2px";


            value.style.color =
                "#a99a82";


            value.style.fontSize =
                "9px";


            const formatter =
                buffValues[
                    effect.effect_type
                ];


            value.textContent =
                formatter

                    ? formatter(
                        Number(
                            effect.value
                        ) || 0
                    )

                    : "";


            left.append(
                name,
                value
            );


            const duration =
                document.createElement(
                    "div"
                );


            duration.className =
                "combat-buff-duration";


            const rounds =
                Number(
                    effect.remaining_rounds
                ) || 0;


            duration.textContent =
                rounds === 1

                    ? "1 round"

                    : `${rounds} round`;


            row.append(
                left,
                duration
            );


            container.appendChild(
                row
            );

        }
    );


    // ========================================================
    // GIORNO PAGA
    // ========================================================

    pendingBuffs.forEach(
        effect => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "combat-buff-item";


            const left =
                document.createElement(
                    "div"
                );


            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "combat-buff-name";


            name.textContent =
                "Giorno Paga";


            const value =
                document.createElement(
                    "div"
                );


            value.style.marginTop =
                "2px";


            value.style.color =
                "#a99a82";


            value.style.fontSize =
                "9px";


            value.textContent =
                `Oro ×${
                    Number(
                        effect.value
                    ) || 2
                }`;


            left.append(
                name,
                value
            );


            const duration =
                document.createElement(
                    "div"
                );


            duration.className =
                "combat-buff-duration";


            duration.textContent =
                "incontro corrente";


            row.append(
                left,
                duration
            );


            container.appendChild(
                row
            );

        }
    );

}


// ============================================================
// BARRE PF / PM
// ============================================================

function updateBar(
    id,
    current,
    max
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return;

    }


    const percentage =
        max > 0

            ? Math.max(
                0,
                Math.min(
                    100,
                    (
                        current /
                        max
                    )
                    *
                    100
                )
            )

            : 0;


    element.style.width =
        `${percentage}%`;

}


// ============================================================
// TESTO ELEMENTO
// ============================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


// ============================================================
// RISORSE TURNO
// ============================================================

function updateTurnResourceIndicators() {

    const player =
        getMyPlayerEntity();


    const movement =
        document.getElementById(
            "turn-resource-movement"
        );


    const action =
        document.getElementById(
            "turn-resource-action"
        );


    const item =
        document.getElementById(
            "turn-resource-item"
        );


    if (!player) {

        return;

    }


    setResourceIndicator(
        movement,
        Number(
            player.movement_remaining
        ) > 0
    );


    setResourceIndicator(
        action,
        player.action_used !==
            true
    );


    setResourceIndicator(
        item,
        player.item_used !==
            true
    );

}


// ============================================================
// SINGOLO INDICATORE RISORSA
// ============================================================

function setResourceIndicator(
    element,
    available
) {

    if (!element) {

        return;

    }


    element.classList.toggle(
        "available",
        available
    );


    element.classList.toggle(
        "used",
        !available
    );

}


// ============================================================
// BOTTONI PRINCIPALI
// ============================================================

function setupCombatActions() {

    const attack =
        document.getElementById(
            "combat-action-attack"
        );


    const abilities =
        document.getElementById(
            "combat-action-abilities"
        );


    const backpack =
        document.getElementById(
            "combat-action-backpack"
        );


    const pass =
        document.getElementById(
            "combat-action-pass"
        );


    const close =
        document.getElementById(
            "combat-drawer-close"
        );


    // ========================================================
    // ATTACCO BASE
    // ========================================================

    attack?.addEventListener(
        "click",
        () => {

            if (
                !canUseMainAction()
            ) {

                return;

            }


            closeCombatDrawer();


            combatTargetMode =
                "basic_attack";


            addCombatLog(
                "ATTACCO BASE: seleziona un nemico in una delle 8 caselle evidenziate."
            );


            updateTargetSelectionVisuals();

        }
    );


    // ========================================================
    // ABILITÀ
    // ========================================================

    abilities?.addEventListener(
        "click",
        () => {

            cancelCombatTargeting();


            openAbilityPanel();

        }
    );


    // ========================================================
    // ZAINO
    // ========================================================

    backpack?.addEventListener(
        "click",
        () => {

            cancelCombatTargeting();


            openBackpackPanel();

        }
    );


    // ========================================================
    // PASSA TURNO
    // ========================================================

    pass?.addEventListener(
        "click",
        async () => {

            await passTurn();

        }
    );


    // ========================================================
    // CHIUDI DRAWER
    // ========================================================

    close?.addEventListener(
        "click",
        () => {

            closeCombatDrawer();

        }
    );

}


// ============================================================
// PANNELLO ABILITÀ
// ============================================================

function openAbilityPanel() {

    activeDrawer =
        "abilities";


    document.body.classList.add(
        "combat-drawer-open"
    );


    setText(
        "combat-drawer-title",
        "ABILITÀ"
    );


    renderAbilityPanel();

}


// ============================================================
// RENDER ABILITÀ
// ============================================================

function renderAbilityPanel() {

    if (
        activeDrawer !==
        "abilities"
    ) {

        return;

    }


    const container =
        document.getElementById(
            "combat-drawer-body"
        );


    if (!container) {

        return;

    }


    container.replaceChildren();


    if (
        characterAbilities.length ===
        0
    ) {

        renderDrawerMessage(
            container,
            "Il personaggio non conosce abilità."
        );


        return;

    }


    const player =
        getMyPlayerEntity();


    characterAbilities.forEach(
        entry => {

            if (
                !entry.ability
            ) {

                return;

            }


            const ability =
                entry.ability;


            const pmCost =
                Number(
                    ability.pm_cost
                ) || 0;


            const currentPM =
                Number(
                    player?.current_pm
                ) || 0;


            const unavailable =
                !isMyTurn()

                ||

                player?.action_used ===
                    true

                ||

                currentPM <
                    pmCost;


            // =================================================
            // CARD
            // =================================================

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "combat-ability-card";


            if (
                unavailable
            ) {

                card.classList.add(
                    "disabled"
                );

            }


            // =================================================
            // HEADER
            // =================================================

            const header =
                document.createElement(
                    "div"
                );


            header.className =
                "combat-ability-header";


            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "combat-ability-name";


            name.textContent =
                ability.name;


            const level =
                document.createElement(
                    "div"
                );


            level.className =
                "combat-ability-level";


            level.textContent =
                `LV.${
                    entry.level ||
                    1
                }`;


            header.append(
                name,
                level
            );


            // =================================================
            // DESCRIZIONE
            // =================================================

            const description =
                document.createElement(
                    "div"
                );


            description.className =
                "combat-ability-description";


            description.textContent =
                ability.description ||
                "";


            // =================================================
            // FOOTER
            // =================================================

            const footer =
                document.createElement(
                    "div"
                );


            footer.className =
                "combat-ability-footer";


            const cost =
                document.createElement(
                    "div"
                );


            cost.className =
                "combat-ability-cost";


            cost.textContent =
                `${pmCost} PM`;


            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "combat-button";


            button.textContent =
                "USA";


            button.disabled =
                unavailable;


            button.addEventListener(
                "click",
                () => {

                    handleAbilityButton(
                        entry
                    );

                }
            );


            footer.append(
                cost,
                button
            );


            card.append(
                header,
                description,
                footer
            );


            container.appendChild(
                card
            );

        }
    );

}


// ============================================================
// PANNELLO ZAINO
// ============================================================

function openBackpackPanel() {

    activeDrawer =
        "backpack";


    document.body.classList.add(
        "combat-drawer-open"
    );


    setText(
        "combat-drawer-title",
        "ZAINO"
    );


    renderBackpackPanel();

}


// ============================================================
// RENDER ZAINO
// ============================================================

function renderBackpackPanel() {

    if (
        activeDrawer !==
        "backpack"
    ) {

        return;

    }


    const container =
        document.getElementById(
            "combat-drawer-body"
        );


    if (!container) {

        return;

    }


    container.replaceChildren();


    const usableItems =
        characterInventory.filter(
            entry =>
                entry.item
                &&
                entry.item.item_type ===
                    "consumable"
        );


    if (
        usableItems.length ===
        0
    ) {

        renderDrawerMessage(
            container,
            "Non hai oggetti utilizzabili in combattimento."
        );


        return;

    }


    const player =
        getMyPlayerEntity();


    usableItems.forEach(
        entry => {

            const item =
                entry.item;


            const unavailable =
                !isMyTurn()

                ||

                player?.item_used ===
                    true;


            // =================================================
            // CARD
            // =================================================

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "combat-backpack-item";


            if (
                unavailable
            ) {

                card.classList.add(
                    "disabled"
                );

            }


            // =================================================
            // NOME
            // =================================================

            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "combat-backpack-name";


            name.textContent =
                item.name;


            // =================================================
            // DESCRIZIONE
            // =================================================

            const description =
                document.createElement(
                    "div"
                );


            description.className =
                "combat-backpack-description";


            description.textContent =
                item.description ||
                "";


            // =================================================
            // FOOTER
            // =================================================

            const footer =
                document.createElement(
                    "div"
                );


            footer.className =
                "combat-backpack-footer";


            const quantity =
                document.createElement(
                    "div"
                );


            quantity.className =
                "combat-backpack-quantity";


            quantity.textContent =
                `×${
                    Number(
                        entry.quantity
                    ) || 1
                }`;


            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "combat-button";


            button.textContent =
                "USA";


            button.disabled =
                unavailable;


            button.addEventListener(
                "click",
                async () => {

                    await useCombatInventoryItem(
                        entry.id
                    );

                }
            );


            footer.append(
                quantity,
                button
            );


            card.append(
                name,
                description,
                footer
            );


            container.appendChild(
                card
            );

        }
    );

}


// ============================================================
// CHIUDI DRAWER
// ============================================================

function closeCombatDrawer() {

    activeDrawer =
        null;


    document.body.classList.remove(
        "combat-drawer-open"
    );


    setText(
        "combat-drawer-title",
        "AZIONI"
    );


    const container =
        document.getElementById(
            "combat-drawer-body"
        );


    if (
        container
    ) {

        container.innerHTML =
            `
                <div class="combat-drawer-placeholder">
                    Seleziona ABILITÀ oppure ZAINO.
                </div>
            `;

    }


    // Aspettiamo la fine della transizione
    // prima di ricalcolare token e range.

    setTimeout(
        () => {

            renderCombatTokens();

            updateTargetSelectionVisuals();

        },
        200
    );

}


// ============================================================
// MESSAGGIO GENERICO DRAWER
// ============================================================

function renderDrawerMessage(
    container,
    text
) {

    const message =
        document.createElement(
            "div"
        );


    message.className =
        "combat-drawer-placeholder";


    message.textContent =
        text;


    container.appendChild(
        message
    );

}


// ============================================================
// AZIONE PRINCIPALE DISPONIBILE?
// ============================================================

function canUseMainAction() {

    const player =
        getMyPlayerEntity();


    return !!(

        player

        &&

        isMyTurn()

        &&

        player.action_used !==
            true

    );

}


// ============================================================
// AGGIORNA BOTTONI
// ============================================================

function updateActionButtons() {

    const player =
        getMyPlayerEntity();


    const myTurn =
        isMyTurn();


    const actionAvailable =
        !!(

            player

            &&

            myTurn

            &&

            player.action_used !==
                true

        );


    const attack =
        document.getElementById(
            "combat-action-attack"
        );


    const abilities =
        document.getElementById(
            "combat-action-abilities"
        );


    const backpack =
        document.getElementById(
            "combat-action-backpack"
        );


    const pass =
        document.getElementById(
            "combat-action-pass"
        );


    // ========================================================
    // ATTACCO
    // ========================================================

    if (
        attack
    ) {

        attack.disabled =
            !actionAvailable;

    }


    // ========================================================
    // ABILITÀ
    // ========================================================

    if (
        abilities
    ) {

        abilities.disabled =
            !myTurn;

    }


    // ========================================================
    // ZAINO
    // ========================================================

    if (
        backpack
    ) {

        backpack.disabled =
            !myTurn;

    }


    // ========================================================
    // PASSA
    // ========================================================

    if (
        pass
    ) {

        pass.disabled =
            !myTurn;

    }


    // ========================================================
    // AGGIORNA DRAWER APERTO
    // ========================================================

    if (
        activeDrawer ===
        "abilities"
    ) {

        renderAbilityPanel();

    }


    if (
        activeDrawer ===
        "backpack"
    ) {

        renderBackpackPanel();

    }


    updateTurnResourceIndicators();

}