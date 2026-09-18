// ============================================================
// PALAZZO ETERNO
// MASTER.JS
// ============================================================
//
// Modalità Master:
//
// - controlla autenticazione
// - controlla ruolo master
// - NON crea una pedina per il Master
// - visualizza tutta la mappa
// - visualizza tutti i giocatori online
// - riceve i movimenti in tempo reale
// - permette di cliccare sulle pedine
// - mostra la scheda del personaggio
//
// ============================================================


console.log(
    "MASTER.JS CARICATO"
);


// ============================================================
// SUPABASE
// ============================================================

const db =
    supabaseClient;


// ============================================================
// MAPPA
// ============================================================

const MAP_COLUMNS =
    23;

const MAP_ROWS =
    23;


// Deve essere esattamente lo stesso
// canale utilizzato da dungeon.js.

const DUNGEON_CHANNEL_NAME =
    "palazzo-eterno-dungeon-1";


// ============================================================
// VARIABILI
// ============================================================

let currentUser =
    null;

let dungeonChannel =
    null;

let realtimeReady =
    false;


// character_id -> dati giocatore

const onlinePlayers =
    new Map();


// character_id -> elemento IMG

const playerTokens =
    new Map();


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            await checkMasterAccess();

            setupModal();

            setupLogout();

            setupMap();

            await setupRealtime();

        } catch (error) {

            console.error(
                "Errore modalità Master:",
                error
            );


            showMessage(
                "Errore: " +
                (
                    error.message ||
                    "impossibile avviare la modalità Master."
                )
            );

        }

    }
);


// ============================================================
// CONTROLLO ACCESSO MASTER
// ============================================================

async function checkMasterAccess() {

    const {
        data: {
            user
        },
        error: authError
    } =
        await db
            .auth
            .getUser();


    if (authError) {

        throw authError;

    }


    if (!user) {

        window.location.href =
            "login.html";

        return;

    }


    currentUser =
        user;


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


    if (error) {

        throw error;

    }


    if (
        data?.role !==
        "master"
    ) {

        console.warn(
            "Accesso Master negato."
        );


        window.location.href =
            "scheda.html";

        return;

    }


    console.log(
        "Accesso Master autorizzato."
    );

}


// ============================================================
// MAPPA
// ============================================================

function setupMap() {

    const image =
        document.getElementById(
            "master-map-image"
        );


    if (!image) {

        return;

    }


    if (
        image.complete
    ) {

        renderAllTokens();

    } else {

        image.addEventListener(
            "load",
            renderAllTokens
        );

    }

}


// ============================================================
// REALTIME
// ============================================================

async function setupRealtime() {

    showMessage(
        "Connessione al dungeon..."
    );


    dungeonChannel =
        db.channel(
            DUNGEON_CHANNEL_NAME
        );


    // ========================================================
    // PRESENCE SYNC
    // ========================================================

    dungeonChannel.on(
        "presence",
        {
            event:
                "sync"
        },
        () => {

            syncPresencePlayers();

        }
    );


    // ========================================================
    // MOVIMENTO
    // ========================================================

    dungeonChannel.on(
        "broadcast",
        {
            event:
                "player-move"
        },
        message => {

            const data =
                message.payload;


            if (
                !data ||
                !data.character_id
            ) {

                return;

            }


            updatePlayer(
                data
            );

        }
    );


    // ========================================================
    // STATO COMPLETO
    // ========================================================

    dungeonChannel.on(
        "broadcast",
        {
            event:
                "player-state"
        },
        message => {

            const data =
                message.payload;


            if (
                !data ||
                !data.character_id
            ) {

                return;

            }


            updatePlayer(
                data
            );

        }
    );


    // ========================================================
    // SUBSCRIBE
    // ========================================================

    dungeonChannel.subscribe(
        status => {

            console.log(
                "Realtime Master:",
                status
            );


            if (
                status ===
                "SUBSCRIBED"
            ) {

                realtimeReady =
                    true;


                showMessage(
                    "Modalità Master connessa."
                );


                updateOnlineCounter();

            }


            if (
                status ===
                "CHANNEL_ERROR" ||
                status ===
                "TIMED_OUT"
            ) {

                realtimeReady =
                    false;


                showMessage(
                    "Errore connessione Realtime."
                );

            }

        }
    );

}


