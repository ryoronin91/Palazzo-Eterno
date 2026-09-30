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
// STATO GLOBALE COMBAT BASE
//
// Lo stato reale viene letto da Supabase tramite
// get_base_combat_states().
//
// I due encounter hanno cooldown indipendenti e condivisi
// tra tutti i giocatori.
// ============================================================

const baseCombatAvailability =
    new Map(
        BASE_COMBAT_EVENTS.map(
            combatEvent => [
                combatEvent.id,
                {
                    available: true,
                    cooldownUntil: null,
                    remainingSeconds: 0
                }
            ]
        )
    );

let baseCombatStateRefreshInterval =
    null;


// ============================================================
// TOKEN COMBAT
// ============================================================

const baseCombatTokens =
    new Map();


// ============================================================
// CANCELLO CENTRALE
// ============================================================
//
// Posizionato sul lato basso della casella X9 Y9,
// quindi sul confine tra X9 Y9 e X9 Y10.
//
// gatec.png = chiuso quando almeno un combat è disponibile.
// gateo.png = aperto quando entrambi i combat sono in cooldown.
// ============================================================

let baseGateElement =
    null;

let baseOneWayGateElement =
    null;

const BASE_GATE_OPEN_IMAGE =
    "immagini/gateo.png";

const BASE_GATE_CLOSED_IMAGE =
    "immagini/gatec.png";


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
// TELETRASPORTO VERSO PIANO 1
// ============================================================
//
// Le quattro caselle formano l'area di teletrasporto della Base.
// Entrando in una di esse viene chiesta conferma prima di
// trasferire il PG all'ingresso del Piano 1.
// ============================================================

const BASE_TELEPORT_CELLS =
    new Set([
        "3,10",
        "3,11",
        "4,10",
        "4,11"
    ]);

const DUNGEON_FLOOR_1_START_X =
    9;

const DUNGEON_FLOOR_1_START_Y =
    0;

let baseTeleportPromptOpen =
    false;

let baseTeleportZoneActive =
    false;


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await refreshBaseCombatStates();

        renderBaseCombatEvents();
        renderBaseGate();
        renderBaseOneWayGate();

        window.addEventListener(
            "resize",
            () => {

                repositionBaseCombatEvents();
                positionBaseGate();
                positionBaseOneWayGate();

            }
        );

        baseCombatStateRefreshInterval =
            setInterval(
                async () => {

                    await refreshBaseCombatStates();

                },
                15000
            );

    }
);


// ============================================================
// AGGIORNA STATO DEI DUE COMBAT DAL SERVER
// ============================================================

async function refreshBaseCombatStates() {

    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "get_base_combat_states"
            );


        if (error) {

            throw error;

        }


        const leftState =
            data?.left ||
            {};

        const rightState =
            data?.right ||
            {};


        baseCombatAvailability.set(
            "BASE_C1_LEFT",
            {
                available:
                    leftState.available !==
                    false,

                cooldownUntil:
                    leftState.cooldown_until ||
                    null,

                remainingSeconds:
                    Number(
                        leftState.remaining_seconds
                    ) || 0
            }
        );


        baseCombatAvailability.set(
            "BASE_C1_RIGHT",
            {
                available:
                    rightState.available !==
                    false,

                cooldownUntil:
                    rightState.cooldown_until ||
                    null,

                remainingSeconds:
                    Number(
                        rightState.remaining_seconds
                    ) || 0
            }
        );


        renderBaseCombatEvents();
        renderBaseGate();


        if (
            baseCombatPromptOpen
        ) {

            const availableNearby =
                getNearbyBaseCombatEvents();


            if (
                availableNearby.length ===
                0
            ) {

                closeBaseCombatPrompt();

            }

        }


    } catch (error) {

        console.error(
            "Errore aggiornamento stato combat Base:",
            error
        );

    }

}


// ============================================================
// CANCELLO CENTRALE BLOCCATO?
// ============================================================
//
// Il cancello rimane CHIUSO se almeno uno dei due combat
// è disponibile.
//
// Si APRE solo quando entrambi i combat risultano indisponibili
// perché in cooldown.
// ============================================================

function isBaseFilterBlocked() {

    const leftState =
        baseCombatAvailability.get(
            "BASE_C1_LEFT"
        );

    const rightState =
        baseCombatAvailability.get(
            "BASE_C1_RIGHT"
        );


    const leftAvailable =
        leftState?.available ===
        true;

    const rightAvailable =
        rightState?.available ===
        true;


    return (
        leftAvailable ||
        rightAvailable
    );

}


// ============================================================
// RENDER CANCELLO CENTRALE
// ============================================================

