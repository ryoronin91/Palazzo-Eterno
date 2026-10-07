// ============================================================
// PALAZZO ETERNO
// EVENTI.JS
// ============================================================

console.log(
    "EVENTI.JS CARICATO"
);


// ============================================================
// EVENTI COMBAT DEL PIANO 1
// ============================================================

const DUNGEON_COMBAT_EVENTS = [

    {
        id: "C1",
        x: 12,
        y: 4,
        encounter_id: "combat_1",
        token: "../../immagini/eventi/combat_goblin.png"
    },

    {
        id: "C2",
        x: 7,
        y: 11,
        encounter_id: "combat_2",
        token: "../../immagini/eventi/combat_goblin.png"
    },

    {
        id: "C3",
        x: 13,
        y: 14,
        encounter_id: "combat_3",
        token: "../../immagini/eventi/combat_goblin.png"
    },

    {
        id: "C4",
        x: 19,
        y: 11,
        encounter_id: "combat_4",
        token: "../../immagini/eventi/combat_goblin.png"
    },

    {
        id: "C5",
        x: 11,
        y: 20,
        encounter_id: "combat_5",
        token: "../../immagini/eventi/combat_goblin.png"
    },

    {
        id: "BOSS1",
        x: 19,
        y: 20,
        encounter_id: "combat_boss",
        token: "../../immagini/nemici/goblin_boss.png"
    },

    {
        id: "PVP1",

        // Evento conservato ma temporaneamente disattivato.
        // Per riattivarlo basta riportare enabled a true.
        enabled: false,

        x: 1,
        y: 14,
        type: "pvp",
        token: "../../immagini/eventi/token_pvp.png"
    }

];

// ============================================================
// STATO COOLDOWN COMBAT PIANO 1 + GOBLIN BOSS
// ============================================================
//
// C1-C5 condividono uno stato globale lato server, con
// cooldown indipendente per ogni encounter.
//
// Il Boss continua a usare il suo sistema separato.
// Durante un cooldown:
//
// - il token viene nascosto;
// - l'evento non viene rilevato come vicino;
// - la sua casella non blocca il movimento;
// - allo scadere del timer il token ricompare.
//
// ============================================================

const FLOOR1_COOLDOWN_ENCOUNTERS =
    new Set([
        "combat_1",
        "combat_2",
        "combat_3",
        "combat_4",
        "combat_5"
    ]);

let floor1CombatStates = {};
let floor1CombatStateRefreshInterval = null;

let goblinBossAvailable =
    true;

let goblinBossCooldownUntil =
    null;

let goblinBossCooldownRefreshInterval =
    null;


// ============================================================
// EVENTO È DISPONIBILE?
// ============================================================

function isDungeonCombatEventAvailable(
    combatEvent
) {

    if (!combatEvent) {

        return false;

    }


    if (
        combatEvent.enabled ===
        false
    ) {

        return false;

    }


    if (
        combatEvent.type ===
        "pvp"
    ) {

        return true;

    }


    const isBossEvent =
        combatEvent.id ===
            "BOSS1"
        ||
        combatEvent.encounter_id ===
            "combat_boss";


    if (isBossEvent) {

        return goblinBossAvailable ===
            true;

    }


    if (
        FLOOR1_COOLDOWN_ENCOUNTERS.has(
            combatEvent.encounter_id
        )
    ) {

        return floor1CombatStates?.[
            combatEvent.encounter_id
        ]?.available !== false;

    }


    return true;

}


// ============================================================
// AGGIORNA STATO C1-C5 DAL SERVER
// ============================================================

async function refreshFloor1CombatStates() {

    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "get_floor1_combat_states"
            );


        if (error) {

            throw error;

        }


        floor1CombatStates =
            data || {};


        renderCombatEvents();


        // Se un combat entra in cooldown mentre il popup
        // relativo è ancora aperto, lo chiudiamo subito.

        if (
            pendingCombatEvent
            &&
            FLOOR1_COOLDOWN_ENCOUNTERS.has(
                pendingCombatEvent.encounter_id
            )
            &&
            !isDungeonCombatEventAvailable(
                pendingCombatEvent
            )
        ) {

            closeCombatPrompt();

        }


        // Se l'evento vicino non è più disponibile,
        // consentiamo alla rilevazione di ripartire pulita.

        if (
            nearbyCombatEventId
        ) {

            const nearbyEvent =
                DUNGEON_COMBAT_EVENTS.find(
                    combatEvent =>
                        combatEvent.id ===
                        nearbyCombatEventId
                );


            if (
                nearbyEvent
                &&
                FLOOR1_COOLDOWN_ENCOUNTERS.has(
                    nearbyEvent.encounter_id
                )
                &&
                !isDungeonCombatEventAvailable(
                    nearbyEvent
                )
            ) {

                nearbyCombatEventId =
                    null;

            }

        }


        return data;

    } catch (error) {

        console.error(
            "Errore stato combat Piano 1:",
            error
        );


        // Manteniamo l'ultimo stato valido noto.
        return null;

    }

}


