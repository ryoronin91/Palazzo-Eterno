// ============================================================
// PALAZZO ETERNO
// DUNGEON.JS
// ============================================================
//
// Gestisce:
// - autenticazione Supabase
// - caricamento personaggio
// - caricamento dungeon.json
// - scelta casuale della posizione iniziale
// - salvataggio della posizione su Supabase
// - visualizzazione del token
// - visualizzazione della scheda personaggio
//
// ============================================================

console.log("DUNGEON.JS CARICATO");


// ============================================================
// CONFIGURAZIONE
// ============================================================

// Usiamo direttamente il client creato da config.js
const db = supabaseClient;


// ============================================================
// CONFIGURAZIONE MAPPA
// ============================================================

// La mappa visualizzata è 23 x 23 caselle.
const MAP_COLUMNS = 23;
const MAP_ROWS = 23;

// La matrice "cells" del JSON contiene una cornice
// aggiuntiva rispetto alla mappa visibile.
const GRID_OFFSET_X = 3;
const GRID_OFFSET_Y = 4;


// ============================================================
// VARIABILI
// ============================================================

let dungeonData = null;
let character = null;

let playerX = null;
let playerY = null;

let tokenElement = null;


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "Pagina dungeon pronta."
        );

        try {

            await loadDungeon();

            await loadCharacter();

            await initializePlayer();

        } catch (error) {

            console.error(
                "Errore durante l'avvio del dungeon:",
                error
            );

            showError(
                error.message ||
                "Errore durante il caricamento del dungeon."
            );
        }

    }
);


// ============================================================
// LOGOUT
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const logoutButton =
            document.getElementById(
                "logout-button"
            );


        if (!logoutButton) {

            return;
        }


        logoutButton.addEventListener(
            "click",
            async () => {

                try {

                    const {
                        error
                    } =
                        await db.auth.signOut();


                    if (error) {

                        throw error;
                    }


                    window.location.href =
                        "login.html";

                } catch (error) {

                    console.error(
                        "Errore logout:",
                        error
                    );

                    showError(
                        "Impossibile effettuare il logout."
                    );
                }

            }
        );

    }
);


// ============================================================
// CARICAMENTO DUNGEON.JSON
// ============================================================

async function loadDungeon() {

    console.log(
        "Caricamento dungeon.json..."
    );


    const response =
        await fetch(
            "dungeon.json"
        );


    if (!response.ok) {

        throw new Error(
            "Impossibile caricare dungeon.json"
        );
    }


    dungeonData =
        await response.json();


    console.log(
        "Dungeon JSON caricato:",
        dungeonData
    );


    console.log(
        "Griglia visibile:",
        MAP_COLUMNS,
        "x",
        MAP_ROWS
    );


    if (
        !dungeonData.cells
    ) {

        throw new Error(
            "Il file dungeon.json non contiene la matrice cells."
        );
    }


    console.log(
        "Matrice interna:",
        dungeonData.cells[0].length,
        "x",
        dungeonData.cells.length
    );
}


// ============================================================
// CARICAMENTO PERSONAGGIO
// ============================================================

async function loadCharacter() {

    // --------------------------------------------------------
    // Controllo autenticazione
    // --------------------------------------------------------

    const {
        data: {
            user
        },
        error: authError
    } =
        await db.auth.getUser();


    if (authError) {

        throw authError;
    }


    if (!user) {

        console.error(
            "Nessun utente autenticato."
        );

        window.location.href =
            "login.html";

        return;
    }


    console.log(
        "Utente:",
        user.id
    );


    // --------------------------------------------------------
    // Recuperiamo il personaggio
    // --------------------------------------------------------

    const {
        data,
        error
    } =
        await db
            .from("characters")
            .select("*")
            .eq(
                "user_id",
                user.id
            )
            .maybeSingle();


    if (error) {

        throw error;
    }


    if (!data) {

        console.error(
            "Nessun personaggio trovato."
        );

        alert(
            "Non hai ancora creato un personaggio."
        );

        window.location.href =
            "personaggio.html";

        return;
    }


    character =
        data;


    console.log(
        "Personaggio:",
        character
    );


    // --------------------------------------------------------
    // Mostra il nome nell'header
    // --------------------------------------------------------

    const nameElement =
        document.getElementById(
            "character-name"
        );


    if (nameElement) {

        nameElement.textContent =
            character.nome ||
            character.name ||
            "Avventuriero";
    }


    // --------------------------------------------------------
    // Aggiorna la scheda
    // --------------------------------------------------------

    populateCharacterSheet();
}


