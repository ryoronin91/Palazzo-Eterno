// ============================================================
// PALAZZO ETERNO
// COMBAT.JS
// COORDINATORE PRINCIPALE DEL COMBATTIMENTO
// ============================================================

console.log(
    "COMBAT.JS MODULARE v56 CARICATO"
);


const db =
    supabaseClient;


const COMBAT_COLUMNS =
    12;

const COMBAT_ROWS =
    12;


// ============================================================
// STATO GENERALE
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


let combatMapResizeObserver =
    null;


let lastCombatEntitiesSnapshot =
    "";

let lastCombatEffectsSnapshot =
    "";


// ============================================================
// DATI PERSONAGGIO
// ============================================================

let characterAbilities =
    [];

let characterInventory =
    [];

let characterEquipment =
    [];

let combatEffects =
    [];


let equipmentBonuses = {

    attack_bonus:
        0,

    defense_bonus:
        0,

    forza_bonus:
        0,

    resistenza_bonus:
        0,

    costituzione_bonus:
        0,

    intelligenza_bonus:
        0,

    destrezza_bonus:
        0,

    fortuna_bonus:
        0

};


let characterPendingEffects =
    [];


// ============================================================
// DRAWER
// ============================================================

let activeDrawer =
    null;


// ============================================================
// LOOT
// ============================================================

let victoryLootLoaded =
    false;

let victoryLootLoading =
    false;

let victoryLootData =
    [];

let victoryGoldReceived =
    0;


let victoryLootDraftState =
    null;

let victoryLootDraftInterval =
    null;

let victoryLootPickInProgress =
    false;


// ============================================================
// IA NEMICI
// ============================================================

let enemyAITurnKey =
    null;

let enemyAIInProgress =
    false;


// ============================================================
// MODALITÀ BERSAGLIO
// ============================================================

let combatTargetMode =
    null;


// ============================================================
// ENTITÀ COMBAT
// ============================================================

const combatEntities =
    new Map();


const combatTokens =
    new Map();


// ============================================================
// CELLE RANGE
// ============================================================

let combatRangeCells =
    [];


// ============================================================
// PRESENCE DUNGEON DURANTE IL COMBAT
// ============================================================

const COMBAT_DUNGEON_CHANNEL_NAME =
    "palazzo-eterno-dungeon-1";