// ============================================================
// REFRESH PERIODICO C1-C5
// ============================================================

function startFloor1CombatStateRefresh() {

    if (
        floor1CombatStateRefreshInterval
    ) {

        clearInterval(
            floor1CombatStateRefreshInterval
        );

    }


    floor1CombatStateRefreshInterval =
        setInterval(
            async () => {

                await refreshFloor1CombatStates();

            },
            10000
        );

}


// ============================================================
// AGGIORNA STATO BOSS DAL SERVER
// ============================================================

async function refreshGoblinBossState() {

    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "get_goblin_boss_state"
            );


        if (error) {

            throw error;

        }


        goblinBossAvailable =
            data?.available !==
            false;


        goblinBossCooldownUntil =
            data?.cooldown_until ||
            null;


        renderCombatEvents();


        if (
            goblinBossAvailable !==
                true
            &&
            pendingCombatEvent
            &&
            (
                pendingCombatEvent.id ===
                    "BOSS1"
                ||
                pendingCombatEvent.encounter_id ===
                    "combat_boss"
            )
        ) {

            closeCombatPrompt();

        }


        if (
            goblinBossAvailable !==
            true
            &&
            nearbyCombatEventId ===
                "BOSS1"
        ) {

            nearbyCombatEventId =
                null;

        }


        return data;

    } catch (error) {

        console.error(
            "Errore stato Goblin Boss:",
            error
        );


        return null;

    }

}


// ============================================================
// REFRESH PERIODICO STATO BOSS
// ============================================================

function startGoblinBossStateRefresh() {

    if (
        goblinBossCooldownRefreshInterval
    ) {

        clearInterval(
            goblinBossCooldownRefreshInterval
        );

    }


    goblinBossCooldownRefreshInterval =
        setInterval(
            async () => {

                await refreshGoblinBossState();

            },
            15000
        );

}

// ============================================================
// EVENTI COMUNICAZIONE DEL PIANO 1
// ============================================================

const DUNGEON_COMMUNICATION_EVENTS = [

    {
        id: "stairs_down",
        x: 11,
        y: 17,
        type: "stairs",
        message:
            "Queste scale salgono verso il prossimo livello del Palazzo."
    },

    {
        id: "stairs_down_secret",
        x: 19,
        y: 22,
        type: "stairs",
        message:
            "Queste scale salgono verso il prossimo livello del Palazzo."
    },

    {
        id: "dead_end",
        x: 15,
        y: 22,
        type: "monkey_finger",
        message:
            "Il vicolo cieco nasconde qualcosa tra le macerie."
    }

];

// ============================================================
// EVENTI COMUNICAZIONE - UTILITÀ
// ============================================================

function escapeCommunicationHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// ============================================================
// TROVA EVENTO COMUNICAZIONE SULLA CASELLA ATTUALE
// ============================================================

function getCurrentCommunicationEvent() {

    if (
        playerX === null ||
        playerY === null
    ) {

        return null;

    }


    return DUNGEON_COMMUNICATION_EVENTS.find(
        dungeonEvent =>
            Number(dungeonEvent.x) === Number(playerX) &&
            Number(dungeonEvent.y) === Number(playerY)
    ) || null;

}


// ============================================================
// CONTROLLO EVENTO COMUNICAZIONE
// ============================================================

function checkCommunicationEvent() {

    const dungeonEvent =
        getCurrentCommunicationEvent();


    if (!dungeonEvent) {

        return false;

    }


    console.log(
        `Evento comunicazione: ${dungeonEvent.id}`,
        dungeonEvent
    );


    if (
        dungeonEvent.type ===
        "stairs"
    ) {

        openStairsPrompt(
            dungeonEvent
        );

        return true;

    }


    if (
        dungeonEvent.type ===
        "monkey_finger"
    ) {

        triggerMonkeyFingerEvent(
            dungeonEvent
        );

        return true;

    }


    return false;

}