// ============================================================
// RIEMPI SCHEDA PERSONAGGIO
// ============================================================

function populateCharacterSheet() {

    if (!character) {

        return;
    }


    // --------------------------------------------------------
    // Nome
    // --------------------------------------------------------

    setText(
        "sheet-name",
        character.nome ||
        character.name ||
        "Avventuriero"
    );


    // --------------------------------------------------------
    // Razza
    // --------------------------------------------------------

    setText(
        "sheet-razza",
        character.razza ||
        "-"
    );


    // --------------------------------------------------------
    // Classe
    // --------------------------------------------------------

    setText(
        "sheet-classe",
        character.classe ||
        "-"
    );


    // --------------------------------------------------------
    // Livello
    // --------------------------------------------------------

    setText(
        "sheet-livello",
        character.livello ??
        "-"
    );


    // --------------------------------------------------------
    // PF
    // --------------------------------------------------------

    const hp =
        character.hp ??
        "-";


    const hpMax =
        character.hp_max ??
        "-";


    let hpText = "-";


    if (
        hp !== "-" &&
        hpMax !== "-"
    ) {

        hpText =
            `${hp} / ${hpMax}`;

    } else if (
        hp !== "-"
    ) {

        hpText =
            String(hp);

    }


    setText(
        "sheet-hp",
        hpText
    );


    // --------------------------------------------------------
    // Classe Armatura
    // --------------------------------------------------------

    setText(
        "sheet-ca",
        character.ca ??
        "-"
    );


    // --------------------------------------------------------
    // Caratteristiche
    // --------------------------------------------------------

    setAbility(
        "forza",
        character.forza
    );


    setAbility(
        "destrezza",
        character.destrezza
    );


    setAbility(
        "costituzione",
        character.costituzione
    );


    setAbility(
        "intelligenza",
        character.intelligenza
    );


    setAbility(
        "saggezza",
        character.saggezza
    );


    setAbility(
        "carisma",
        character.carisma
    );


    // --------------------------------------------------------
    // Razza + classe
    // --------------------------------------------------------

    const race =
        character.razza ||
        "";


    const className =
        character.classe ||
        "";


    let raceClassText =
        "";


    if (
        race &&
        className
    ) {

        raceClassText =
            `${race} • ${className}`;

    } else {

        raceClassText =
            race ||
            className ||
            "-";
    }


    setText(
        "character-class-race",
        raceClassText
    );


    // --------------------------------------------------------
    // Messaggio scheda
    // --------------------------------------------------------

    setText(
        "character-sheet-message",
        "Personaggio definitivo"
    );
}


// ============================================================
// IMPOSTA CARATTERISTICA
// ============================================================

function setAbility(
    name,
    value
) {

    const numericValue =
        Number(value);


    setText(
        `sheet-${name}`,
        value ??
        "-"
    );


    if (
        !Number.isFinite(
            numericValue
        )
    ) {

        setText(
            `mod-${name}`,
            "-"
        );

        return;
    }


    const modifier =
        Math.floor(
            (
                numericValue -
                10
            ) / 2
        );


    let modifierText;


    if (
        modifier >= 0
    ) {

        modifierText =
            `+${modifier}`;

    } else {

        modifierText =
            String(modifier);
    }


    setText(
        `mod-${name}`,
        modifierText
    );
}


// ============================================================
// IMPOSTA TESTO
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
            String(value);
    }
}


// ============================================================
// INIZIALIZZAZIONE DEL GIOCATORE
// ============================================================

