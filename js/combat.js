// ============================================================
// PALAZZO ETERNO
// COMBAT.JS
// ============================================================

console.log("COMBAT.JS v33 CARICATO");


const db = supabaseClient;

const COMBAT_COLUMNS = 12;
const COMBAT_ROWS = 12;


// ============================================================
// STATO
// ============================================================

let currentUser = null;
let currentCharacter = null;
let currentRole = "player";

let masterObserverMode = false;

let combatId = null;
let combatSession = null;

let combatTimerInterval = null;
let combatStateInterval = null;

let combatRefreshInProgress = false;
let combatMoveInProgress = false;

let combatMapResizeObserver = null;

let lastCombatEntitiesSnapshot = "";
let lastCombatEffectsSnapshot = "";

let characterAbilities = [];
let characterInventory = [];
let characterEquipment = [];
let combatEffects = [];

let equipmentBonuses = {

    attack_bonus: 0,
    defense_bonus: 0,

    forza_bonus: 0,
    resistenza_bonus: 0,
    costituzione_bonus: 0,
    intelligenza_bonus: 0,
    destrezza_bonus: 0,
    fortuna_bonus: 0

};

let activeDrawer = null;

let victoryLootLoaded = false;
let victoryLootLoading = false;
let victoryLootData = [];
let victoryGoldReceived = 0;

let victoryLootDraftState = null;
let victoryLootDraftInterval = null;

let victoryLootPickInProgress = false;

// ============================================================
// MODALITÀ BERSAGLIO
//
// null
// basic_attack
// fire_bolt
// heal
// ============================================================

let combatTargetMode = null;


// ============================================================
// ENTITÀ
// ============================================================

const combatEntities = new Map();
const combatTokens = new Map();


// ============================================================
// CELLE RANGE
// ============================================================

let combatRangeCells = [];

// ============================================================
// PRESENCE DUNGEON MENTRE SI È IN COMBAT
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

            await setupDungeonPresenceWhileInCombat();

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
// AVVIA IL COMBATTIMENTO SE È ANCORA IN ATTESA
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


    if (error) {

        throw error;

    }


    // Ricarichiamo la sessione perché ora
    // contiene status=active, primo turno e timer.

    await loadCombatSession();

}


// =================================================
// CARICA ENTITÀ
// =================================================

await Promise.all([
    loadCombatEntities(),
    loadCombatEffects()
]);

console.log(
    "DEBUG COMBAT EFFECTS:",
    combatEffects
);

console.log(
    "DEBUG PLAYER ENTITY:",
    getMyPlayerEntity()
);

console.log(
    "DEBUG ATTACK BUFF:",
    getCombatEffectBonus(
        getMyPlayerEntity()?.id,
        "attack_bonus"
    )
);

            // =================================================
            // DATI PG
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


    currentUser = user;

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


    if (error) {

        throw error;

    }


    currentCharacter = data;

}

// ============================================================
// MANTIENE IL PG VISIBILE NEL DUNGEON DURANTE IL COMBAT
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

                        } catch (error) {

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


    combatSession = data;

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
// CARICA ENTITÀ
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
// EFFETTI TEMPORANEI DEL COMBATTIMENTO
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


    if (error) {

        throw error;

    }


    combatEffects =
        data || [];

}

// ============================================================
// BONUS EFFETTO TEMPORANEO SU ENTITÀ
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
// ABILITÀ
// ============================================================

async function loadCharacterAbilities() {

    const {
        data,
        error
    } =
        await db
            .from("character_abilities")
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
            .from("character_inventory")
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
// EQUIPAGGIAMENTO
// ============================================================

async function loadCharacterEquipment() {

    const {
        data,
        error
    } =
        await db
            .from("character_inventory")
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


    if (error) {

        throw error;

    }


    characterEquipment =
        data || [];


    calculateCombatEquipmentBonuses();

}

// ============================================================
// SINCRONIZZA STATISTICHE PG NEL COMBATTIMENTO
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


    if (error) {

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

        attack_bonus: 0,
        defense_bonus: 0,

        forza_bonus: 0,
        resistenza_bonus: 0,
        costituzione_bonus: 0,
        intelligenza_bonus: 0,
        destrezza_bonus: 0,
        fortuna_bonus: 0

    };


    characterEquipment.forEach(
        entry => {

            if (!entry.item) {

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
            currentCharacter?.[name]
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
            base + bonus
        )
    );

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
                (a, b) =>
                    a.id.localeCompare(
                        b.id
                    )
            )

    );

}

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
// SCHERMATA VITTORIA
// ============================================================