// ============================================================
// POPUP SCALE
// ============================================================

function openStairsPrompt(
    dungeonEvent
) {

    if (
        !dungeonEvent ||
        document.getElementById(
            "stairs-event-overlay"
        )
    ) {

        return;

    }


    eventLocked =
        true;

    movementQueue.length =
        0;


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "stairs-event-overlay";

    overlay.className =
        "combat-event-overlay";


    const modal =
        document.createElement(
            "div"
        );


    modal.className =
        "combat-event-modal";


    modal.innerHTML = `
        <div class="combat-event-icon">
            ▲
        </div>

        <h2>
            SCALE
        </h2>

        <p>
            ${escapeCommunicationHtml(
                dungeonEvent.message
            )}
        </p>

        <div class="combat-event-buttons">

            <button
                id="stairs-stay-button"
                type="button"
                class="combat-event-button combat-event-cancel"
            >
                RIMANI
            </button>

            <button
                id="stairs-descend-button"
                type="button"
                class="combat-event-button combat-event-enter"
            >
                VAI ALLA BASE
            </button>

        </div>
    `;


    overlay.appendChild(
        modal
    );


    document.body.appendChild(
        overlay
    );


    document
        .getElementById(
            "stairs-stay-button"
        )
        ?.addEventListener(
            "click",
            () => {

                overlay.remove();

                eventLocked =
                    false;

                setMessage(
                    "Decidi di rimanere su questo piano."
                );

            }
        );


    document
        .getElementById(
            "stairs-descend-button"
        )
        ?.addEventListener(
            "click",
            async () => {

                await descendToNextFloor(
                    dungeonEvent
                );

            }
        );

}


// ============================================================
// SCALE - RITORNO ALLA BASE
// Nessun bonus score e nessuna chiusura/archiviazione della run.
// ============================================================

async function descendToNextFloor(
    dungeonEvent
) {

    if (
        !character ||
        !character.id
    ) {

        return;

    }


    const button =
        document.getElementById(
            "stairs-descend-button"
        );


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "RITORNO ALLA BASE...";

    }


    eventLocked =
        true;

    movementQueue.length =
        0;


    try {

        const characterId =
            character.id;


        // Ogni scala del dungeon ritorna alla scala corrispondente
        // del Livello Base.
        let targetBaseX = null;
        let targetBaseY = null;


        if (
            dungeonEvent?.id ===
            "stairs_down"
        ) {

            // Dungeon X11 Y17 -> Base X11 Y3
            targetBaseX = 11;
            targetBaseY = 3;

        } else if (
            dungeonEvent?.id ===
            "stairs_down_secret"
        ) {

            // Dungeon X19 Y22 -> Base X18 Y8
            targetBaseX = 18;
            targetBaseY = 8;

        } else {

            throw new Error(
                "Scala del dungeon non riconosciuta."
            );

        }


        const {
            error: updateError
        } =
            await db
                .from(
                    "characters"
                )
                .update({
                    base_x:
                        targetBaseX,

                    base_y:
                        targetBaseY,

                    current_location:
                        "base"
                })
                .eq(
                    "id",
                    characterId
                );


        if (updateError) {

            throw updateError;

        }


        character.base_x =
            targetBaseX;

        character.base_y =
            targetBaseY;

        character.current_location =
            "base";


        // Evita che, appena caricata la Base sulla casella della scala,
        // venga riaperto immediatamente lo stesso popup.
        try {

            sessionStorage.setItem(
                "palazzo_eterno_skip_base_arrival_event",
                "1"
            );

        } catch (storageError) {

            console.warn(
                "Impossibile impostare flag arrivo Base:",
                storageError
            );

        }


        if (
            dungeonChannel &&
            realtimeReady
        ) {

            try {

                await dungeonChannel.untrack();

            } catch (presenceError) {

                console.error(
                    "Errore untrack durante ritorno alla Base:",
                    presenceError
                );

            }

        }


        window.location.href =
            "../../base/base.html";


    } catch (error) {

        console.error(
            "Errore ritorno alla Base:",
            error
        );


        setMessage(
            error?.message ||
            "Non è stato possibile tornare alla Base."
        );


        if (button) {

            button.disabled =
                false;

            button.textContent =
                "VAI ALLA BASE";

        }


        eventLocked =
            false;

    }

}