async function initializePlayer() {

    console.log(
        "Controllo posizione del personaggio..."
    );


    // --------------------------------------------------------
    // Posizione già salvata?
    // --------------------------------------------------------

    if (
        character.dungeon_x != null &&
        character.dungeon_y != null
    ) {

        playerX =
            Number(
                character.dungeon_x
            );

        playerY =
            Number(
                character.dungeon_y
            );


        console.log(
            "Posizione già presente:",
            playerX,
            playerY
        );


        showToken(
            playerX,
            playerY
        );


        setMessage(
            "Sei rientrato nel dungeon."
        );


        return;
    }


    // --------------------------------------------------------
    // Prima entrata
    // --------------------------------------------------------

    console.log(
        "Prima entrata nel dungeon."
    );


    const position =
        findRandomWalkableCell();


    if (!position) {

        throw new Error(
            "Non è stata trovata nessuna cella percorribile."
        );
    }


    playerX =
        position.x;

    playerY =
        position.y;


    console.log(
        "Nuova posizione:",
        position
    );


    // --------------------------------------------------------
    // Salva posizione
    // --------------------------------------------------------

    const {
        error: saveError
    } =
        await db
            .from("characters")
            .update({

                dungeon_x:
                    playerX,

                dungeon_y:
                    playerY

            })
            .eq(
                "id",
                character.id
            );


    if (saveError) {

        throw saveError;
    }


    console.log(
        "Posizione salvata su Supabase."
    );


    // --------------------------------------------------------
    // Mostra token
    // --------------------------------------------------------

    showToken(
        playerX,
        playerY
    );


    setMessage(
        "Sei entrato nel dungeon."
    );
}


// ============================================================
// TROVA UNA CELLA PERCORRIBILE
// ============================================================

function findRandomWalkableCell() {

    const walkableCells = [];

    const cells =
        dungeonData.cells;


    // --------------------------------------------------------
    // Scansione della matrice
    // --------------------------------------------------------

    for (
        let jsonY = 0;
        jsonY < cells.length;
        jsonY++
    ) {

        for (
            let jsonX = 0;
            jsonX < cells[jsonY].length;
            jsonX++
        ) {

            const value =
                Number(
                    cells[jsonY][jsonX]
                );


            if (
                !Number.isFinite(
                    value
                )
            ) {

                continue;
            }


            // ------------------------------------------------
            // BIT DEL JSON
            //
            // ROOM     = 2
            // CORRIDOR = 4
            // ------------------------------------------------

            const isRoom =
                (
                    value & 2
                ) !== 0;


            const isCorridor =
                (
                    value & 4
                ) !== 0;


            if (
                !isRoom &&
                !isCorridor
            ) {

                continue;
            }


            // ------------------------------------------------
            // Conversione coordinate JSON
            // → coordinate mappa
            // ------------------------------------------------

            const mapX =
                jsonX -
                GRID_OFFSET_X;


            const mapY =
                jsonY -
                GRID_OFFSET_Y;


            // ------------------------------------------------
            // Controlliamo che la cella appartenga
            // effettivamente alla mappa visibile.
            // ------------------------------------------------

            if (
                mapX < 0 ||
                mapY < 0 ||
                mapX >= MAP_COLUMNS ||
                mapY >= MAP_ROWS
            ) {

                continue;
            }


            walkableCells.push({

                x:
                    mapX,

                y:
                    mapY,

                type:
                    isRoom
                        ? "room"
                        : "corridor"

            });

        }

    }


    console.log(
        "Celle percorribili trovate:",
        walkableCells.length
    );


    if (
        walkableCells.length === 0
    ) {

        return null;
    }


    // --------------------------------------------------------
    // Scelta casuale
    // --------------------------------------------------------

    const randomIndex =
        Math.floor(
            Math.random() *
            walkableCells.length
        );


    return walkableCells[
        randomIndex
    ];
}


// ============================================================
// TROVA IL CONTENITORE DELLA MAPPA
// ============================================================

function getMapContainer() {

    const image =
        document.getElementById(
            "dungeon-image"
        );


    if (image) {

        const container =
            image.parentElement;


        if (container) {

            const style =
                window.getComputedStyle(
                    container
                );


            if (
                style.position === "static"
            ) {

                container.style.position =
                    "relative";
            }


            return {

                image,
                container

            };
        }
    }


    // --------------------------------------------------------
    // Fallback: canvas
    // --------------------------------------------------------

    const canvas =
        document.querySelector(
            "canvas"
        );


    if (canvas) {

        const container =
            canvas.parentElement;


        if (container) {

            const style =
                window.getComputedStyle(
                    container
                );


            if (
                style.position === "static"
            ) {

                container.style.position =
                    "relative";
            }


            return {

                canvas,
                container

            };
        }
    }


    throw new Error(
        "Contenitore della mappa non trovato."
    );
}