// ============================================================
// SINCRONIZZA PRESENCE
// ============================================================

function syncPresencePlayers() {

    if (!dungeonChannel) {

        return;

    }


    const state =
        dungeonChannel
            .presenceState();


    const currentIds =
        new Set();


    Object.values(
        state
    ).forEach(
        presences => {

            presences.forEach(
                presence => {

                    /*
                       Il Master non fa track(),
                       quindi qui dovrebbero esserci
                       solamente i personaggi.

                       Ignoriamo comunque qualsiasi
                       presenza senza character_id.
                    */

                    if (
                        !presence.character_id
                    ) {

                        return;

                    }


                    currentIds.add(
                        presence.character_id
                    );


                    updatePlayer(
                        presence
                    );

                }
            );

        }
    );


    // --------------------------------------------------------
    // RIMUOVI CHI È USCITO
    // --------------------------------------------------------

    for (
        const characterId
        of onlinePlayers.keys()
    ) {

        if (
            !currentIds.has(
                characterId
            )
        ) {

            removePlayer(
                characterId
            );

        }

    }


    updatePlayerList();

    updateOnlineCounter();

}


// ============================================================
// AGGIORNA GIOCATORE
// ============================================================

function updatePlayer(
    data
) {

    if (
        !data ||
        !data.character_id
    ) {

        return;

    }


    const x =
        Number(
            data.x
        );


    const y =
        Number(
            data.y
        );


    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y)
    ) {

        return;

    }


    onlinePlayers.set(
        data.character_id,
        {

            character_id:
                data.character_id,

            user_id:
                data.user_id ||
                null,

            nome:
                data.nome ||
                "Avventuriero",

            token:
                data.token ||
                "token_1.png",

            x,
            y

        }
    );


    renderPlayerToken(
        data.character_id
    );


    updatePlayerList();

    updateOnlineCounter();

}


// ============================================================
// RIMUOVI GIOCATORE
// ============================================================

function removePlayer(
    characterId
) {

    onlinePlayers.delete(
        characterId
    );


    const token =
        playerTokens.get(
            characterId
        );


    if (token) {

        token.remove();


        playerTokens.delete(
            characterId
        );

    }

}


// ============================================================
// MOSTRA TOKEN
// ============================================================

function renderPlayerToken(
    characterId
) {

    const player =
        onlinePlayers.get(
            characterId
        );


    if (!player) {

        return;

    }


    const image =
        document.getElementById(
            "master-map-image"
        );


    const container =
        document.getElementById(
            "master-map"
        );


    if (
        !image ||
        !container
    ) {

        return;

    }


    const mapRect =
        image.getBoundingClientRect();


    const containerRect =
        container.getBoundingClientRect();


    if (
        mapRect.width <= 0 ||
        mapRect.height <= 0
    ) {

        return;

    }


    const cellWidth =
        mapRect.width /
        MAP_COLUMNS;


    const cellHeight =
        mapRect.height /
        MAP_ROWS;


    // ========================================================
    // CREA TOKEN
    // ========================================================

    let token =
        playerTokens.get(
            characterId
        );


    if (!token) {

        token =
            document.createElement(
                "img"
            );


        token.className =
            "master-player-token";


        token.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                openCharacterSheet(
                    characterId
                );

            }
        );


        container.appendChild(
            token
        );


        playerTokens.set(
            characterId,
            token
        );

    }


    // ========================================================
    // IMMAGINE
    // ========================================================

    token.src =
        "immagini/token/" +
        player.token;


    token.alt =
        "Token di " +
        player.nome;


    token.title =
        player.nome;


    // ========================================================
    // DIMENSIONE
    // ========================================================

    const tokenSize =
        Math.min(
            cellWidth,
            cellHeight
        ) *
        0.92;


    token.style.width =
        `${tokenSize}px`;


    token.style.height =
        `${tokenSize}px`;


    // ========================================================
    // POSIZIONE
    // ========================================================

    const centerX =
        (
            player.x +
            0.5
        ) *
        cellWidth;


    const centerY =
        (
            player.y +
            0.5
        ) *
        cellHeight;


    const offsetX =
        mapRect.left -
        containerRect.left;


    const offsetY =
        mapRect.top -
        containerRect.top;


    token.style.left =
        `${
            offsetX +
            centerX -
            tokenSize / 2
        }px`;


    token.style.top =
        `${
            offsetY +
            centerY -
            tokenSize / 2
        }px`;

}