function renderCombatVictory() {

    const overlay =
        document.getElementById(
            "combat-victory-overlay"
        );

    if (!overlay) {
        return;
    }

    const victory =
        combatSession?.status ===
        "victory";

    overlay.classList.toggle(
        "visible",
        victory
    );

    overlay.setAttribute(
        "aria-hidden",
        victory
            ? "false"
            : "true"
    );

    if (!victory) {
        return;
    }

    if (combatTargetMode) {
        cancelCombatTargeting();
    }

    if (
        !victoryLootLoaded &&
        !victoryLootLoading
    ) {
        loadVictoryLoot();
    }

}

// ============================================================
// CARICA LOOT VITTORIA
// ============================================================

    async function loadVictoryLoot() {

    if (
        victoryLootLoaded ||
        victoryLootLoading ||
        !combatId
    ) {
        return;
    }


    victoryLootLoading = true;


    const container =
        document.getElementById(
            "combat-victory-loot"
        );


    if (container) {

        container.textContent =
            "Generazione del bottino...";

    }


    try {

        // ====================================================
        // 1. GENERA IL LOOT
        //
        // Se è già stato generato, la RPC non lo rigenera.
        // ====================================================

        const {
            error: generateError
        } =
            await db.rpc(
                "generate_combat_loot",
                {
                    p_combat_id:
                        combatId
                }
            );


        if (generateError) {

            throw generateError;

        }


        // ====================================================
        // 2. DISTRIBUISCE AUTOMATICAMENTE L'ORO
        //
        // Solo i giocatori partecipanti eseguono questa RPC.
        // Il master osservatore non possiede un PG nel combat.
        //
        // La funzione SQL impedisce comunque una doppia
        // distribuzione.
        // ====================================================

        if (
            !masterObserverMode &&
            currentCharacter
        ) {

            const {
                error: distributeError
            } =
                await db.rpc(
                    "distribute_combat_gold",
                    {
                        p_combat_id:
                            combatId
                    }
                );


            if (distributeError) {

                throw distributeError;

            }

        }


        // ====================================================
        // 3. RECUPERA LA QUOTA PERSONALE DI ORO
        // ====================================================

        let myGold = null;


        if (
            !masterObserverMode &&
            currentCharacter
        ) {

            const {
                data: goldData,
                error: goldError
            } =
                await db.rpc(
                    "get_my_combat_gold",
                    {
                        p_combat_id:
                            combatId
                    }
                );


            if (goldError) {

                throw goldError;

            }


            myGold =
                Number(
                    goldData
                ) || 0;

        }


        // ====================================================
        // 4. RECUPERA IL LOOT COMPLETO
        // ====================================================

        const {
            data,
            error
        } =
            await db.rpc(
                "get_combat_loot",
                {
                    p_combat_id:
                        combatId
                }
            );


        if (error) {

            throw error;

        }


        // ====================================================
        // 5. MOSTRA RISULTATO
        // ====================================================

        // ====================================================
// SALVA DATI LOCALI
// ====================================================

victoryLootData =
    data || [];

victoryGoldReceived =
    myGold;


// ====================================================
// INIZIALIZZA IL DRAFT DEGLI OGGETTI
// ====================================================

const {
    error: draftInitError
} =
    await db.rpc(
        "initialize_combat_loot_draft",
        {
            p_combat_id:
                combatId
        }
    );


if (draftInitError) {

    throw draftInitError;

}


// ====================================================
// CARICA STATO DRAFT
// ====================================================

await refreshVictoryLootDraft();


// ====================================================
// AVVIA TIMER
// ====================================================

startVictoryLootDraftLoop();


victoryLootLoaded = true;


    } catch (error) {

        console.error(
            "Errore caricamento loot:",
            error
        );


        if (container) {

            container.textContent =
                "Errore durante il caricamento del bottino.";

        }


    } finally {

        victoryLootLoading = false;

    }

}

// ============================================================
// LOOP DRAFT LOOT
// ============================================================

function startVictoryLootDraftLoop() {

    stopVictoryLootDraftLoop();


    victoryLootDraftInterval =
        setInterval(
            async () => {

                await refreshVictoryLootDraft();

            },
            1000
        );

}


function stopVictoryLootDraftLoop() {

    if (
        victoryLootDraftInterval
    ) {

        clearInterval(
            victoryLootDraftInterval
        );


        victoryLootDraftInterval =
            null;

    }

}


// ============================================================
// AGGIORNA STATO DRAFT
// ============================================================

