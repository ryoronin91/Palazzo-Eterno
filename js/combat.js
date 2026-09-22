// ============================================================
// PALAZZO ETERNO
// COMBAT.JS
// ============================================================

console.log(
    "COMBAT.JS v7 CARICATO"
);


const db =
    supabaseClient;


const COMBAT_COLUMNS =
    12;


const COMBAT_ROWS =
    12;


// ============================================================
// STATO
// ============================================================

let currentUser =
    null;


let currentCharacter =
    null;


let currentRole =
    "player";


let masterObserverMode =
    false;


let combatId =
    null;


let combatSession =
    null;


let combatTimerInterval =
    null;


let combatStateInterval =
    null;


let combatRefreshInProgress =
    false;


let combatMoveInProgress =
    false;


let lastCombatEntitiesSnapshot =
    "";


let characterAbilities =
    [];


let characterInventory =
    [];


let activeDrawer =
    null;


// ============================================================
// MODALITÀ DI SELEZIONE BERSAGLIO
// ============================================================

let combatTargetMode =
    null;


const combatEntities =
    new Map();


const combatTokens =
    new Map();


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            await loadCurrentUser();

            await loadCurrentRole();


            masterObserverMode =
                getMasterObserverModeFromUrl();


            combatId =
                getCombatIdFromUrl();


            if (!combatId) {

                throw new Error(
                    "Nessuna sessione di combattimento specificata."
                );

            }


            await loadCurrentCharacter();

            await loadCombatSession();


            // =================================================
            // PG
            // =================================================

            await joinCombatAsPlayer();


            // =================================================
            // NEMICI
            // =================================================

            await generateCombatEnemies();


            // =================================================
            // ENTITÀ
            // =================================================

            await loadCombatEntities();


            // =================================================
            // ABILITÀ + INVENTARIO
            // =================================================

            if (
                !masterObserverMode &&
                currentCharacter
            ) {

                await Promise.all([

                    loadCharacterAbilities(),

                    loadCharacterInventory()

                ]);

            }


            lastCombatEntitiesSnapshot =
                createCombatSnapshot();


            // =================================================
            // INTERFACCIA
            // =================================================

            setupCombatActions();

            renderCombat();

            updateCombatMode();

            setupCombatNotes();

            updateCombatTurnUI();

            startCombatStateLoop();


        } catch (error) {

            console.error(
                "Errore caricamento combat:",
                error
            );


            setCombatStatus(
                error.message ||
                "Errore durante il caricamento del combattimento."
            );

        }

    }
);


// ============================================================
// UTENTE
// ============================================================

async function loadCurrentUser() {

    const {
        data: {
            user
        },
        error
    } =
        await db.auth.getUser();


    if (error) {

        throw error;

    }


    if (!user) {

        window.location.href =
            "login.html";

        return;

    }


    currentUser =
        user;

}


// ============================================================
// RUOLO
// ============================================================

async function loadCurrentRole() {

    const {
        data,
        error
    } =
        await db
            .from("user_roles")
            .select("role")
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();


    if (error) {

        throw error;

    }


    currentRole =
        data?.role ||
        "player";

}


// ============================================================
// URL
// ============================================================

function getCombatIdFromUrl() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    return params.get(
        "combat_id"
    );

}


function getMasterObserverModeFromUrl() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    return (
        params.get("mode") ===
        "master"
    );

}


// ============================================================
// PERSONAGGIO
// ============================================================

async function loadCurrentCharacter() {

    if (masterObserverMode) {

        return;

    }


    const {
        data,
        error
    } =
        await db
            .from("characters")
            .select(`
                id,
                nome,
                token,
                forza,
                resistenza,
                costituzione,
                intelligenza,
                destrezza,
                fortuna,
                current_hp,
                current_pm,
                livello,
                notes
            `)
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();


    if (error) {

        throw error;

    }


    currentCharacter =
        data;

}


// ============================================================
// SESSIONE
// ============================================================

async function loadCombatSession() {

    const {
        data,
        error
    } =
        await db
            .from("combat_sessions")
            .select(`
                id,
                encounter_id,
                status,
                round_number,
                current_turn_entity_id,
                turn_started_at,
                turn_duration_seconds
            `)
            .eq(
                "id",
                combatId
            )
            .single();


    if (error) {

        throw error;

    }


    combatSession =
        data;

}


// ============================================================
// ENTRA NEL COMBATTIMENTO
// ============================================================

