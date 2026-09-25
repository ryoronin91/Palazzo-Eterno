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
    }

];

// ============================================================
// EVENTI COMUNICAZIONE DEL PIANO 1
// ============================================================

const DUNGEON_COMMUNICATION_EVENTS = [

    {
        id: "stairs_down",
        x: 11,
        y: 17,
        message:
            "Queste scale scendono ad un piano inferiore."
    },

    {
        id: "dead_end",
        x: 15,
        y: 22,
        message:
            "Possibile che quelle scale ti abbiano portato ad un vicolo cieco? Sì"
    }

];


// ============================================================
// CONTROLLO EVENTO COMUNICAZIONE
// ============================================================

function checkCommunicationEvent() {

    if (
        playerX === null ||
        playerY === null
    ) {

        return false;

    }


    const communicationEvent =
        DUNGEON_COMMUNICATION_EVENTS.find(
            dungeonEvent =>

                Number(
                    dungeonEvent.x
                ) ===
                Number(
                    playerX
                )

                &&

                Number(
                    dungeonEvent.y
                ) ===
                Number(
                    playerY
                )
        );


    if (
        !communicationEvent
    ) {

        return false;

    }


    setMessage(
        communicationEvent.message
    );


    console.log(
        "Evento comunicazione:",
        communicationEvent
    );


    return true;

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


    modal.innerHTML = `
        <div class="combat-event-icon">
            ⚔
        </div>

        <h2>
            COMBATTIMENTO
        </h2>

        <p>
            Una presenza ostile blocca il tuo cammino.
        </p>

        <div class="combat-event-warning">
            Una volta entrato nel combattimento
            non potrai abbandonarlo fino alla
            <strong>vittoria</strong>
            o alla
            <strong>morte</strong>.
        </div>

        <div class="combat-event-buttons">

            <button
                id="combat-event-enter"
                type="button"
                class="combat-event-button combat-event-enter"
            >
                ENTRA IN COMBATTIMENTO
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
                    "Decidi di non entrare in combattimento."
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

                setMessage(
                    "Ingresso nel combattimento..."
                );


                const {
                    data,
                    error
                } =
                    await db.rpc(
                        "enter_dungeon_combat",
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
    () => {

        console.log(
            "Eventi combat disponibili:",
            DUNGEON_COMBAT_EVENTS
        );


        renderCombatEvents();

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
    "Percepisci una presenza ostile nelle vicinanze."
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
                    `Evento Combat ${combatEvent.id}`;


                const image =
                    document.createElement(
                        "img"
                    );


                image.src =
                    combatEvent.token;


                image.alt =
                    `Evento Combat ${combatEvent.id}`;


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


            positionCombatEventToken(
                token,
                combatEvent.x,
                combatEvent.y
            );

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


            positionCombatEventToken(
                token,
                combatEvent.x,
                combatEvent.y
            );

        }
    );

}