let combatDungeonChannel =
    null;


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            // =================================================
            // UTENTE
            // =================================================

            await loadCurrentUser();


            await loadCurrentRole();


            // =================================================
            // MODALITÀ
            // =================================================

            masterObserverMode =
                getMasterObserverModeFromUrl();


            combatId =
                getCombatIdFromUrl();


            if (
                !combatId
            ) {

                throw new Error(
                    "Nessuna sessione di combattimento specificata."
                );

            }


            // =================================================
            // PERSONAGGIO
            // =================================================

            await loadCurrentCharacter();


            // =================================================
            // PRESENCE DUNGEON
            // =================================================

            await setupDungeonPresenceWhileInCombat();


            // =================================================
            // SESSIONE
            // =================================================

            await loadCombatSession();


            // =================================================
            // ENTRA NEL COMBATTIMENTO
            // =================================================

            await joinCombatAsPlayer();


            // =================================================
            // GENERA NEMICI
            // =================================================

            await generateCombatEnemies();


            // =================================================
            // INIZIALIZZA TURNI
            // =================================================

            if (
                combatSession.status ===
                "waiting"
            ) {

                const {
                    error
                } =
                    await db.rpc(
                        "initialize_combat_turns",
                        {

                            p_combat_id:
                                combatId

                        }
                    );


                if (
                    error
                ) {

                    throw error;

                }


                await loadCombatSession();

            }


            // =================================================
            // CARICA STATO COMBAT
            // =================================================

            await Promise.all([

                loadCombatEntities(),

                loadCombatEffects(),

                loadCharacterPendingEffects()

            ]);


            // =================================================
            // DATI DEL PG
            // =================================================

            if (
                !masterObserverMode &&
                currentCharacter
            ) {

                await Promise.all([

                    loadCharacterAbilities(),

                    loadCharacterInventory(),

                    loadCharacterEquipment()

                ]);


                await syncCombatPlayerStats();


                await loadCombatEntities();

            }


            // =================================================
            // SNAPSHOT INIZIALE
            // =================================================

            lastCombatEntitiesSnapshot =
                createCombatSnapshot();


            lastCombatEffectsSnapshot =
                createCombatEffectsSnapshot();


            // =================================================
            // INTERFACCIA
            // =================================================

            setupCombatActions();


            setupVictoryExitButton();


            renderCombat();


            setupCombatMapResizeObserver();


            updateCombatMode();


            setupCombatNotes();


            await updateCombatTurnUI();


            // =================================================
            // LOOP
            // =================================================

            startCombatStateLoop();


        } catch (
            error
        ) {

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


    if (
        error
    ) {

        throw error;

    }


    if (
        !user
    ) {

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
            .from(
                "user_roles"
            )
            .select(
                "role"
            )
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();


    if (
        error
    ) {

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
        params.get(
            "mode"
        ) ===
        "master"
    );

}


// ============================================================
// PERSONAGGIO
// ============================================================

async function loadCurrentCharacter() {

    if (
        masterObserverMode
    ) {

        return;

    }


    const {
        data,
        error
    } =
        await db
            .from(
                "characters"
            )
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
                notes,
                dungeon_x,
                dungeon_y,
                active_combat_id
            `)
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();


    if (
        error
    ) {

        throw error;

    }


    currentCharacter =
        data;

}


// ============================================================
// PRESENCE DUNGEON
// ============================================================

async function setupDungeonPresenceWhileInCombat() {

    if (
        masterObserverMode ||
        !currentCharacter ||
        !currentUser
    ) {

        return;

    }


    combatDungeonChannel =
        db.channel(
            COMBAT_DUNGEON_CHANNEL_NAME,
            {

                config: {

                    presence: {

                        key:
                            currentCharacter.id

                    }

                }

            }
        );


    await new Promise(
        (
            resolve,
            reject
        ) => {

            combatDungeonChannel.subscribe(
                async status => {

                    console.log(
                        "Presence dungeon dal combat:",
                        status
                    );


                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {

                        try {

                            await combatDungeonChannel.track({

                                character_id:
                                    currentCharacter.id,

                                user_id:
                                    currentUser.id,

                                name:
                                    currentCharacter.nome ||
                                    "Avventuriero",

                                token:
                                    currentCharacter.token ||
                                    "token_1.png",

                                x:
                                    Number(
                                        currentCharacter.dungeon_x
                                    ),

                                y:
                                    Number(
                                        currentCharacter.dungeon_y
                                    ),

                                current_hp:
                                    currentCharacter.current_hp,

                                active_combat_id:
                                    currentCharacter.active_combat_id ||
                                    combatId,

                                in_combat:
                                    true,

                                online_at:
                                    new Date()
                                        .toISOString()

                            });


                            resolve();


                        } catch (
                            error
                        ) {

                            reject(
                                error
                            );

                        }

                    }


                    if (
                        status ===
                        "CHANNEL_ERROR"
                    ) {

                        reject(
                            new Error(
                                "Errore Presence dungeon dal combat."
                            )
                        );

                    }

                }
            );

        }
    );

}


// ============================================================
// SESSIONE COMBAT
// ============================================================

async function loadCombatSession() {

    const {
        data,
        error
    } =
        await db
            .from(
                "combat_sessions"
            )
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


    if (
        error
    ) {

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


    if (
        error
    ) {

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


    if (
        error
    ) {

        throw error;

    }


    console.log(
        "Nemici presenti:",
        data
    );

}


// ============================================================
// CARICA ENTITÀ
// ============================================================

async function loadCombatEntities() {

    const {
        data,
        error
    } =
        await db
            .from(
                "combat_entities"
            )
            .select(`
                id,
                entity_type,
                character_id,
                monster_type,
                enemy_id,
                display_name,
                initiative,
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


    if (
        error
    ) {

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
// EFFETTI PERSISTENTI
// ============================================================

async function loadCharacterPendingEffects() {

    if (
        !currentCharacter
    ) {

        characterPendingEffects =
            [];


        return;

    }


    const {
        data,
        error
    } =
        await db.rpc(
            "get_my_pending_effects"
        );


    if (
        error
    ) {

        throw error;

    }


    characterPendingEffects =
        data ||
        [];

}


// ============================================================
// EFFETTI TEMPORANEI COMBAT
// ============================================================

async function loadCombatEffects() {

    const {
        data,
        error
    } =
        await db
            .from(
                "combat_effects"
            )
            .select(`
                id,
                combat_id,
                source_entity_id,
                target_entity_id,
                effect_type,
                value,
                remaining_rounds
            `)
            .eq(
                "combat_id",
                combatId
            )
            .gt(
                "remaining_rounds",
                0
            );


    if (
        error
    ) {

        throw error;

    }


    combatEffects =
        data ||
        [];

}


// ============================================================
// BONUS EFFETTO
// ============================================================

function getCombatEffectBonus(
    entityId,
    effectType
) {

    return combatEffects

        .filter(
            effect =>

                effect.target_entity_id ===
                    entityId

                &&

                effect.effect_type ===
                    effectType

                &&

                Number(
                    effect.remaining_rounds
                ) > 0
        )

        .reduce(
            (
                total,
                effect
            ) =>

                total +

                (
                    Number(
                        effect.value
                    ) || 0
                ),

            0
        );

}


// ============================================================
// ABILITÀ PG
// ============================================================

async function loadCharacterAbilities() {

    if (
        !currentCharacter
    ) {

        characterAbilities =
            [];


        return;

    }


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

                    ascending:
                        true

                }
            );


    if (
        error
    ) {

        throw error;

    }


    characterAbilities =
        data ||
        [];

}


// ============================================================
// INVENTARIO
// ============================================================

async function loadCharacterInventory() {

    if (
        !currentCharacter
    ) {

        characterInventory =
            [];


        return;

    }


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

                    ascending:
                        true

                }
            );


    if (
        error
    ) {

        throw error;

    }


    characterInventory =
        data ||
        [];

}


