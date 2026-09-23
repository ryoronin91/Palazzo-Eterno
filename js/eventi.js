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
        x: 4,
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

    }
);
