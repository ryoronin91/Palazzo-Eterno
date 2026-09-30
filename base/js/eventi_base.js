// ============================================================
// PALAZZO ETERNO
// EVENTI_BASE.JS
//
// Eventi specifici del LIVELLO BASE.
//
// PRIMA VERSIONE:
// - definisce due combat clonati concettualmente da C1;
// - posiziona i token a X8 Y7 e X10 Y7;
// - gestisce correttamente le tre caselle condivise:
//   X9 Y6, X9 Y7, X9 Y8;
// - se entrambi i combat sono disponibili apre una scelta;
// - se ne è disponibile uno solo propone direttamente quello.
//
// NOTA IMPORTANTE:
// Il cooldown globale di 15 minuti e l'ingresso reale nei due
// combat richiedono due encounter Supabase separati.
// In questa versione usiamo gli ID:
//   base_combat_left
//   base_combat_right
//
// Quando creeremo i due encounter nel DB, questo file sarà già
// pronto per richiamarli.
// ============================================================

console.log("EVENTI_BASE.JS CARICATO");


// ============================================================
// EVENTI COMBAT DEL LIVELLO BASE
// ============================================================

const BASE_COMBAT_EVENTS = [

    {
        id: "BASE_C1_LEFT",
        x: 8,
        y: 7,
        encounter_id: "base_combat_left",
        token: "../immagini/eventi/combat_goblin.png",
        label: "Combattimento sinistro"
    },

    {
        id: "BASE_C1_RIGHT",
        x: 10,
        y: 7,
        encounter_id: "base_combat_right",
        token: "../immagini/eventi/combat_goblin.png",
        label: "Combattimento destro"
    }

];


// ============================================================
// COOLDOWN
// ============================================================

const BASE_COMBAT_COOLDOWN_MS =
    15 * 60 * 1000;


// ============================================================
// STATO LOCALE FRONTEND
//
// Per ora entrambi risultano disponibili.
// Nel passaggio successivo collegheremo questo stato a Supabase,
// così il cooldown sarà globale e condiviso tra tutti i PG.
// ============================================================

const baseCombatAvailability =
    new Map(
        BASE_COMBAT_EVENTS.map(
            combatEvent => [
                combatEvent.id,
                {
                    available: true,
                    cooldownUntil: null
                }
            ]
        )
    );


// ============================================================
// TOKEN COMBAT
// ============================================================

const baseCombatTokens =
    new Map();


// ============================================================
// STATO POPUP / RILEVAZIONE
// ============================================================

let baseCombatPromptOpen =
    false;

let pendingBaseCombatEvent =
    null;

let nearbyBaseCombatKey =
    null;


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        renderBaseCombatEvents();

        window.addEventListener(
            "resize",
            repositionBaseCombatEvents
        );

    }
);


// ============================================================
// EVENTO DISPONIBILE?
// ============================================================

function isBaseCombatEventAvailable(
    combatEvent
) {

    if (!combatEvent) {

        return false;

    }


    const state =
        baseCombatAvailability.get(
            combatEvent.id
        );


    return state?.available !==
        false;

}


// ============================================================
// MOSTRA TOKEN COMBAT
// ============================================================