async function refreshVictoryLootDraft() {

    if (!combatId) {

        return;

    }


    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "get_combat_loot_draft_state",
                {
                    p_combat_id:
                        combatId
                }
            );


        if (error) {

            throw error;

        }


        victoryLootDraftState =
            data;


        renderVictoryLoot(
            victoryLootData,
            victoryGoldReceived,
            victoryLootDraftState
        );


        if (
            data?.status ===
            "complete"
        ) {

            stopVictoryLootDraftLoop();

        }


    } catch (error) {

        console.error(
            "Errore aggiornamento draft loot:",
            error
        );

    }

}


// ============================================================
// PRENDI OGGETTO
// ============================================================

async function pickVictoryLootItem(
    itemId
) {

    if (
        victoryLootPickInProgress ||
        !itemId ||
        !victoryLootDraftState?.is_my_turn
    ) {

        return;

    }


    victoryLootPickInProgress =
        true;


    try {

        const {
            error
        } =
            await db.rpc(
                "pick_combat_loot_item",
                {
                    p_combat_id:
                        combatId,

                    p_item_id:
                        itemId
                }
            );


        if (error) {

            throw error;

        }


        // Aggiorna immediatamente inventario
        await loadCharacterInventory();


        // Aggiorna immediatamente il draft
        await refreshVictoryLootDraft();


    } catch (error) {

        console.error(
            "Errore scelta oggetto:",
            error
        );


        alert(
            cleanCombatError(
                error.message
            )
        );


        await refreshVictoryLootDraft();


    } finally {

        victoryLootPickInProgress =
            false;

    }

}

// ============================================================
// MOSTRA LOOT VITTORIA
// ============================================================