// ============================================================
// MOSTRA TOKEN
// ============================================================

function showToken(
    x,
    y
) {

    console.log(
        "TOKEN POSIZIONE:",
        x,
        y
    );


    try {

        const {
            image,
            container
        } =
            getMapContainer();


        // ----------------------------------------------------
        // Rimuovi eventuale token precedente
        // ----------------------------------------------------

        if (
            tokenElement
        ) {

            tokenElement.remove();

            tokenElement =
                null;
        }


        // ----------------------------------------------------
        // Dimensioni reali della mappa
        // ----------------------------------------------------

        const mapElement =
            image ||
            container.querySelector(
                "canvas"
            );


        if (!mapElement) {

            throw new Error(
                "Elemento della mappa non trovato."
            );
        }


        const mapRect =
            mapElement.getBoundingClientRect();


        const containerRect =
            container.getBoundingClientRect();


        // ----------------------------------------------------
        // Dimensione casella
        // ----------------------------------------------------

        const cellWidth =
            mapRect.width /
            MAP_COLUMNS;


        const cellHeight =
            mapRect.height /
            MAP_ROWS;


        // ----------------------------------------------------
        // Creiamo il token
        // ----------------------------------------------------

        const token =
            document.createElement(
                "div"
            );


        token.className =
            "dungeon-player-token";


        // ----------------------------------------------------
        // Dimensione token
        // ----------------------------------------------------

        const tokenSize =
            Math.min(
                cellWidth,
                cellHeight
            ) * 0.78;


        token.style.position =
            "absolute";


        token.style.width =
            `${tokenSize}px`;


        token.style.height =
            `${tokenSize}px`;


        token.style.borderRadius =
            "50%";


        token.style.background =
            "#b88a3b";


        token.style.border =
            "3px solid white";


        token.style.boxSizing =
            "border-box";


        token.style.boxShadow =
            "0 0 0 2px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.6)";


        token.style.zIndex =
            "100";


        token.style.pointerEvents =
            "none";


        token.style.transform =
            "translate(-50%, -50%)";


        // ----------------------------------------------------
        // Centro della casella
        // ----------------------------------------------------

        const centerX =
            (
                x + 0.5
            ) *
            cellWidth;


        const centerY =
            (
                y + 0.5
            ) *
            cellHeight;


        // ----------------------------------------------------
        // Offset tra mappa e contenitore
        // ----------------------------------------------------

        const offsetX =
            mapRect.left -
            containerRect.left;


        const offsetY =
            mapRect.top -
            containerRect.top;


        // ----------------------------------------------------
        // Posizione finale
        // ----------------------------------------------------

        token.style.left =
            `${
                offsetX +
                centerX
            }px`;


        token.style.top =
            `${
                offsetY +
                centerY
            }px`;


        // ----------------------------------------------------
        // Inserimento
        // ----------------------------------------------------

        container.appendChild(
            token
        );


        tokenElement =
            token;


        console.log(
            "Token creato."
        );


        console.log(
            "Casella:",
            cellWidth,
            "x",
            cellHeight
        );


        console.log(
            "Token:",
            tokenSize,
            "x",
            tokenSize
        );


    } catch (error) {

        console.error(
            "Errore nella visualizzazione del token:",
            error
        );


        showError(
            "Errore nella visualizzazione del personaggio."
        );
    }
}


// ============================================================
// MESSAGGIO
// ============================================================

function setMessage(
    text
) {

    const element =
        document.getElementById(
            "dungeon-message"
        );


    if (element) {

        element.textContent =
            text;

        element.style.color =
            "#b18a4d";
    }
}


// ============================================================
// ERRORI
// ============================================================

function showError(
    text
) {

    console.error(
        text
    );


    const element =
        document.getElementById(
            "dungeon-message"
        );


    if (element) {

        element.textContent =
            text;

        element.style.color =
            "#d66";
    }
}


// ============================================================
// RIDIMENSIONAMENTO
// ============================================================
//
// Quando la finestra cambia dimensione,
// ricalcoliamo posizione e dimensione del token.
//

window.addEventListener(
    "resize",
    () => {

        if (
            playerX !== null &&
            playerY !== null
        ) {

            showToken(
                playerX,
                playerY
            );
        }
    }
);