// ============================================================
// EQUIPAGGIAMENTO
// ============================================================

async function loadCharacterEquipment() {

    if (
        !currentCharacter
    ) {

        characterEquipment =
            [];


        return;

    }


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
                equipped_slot,

                item:items (
                    id,
                    attack_bonus,
                    defense_bonus,
                    forza_bonus,
                    resistenza_bonus,
                    costituzione_bonus,
                    intelligenza_bonus,
                    destrezza_bonus,
                    fortuna_bonus
                )
            `)
            .eq(
                "character_id",
                currentCharacter.id
            )
            .not(
                "equipped_slot",
                "is",
                null
            );


    if (
        error
    ) {

        throw error;

    }


    characterEquipment =
        data ||
        [];


    calculateCombatEquipmentBonuses();

}


// ============================================================
// SINCRONIZZA STATISTICHE PG
// ============================================================

async function syncCombatPlayerStats() {

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
            "sync_combat_player_stats",
            {

                p_combat_id:
                    combatId,

                p_character_id:
                    currentCharacter.id

            }
        );


    if (
        error
    ) {

        throw error;

    }


    console.log(
        "Statistiche combat sincronizzate:",
        data
    );

}


// ============================================================
// BONUS EQUIPAGGIAMENTO
// ============================================================

function calculateCombatEquipmentBonuses() {

    equipmentBonuses = {

        attack_bonus:
            0,

        defense_bonus:
            0,

        forza_bonus:
            0,

        resistenza_bonus:
            0,

        costituzione_bonus:
            0,

        intelligenza_bonus:
            0,

        destrezza_bonus:
            0,

        fortuna_bonus:
            0

    };


    characterEquipment.forEach(
        entry => {

            if (
                !entry.item
            ) {

                return;

            }


            const item =
                entry.item;


            equipmentBonuses.attack_bonus +=
                Number(
                    item.attack_bonus
                ) || 0;


            equipmentBonuses.defense_bonus +=
                Number(
                    item.defense_bonus
                ) || 0;


            equipmentBonuses.forza_bonus +=
                Number(
                    item.forza_bonus
                ) || 0;


            equipmentBonuses.resistenza_bonus +=
                Number(
                    item.resistenza_bonus
                ) || 0;


            equipmentBonuses.costituzione_bonus +=
                Number(
                    item.costituzione_bonus
                ) || 0;


            equipmentBonuses.intelligenza_bonus +=
                Number(
                    item.intelligenza_bonus
                ) || 0;


            equipmentBonuses.destrezza_bonus +=
                Number(
                    item.destrezza_bonus
                ) || 0;


            equipmentBonuses.fortuna_bonus +=
                Number(
                    item.fortuna_bonus
                ) || 0;

        }
    );

}


// ============================================================
// ATTRIBUTO EFFETTIVO
// ============================================================

function getCombatEffectiveAttribute(
    name
) {

    const base =
        Number(
            currentCharacter?.[
                name
            ]
        ) || 1;


    const bonus =
        Number(
            equipmentBonuses[
                `${name}_bonus`
            ]
        ) || 0;


    return Math.max(
        1,
        Math.min(
            30,
            base +
            bonus
        )
    );

}


// ============================================================
// SNAPSHOT ENTITÀ
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

                    entity_type:
                        entity.entity_type,

                    character_id:
                        entity.character_id,

                    monster_type:
                        entity.monster_type,

                    enemy_id:
                        entity.enemy_id,

                    display_name:
                        entity.display_name,

                    initiative:
                        entity.initiative,

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
                        entity.status

                })
            )

            .sort(
                (
                    a,
                    b
                ) =>
                    String(
                        a.id
                    ).localeCompare(
                        String(
                            b.id
                        )
                    )
            )

    );

}


// ============================================================
// SNAPSHOT EFFETTI
// ============================================================

function createCombatEffectsSnapshot() {

    return JSON.stringify(

        combatEffects

            .map(
                effect => ({

                    id:
                        effect.id,

                    target_entity_id:
                        effect.target_entity_id,

                    effect_type:
                        effect.effect_type,

                    value:
                        effect.value,

                    remaining_rounds:
                        effect.remaining_rounds

                })
            )

            .sort(
                (
                    a,
                    b
                ) =>
                    String(
                        a.id
                    ).localeCompare(
                        String(
                            b.id
                        )
                    )
            )

    );

}


// ============================================================
// ENTITÀ DEL TURNO CORRENTE
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

        currentEntity

        &&

        currentEntity.entity_type ===
            "player"

        &&

        currentEntity.character_id ===
            currentCharacter.id

    );

}


// ============================================================
// PASSA TURNO
// ============================================================

async function passTurn() {

    if (
        !isMyTurn()
    ) {

        return;

    }


    cancelCombatTargeting();


    const button =
        document.getElementById(
            "combat-action-pass"
        );


    if (
        button
    ) {

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


        if (
            error
        ) {

            throw error;

        }


        closeCombatDrawer();


        await refreshCombatState();


    } catch (
        error
    ) {

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

async function updateCombatTurnUI() {

    if (
        !combatSession
    ) {

        return;

    }


    // ========================================================
    // COMBAT NON ATTIVO
    // ========================================================

    if (
        combatSession.status !==
        "active"
    ) {

        setCombatStatus(
            `Stato: ${combatSession.status}`
        );


        if (
            combatTargetMode
        ) {

            cancelCombatTargeting();

        }


        updateActionButtons();


        refreshCombatTurnOrder();


        return;

    }


    const currentEntity =
        getCurrentTurnEntity();


    if (
        !currentEntity
    ) {

        setCombatStatus(
            "Turno non disponibile."
        );


        if (
            combatTargetMode
        ) {

            cancelCombatTargeting();

        }


        updateActionButtons();


        refreshCombatTurnOrder();


        return;

    }


    // ========================================================
    // TURN ORDER VISIVO
    //
    // Tutta la logica è in combat-ui.js.
    // ========================================================

    refreshCombatTurnOrder();


    // ========================================================
    // TIMER
    // ========================================================

    const round =
        Number(
            combatSession.round_number
        ) || 1;


    const duration =
        Number(
            combatSession.turn_duration_seconds
        ) || 60;


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


    // ========================================================
    // TURNO NEMICO
    // ========================================================

    if (
        currentEntity.entity_type ===
        "enemy"
    ) {

        setCombatStatus(
            `Round ${round} · Turno di ${currentEntity.display_name} · ${remaining}s`
        );


        if (
            combatTargetMode
        ) {

            cancelCombatTargeting();

        }


        updateActionButtons();


        await runEnemyAI(
            currentEntity
        );


        return;

    }


    // ========================================================
    // MIO TURNO
    // ========================================================

    if (
        isMyTurn()
    ) {

        setCombatStatus(
            `Round ${round} · IL TUO TURNO · ${remaining}s`
        );

    }


    // ========================================================
    // TURNO ALTRO PG
    // ========================================================

    else {

        setCombatStatus(
            `Round ${round} · Turno di ${currentEntity.display_name} · ${remaining}s`
        );


        if (
            combatTargetMode
        ) {

            cancelCombatTargeting();

        }

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
                        .from(
                            "characters"
                        )
                        .update({

                            notes:
                                newNotes

                        })
                        .eq(
                            "id",
                            currentCharacter.id
                        );


                if (
                    error
                ) {

                    throw error;

                }


                currentCharacter.notes =
                    newNotes;


                saveButton.textContent =
                    "SALVATO ✓";


            } catch (
                error
            ) {

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
// MODALITÀ MASTER
// ============================================================

function updateCombatMode() {

    const badge =
        document.getElementById(
            "combat-master-badge"
        );


    if (
        badge
    ) {

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
// ERRORI
// ============================================================

function cleanCombatError(
    text
) {

    if (
        !text
    ) {

        return (
            "Si è verificato un errore."
        );

    }


    return text

        .replace(
            /^.*?: /,
            ""
        )

        .trim();

}


// ============================================================
// STATO TESTUALE
// ============================================================

function setCombatStatus(
    text
) {

    const element =
        document.getElementById(
            "combat-status"
        );


    if (
        element
    ) {

        element.textContent =
            text;

    }

}


// ============================================================
// LOOP COMBAT
// ============================================================

function startCombatStateLoop() {

    stopCombatStateLoop();


    // ========================================================
    // TIMER / TURNO
    // ========================================================

    combatTimerInterval =
        setInterval(
            () => {

                updateCombatTurnUI();

            },
            250
        );


    // ========================================================
    // STATO SERVER
    // ========================================================

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

    if (
        combatTimerInterval
    ) {

        clearInterval(
            combatTimerInterval
        );


        combatTimerInterval =
            null;

    }


    if (
        combatStateInterval
    ) {

        clearInterval(
            combatStateInterval
        );


        combatStateInterval =
            null;

    }

}


// ============================================================
// REFRESH STATO COMBAT
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

        // ====================================================
        // TIMEOUT TURNO
        // ====================================================

        await db.rpc(
            "advance_combat_if_timeout",
            {

                p_combat_id:
                    combatId

            }
        );


        // ====================================================
        // SESSIONE
        // ====================================================

        await loadCombatSession();


        // ====================================================
        // VITTORIA
        // ====================================================

        renderCombatVictory();


        // ====================================================
        // DATI COMBAT
        // ====================================================

        await Promise.all([

            loadCombatEntities(),

            loadCombatEffects(),

            loadCharacterPendingEffects()

        ]);


        // ====================================================
        // SNAPSHOT
        // ====================================================

        const snapshot =
            createCombatSnapshot();


        const effectsSnapshot =
            createCombatEffectsSnapshot();


        // ====================================================
        // RENDER SE CAMBIA LO STATO
        // ====================================================

        if (
            snapshot !==
                lastCombatEntitiesSnapshot

            ||

            effectsSnapshot !==
                lastCombatEffectsSnapshot
        ) {

            lastCombatEntitiesSnapshot =
                snapshot;


            lastCombatEffectsSnapshot =
                effectsSnapshot;


            renderCombat();

        }


        // ====================================================
        // TURNO
        // ====================================================

        await updateCombatTurnUI();


    } catch (
        error
    ) {

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
// MOVIMENTO PG
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


        if (
            !isMyTurn()
        ) {

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


            if (
                error
            ) {

                throw error;

            }


            if (
                !data
            ) {

                return;

            }


            await loadCombatEntities();


            lastCombatEntitiesSnapshot =
                createCombatSnapshot();


            renderCombat();


        } catch (
            error
        ) {

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
                HTMLInputElement

            ||

            target instanceof
                HTMLTextAreaElement

            ||

            target instanceof
                HTMLSelectElement

            ||

            target?.isContentEditable
        ) {

            return;

        }


        if (
            event.repeat
        ) {

            return;

        }


        let dx =
            0;

        let dy =
            0;


        switch (
            event.key.toLowerCase()
        ) {

            case "w":
            case "arrowup":

                dy =
                    -1;

                break;


            case "s":
            case "arrowdown":

                dy =
                    1;

                break;


            case "a":
            case "arrowleft":

                dx =
                    -1;

                break;


            case "d":
            case "arrowright":

                dx =
                    1;

                break;


            case "escape":

                cancelCombatTargeting();


                closeCombatDrawer();


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
// RESIZE OBSERVER MAPPA
// ============================================================

function setupCombatMapResizeObserver() {

    const map =
        document.getElementById(
            "combat-map"
        );


    if (
        !map
    ) {

        return;

    }


    if (
        combatMapResizeObserver
    ) {

        combatMapResizeObserver.disconnect();

    }


    combatMapResizeObserver =
        new ResizeObserver(
            () => {

                requestAnimationFrame(
                    () => {

                        renderCombatTokens();


                        updateTargetSelectionVisuals();

                    }
                );

            }
        );


    combatMapResizeObserver.observe(
        map
    );

}


// ============================================================
// RESIZE FINESTRA
// ============================================================

window.addEventListener(
    "resize",
    () => {

        renderCombatTokens();


        updateTargetSelectionVisuals();

    }
);


// ============================================================
// USCITA PAGINA
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        stopCombatStateLoop();


        clearCombatRangeCells();


        if (
            combatMapResizeObserver
        ) {

            combatMapResizeObserver.disconnect();


            combatMapResizeObserver =
                null;

        }


        if (
            combatDungeonChannel
        ) {

            try {

                combatDungeonChannel.untrack();

            } catch (
                error
            ) {

                console.warn(
                    "Errore chiusura Presence combat:",
                    error
                );

            }

        }

    }
);