// ============================================================
// RIDISEGNA TUTTE LE PEDINE
// ============================================================

function renderAllTokens() {

    for (
        const characterId
        of onlinePlayers.keys()
    ) {

        renderPlayerToken(
            characterId
        );

    }

}


// ============================================================
// LISTA GIOCATORI
// ============================================================

function updatePlayerList() {

    const list =
        document.getElementById(
            "master-player-list"
        );


    if (!list) {

        return;

    }


    list.innerHTML =
        "";


    if (
        onlinePlayers.size ===
        0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "master-player-empty";


        empty.textContent =
            "Nessun giocatore collegato.";


        list.appendChild(
            empty
        );


        return;

    }


    const players =
        Array.from(
            onlinePlayers.values()
        )
            .sort(
                (a, b) =>
                    a.nome.localeCompare(
                        b.nome,
                        "it"
                    )
            );


    players.forEach(
        player => {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "master-player-item";


            const token =
                document.createElement(
                    "img"
                );


            token.src =
                "immagini/token/" +
                player.token;


            token.alt =
                "";


            const info =
                document.createElement(
                    "div"
                );


            info.className =
                "master-player-info";


            const name =
                document.createElement(
                    "span"
                );


            name.className =
                "master-player-name";


            name.textContent =
                player.nome;


            const position =
                document.createElement(
                    "span"
                );


            position.className =
                "master-player-position";


            position.textContent =
                `X ${player.x} • Y ${player.y}`;


            info.appendChild(
                name
            );


            info.appendChild(
                position
            );


            button.appendChild(
                token
            );


            button.appendChild(
                info
            );


            button.addEventListener(
                "click",
                () => {

                    openCharacterSheet(
                        player.character_id
                    );

                }
            );


            list.appendChild(
                button
            );

        }
    );

}


// ============================================================
// CONTATORE ONLINE
// ============================================================

function updateOnlineCounter() {

    const element =
        document.getElementById(
            "master-online-count"
        );


    if (!element) {

        return;

    }


    const count =
        onlinePlayers.size;


    if (
        !realtimeReady
    ) {

        element.textContent =
            "Connessione...";

        return;

    }


    if (
        count ===
        0
    ) {

        element.textContent =
            "Nessun giocatore online";

    } else if (
        count ===
        1
    ) {

        element.textContent =
            "1 giocatore online";

    } else {

        element.textContent =
            `${count} giocatori online`;

    }

}


// ============================================================
// APRI SCHEDA PERSONAGGIO
// ============================================================

async function openCharacterSheet(
    characterId
) {

    const modal =
        document.getElementById(
            "master-character-modal"
        );


    if (!modal) {

        return;

    }


    showMessage(
        "Caricamento scheda..."
    );


    const {
        data,
        error
    } =
        await db
            .from(
                "characters"
            )
            .select(
                `
                id,
                nome,
                livello,
                token,
                forza,
                resistenza,
                costituzione,
                intelligenza,
                destrezza,
                fortuna,
                dungeon_x,
                dungeon_y
                `
            )
            .eq(
                "id",
                characterId
            )
            .single();


    if (error) {

        console.error(
            "Errore caricamento scheda:",
            error
        );


        showMessage(
            "Impossibile caricare la scheda."
        );


        return;

    }


    fillCharacterSheet(
        data
    );


    modal.hidden =
        false;


    document.body.style.overflow =
        "hidden";


    showMessage(
        ""
    );

}


// ============================================================
// RIEMPI SCHEDA
// ============================================================