function renderBaseCombatEvents() {

    const map =
        document.getElementById(
            "dungeon-map"
        );


    if (!map) {

        return;

    }


    BASE_COMBAT_EVENTS.forEach(
        combatEvent => {

            let token =
                baseCombatTokens.get(
                    combatEvent.id
                );


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
                    combatEvent.label;


                const image =
                    document.createElement(
                        "img"
                    );


                image.src =
                    combatEvent.token;


                image.alt =
                    combatEvent.label;


                image.draggable =
                    false;


                token.appendChild(
                    image
                );


                map.appendChild(
                    token
                );


                baseCombatTokens.set(
                    combatEvent.id,
                    token
                );

            }


            token.style.display =
                isBaseCombatEventAvailable(
                    combatEvent
                )
                    ? ""
                    : "none";


            if (
                isBaseCombatEventAvailable(
                    combatEvent
                )
            ) {

                positionBaseCombatToken(
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

function positionBaseCombatToken(
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
        BASE_MAP_COLUMNS;


    const cellHeight =
        rect.height /
        BASE_MAP_ROWS;


    const tokenSize =
        Math.min(
            cellWidth,
            cellHeight
        ) *
        1.10;


    element.style.position =
        "absolute";


    element.style.width =
        `${tokenSize}px`;


    element.style.height =
        `${tokenSize}px`;


    element.style.left =
        `${
            (
                Number(x) +
                0.5
            )
            *
            cellWidth
            -
            tokenSize / 2
        }px`;


    element.style.top =
        `${
            (
                Number(y) +
                0.5
            )
            *
            cellHeight
            -
            tokenSize / 2
        }px`;


    element.style.zIndex =
        "5";


    element.style.pointerEvents =
        "none";

}


// ============================================================
// RIPOSIZIONA TOKEN
// ============================================================

function repositionBaseCombatEvents() {

    BASE_COMBAT_EVENTS.forEach(
        combatEvent => {

            const token =
                baseCombatTokens.get(
                    combatEvent.id
                );


            if (!token) {

                return;

            }


            if (
                !isBaseCombatEventAvailable(
                    combatEvent
                )
            ) {

                token.style.display =
                    "none";

                return;

            }


            token.style.display =
                "";


            positionBaseCombatToken(
                token,
                combatEvent.x,
                combatEvent.y
            );

        }
    );

}


// ============================================================
// EVENTI ADIACENTI AL PG
//
// Distanza di 1 casella, comprese le diagonali.
// La casella del token non conta.
// ============================================================

function getNearbyBaseCombatEvents() {

    if (
        basePlayerX === null ||
        basePlayerY === null
    ) {

        return [];

    }


    return BASE_COMBAT_EVENTS.filter(
        combatEvent => {

            if (
                !isBaseCombatEventAvailable(
                    combatEvent
                )
            ) {

                return false;

            }


            const dx =
                Math.abs(
                    Number(basePlayerX) -
                    Number(combatEvent.x)
                );


            const dy =
                Math.abs(
                    Number(basePlayerY) -
                    Number(combatEvent.y)
                );


            return (
                Math.max(
                    dx,
                    dy
                ) === 1
            );

        }
    );

}


// ============================================================
// CONTROLLO VICINANZA
//
// Questa funzione deve essere chiamata da base.js dopo ogni passo.
// ============================================================

function checkNearbyBaseCombatEvents() {

    if (
        baseCombatPromptOpen
    ) {

        return true;

    }


    const nearbyEvents =
        getNearbyBaseCombatEvents();


    if (
        nearbyEvents.length === 0
    ) {

        nearbyBaseCombatKey =
            null;

        return false;

    }


    const detectionKey =
        nearbyEvents
            .map(
                event =>
                    event.id
            )
            .sort()
            .join("|");


    if (
        nearbyBaseCombatKey ===
        detectionKey
    ) {

        return true;

    }


    nearbyBaseCombatKey =
        detectionKey;


    // --------------------------------------------------------
    // UN SOLO COMBAT DISPONIBILE
    // --------------------------------------------------------

    if (
        nearbyEvents.length === 1
    ) {

        openBaseCombatPrompt(
            nearbyEvents[0]
        );

        return true;

    }


    // --------------------------------------------------------
    // DUE COMBAT CONTEMPORANEAMENTE ADIACENTI
    //
    // Succede nelle caselle:
    // X9 Y6
    // X9 Y7
    // X9 Y8
    // --------------------------------------------------------

    openBaseCombatChoicePrompt(
        nearbyEvents
    );


    return true;

}


// ============================================================
// POPUP COMBAT SINGOLO
// ============================================================

function openBaseCombatPrompt(
    combatEvent
) {

    if (
        baseCombatPromptOpen ||
        !combatEvent
    ) {

        return;

    }


    baseCombatPromptOpen =
        true;


    pendingBaseCombatEvent =
        combatEvent;


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "base-combat-event-overlay";


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
            ⚔
        </div>

        <h2>
            COMBATTIMENTO
        </h2>

        <p>
            Una presenza ostile blocca il tuo cammino.
        </p>

        <div class="combat-event-warning">
            Questo scontro appartiene al Livello Base.
            Una volta attivato avrà un cooldown globale
            di <strong>15 minuti</strong>.
        </div>

        <div class="combat-event-buttons">

            <button
                id="base-combat-enter"
                type="button"
                class="combat-event-button combat-event-enter"
            >
                ENTRA IN COMBATTIMENTO
            </button>

            <button
                id="base-combat-cancel"
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


    document
        .getElementById(
            "base-combat-cancel"
        )
        ?.addEventListener(
            "click",
            () => {

                closeBaseCombatPrompt();

                setMessage(
                    "Decidi di non entrare in combattimento."
                );

            }
        );


    document
        .getElementById(
            "base-combat-enter"
        )
        ?.addEventListener(
            "click",
            async () => {

                await enterBaseCombat(
                    combatEvent
                );

            }
        );

}


// ============================================================
// POPUP SCELTA TRA I DUE COMBAT
// ============================================================

function openBaseCombatChoicePrompt(
    combatEvents
) {

    if (
        baseCombatPromptOpen ||
        !Array.isArray(
            combatEvents
        ) ||
        combatEvents.length < 2
    ) {

        return;

    }


    baseCombatPromptOpen =
        true;


    pendingBaseCombatEvent =
        null;


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "base-combat-event-overlay";


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
            ⚔
        </div>

        <h2>
            DUE MINACCE
        </h2>

        <p>
            Ti trovi tra due gruppi ostili.
            Quale vuoi affrontare?
        </p>

        <div class="combat-event-buttons">

            <button
                id="base-combat-left"
                type="button"
                class="combat-event-button combat-event-enter"
            >
                AFFRONTA QUELLO A SINISTRA
            </button>

            <button
                id="base-combat-right"
                type="button"
                class="combat-event-button combat-event-enter"
            >
                AFFRONTA QUELLO A DESTRA
            </button>

            <button
                id="base-combat-choice-cancel"
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


    const leftEvent =
        combatEvents.find(
            event =>
                Number(event.x) === 8
        );


    const rightEvent =
        combatEvents.find(
            event =>
                Number(event.x) === 10
        );


    document
        .getElementById(
            "base-combat-left"
        )
        ?.addEventListener(
            "click",
            async () => {

                if (leftEvent) {

                    await enterBaseCombat(
                        leftEvent
                    );

                }

            }
        );


    document
        .getElementById(
            "base-combat-right"
        )
        ?.addEventListener(
            "click",
            async () => {

                if (rightEvent) {

                    await enterBaseCombat(
                        rightEvent
                    );

                }

            }
        );


    document
        .getElementById(
            "base-combat-choice-cancel"
        )
        ?.addEventListener(
            "click",
            () => {

                closeBaseCombatPrompt();

                setMessage(
                    "Decidi di non entrare in combattimento."
                );

            }
        );

}


// ============================================================
// INGRESSO COMBAT
//
// Richiede che in Supabase esistano:
//
// base_combat_left
// base_combat_right
//
// come cloni di combat_1.
//
// Il cooldown globale di 15 minuti verrà aggiunto lato server
// nel prossimo passaggio.
// ============================================================

async function enterBaseCombat(
    combatEvent
) {

    if (
        !combatEvent ||
        !character ||
        !character.id
    ) {

        return;

    }


    const button =
        document.getElementById(
            "base-combat-enter"
        );


    try {

        if (button) {

            button.disabled =
                true;

            button.textContent =
                "INGRESSO...";

        }


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
                        combatEvent.encounter_id,

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


        character.active_combat_id =
            combatId;


        window.location.href =
            `../combat.html?combat_id=${encodeURIComponent(
                combatId
            )}`;


    } catch (error) {

        console.error(
            "Errore ingresso combat Base:",
            error
        );


        setMessage(
            error?.message ||
            "Impossibile entrare nel combattimento."
        );


        if (button) {

            button.disabled =
                false;

            button.textContent =
                "ENTRA IN COMBATTIMENTO";

        }

    }

}


// ============================================================
// CHIUDE POPUP
// ============================================================

function closeBaseCombatPrompt() {

    const overlay =
        document.getElementById(
            "base-combat-event-overlay"
        );


    if (overlay) {

        overlay.remove();

    }


    baseCombatPromptOpen =
        false;


    pendingBaseCombatEvent =
        null;

}