function renderBaseGate() {

    const map =
        document.getElementById(
            "dungeon-map"
        );


    if (!map) {

        return;

    }


    if (!baseGateElement) {

        baseGateElement =
            document.createElement(
                "div"
            );


        baseGateElement.className =
            "base-gate-token";


        const image =
            document.createElement(
                "img"
            );


        image.draggable =
            false;

        image.style.width =
            "100%";

        image.style.height =
            "100%";

        image.style.objectFit =
            "contain";

        image.style.display =
            "block";


        baseGateElement.appendChild(
            image
        );


        map.appendChild(
            baseGateElement
        );

    }


    const image =
        baseGateElement.querySelector(
            "img"
        );


    const blocked =
        isBaseFilterBlocked();


    if (image) {

        image.src =
            blocked
                ? BASE_GATE_CLOSED_IMAGE
                : BASE_GATE_OPEN_IMAGE;


        image.alt =
            blocked
                ? "Cancello chiuso"
                : "Cancello aperto";

    }


    baseGateElement.title =
        blocked
            ? "Cancello chiuso"
            : "Cancello aperto";


    positionBaseGate();

}


// ============================================================
// POSIZIONA CANCELLO
//
// Il centro del cancello viene appoggiato sul bordo inferiore
// della cella X9 Y9.
// ============================================================