// ============================================================
// VICOLO CIECO - DITO DI SCIMMIA
// ============================================================

async function triggerMonkeyFingerEvent(
    dungeonEvent
) {

    if (
        !character ||
        !character.id
    ) {

        return;

    }


    eventLocked =
        true;

    movementQueue.length =
        0;


    setMessage(
        dungeonEvent?.message ||
        "Cerchi tra le macerie..."
    );


    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "claim_monkey_finger",
                {
                    p_character_id:
                        character.id
                }
            );


        if (error) {

            throw error;

        }


        if (
            data?.obtained ===
            true
        ) {

            if (
                typeof loadCharacterEquipment ===
                "function"
            ) {

                await loadCharacterEquipment();

            }


            openSimpleDungeonEventPrompt(
                "DITO DI SCIMMIA",
                "Tra le macerie trovi un piccolo dito mummificato. Hai ottenuto il Dito di Scimmia."
            );

        } else {

            openSimpleDungeonEventPrompt(
                "VICOLO CIECO",
                "Cerchi tra le macerie, ma non trovi nulla di utile."
            );

        }


    } catch (error) {

        console.error(
            "Errore Dito di Scimmia:",
            error
        );


        openSimpleDungeonEventPrompt(
            "VICOLO CIECO",
            "Non riesci a recuperare ciò che si nasconde tra le macerie."
        );

    }

}


// ============================================================
// POPUP SEMPLICE EVENTO DUNGEON
// ============================================================

function openSimpleDungeonEventPrompt(
    title,
    message
) {

    const oldOverlay =
        document.getElementById(
            "communication-event-overlay"
        );


    if (oldOverlay) {

        oldOverlay.remove();

    }


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "communication-event-overlay";

    overlay.className =
        "combat-event-overlay";


    const modal =
        document.createElement(
            "div"
        );


    modal.className =
        "combat-event-modal";


    modal.innerHTML = `
        <div class="combat-event-icon">
            ◆
        </div>

        <h2>
            ${escapeCommunicationHtml(
                title
            )}
        </h2>

        <p>
            ${escapeCommunicationHtml(
                message
            )}
        </p>

        <div class="combat-event-buttons">

            <button
                id="communication-event-close"
                type="button"
                class="combat-event-button combat-event-cancel"
            >
                CONTINUA
            </button>

        </div>
    `;


    overlay.appendChild(
        modal
    );


    document.body.appendChild(
        overlay
    );


    document
        .getElementById(
            "communication-event-close"
        )
        ?.addEventListener(
            "click",
            () => {

                overlay.remove();

                eventLocked =
                    false;

            }
        );

}


// ============================================================
// POPUP COMBATTIMENTO
// ============================================================

