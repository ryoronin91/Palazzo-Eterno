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
        token: "immagini/eventi/combat_goblin.png"
    },

    {
        id: "C2",
        x: 7,
        y: 11,
        encounter_id: "combat_2",
        token: "immagini/eventi/combat_goblin.png"
    },

    {
        id: "C3",
        x: 13,
        y: 14,
        encounter_id: "combat_3",
        token: "immagini/eventi/combat_goblin.png"
    },

    {
        id: "C4",
        x: 19,
        y: 11,
        encounter_id: "combat_4",
        token: "immagini/eventi/combat_goblin.png"
    },

    {
        id: "C5",
        x: 11,
        y: 20,
        encounter_id: "combat_5",
        token: "immagini/eventi/combat_goblin.png"
    },

    {
        id: "BOSS1",
        x: 19,
        y: 20,
        encounter_id: "combat_boss",
        token: "immagini/nemici/goblin_boss.png"
    },

    {
        id: "PVP1",
        x: 1,
        y: 14,
        type: "pvp",
        token: "immagini/eventi/token_pvp.png"
    }

];

// ============================================================
// STATO GLOBALE GOBLIN BOSS
// ============================================================
//
// Il backend decide se il Boss è disponibile.
// Durante il cooldown:
//
// - il token del Boss viene nascosto;
// - il Boss non viene rilevato come evento vicino;
// - la sua casella NON blocca il movimento;
// - allo scadere del cooldown il Boss ricompare.
//
// ============================================================

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


    const isBossEvent =
        combatEvent.id ===
            "BOSS1"
        ||
        combatEvent.encounter_id ===
            "combat_boss";


    if (!isBossEvent) {

        return true;

    }


    return goblinBossAvailable ===
        true;

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


        // Se il Boss è diventato indisponibile mentre
        // avevamo il suo popup aperto, lo chiudiamo.

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


        // Se il Boss non è più disponibile,
        // azzeriamo anche la rilevazione di vicinanza.

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


        // In caso di errore manteniamo l'ultimo stato noto.
        // Non alteriamo gli altri eventi del dungeon.

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
        type: "base_return",
        message:
            "Queste scale conducono al Livello Base del Palazzo."
    },

    {
        id: "stairs_down_secret",
        x: 19,
        y: 22,
        type: "base_return_secret",
        message:
            "Queste scale conducono al Livello Base del Palazzo."
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
        "base_return"
    ) {

        openBaseReturnStairsPrompt(
            dungeonEvent
        );

        return true;

    }


    if (
        dungeonEvent.type ===
        "base_return_secret"
    ) {

        openSecretBaseReturnStairsPrompt(
            dungeonEvent
        );

        return true;

    }


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
// SCALE X11 Y17 -> LIVELLO BASE
// ============================================================
//
// Queste scale NON assegnano punti e NON archiviano/eliminano
// il personaggio.
//
// Il PG viene trasferito nel Livello Base alla casella X11 Y3.
// ============================================================