function renderVictoryLoot(
    loot,
    myGold = 0,
    draft = null
) {

    const container =
        document.getElementById(
            "combat-victory-loot"
        );


    if (!container) {

        return;

    }


    let html = "";


    // ========================================================
    // ORO PERSONALE
    // ========================================================

    html += `
        <div class="victory-loot-gold">

            <div class="victory-loot-gold-label">
                HAI RICEVUTO
            </div>

            <div class="victory-loot-gold-value">

                <span class="victory-gold-coin"></span>

                <strong>
                    ${Number(myGold) || 0}
                </strong>

                monete d'oro

            </div>

        </div>
    `;


    // ========================================================
    // DRAFT NON ANCORA DISPONIBILE
    // ========================================================

    if (!draft) {

        html += `
            <div class="victory-loot-empty">
                Preparazione della spartizione...
            </div>
        `;

        container.innerHTML =
            html;

        return;

    }


    // ========================================================
    // DRAFT COMPLETATO
    // ========================================================

    if (
    draft.status ===
    "complete"
) {

    html += `
        <div class="victory-loot-draft-complete">
            SPARTIZIONE COMPLETATA
        </div>
    `;


    const myItems =
        Array.isArray(
            draft.my_items
        )
            ? draft.my_items
            : [];


    if (
        myItems.length > 0
    ) {

        html += `
            <div class="victory-loot-items">

                <div class="victory-loot-gold-label">
                    HAI OTTENUTO
                </div>
        `;


        for (
            const item
            of myItems
        ) {

            html += `
                <div class="victory-loot-item">

                    <span>
                        ${escapeCombatHtml(
                            item.item_name ||
                            item.item_id
                        )}
                    </span>

                    <strong>
                        ×${Number(
                            item.quantity
                        ) || 0}
                    </strong>

                </div>
            `;

        }


        html += `
            </div>
        `;

    } else {

        html += `
            <div class="victory-loot-empty">
                Non hai ottenuto oggetti.
            </div>
        `;

    }


    container.innerHTML =
        html;

    return;

}


    // ========================================================
    // TURNO ATTUALE
    // ========================================================

    const seconds =
        Math.max(
            0,
            Number(
                draft.seconds_remaining
            ) || 0
        );


    html += `
        <div class="victory-loot-turn">

            <div class="victory-loot-turn-label">
                TURNO DI
            </div>

            <div class="victory-loot-turn-player">
                ${escapeCombatHtml(
                    draft.current_player_name ||
                    "Giocatore"
                )}
            </div>

            <div class="victory-loot-timer">
                ${seconds}s
            </div>

        </div>
    `;


    if (
        draft.is_my_turn
    ) {

        html += `
            <div class="victory-loot-your-turn">
                È il tuo turno. Scegli un oggetto.
            </div>
        `;

    } else {

        html += `
            <div class="victory-loot-waiting">
                Attendi che il giocatore scelga.
            </div>
        `;

    }


    // ========================================================
    // OGGETTI DISPONIBILI
    // ========================================================

    const items =
        Array.isArray(
            draft.items
        )
            ? draft.items
            : [];


    if (
        items.length === 0
    ) {

        html += `
            <div class="victory-loot-empty">
                Nessun oggetto rimasto.
            </div>
        `;

    } else {

        html += `
            <div class="victory-loot-items">
        `;


        for (
            const item
            of items
        ) {

            html += `
                <div class="victory-loot-item">

                    <div class="victory-loot-item-info">

                        <span>
                            ${escapeCombatHtml(
                                item.item_name ||
                                item.item_id
                            )}
                        </span>

                        <strong>
                            ×${Number(item.quantity) || 0}
                        </strong>

                    </div>


                    <button
                        type="button"
                        class="victory-loot-pick"
                        data-item-id="${escapeCombatHtml(
                            item.item_id
                        )}"
                        ${draft.is_my_turn
                            ? ""
                            : "disabled"}
                    >
                        PRENDI
                    </button>

                </div>
            `;

        }


        html += `
            </div>
        `;

    }


    container.innerHTML =
        html;


    // ========================================================
    // EVENTI PULSANTI
    // ========================================================

    container
        .querySelectorAll(
            ".victory-loot-pick"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        if (
                            button.disabled
                        ) {

                            return;

                        }


                        button.disabled =
                            true;


                        await pickVictoryLootItem(
                            button.dataset.itemId
                        );

                    }
                );

            }
        );

}


    // ========================================================
    // RACCOGLIE GLI OGGETTI
    //
    // Le monete non vengono mostrate qui:
    // sono già state distribuite automaticamente.
    // ========================================================

    const otherItems =
        new Map();


    if (
        Array.isArray(loot)
    ) {

        loot.forEach(
            entry => {

                const quantity =
                    Number(
                        entry.quantity
                    ) || 0;


                // =================================================
                // ORO
                //
                // Viene gestito dalla distribuzione automatica.
                // =================================================

                if (
                    entry.item_id ===
                    "moneta_oro"
                ) {

                    return;

                }


                const existing =
                    otherItems.get(
                        entry.item_id
                    );


                if (existing) {

                    existing.quantity +=
                        quantity;

                } else {

                    otherItems.set(
                        entry.item_id,
                        {

                            item_id:
                                entry.item_id,

                            item_name:
                                entry.item_name,

                            quantity:
                                quantity

                        }
                    );

                }

            }
        );

    }


    // ========================================================
    // HTML
    // ========================================================

    let html = "";


    // ========================================================
    // QUOTA PERSONALE DI ORO
    // ========================================================

    if (
        myGold !== null
    ) {

        html += `
            <div class="victory-loot-gold">

                <div class="victory-loot-gold-label">
                    HAI RICEVUTO
                </div>

                <div class="victory-loot-gold-value">
                    <span class="victory-gold-coin">●</span>
<strong>${myGold}</strong>
monete d'oro
                </div>

            </div>
        `;

    }


    // ========================================================
    // ALTRI OGGETTI
    // ========================================================

    if (
        otherItems.size > 0
    ) {

        html += `
            <div class="victory-loot-items-title">
                OGGETTI TROVATI
            </div>

            <div class="victory-loot-items">
        `;


        for (
            const item
            of otherItems.values()
        ) {

            html += `
                <div class="victory-loot-item">

                    <span>
                        ${escapeCombatHtml(
                            item.item_name ||
                            item.item_id
                        )}
                    </span>

                    <strong>
                        ×${item.quantity}
                    </strong>

                </div>
            `;

        }


        html += `
            </div>
        `;

    }


    // ========================================================
    // NESSUN ALTRO OGGETTO
    // ========================================================

    if (
        otherItems.size === 0
    ) {

        html += `
            <div class="victory-loot-empty">
                Nessun altro oggetto trovato.
            </div>
        `;

    }


    container.innerHTML =
        html;


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeCombatHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}

// ============================================================
// PULSANTE USCITA VITTORIA
// ============================================================