function openCombatPrompt(
    combatEvent
) {

    if (
        combatPromptOpen ||
        !combatEvent
    ) {

        return;

    }


    combatPromptOpen =
        true;

    pendingCombatEvent =
        combatEvent;


    // Blocca momentaneamente il movimento.

    eventLocked =
        true;

    movementQueue.length =
        0;


    // --------------------------------------------------------
    // OVERLAY
    // --------------------------------------------------------

    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "combat-event-overlay";


    overlay.className =
        "combat-event-overlay";


    // --------------------------------------------------------
    // FINESTRA
    // --------------------------------------------------------

    const modal =
        document.createElement(
            "div"
        );


    modal.className =
        "combat-event-modal";


    const isPvpEvent =
        combatEvent.type ===
        "pvp";


    const isBossEvent =
        combatEvent.id ===
            "BOSS1"
        ||
        combatEvent.encounter_id ===
            "combat_boss";


    modal.innerHTML = `
        <div class="combat-event-icon">
            ⚔
        </div>

        <h2>
            ${
                isPvpEvent
                    ? "ARENA PvP"
                    : (
                        isBossEvent
                            ? "GOBLIN BOSS"
                            : "COMBATTIMENTO"
                    )
            }
        </h2>

        <p>
            ${
                isPvpEvent
                    ? "Davanti a te si apre l'Arena del Palazzo."
                    : (
                        isBossEvent
                            ? "Davanti a te si erge il Goblin Boss, a guardia delle scale."
                            : "Una presenza ostile blocca il tuo cammino."
                    )
            }
        </p>

        <div class="combat-event-warning">
            ${
                isPvpEvent
                    ? `
                        Qui gli avventurieri possono
                        combattere tra loro fino alla morte.
                        Il vincitore conquista
                        <strong>score ed equipaggiamento</strong>
                        dello sconfitto.
                    `
                    : (
                        isBossEvent
                            ? `
                                Questo sarà uno
                                <strong>scontro difficile</strong>:
                                sarebbe meglio affrontarlo
                                <strong>in gruppo</strong>.<br><br>

                                In compenso, i
                                <strong>premi saranno alti</strong>
                                e le scale protette dal Boss
                                sembrano decisamente migliori
                                di quelle lasciate incustodite.
                            `
                            : `
                                Una volta entrato nel combattimento
                                non potrai abbandonarlo fino alla
                                <strong>vittoria</strong>
                                o alla
                                <strong>morte</strong>.
                            `
                    )
            }
        </div>

        <div class="combat-event-buttons">

            <button
                id="combat-event-enter"
                type="button"
                class="combat-event-button combat-event-enter"
            >
                ${
                    isPvpEvent
                        ? "ENTRA NELL'ARENA"
                        : (
                            isBossEvent
                                ? "AFFRONTA IL BOSS"
                                : "ENTRA IN COMBATTIMENTO"
                        )
                }
            </button>

            <button
                id="combat-event-cancel"
                type="button"
                class="combat-event-button combat-event-cancel"
            >
                NON ORA
            </button>

        </div>
    `;


    overlay.appendChild(
        modal
    );


    document.body.appendChild(
        overlay
    );


    // --------------------------------------------------------
    // NON ORA
    // --------------------------------------------------------

    document
        .getElementById(
            "combat-event-cancel"
        )
        ?.addEventListener(
            "click",
            () => {

                closeCombatPrompt();

                setMessage(
                    pendingCombatEvent?.type === "pvp"
                        ? "Decidi di non entrare nell'Arena."
                        : "Decidi di non entrare in combattimento."
                );

            }
        );


    // --------------------------------------------------------
    // ENTRA
    // --------------------------------------------------------

    document
    .getElementById(
        "combat-event-enter"
    )
    ?.addEventListener(
        "click",
        async () => {

            const button =
                document.getElementById(
                    "combat-event-enter"
                );


            const selectedEvent =
                pendingCombatEvent;


            if (
                !selectedEvent ||
                !character
            ) {

                return;

            }


            if (button) {

                button.disabled =
                    true;

                button.textContent =
                    "INGRESSO...";

            }


            try {

                // ====================================================
                // ARENA PvP
                // ====================================================

                if (
                    selectedEvent.type ===
                    "pvp"
                ) {

                    setMessage(
                        "Ingresso nell'Arena PvP..."
                    );


                    if (
                        typeof flushPositionSave ===
                        "function"
                    ) {

                        await flushPositionSave();

                    }


                    window.location.href =
                        "pvp.html";


                    return;

                }


                // ====================================================
                // COMBAT PvE NORMALE
                // ====================================================

                setMessage(
                    "Ingresso nel combattimento..."
                );


                const isBossEvent =
                    selectedEvent.id ===
                        "BOSS1"
                    ||
                    selectedEvent.encounter_id ===
                        "combat_boss";


                const isFloor1CooldownEvent =
                    FLOOR1_COOLDOWN_ENCOUNTERS.has(
                        selectedEvent.encounter_id
                    );


                const enterCombatRpc =
                    isBossEvent
                        ? "enter_dungeon_combat_checked"
                        : (
                            isFloor1CooldownEvent
                                ? "enter_floor1_combat_checked"
                                : "enter_dungeon_combat"
                        );


                const {
                    data,
                    error
                } =
                    await db.rpc(
                        enterCombatRpc,
                        {

                            p_encounter_id:
                                selectedEvent.encounter_id,

                            p_character_id:
                                character.id

                        }
                    );


                if (error) {

                    throw error;

                }


                const combatId =
                    data;


                if (!combatId) {

                    throw new Error(
                        "ID del combattimento non ricevuto."
                    );

                }


                // Salviamo localmente lo stato.

                character.active_combat_id =
                    combatId;


                // Aggiorniamo la Presence prima di uscire,
                // così gli altri PG possono vedere che
                // siamo entrati in combat.

                if (
                    typeof updateMyPresence ===
                    "function"
                ) {

                    await updateMyPresence();

                }


                if (
                    typeof broadcastMyState ===
                    "function"
                ) {

                    await broadcastMyState();

                }


                // Non chiudiamo prima il popup:
                // lasciamo il movimento bloccato fino
                // al cambio pagina.

                window.location.href =
                    `../../combat.html?combat_id=${encodeURIComponent(
                        combatId
                    )}`;

            } catch (error) {

                console.error(
                    "Errore ingresso combat:",
                    error
                );


                if (button) {

                    button.disabled =
                        false;

                    button.textContent =
                        "ENTRA IN COMBATTIMENTO";

                }


                const message =
                    error?.message ||
                    "Impossibile entrare nel combattimento.";


                setMessage(
                    message
                );


                if (
                    selectedEvent?.id ===
                        "BOSS1"
                    ||
                    selectedEvent?.encounter_id ===
                        "combat_boss"
                ) {

                    await refreshGoblinBossState();

                } else if (
                    FLOOR1_COOLDOWN_ENCOUNTERS.has(
                        selectedEvent?.encounter_id
                    )
                ) {

                    await refreshFloor1CombatStates();

                }

            }

        }
    );

}