function openBaseReturnStairsPrompt(
    dungeonEvent
) {

    if (
        !dungeonEvent ||
        document.getElementById(
            "base-return-stairs-overlay"
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
        "base-return-stairs-overlay";

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

        <div class="combat-event-warning">
            Salendo tornerai al
            <strong>Livello Base</strong>.
        </div>

        <div class="combat-event-buttons">

            <button
                id="base-return-stay-button"
                type="button"
                class="combat-event-button combat-event-cancel"
            >
                RIMANI
            </button>

            <button
                id="base-return-enter-button"
                type="button"
                class="combat-event-button combat-event-enter"
            >
                RAGGIUNGI IL LIVELLO BASE
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
            "base-return-stay-button"
        )
        ?.addEventListener(
            "click",
            () => {

                overlay.remove();

                eventLocked =
                    false;

                setMessage(
                    "Decidi di rimanere nel dungeon."
                );

            }
        );


    document
        .getElementById(
            "base-return-enter-button"
        )
        ?.addEventListener(
            "click",
            async () => {

                await returnToBaseFromDungeon();

            }
        );

}


// ============================================================
// TRASFERISCE IL PG AL LIVELLO BASE
// ============================================================

async function returnToBaseFromDungeon() {

    if (
        !character ||
        !character.id
    ) {

        return;

    }


    const button =
        document.getElementById(
            "base-return-enter-button"
        );


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "SALITA...";

    }


    eventLocked =
        true;

    movementQueue.length =
        0;


    try {

        // ----------------------------------------------------
        // Salva immediatamente l'ultima posizione dungeon.
        // Non assegna alcun punto.
        // ----------------------------------------------------

        if (
            typeof flushPositionSave ===
            "function"
        ) {

            await flushPositionSave();

        }


        // ----------------------------------------------------
        // Posizione di arrivo nel Livello Base: X11 Y3
        // ----------------------------------------------------

        const {
            error
        } =
            await db
                .from(
                    "characters"
                )
                .update({

                    base_x:
                        11,

                    base_y:
                        3,

                    current_location:
                        "base"

                })
                .eq(
                    "id",
                    character.id
                );


        if (error) {

            throw error;

        }


        character.base_x =
            11;

        character.base_y =
            3;

        character.current_location =
            "base";


        // ----------------------------------------------------
        // Rimuove il PG dalla Presence del Piano 1
        // ----------------------------------------------------

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


        // ----------------------------------------------------
        // APRE IL LIVELLO BASE
        // ----------------------------------------------------

        window.location.href =
            "base/base.html";


    } catch (error) {

        console.error(
            "Errore ritorno al Livello Base:",
            error
        );


        setMessage(
            error?.message ||
            "Non è stato possibile tornare al Livello Base."
        );


        if (button) {

            button.disabled =
                false;

            button.textContent =
                "RAGGIUNGI IL LIVELLO BASE";

        }


        eventLocked =
            false;

    }

}


// ============================================================
// SCALE X19 Y22 -> LIVELLO BASE X18 Y8
// ============================================================
//
// Nessun punto, nessuna archiviazione, nessuna morte.
// ============================================================