function setupVictoryExitButton() {

    const button =
        document.getElementById(
            "combat-victory-exit"
        );

    if (!button) {
        return;

    }

    button.addEventListener(
        "click",
        () => {

            window.location.href =
                "dungeon.html"
        }
    )
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
                "dead" ||
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
                    )
                    *
                    cellWidth
                    -
                    size / 2
                }px`;


            token.style.top =
                `${
                    (
                        Number(entity.y) +
                        0.5
                    )
                    *
                    cellHeight
                    -
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
            loadCombatEffects()
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


        // Ricarica PM e stato azione del PG.
        await loadCombatEntities();


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
// VISUALI TARGET
// ============================================================

function updateTargetSelectionVisuals() {

    renderCombatRangeCells();


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


            if (!combatTargetMode) {

                return;

            }


            const entity =
                combatEntities.get(
                    entityId
                );


            if (
                !entity ||
                entity.status !==
                "alive"
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
    combatTargetMode &&
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
            // ATTACCHI
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
// ANNULLA TARGET
// ============================================================

function cancelCombatTargeting() {

    combatTargetMode = null;


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


    aliveEntities.forEach(
        entity => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "combat-entity-item";

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
// MIO PG
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

const movementBuff =
    getCombatEffectBonus(
        playerEntity.id,
        "movement_bonus"
    );

const criticalBuff =
    getCombatEffectBonus(
        playerEntity.id,
        "critical_bonus"
    );


    if (!playerEntity) {

        return;

    }


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


    const attack =
    Math.ceil(
        forza / 2
    )
    +
    (
        Number(
            equipmentBonuses.attack_bonus
        ) || 0
    )
    +
    getCombatEffectBonus(
        playerEntity.id,
        "attack_bonus"
    );


    const defense =
    Math.ceil(
        7 +
        resistenza / 2
    )
    +
    (
        Number(
            equipmentBonuses.defense_bonus
        ) || 0
    )
    +
    getCombatEffectBonus(
        playerEntity.id,
        "defense_bonus"
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
    )
    +
    getCombatEffectBonus(
        playerEntity.id,
        "movement_bonus"
    );


    const critical =
    (
        fortuna *
        (
            50 / 30
        )
        +
        getCombatEffectBonus(
            playerEntity.id,
            "critical_bonus"
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
    attackBuff > 0
        ? `${attack - attackBuff} +${attackBuff}`
        : attack
);


    setText(
    "combat-defense-value",
    defenseBuff > 0
        ? `${defense - defenseBuff} +${defenseBuff}`
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
                Number(critical) -
                criticalBuff
            ).toFixed(2)
        }% +${criticalBuff}%`
        : `${critical}%`
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


    if (
        playerBuffs.length ===
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


            const valueFormatter =
                buffValues[
                    effect.effect_type
                ];


            value.textContent =
                valueFormatter
                    ? valueFormatter(
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
                ability.description ||
                "";


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
    ability.id === "attrazione"
    ||
    ability.id === "repulsione"
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
                item.description ||
                "";


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


        if (data) {

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


// ============================================================
// DRAWER
// ============================================================

function closeCombatDrawer() {

    activeDrawer = null;


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
// AZIONE PRINCIPALE DISPONIBILE?
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
// AGGIORNA BOTTONI
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


    cancelCombatTargeting();


    const button =
        document.getElementById(
            "combat-action-pass"
        );


    if (button) {

        button.disabled = true;

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


        if (combatTargetMode) {

            cancelCombatTargeting();

        }


        updateActionButtons();


        return;

    }


    const currentEntity =
        getCurrentTurnEntity();


    if (!currentEntity) {

        setCombatStatus(
            "Turno non disponibile."
        );


        if (combatTargetMode) {

            cancelCombatTargeting();

        }


        updateActionButtons();


        return;

    }


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


        if (combatTargetMode) {

            cancelCombatTargeting();

        }


        updateActionButtons();


        return;

    }


    // ========================================================
    // TURNO PG
    // ========================================================

    if (isMyTurn()) {

        setCombatStatus(
            `Round ${round} · IL TUO TURNO · ${remaining}s`
        );

    } else {

        setCombatStatus(
            `Round ${round} · Turno di ${currentEntity.display_name} · ${remaining}s`
        );


        if (combatTargetMode) {

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


        combatTimerInterval = null;

    }


    if (combatStateInterval) {

        clearInterval(
            combatStateInterval
        );


        combatStateInterval = null;

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


    combatRefreshInProgress = true;


    try {

        await db.rpc(
            "advance_combat_if_timeout",
            {

                p_combat_id:
                    combatId

            }
        );


        await loadCombatSession();

// ============================================================
// CONTROLLA SUBITO EVENTUALE VITTORIA
// ============================================================

renderCombatVictory();

await Promise.all([
    loadCombatEntities(),
    loadCombatEffects()
]);


        const snapshot =
    createCombatSnapshot();

const effectsSnapshot =
    createCombatEffectsSnapshot();


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

        updateCombatTurnUI();


    } catch (error) {

        console.error(
            "Errore aggiornamento stato combat:",
            error
        );


    } finally {

        combatRefreshInProgress = false;

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


        combatMoveInProgress = true;


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

            combatMoveInProgress = false;

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
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement ||
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


    if (!map) {

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
// USCITA
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

            combatMapResizeObserver = null;

        }

    }
);