function fillCharacterSheet(
    character
) {

    const forza =
        getStat(
            character.forza
        );


    const resistenza =
        getStat(
            character.resistenza
        );


    const costituzione =
        getStat(
            character.costituzione
        );


    const intelligenza =
        getStat(
            character.intelligenza
        );


    const destrezza =
        getStat(
            character.destrezza
        );


    const fortuna =
        getStat(
            character.fortuna
        );


    // --------------------------------------------------------
    // IDENTITÀ
    // --------------------------------------------------------

    setText(
        "master-character-name",
        character.nome ||
        "Avventuriero"
    );


    setText(
        "master-character-level",
        "Livello " +
        (
            Number(
                character.livello
            ) ||
            1
        )
    );


    const token =
        document.getElementById(
            "master-character-token"
        );


    if (token) {

        token.src =
            "immagini/token/" +
            (
                character.token ||
                "token_1.png"
            );


        token.alt =
            "Token di " +
            (
                character.nome ||
                "personaggio"
            );

    }


    // --------------------------------------------------------
    // ATTRIBUTI
    // --------------------------------------------------------

    setText(
        "master-forza",
        forza
    );


    setText(
        "master-resistenza",
        resistenza
    );


    setText(
        "master-costituzione",
        costituzione
    );


    setText(
        "master-intelligenza",
        intelligenza
    );


    setText(
        "master-destrezza",
        destrezza
    );


    setText(
        "master-fortuna",
        fortuna
    );


    // --------------------------------------------------------
    // SECONDARIE
    // --------------------------------------------------------

    const attack =
        Math.ceil(
            forza /
            2
        );


    const defense =
        Math.ceil(
            7 +
            (
                resistenza /
                2
            )
        );


    const life =
        Math.ceil(
            5 *
            (
                costituzione /
                2
            )
        );


    const mana =
        Math.ceil(
            5 *
            (
                intelligenza /
                2
            )
        );


    const movement =
        Math.ceil(
            4 +
            (
                destrezza /
                2
            )
        );


    const critical =
        Math.min(
            50,
            Math.ceil(
                fortuna *
                (
                    50 /
                    30
                )
            )
        );


    setText(
        "master-attack",
        attack
    );


    setText(
        "master-defense",
        defense
    );


    setText(
        "master-life",
        life
    );


    setText(
        "master-mana",
        mana
    );


    setText(
        "master-movement",
        movement
    );


    setText(
        "master-critical",
        `${critical}%`
    );


    setText(
        "master-character-position",
        `X ${
            Number(
                character.dungeon_x
            ) || 0
        } • Y ${
            Number(
                character.dungeon_y
            ) || 0
        }`
    );

}


// ============================================================
// VALORE STAT
// ============================================================

function getStat(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return 1;

    }


    return Math.max(
        1,
        Math.min(
            30,
            number
        )
    );

}


// ============================================================
// SET TEXT
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
// MODALE
// ============================================================

function setupModal() {

    const modal =
        document.getElementById(
            "master-character-modal"
        );


    const closeButton =
        document.getElementById(
            "master-modal-close"
        );


    if (
        !modal ||
        !closeButton
    ) {

        return;

    }


    closeButton.addEventListener(
        "click",
        closeCharacterSheet
    );


    modal
        .querySelectorAll(
            "[data-close-master-modal]"
        )
        .forEach(
            element => {

                element.addEventListener(
                    "click",
                    closeCharacterSheet
                );

            }
        );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape" &&
                !modal.hidden
            ) {

                closeCharacterSheet();

            }

        }
    );

}


// ============================================================
// CHIUDI SCHEDA
// ============================================================

function closeCharacterSheet() {

    const modal =
        document.getElementById(
            "master-character-modal"
        );


    if (!modal) {

        return;

    }


    modal.hidden =
        true;


    document.body.style.overflow =
        "";

}


// ============================================================
// LOGOUT
// ============================================================

function setupLogout() {

    const button =
        document.getElementById(
            "logout-button"
        );


    if (!button) {

        return;

    }


    button.addEventListener(
        "click",
        async () => {

            if (
                dungeonChannel
            ) {

                await db
                    .removeChannel(
                        dungeonChannel
                    );

            }


            await db
                .auth
                .signOut();


            window.location.href =
                "index.html";

        }
    );

}


// ============================================================
// MESSAGGIO
// ============================================================

function showMessage(
    text
) {

    const element =
        document.getElementById(
            "master-message"
        );


    if (element) {

        element.textContent =
            text;

    }

}


// ============================================================
// RIDIMENSIONAMENTO
// ============================================================

window.addEventListener(
    "resize",
    () => {

        renderAllTokens();

    }
);


// ============================================================
// USCITA
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (
            dungeonChannel
        ) {

            db.removeChannel(
                dungeonChannel
            );

        }

    }
);