function positionBaseGate() {

    const map =
        document.getElementById(
            "dungeon-map"
        );


    if (
        !map ||
        !baseGateElement
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


    const gateWidth =
        cellWidth *
        1.20;


    const gateHeight =
        cellHeight *
        0.90;


    const cellCenterX =
        (
            9 +
            0.5
        ) *
        cellWidth;


    const lowerEdgeY =
        (
            9 +
            1
        ) *
        cellHeight;


    baseGateElement.style.position =
        "absolute";


    baseGateElement.style.width =
        `${gateWidth}px`;


    baseGateElement.style.height =
        `${gateHeight}px`;


    baseGateElement.style.left =
        `${
            cellCenterX -
            gateWidth / 2
        }px`;


    baseGateElement.style.top =
        `${
            lowerEdgeY -
            gateHeight / 2
        }px`;


    baseGateElement.style.zIndex =
        "18";


    baseGateElement.style.pointerEvents =
        "none";

}


// ============================================================
// CANCELLO A SENSO UNICO X18 Y9
//
// È sempre visualizzato come chiuso sul bordo inferiore della
// casella X18 Y9.
//
// Da X18 Y10 verso X18 Y9 il passaggio è bloccato.
// Da X18 Y9 verso X18 Y10 il passaggio resta consentito.
// ============================================================

function renderBaseOneWayGate() {

    const map =
        document.getElementById(
            "dungeon-map"
        );


    if (!map) {

        return;

    }


    if (!baseOneWayGateElement) {

        baseOneWayGateElement =
            document.createElement(
                "div"
            );


        baseOneWayGateElement.className =
            "base-gate-token base-one-way-gate-token";


        const image =
            document.createElement(
                "img"
            );


        image.src =
            BASE_GATE_CLOSED_IMAGE;

        image.alt =
            "Cancello attraversabile solo dall'altro lato";

        image.draggable =
            false;

        image.style.width =
            "100%";

        image.style.height =
            "100%";

        image.style.objectFit =
            "contain";

        image.style.display =
            "block";


        baseOneWayGateElement.appendChild(
            image
        );


        map.appendChild(
            baseOneWayGateElement
        );

    }


    positionBaseOneWayGate();

}


// ============================================================
// POSIZIONA CANCELLO A SENSO UNICO
//
// Sul bordo inferiore della casella X18 Y9.
// ============================================================

function positionBaseOneWayGate() {

    const map =
        document.getElementById(
            "dungeon-map"
        );


    if (
        !map ||
        !baseOneWayGateElement
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


    const gateWidth =
        cellWidth *
        1.20;


    const gateHeight =
        cellHeight *
        0.90;


    const cellCenterX =
        (
            18 +
            0.5
        ) *
        cellWidth;


    const lowerEdgeY =
        (
            9 +
            1
        ) *
        cellHeight;


    baseOneWayGateElement.style.position =
        "absolute";


    baseOneWayGateElement.style.width =
        `${gateWidth}px`;


    baseOneWayGateElement.style.height =
        `${gateHeight}px`;


    baseOneWayGateElement.style.left =
        `${
            cellCenterX -
            gateWidth / 2
        }px`;


    baseOneWayGateElement.style.top =
        `${
            lowerEdgeY -
            gateHeight / 2
        }px`;


    baseOneWayGateElement.style.zIndex =
        "18";


    baseOneWayGateElement.style.pointerEvents =
        "none";

}


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
                "enter_base_combat_checked",
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


        await refreshBaseCombatStates();


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


// ============================================================
// CONTROLLO AREA TELETRASPORTO
// ============================================================

function checkBaseTeleportEvent() {

    if (
        basePlayerX === null ||
        basePlayerY === null
    ) {

        return false;

    }


    const key =
        `${Number(basePlayerX)},${Number(basePlayerY)}`;


    const insideTeleportZone =
        BASE_TELEPORT_CELLS.has(
            key
        );


    if (!insideTeleportZone) {

        baseTeleportZoneActive =
            false;

        return false;

    }


    // Evita di riaprire il popup a ogni evento mentre il PG
    // rimane fermo nella stessa area.
    if (
        baseTeleportPromptOpen ||
        baseTeleportZoneActive
    ) {

        return true;

    }


    baseTeleportZoneActive =
        true;


    openBaseTeleportPrompt();


    return true;

}


// ============================================================
// POPUP TELETRASPORTO
// ============================================================

function openBaseTeleportPrompt() {

    if (
        baseTeleportPromptOpen ||
        document.getElementById(
            "base-teleport-overlay"
        )
    ) {

        return;

    }


    baseTeleportPromptOpen =
        true;


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "base-teleport-overlay";

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
            ✦
        </div>

        <h2>
            TELETRASPORTO
        </h2>

        <p>
            Il portale conduce all'ingresso del Piano 1 del Palazzo.
        </p>

        <div class="combat-event-warning">
            Vuoi lasciare il Livello Base ed entrare nel dungeon?
        </div>

        <div class="combat-event-buttons">

            <button
                id="base-teleport-enter"
                type="button"
                class="combat-event-button combat-event-enter"
            >
                ENTRA NEL DUNGEON
            </button>

            <button
                id="base-teleport-cancel"
                type="button"
                class="combat-event-button combat-event-cancel"
            >
                RIMANI NELLA BASE
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
            "base-teleport-cancel"
        )
        ?.addEventListener(
            "click",
            () => {

                closeBaseTeleportPrompt();

                setMessage(
                    "Decidi di rimanere nel Livello Base."
                );

            }
        );


    document
        .getElementById(
            "base-teleport-enter"
        )
        ?.addEventListener(
            "click",
            async () => {

                await teleportBasePlayerToDungeon();

            }
        );

}


// ============================================================
// ESEGUE TELETRASPORTO AL PIANO 1
// ============================================================

async function teleportBasePlayerToDungeon() {

    if (
        !character ||
        !character.id
    ) {

        return;

    }


    const button =
        document.getElementById(
            "base-teleport-enter"
        );


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "TELETRASPORTO...";

    }


    try {

        // Salviamo prima la posizione corrente nella Base,
        // così un eventuale ritorno futuro riparte da qui.
        if (
            typeof flushBasePositionSave ===
            "function"
        ) {

            await flushBasePositionSave();

        }


        const {
            error
        } =
            await db
                .from("characters")
                .update({

                    dungeon_x:
                        DUNGEON_FLOOR_1_START_X,

                    dungeon_y:
                        DUNGEON_FLOOR_1_START_Y,

                    current_location:
                        "dungeon"

                })
                .eq(
                    "id",
                    character.id
                );


        if (error) {

            throw error;

        }


        character.dungeon_x =
            DUNGEON_FLOOR_1_START_X;

        character.dungeon_y =
            DUNGEON_FLOOR_1_START_Y;

        character.current_location =
            "dungeon";


        if (
            baseChannel
        ) {

            try {

                await baseChannel.untrack();

            } catch (presenceError) {

                console.warn(
                    "Errore uscita Presence Base:",
                    presenceError
                );

            }

        }


        window.location.href =
            "../dungeon.html";


    } catch (error) {

        console.error(
            "Errore teletrasporto verso il Piano 1:",
            error
        );


        setMessage(
            error?.message ||
            "Il teletrasporto non ha funzionato."
        );


        if (button) {

            button.disabled =
                false;

            button.textContent =
                "ENTRA NEL DUNGEON";

        }

    }

}


// ============================================================
// CHIUDE POPUP TELETRASPORTO
// ============================================================

function closeBaseTeleportPrompt() {

    const overlay =
        document.getElementById(
            "base-teleport-overlay"
        );


    if (overlay) {

        overlay.remove();

    }


    baseTeleportPromptOpen =
        false;

}


// ============================================================
// PULIZIA TIMER STATO BASE
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (
            baseCombatStateRefreshInterval
        ) {

            clearInterval(
                baseCombatStateRefreshInterval
            );

            baseCombatStateRefreshInterval =
                null;

        }

    }
);