async function joinCombatAsPlayer() {

    if (
        masterObserverMode ||
        !currentCharacter
    ) {

        return;

    }


    const {
        data,
        error
    } =
        await db.rpc(
            "join_combat_player",
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


    console.log(
        "Entità giocatore:",
        data
    );

}


// ============================================================
// GENERA NEMICI
// ============================================================

async function generateCombatEnemies() {

    const {
        data,
        error
    } =
        await db.rpc(
            "generate_combat_enemies",
            {
                p_combat_id:
                    combatId
            }
        );


    if (error) {

        throw error;

    }


    console.log(
        "Nemici presenti:",
        data
    );

}


// ============================================================
// ENTITÀ
// ============================================================

async function loadCombatEntities() {

    const {
        data,
        error
    } =
        await db
            .from("combat_entities")
            .select(`
                id,
                entity_type,
                character_id,
                monster_type,
                enemy_id,
                display_name,
                x,
                y,
                current_hp,
                max_hp,
                current_pm,
                max_pm,
                movement_remaining,
                action_used,
                item_used,
                status
            `)
            .eq(
                "combat_id",
                combatId
            );


    if (error) {

        throw error;

    }


    combatEntities.clear();


    (
        data ||
        []
    ).forEach(
        entity => {

            combatEntities.set(
                entity.id,
                entity
            );

        }
    );

}


// ============================================================
// ABILITÀ
// ============================================================

async function loadCharacterAbilities() {

    const {
        data,
        error
    } =
        await db
            .from(
                "character_abilities"
            )
            .select(`
                id,
                ability_id,
                level,

                ability:abilities (
                    id,
                    name,
                    description,
                    ability_type,
                    pm_cost,
                    max_level
                )
            `)
            .eq(
                "character_id",
                currentCharacter.id
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if (error) {

        throw error;

    }


    characterAbilities =
        data || [];

}


// ============================================================
// INVENTARIO
// ============================================================

async function loadCharacterInventory() {

    const {
        data,
        error
    } =
        await db
            .from(
                "character_inventory"
            )
            .select(`
                id,
                item_id,
                quantity,
                equipped_slot,

                item:items (
                    id,
                    name,
                    description,
                    item_type,
                    equip_slot,
                    heal_pf,
                    heal_pm,
                    gold_value
                )
            `)
            .eq(
                "character_id",
                currentCharacter.id
            )
            .is(
                "equipped_slot",
                null
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if (error) {

        throw error;

    }


    characterInventory =
        data || [];

}


// ============================================================
// SNAPSHOT
// ============================================================

function createCombatSnapshot() {

    return JSON.stringify(
        Array.from(
            combatEntities.values()
        )
            .map(
                entity => ({

                    id:
                        entity.id,

                    x:
                        entity.x,

                    y:
                        entity.y,

                    current_hp:
                        entity.current_hp,

                    max_hp:
                        entity.max_hp,

                    current_pm:
                        entity.current_pm,

                    max_pm:
                        entity.max_pm,

                    movement_remaining:
                        entity.movement_remaining,

                    action_used:
                        entity.action_used,

                    item_used:
                        entity.item_used,

                    status:
                        entity.status,

                    entity_type:
                        entity.entity_type,

                    display_name:
                        entity.display_name,

                    character_id:
                        entity.character_id,

                    monster_type:
                        entity.monster_type,

                    enemy_id:
                        entity.enemy_id

                })
            )
            .sort(
                (a, b) =>
                    a.id.localeCompare(
                        b.id
                    )
            )
    );

}


// ============================================================
// RENDER
// ============================================================

function renderCombat() {

    renderCombatTokens();

    renderCombatEntityList();

    renderPlayerCombatSheet();

    updateActionButtons();

    updateTargetSelectionVisuals();

}


// ============================================================
// TOKEN
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


            if (
                entity.status ===
                "dead"
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
                    entity.display_name;


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


            token.style.left =
                `${
                    (
                        Number(entity.x) +
                        0.5
                    ) *
                    cellWidth -
                    size / 2
                }px`;


            token.style.top =
                `${
                    (
                        Number(entity.y) +
                        0.5
                    ) *
                    cellHeight -
                    size / 2
                }px`;

        }
    );


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


    image.alt =
        entity.display_name;


    image.src =
        "immagini/token/token_1.png";


    if (
        entity.character_id
    ) {

        const {
            data
        } =
            await db
                .from("characters")
                .select("token")
                .eq(
                    "id",
                    entity.character_id
                )
                .maybeSingle();


        if (
            data?.token
        ) {

            image.src =
                `immagini/token/${data.token}`;

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
// CLICK SU TOKEN
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


    if (
        combatTargetMode ===
        "basic_attack"
    ) {

        if (
            entity.entity_type !==
            "enemy"
        ) {

            addCombatLog(
                "Devi selezionare un nemico."
            );


            return;

        }


        await performBasicAttack(
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

        combatTargetMode =
            null;


        updateTargetSelectionVisuals();


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


        combatTargetMode =
            null;


        await loadCombatEntities();


        lastCombatEntitiesSnapshot =
            createCombatSnapshot();


        renderCombat();


        // ====================================================
        // LOG
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
// EVIDENZIA BERSAGLI ATTACCO BASE
//
// DIAGONALI COMPRESE.
// ============================================================

function updateTargetSelectionVisuals() {

    combatTokens.forEach(
        (
            token,
            entityId
        ) => {

            token.style.outline =
                "";


            token.style.outlineOffset =
                "";


            token.style.cursor =
                "default";


            if (
                combatTargetMode !==
                "basic_attack"
            ) {

                return;

            }


            const entity =
                combatEntities.get(
                    entityId
                );


            if (
                !entity ||
                entity.entity_type !==
                    "enemy" ||
                entity.status !==
                    "alive"
            ) {

                return;

            }


            const player =
                getMyPlayerEntity();


            if (!player) {

                return;

            }


            // =================================================
            // DISTANZA CON DIAGONALI
            // =================================================

            const distance =
                Math.max(

                    Math.abs(
                        Number(player.x) -
                        Number(entity.x)
                    ),

                    Math.abs(
                        Number(player.y) -
                        Number(entity.y)
                    )

                );


            if (
                distance === 1
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
// LISTA ENTITÀ
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


    combatEntities.forEach(
        entity => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "combat-entity-item";


            if (
                entity.id ===
                combatSession?.current_turn_entity_id
            ) {

                item.classList.add(
                    "current-turn"
                );

            }


            const name =
                document.createElement(
                    "strong"
                );


            name.textContent =
                entity.display_name;


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
// ATTRIBUTI
// ============================================================

function clampAttribute(
    value
) {

    return Math.max(
        1,
        Math.min(
            30,
            Number(value) || 1
        )
    );

}


// ============================================================
// ENTITÀ DEL MIO PG
// ============================================================

function getMyPlayerEntity() {

    if (!currentCharacter) {

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


    if (!playerEntity) {

        return;

    }


    const forza =
        clampAttribute(
            currentCharacter.forza
        );


    const resistenza =
        clampAttribute(
            currentCharacter.resistenza
        );


    const costituzione =
        clampAttribute(
            currentCharacter.costituzione
        );


    const intelligenza =
        clampAttribute(
            currentCharacter.intelligenza
        );


    const destrezza =
        clampAttribute(
            currentCharacter.destrezza
        );


    const fortuna =
        clampAttribute(
            currentCharacter.fortuna
        );


    const attack =
        Math.ceil(
            forza / 2
        );


    const defense =
        Math.ceil(
            7 +
            resistenza / 2
        );


    const fallbackMaxPF =
        Math.ceil(
            5 *
            (
                costituzione / 2
            )
        );


    const fallbackMaxPM =
        Math.ceil(
            5 *
            (
                intelligenza / 2
            )
        );


    const fallbackMovement =
        Math.ceil(
            4 +
            destrezza / 2
        );


    const critical =
        (
            fortuna *
            (
                50 / 30
            )
        ).toFixed(
            2
        );


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
        ) ||
        fallbackMaxPF;


    const currentPM =
        playerEntity.current_pm === null ||
        playerEntity.current_pm === undefined
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
        ) ||
        fallbackMaxPM;


    const currentMovement =
        Number(
            playerEntity.movement_remaining
        ) || 0;


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
        attack
    );


    setText(
        "combat-defense-value",
        defense
    );


    setText(
        "combat-movement-value",
        `${currentMovement} / ${fallbackMovement}`
    );


    setText(
        "combat-critical-value",
        `${critical}%`
    );


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
// BARRE
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
                    ) *
                    100
                )
            )
            : 0;


    element.style.width =
        `${percentage}%`;

}


// ============================================================
// TESTO
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
// TURNO CORRENTE
// ============================================================

function getCurrentTurnEntity() {

    if (
        !combatSession ||
        !combatSession.current_turn_entity_id
    ) {

        return null;

    }


    return combatEntities.get(
        combatSession.current_turn_entity_id
    ) || null;

}


// ============================================================
// È IL MIO TURNO?
// ============================================================

function isMyTurn() {

    if (
        masterObserverMode ||
        !currentCharacter
    ) {

        return false;

    }


    const currentEntity =
        getCurrentTurnEntity();


    return !!(
        currentEntity &&
        currentEntity.entity_type ===
            "player"
        &&
        currentEntity.character_id ===
            currentCharacter.id
    );

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
        player.action_used !== true
    );


    setResourceIndicator(
        item,
        player.item_used !== true
    );

}


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
// BOTTONI
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
                "ATTACCO BASE: seleziona un nemico in una delle 8 caselle adiacenti."
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

            combatTargetMode =
                null;


            updateTargetSelectionVisuals();


            openAbilityPanel();

        }
    );


    // ========================================================
    // ZAINO
    // ========================================================

    backpack?.addEventListener(
        "click",
        () => {

            combatTargetMode =
                null;


            updateTargetSelectionVisuals();


            openBackpackPanel();

        }
    );


    // ========================================================
    // SALTA TURNO
    // ========================================================

    pass?.addEventListener(
        "click",
        async () => {

            await passTurn();

        }
    );


    close?.addEventListener(
        "click",
        () => {

            closeCombatDrawer();

        }
    );

}


// ============================================================
// ABILITÀ
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

            if (!entry.ability) {

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
                currentPM < pmCost;


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "combat-ability-card";


            if (unavailable) {

                card.classList.add(
                    "disabled"
                );

            }


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
                `LV.${entry.level || 1}`;


            header.append(
                name,
                level
            );


            const description =
                document.createElement(
                    "div"
                );


            description.className =
                "combat-ability-description";


            description.textContent =
                ability.description || "";


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

                    addCombatLog(
                        `${ability.name} selezionata. Implementeremo il suo effetto nel prossimo passaggio.`
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
// ZAINO
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
                entry.item &&
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


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "combat-backpack-item";


            if (unavailable) {

                card.classList.add(
                    "disabled"
                );

            }


            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "combat-backpack-name";


            name.textContent =
                item.name;


            const description =
                document.createElement(
                    "div"
                );


            description.className =
                "combat-backpack-description";


            description.textContent =
                item.description || "";


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
                `×${Number(entry.quantity) || 1}`;


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


        await Promise.all([

            loadCombatEntities(),

            loadCharacterInventory()

        ]);


        lastCombatEntitiesSnapshot =
            createCombatSnapshot();


        renderCombat();

        renderBackpackPanel();


        if (data) {

            addCombatLog(
                `${data.item_name} utilizzata. PF ${data.current_hp}/${data.max_hp} · PM ${data.current_pm}/${data.max_pm}.`
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


// ============================================================
// DRAWER
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


    if (container) {

        container.innerHTML =
            `
            <div class="combat-drawer-placeholder">
                Seleziona ABILITÀ oppure ZAINO.
            </div>
            `;

    }


    setTimeout(
        () => {

            renderCombatTokens();

            updateTargetSelectionVisuals();

        },
        200
    );

}


// ============================================================
// MESSAGGIO DRAWER
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
// AZIONE PRINCIPALE DISPONIBILE
// ============================================================

function canUseMainAction() {

    const player =
        getMyPlayerEntity();


    return !!(
        player &&
        isMyTurn() &&
        player.action_used !== true
    );

}


// ============================================================
// BOTTONI
// ============================================================

function updateActionButtons() {

    const player =
        getMyPlayerEntity();


    const myTurn =
        isMyTurn();


    const actionAvailable =
        !!(
            player &&
            myTurn &&
            player.action_used !== true
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


    if (attack) {

        attack.disabled =
            !actionAvailable;

    }


    if (abilities) {

        abilities.disabled =
            !myTurn;

    }


    if (backpack) {

        backpack.disabled =
            !myTurn;

    }


    if (pass) {

        pass.disabled =
            !myTurn;

    }


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


// ============================================================
// SALTA TURNO
// ============================================================

async function passTurn() {

    if (!isMyTurn()) {

        return;

    }


    combatTargetMode =
        null;


    updateTargetSelectionVisuals();


    const button =
        document.getElementById(
            "combat-action-pass"
        );


    if (button) {

        button.disabled =
            true;

    }


    try {

        const {
            error
        } =
            await db.rpc(
                "next_combat_turn",
                {
                    p_combat_id:
                        combatId
                }
            );


        if (error) {

            throw error;

        }


        closeCombatDrawer();


        await refreshCombatState();


    } catch (error) {

        console.error(
            "Errore salto turno:",
            error
        );


        setCombatStatus(
            "Errore durante il cambio turno."
        );

    }

}


// ============================================================
// UI TURNO
// ============================================================

function updateCombatTurnUI() {

    if (!combatSession) {

        return;

    }


    if (
        combatSession.status !==
        "active"
    ) {

        setCombatStatus(
            `Stato: ${combatSession.status}`
        );


        updateActionButtons();


        return;

    }


    const currentEntity =
        getCurrentTurnEntity();


    if (!currentEntity) {

        setCombatStatus(
            "Turno non disponibile."
        );


        updateActionButtons();


        return;

    }


    const round =
        Number(
            combatSession.round_number
        ) || 1;


    if (
        currentEntity.entity_type ===
        "enemy"
    ) {

        setCombatStatus(
            `Round ${round} · Turno di ${currentEntity.display_name}`
        );


        combatTargetMode =
            null;


        updateTargetSelectionVisuals();

        updateActionButtons();


        return;

    }


    const duration =
        Number(
            combatSession.turn_duration_seconds
        ) || 30;


    const startedAt =
        combatSession.turn_started_at
            ? new Date(
                combatSession.turn_started_at
            ).getTime()
            : Date.now();


    const elapsedSeconds =
        (
            Date.now() -
            startedAt
        )
        /
        1000;


    const remaining =
        Math.max(
            0,
            Math.ceil(
                duration -
                elapsedSeconds
            )
        );


    if (isMyTurn()) {

        setCombatStatus(
            `Round ${round} · IL TUO TURNO · ${remaining}s`
        );

    } else {

        setCombatStatus(
            `Round ${round} · Turno di ${currentEntity.display_name} · ${remaining}s`
        );


        combatTargetMode =
            null;


        updateTargetSelectionVisuals();

    }


    updateActionButtons();

}


// ============================================================
// NOTE
// ============================================================

function setupCombatNotes() {

    if (
        masterObserverMode ||
        !currentCharacter
    ) {

        return;

    }


    const notesElement =
        document.getElementById(
            "combat-notes"
        );


    const saveButton =
        document.getElementById(
            "combat-notes-save"
        );


    if (
        !notesElement ||
        !saveButton
    ) {

        return;

    }


    notesElement.value =
        currentCharacter.notes ||
        "";


    saveButton.disabled =
        false;


    saveButton.addEventListener(
        "click",
        async () => {

            saveButton.disabled =
                true;


            saveButton.textContent =
                "SALVATAGGIO...";


            try {

                const newNotes =
                    notesElement.value;


                const {
                    error
                } =
                    await db
                        .from("characters")
                        .update({
                            notes:
                                newNotes
                        })
                        .eq(
                            "id",
                            currentCharacter.id
                        );


                if (error) {

                    throw error;

                }


                currentCharacter.notes =
                    newNotes;


                saveButton.textContent =
                    "SALVATO ✓";


            } catch (error) {

                console.error(
                    "Errore note:",
                    error
                );


                saveButton.textContent =
                    "ERRORE";


            } finally {

                setTimeout(
                    () => {

                        saveButton.textContent =
                            "SALVA NOTE";


                        saveButton.disabled =
                            false;

                    },
                    1200
                );

            }

        }
    );

}


// ============================================================
// MASTER
// ============================================================

function updateCombatMode() {

    const badge =
        document.getElementById(
            "combat-master-badge"
        );


    if (badge) {

        badge.classList.toggle(
            "visible",
            masterObserverMode
        );

    }


    document.body.classList.toggle(
        "master-observer",
        masterObserverMode
    );

}


// ============================================================
// LOG
// ============================================================

function addCombatLog(
    text
) {

    const container =
        document.getElementById(
            "combat-log"
        );


    if (!container) {

        return;

    }


    const placeholder =
        container.querySelector(
            ".combat-log-placeholder"
        );


    placeholder?.remove();


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "combat-log-entry";


    row.textContent =
        text;


    container.appendChild(
        row
    );


    container.scrollTop =
        container.scrollHeight;

}


// ============================================================
// ERRORI
// ============================================================

function cleanCombatError(
    text
) {

    if (!text) {

        return "Si è verificato un errore.";

    }


    return text
        .replace(
            /^.*?: /,
            ""
        )
        .trim();

}


// ============================================================
// STATO
// ============================================================

function setCombatStatus(
    text
) {

    const element =
        document.getElementById(
            "combat-status"
        );


    if (element) {

        element.textContent =
            text;

    }

}


// ============================================================
// LOOP
// ============================================================

function startCombatStateLoop() {

    stopCombatStateLoop();


    combatTimerInterval =
        setInterval(
            () => {

                updateCombatTurnUI();

            },
            250
        );


    combatStateInterval =
        setInterval(
            async () => {

                await refreshCombatState();

            },
            1000
        );

}


// ============================================================
// STOP LOOP
// ============================================================

function stopCombatStateLoop() {

    if (combatTimerInterval) {

        clearInterval(
            combatTimerInterval
        );


        combatTimerInterval =
            null;

    }


    if (combatStateInterval) {

        clearInterval(
            combatStateInterval
        );


        combatStateInterval =
            null;

    }

}


// ============================================================
// REFRESH
// ============================================================

async function refreshCombatState() {

    if (
        combatRefreshInProgress
    ) {

        return;

    }


    combatRefreshInProgress =
        true;


    try {

        await db.rpc(
            "advance_combat_if_timeout",
            {
                p_combat_id:
                    combatId
            }
        );


        await loadCombatSession();

        await loadCombatEntities();


        const snapshot =
            createCombatSnapshot();


        if (
            snapshot !==
            lastCombatEntitiesSnapshot
        ) {

            lastCombatEntitiesSnapshot =
                snapshot;


            renderCombat();

        }


        updateCombatTurnUI();


    } catch (error) {

        console.error(
            "Errore aggiornamento stato combat:",
            error
        );


    } finally {

        combatRefreshInProgress =
            false;

    }

}


// ============================================================
// MOVIMENTO
// ============================================================

window.moveCombatPlayer =
    async function (
        dx,
        dy
    ) {

        if (
            combatMoveInProgress ||
            masterObserverMode ||
            !currentCharacter ||
            !combatSession ||
            combatSession.status !==
                "active"
        ) {

            return;

        }


        if (!isMyTurn()) {

            return;

        }


        combatMoveInProgress =
            true;


        try {

            const {
                data,
                error
            } =
                await db.rpc(
                    "move_combat_player",
                    {

                        p_combat_id:
                            combatId,

                        p_character_id:
                            currentCharacter.id,

                        p_dx:
                            dx,

                        p_dy:
                            dy

                    }
                );


            if (error) {

                throw error;

            }


            if (!data) {

                return;

            }


            await loadCombatEntities();


            lastCombatEntitiesSnapshot =
                createCombatSnapshot();


            renderCombat();


        } catch (error) {

            console.error(
                "Errore movimento combattimento:",
                error
            );


        } finally {

            combatMoveInProgress =
                false;

        }

    };


// ============================================================
// TASTIERA
// ============================================================

document.addEventListener(
    "keydown",
    async event => {

        const target =
            event.target;


        if (
            target instanceof
                HTMLInputElement ||
            target instanceof
                HTMLTextAreaElement ||
            target instanceof
                HTMLSelectElement ||
            target?.isContentEditable
        ) {

            return;

        }


        if (event.repeat) {

            return;

        }


        let dx = 0;
        let dy = 0;


        switch (
            event.key.toLowerCase()
        ) {

            case "w":
            case "arrowup":

                dy = -1;

                break;


            case "s":
            case "arrowdown":

                dy = 1;

                break;


            case "a":
            case "arrowleft":

                dx = -1;

                break;


            case "d":
            case "arrowright":

                dx = 1;

                break;


            case "escape":

                combatTargetMode =
                    null;


                closeCombatDrawer();


                updateTargetSelectionVisuals();


                return;


            default:

                return;

        }


        event.preventDefault();


        await window.moveCombatPlayer(
            dx,
            dy
        );

    }
);


// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
    "resize",
    () => {

        renderCombatTokens();

        updateTargetSelectionVisuals();

    }
);


// ============================================================
// USCITA
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        stopCombatStateLoop();

    }
);
