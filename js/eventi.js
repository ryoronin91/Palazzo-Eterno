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
        `Percepisci una presenza ostile nelle vicinanze. Evento ${combatEvent.id}.`
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