// ============================================================
// CHIUDE POPUP COMBATTIMENTO
// ============================================================

function closeCombatPrompt() {

    const overlay =
        document.getElementById(
            "combat-event-overlay"
        );


    if (overlay) {

        overlay.remove();

    }


    combatPromptOpen =
        false;

    pendingCombatEvent =
        null;


    eventLocked =
        false;

}

// ============================================================
// AVVIO EVENTI
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "Eventi combat disponibili:",
            DUNGEON_COMBAT_EVENTS
        );

        console.log(
            "Eventi comunicazione disponibili:",
            DUNGEON_COMMUNICATION_EVENTS
        );


        // Prima di mostrare i token leggiamo dal server
        // sia i cooldown C1-C5 sia lo stato del Boss.

        await Promise.all([
            refreshFloor1CombatStates(),
            refreshGoblinBossState()
        ]);


        renderCombatEvents();


        // Durante la permanenza nel dungeon controlliamo
        // periodicamente se i cooldown sono terminati.

        startFloor1CombatStateRefresh();
        startGoblinBossStateRefresh();

    }
);

// ============================================================
// CONTROLLO VICINANZA EVENTI COMBAT
// ============================================================

let nearbyCombatEventId =
    null;

let combatPromptOpen =
    false;

let pendingCombatEvent =
    null;

// ============================================================
// TROVA EVENTO COMBAT VICINO
// ============================================================

function getNearbyCombatEvent() {

    if (
        playerX === null ||
        playerY === null
    ) {

        return null;

    }


    for (
        const combatEvent
        of DUNGEON_COMBAT_EVENTS
    ) {

        if (
            !isDungeonCombatEventAvailable(
                combatEvent
            )
        ) {

            continue;

        }


        const dx =
            Math.abs(
                Number(playerX) -
                Number(combatEvent.x)
            );


        const dy =
            Math.abs(
                Number(playerY) -
                Number(combatEvent.y)
            );


        // Distanza di 1 quadretto:
        // ortogonale o diagonale.
        //
        // NON conta la casella stessa del token.

        const isAdjacent =
            Math.max(
                dx,
                dy
            ) === 1;


        if (isAdjacent) {

            return combatEvent;

        }

    }


    return null;

}


// ============================================================
// AGGIORNA EVENTO VICINO
// ============================================================

function checkNearbyCombatEvents() {

    // ========================================================
    // EVENTO COMUNICAZIONE SULLA CASELLA ATTUALE
    // ========================================================

    if (
        checkCommunicationEvent() ===
        true
    ) {

        return true;

    }


    // ========================================================
    // EVENTO COMBAT NELLE VICINANZE
    // ========================================================

    const combatEvent =
        getNearbyCombatEvent();


    if (!combatEvent) {

        nearbyCombatEventId =
            null;

        return false;

    }


    // Evita di rilevare continuamente
    // lo stesso evento mentre il PG resta fermo.

    if (
        nearbyCombatEventId ===
        combatEvent.id
    ) {

        return true;

    }


    nearbyCombatEventId =
        combatEvent.id;


    console.log(
        `Evento combat vicino: ${combatEvent.id}`,
        combatEvent
    );


    setMessage(
        combatEvent.type === "pvp"
            ? "Scorgi l'ingresso dell'Arena PvP."
            : "Percepisci una presenza ostile nelle vicinanze."
    );


    openCombatPrompt(
        combatEvent
    );


    return true;

}