function openSecretBaseReturnStairsPrompt(
    dungeonEvent
) {

    if (
        !dungeonEvent ||
        document.getElementById(
            "secret-base-return-stairs-overlay"
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
        "secret-base-return-stairs-overlay";

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

        <div class="combat-event-warning">
            Salendo raggiungerai il
            <strong>Livello Base</strong>.
        </div>

        <div class="combat-event-buttons">

            <button
                id="secret-base-return-stay-button"
                type="button"
                class="combat-event-button combat-event-cancel"
            >
                RIMANI
            </button>

            <button
                id="secret-base-return-enter-button"
                type="button"
                class="combat-event-button combat-event-enter"
            >
                RAGGIUNGI IL LIVELLO BASE
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
            "secret-base-return-stay-button"
        )
        ?.addEventListener(
            "click",
            () => {

                overlay.remove();

                eventLocked =
                    false;

                setMessage(
                    "Decidi di rimanere nel dungeon."
                );

            }
        );


    document
        .getElementById(
            "secret-base-return-enter-button"
        )
        ?.addEventListener(
            "click",
            async () => {

                await returnToSecretBaseStairs();

            }
        );

}


// ============================================================
// TRASFERISCE IL PG ALLA BASE X18 Y8
// ============================================================

async function returnToSecretBaseStairs() {

    if (
        !character ||
        !character.id
    ) {

        return;

    }


    const button =
        document.getElementById(
            "secret-base-return-enter-button"
        );


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "SALITA...";

    }


    eventLocked =
        true;

    movementQueue.length =
        0;


    try {

        if (
            typeof flushPositionSave ===
            "function"
        ) {

            await flushPositionSave();

        }


        const {
            error
        } =
            await db
                .from(
                    "characters"
                )
                .update({

                    base_x:
                        18,

                    base_y:
                        8,

                    current_location:
                        "base"

                })
                .eq(
                    "id",
                    character.id
                );


        if (error) {

            throw error;

        }


        character.base_x =
            18;

        character.base_y =
            8;

        character.current_location =
            "base";


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
            "base/base.html";


    } catch (error) {

        console.error(
            "Errore ritorno al Livello Base dalle scale segrete:",
            error
        );


        setMessage(
            error?.message ||
            "Non è stato possibile raggiungere il Livello Base."
        );


        if (button) {

            button.disabled =
                false;

            button.textContent =
                "RAGGIUNGI IL LIVELLO BASE";

        }


        eventLocked =
            false;

    }

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
            ▼
        </div>

        <h2>
            SCALE
        </h2>

        <p>
            ${escapeCommunicationHtml(
                dungeonEvent.message
            )}
        </p>

        <div class="combat-event-warning">
            Scendere al prossimo livello conclude
            questa esplorazione e assegna
            <strong>+${Number(dungeonEvent.score_bonus) || 50} punti</strong>.
        </div>

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
                SCENDI AL PROSSIMO LIVELLO
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
// SCENDI AL PROSSIMO LIVELLO
// +50 SCORE, ARCHIVIA LA RUN, ELIMINA IL PG, PAGINA MORTE
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
            "DISCESA...";

    }


    eventLocked =
        true;

    movementQueue.length =
        0;


    try {

        const characterId =
            character.id;

        const deadName =
            character.nome ||
            "Avventuriero";

        const currentScore =
            Number(
                character.score
            ) || 0;

        const floorBonus =
            Number(
                dungeonEvent?.score_bonus
            ) || 50;

        const scoreWithFloorBonus =
            currentScore +
            floorBonus;


        // ----------------------------------------------------
        // 1. BONUS DISCESA
        // ----------------------------------------------------

        const {
            error: scoreError
        } =
            await db
                .from(
                    "characters"
                )
                .update({
                    score:
                        scoreWithFloorBonus
                })
                .eq(
                    "id",
                    characterId
                );


        if (scoreError) {

            throw scoreError;

        }


        character.score =
            scoreWithFloorBonus;


        // ----------------------------------------------------
        // 2. SCORE FINALE
        // Include anche il valore degli oggetti in inventario.
        // ----------------------------------------------------

        const {
            data: finalScoreData,
            error: finalScoreError
        } =
            await db.rpc(
                "get_character_final_score",
                {
                    p_character_id:
                        characterId
                }
            );


        if (finalScoreError) {

            throw finalScoreError;

        }


        const deadFinalScore =
            Number(
                finalScoreData
            ) || 0;


        // ----------------------------------------------------
        // 3. ARCHIVIA LA RUN
        // ----------------------------------------------------

        const {
            error: archiveError
        } =
            await db
                .from(
                    "dead_characters"
                )
                .insert({

                    character_id:
                        characterId,

                    user_id:
                        character.user_id ||
                        currentUser?.id ||
                        null,

                    character_name:
                        deadName,

                    score:
                        deadFinalScore

                });


        if (archiveError) {

            throw archiveError;

        }


        // ----------------------------------------------------
        // 4. RIMUOVE PRESENCE
        // ----------------------------------------------------

        if (
            dungeonChannel &&
            realtimeReady
        ) {

            try {

                await dungeonChannel.untrack();

            } catch (presenceError) {

                console.error(
                    "Errore untrack durante discesa:",
                    presenceError
                );

            }

        }


        // ----------------------------------------------------
        // 5. ELIMINA IL PERSONAGGIO VIVO
        // ----------------------------------------------------

        const {
            error: deleteError
        } =
            await db
                .from(
                    "characters"
                )
                .delete()
                .eq(
                    "id",
                    characterId
                );


        if (deleteError) {

            throw deleteError;

        }


        character =
            null;


        // ----------------------------------------------------
        // 6. PAGINA FINALE
        // ----------------------------------------------------

        window.location.href =
            `morte.html?nome=${encodeURIComponent(
                deadName
            )}&score=${encodeURIComponent(
                deadFinalScore
            )}`;


    } catch (error) {

        console.error(
            "Errore discesa al prossimo livello:",
            error
        );


        setMessage(
            error?.message ||
            "Non è stato possibile scendere al prossimo livello."
        );


        if (button) {

            button.disabled =
                false;

            button.textContent =
                "SCENDI AL PROSSIMO LIVELLO";

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


                const {
                    data,
                    error
                } =
                    await db.rpc(
                        isBossEvent
                            ? "enter_dungeon_combat_checked"
                            : "enter_dungeon_combat",
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
                    `combat.html?combat_id=${encodeURIComponent(
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


        // Prima di mostrare i token leggiamo
        // lo stato globale del Goblin Boss.

        await refreshGoblinBossState();


        renderCombatEvents();


        // Durante la permanenza nel dungeon controlliamo
        // periodicamente se il cooldown è terminato.

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
// CHIUSURA PAGINA - STOP REFRESH BOSS
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

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