// ============================================================
// RIDIMENSIONAMENTO MAPPA
// ============================================================

window.addEventListener(
    "resize",
    () => {

        repositionCombatEvents();

    }
);

// ============================================================
// TOKEN EVENTI COMBAT
// ============================================================

const combatEventTokens =
    new Map();


// ============================================================
// MOSTRA EVENTI COMBAT SULLA MAPPA
// ============================================================

function renderCombatEvents() {

    const map =
        document.getElementById(
            "dungeon-map"
        );


    if (!map) {

        console.error(
            "Mappa dungeon non trovata."
        );

        return;

    }


    DUNGEON_COMBAT_EVENTS.forEach(
        combatEvent => {

            let token =
                combatEventTokens.get(
                    combatEvent.id
                );


            // ------------------------------------------------
            // CREA TOKEN
            // ------------------------------------------------

            if (!token) {

                token =
                    document.createElement(
                        "div"
                    );


                token.className =
                    "dungeon-combat-event";


                token.dataset.eventId =
                    combatEvent.id;


                token.title =
                    combatEvent.type === "pvp"
                        ? "Arena PvP"
                        : `Evento Combat ${combatEvent.id}`;


                const image =
                    document.createElement(
                        "img"
                    );


                image.src =
                    combatEvent.token;


                image.alt =
                    combatEvent.type === "pvp"
                        ? "Arena PvP"
                        : `Evento Combat ${combatEvent.id}`;


                image.draggable =
                    false;


                token.appendChild(
                    image
                );


                map.appendChild(
                    token
                );


                combatEventTokens.set(
                    combatEvent.id,
                    token
                );

            }


            const eventAvailable =
                isDungeonCombatEventAvailable(
                    combatEvent
                );


            token.style.display =
                eventAvailable
                    ? ""
                    : "none";


            if (
                eventAvailable
            ) {

                positionCombatEventToken(
                    token,
                    combatEvent.x,
                    combatEvent.y
                );

            }

        }
    );

}


// ============================================================
// POSIZIONA TOKEN COMBAT
// ============================================================

function positionCombatEventToken(
    element,
    x,
    y
) {

    const map =
        document.getElementById(
            "dungeon-map"
        );


    if (
        !map ||
        !element
    ) {

        return;

    }


    const rect =
        map.getBoundingClientRect();


    if (
        rect.width <= 0 ||
        rect.height <= 0
    ) {

        return;

    }


    const cellWidth =
        rect.width /
        MAP_COLUMNS;


    const cellHeight =
        rect.height /
        MAP_ROWS;


    // Il token combat è leggermente più grande
    // della pedina di un personaggio.

    const tokenSize =
        Math.min(
            cellWidth,
            cellHeight
        ) * 1.10;


    element.style.width =
        `${tokenSize}px`;


    element.style.height =
        `${tokenSize}px`;


    element.style.left =
        `${
            (
                Number(x) +
                0.5
            ) *
            cellWidth -
            tokenSize / 2
        }px`;


    element.style.top =
        `${
            (
                Number(y) +
                0.5
            ) *
            cellHeight -
            tokenSize / 2
        }px`;

}


// ============================================================
// RIPOSIZIONA EVENTI
// ============================================================

function repositionCombatEvents() {

    DUNGEON_COMBAT_EVENTS.forEach(
        combatEvent => {

            const token =
                combatEventTokens.get(
                    combatEvent.id
                );


            if (!token) {

                return;

            }


            if (
                !isDungeonCombatEventAvailable(
                    combatEvent
                )
            ) {

                token.style.display =
                    "none";

                return;

            }


            token.style.display =
                "";


            positionCombatEventToken(
                token,
                combatEvent.x,
                combatEvent.y
            );

        }
    );

}

// ============================================================
// CHIUSURA PAGINA - STOP REFRESH COOLDOWN
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (
            floor1CombatStateRefreshInterval
        ) {

            clearInterval(
                floor1CombatStateRefreshInterval
            );

            floor1CombatStateRefreshInterval =
                null;

        }


        if (
            goblinBossCooldownRefreshInterval
        ) {

            clearInterval(
                goblinBossCooldownRefreshInterval
            );

            goblinBossCooldownRefreshInterval =
                null;

        }

    }
);

