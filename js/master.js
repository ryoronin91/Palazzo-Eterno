// ============================================================
// PALAZZO ETERNO
// MASTER.JS
// ============================================================
//
// Modalità Master:
//
// - controlla autenticazione
// - controlla ruolo master
// - nessuna pedina del Master
// - visualizza tutta la mappa
// - visualizza tutti i giocatori online
// - riceve movimenti in tempo reale
// - permette di cliccare sulle pedine
// - mostra la scheda del personaggio
// - chat realtime del piano
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


// Stesso canale di dungeon.js

const DUNGEON_CHANNEL_NAME =
    "palazzo-eterno-dungeon-1";

// ============================================================
// EVENTI DEL DUNGEON
// ============================================================

const MASTER_DUNGEON_EVENTS = {

    "11,17": {

        id:
            "stairs_down",

        type:
            "communication",

        message:
            "Queste scale scendono ad un piano inferiore."

    },


    "15,22": {

        id:
            "dead_end",

        type:
            "communication",

        message:
            "Possibile che quelle scale ti abbiano portato ad un vicolo cieco? Sì"

    },


    "11,11": {

        id:
            "blade_corridor",

        type:
            "trap",

        message:
            "Una lama affilata attraversa il corridoio da muro a muro."

    },


    "9,15": {

        id:
            "acid_vapor",

        type:
            "trap",

        message:
            "Dal pavimento una nube di vapore acido ti investe."

    }

};


// trap_id -> stato Supabase

const masterTrapStates =
    new Map();


let trapStateRefreshTimer =
    null;


let trapCountdownTimer =
    null;


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


// character_id -> token

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

            setupMasterChat();

            setupMap();

            await Promise.all([
                loadMasterTrapStates(),
                loadAllMasterCharacters(),
                loadActiveMasterCombats()
            ]);

            renderMasterEvents();

            startMasterTrapTimers();

            await setupRealtime();

            startMasterDashboardRefresh();

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


    const renderMapElements =
        () => {

            renderAllTokens();

            renderMasterEvents();

        };


    if (
        image.complete
    ) {

        renderMapElements();

    } else {

        image.addEventListener(
            "load",
            renderMapElements
        );

    }

}

// ============================================================
// CARICA STATO TRAPPOLE
// ============================================================

async function loadMasterTrapStates() {

    const {
        data,
        error
    } =
        await db
            .from(
                "dungeon_trap_states"
            )
            .select(
                "trap_id, triggered_at, disabled_until"
            );


    if (error) {

        console.error(
            "Errore caricamento stato trappole:",
            error
        );

        return;

    }


    masterTrapStates.clear();


    (
        data ||
        []
    ).forEach(
        trapState => {

            masterTrapStates.set(
                trapState.trap_id,
                trapState
            );

        }
    );


    renderMasterEvents();

}


// ============================================================
// TIMER MASTER TRAPPOLE
// ============================================================

function startMasterTrapTimers() {

    if (
        trapStateRefreshTimer
    ) {

        clearInterval(
            trapStateRefreshTimer
        );

    }


    if (
        trapCountdownTimer
    ) {

        clearInterval(
            trapCountdownTimer
        );

    }


    // Rilegge Supabase periodicamente,
    // così il Master vede le trappole
    // attivate dai giocatori.

    trapStateRefreshTimer =
        setInterval(
            async () => {

                await loadMasterTrapStates();

            },
            5000
        );


    // Aggiorna invece il countdown visivo
    // ogni secondo senza interrogare Supabase.

    trapCountdownTimer =
        setInterval(
            () => {

                updateMasterTrapCountdowns();

            },
            1000
        );

}


// ============================================================
// RENDER EVENTI MASTER
// ============================================================

function renderMasterEvents() {

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


    const oldMarkers =
        container.querySelectorAll(
            ".master-event-marker"
        );


    oldMarkers.forEach(
        marker => {

            marker.remove();

        }
    );


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


    Object.entries(
        MASTER_DUNGEON_EVENTS
    ).forEach(
        ([
            coordinateKey,
            dungeonEvent
        ]) => {

            const [
                x,
                y
            ] =
                coordinateKey
                    .split(",")
                    .map(Number);


            const marker =
                document.createElement(
                    "div"
                );


            marker.className =
                "master-event-marker";


            marker.dataset.eventId =
                dungeonEvent.id;


            marker.dataset.eventType =
                dungeonEvent.type;


            // ------------------------------------------------
            // POSIZIONE
            // ------------------------------------------------

            const markerSize =
                Math.min(
                    cellWidth,
                    cellHeight
                ) *
                0.72;


            const centerX =
                (
                    x +
                    0.5
                ) *
                cellWidth;


            const centerY =
                (
                    y +
                    0.5
                ) *
                cellHeight;


            const offsetX =
                mapRect.left -
                containerRect.left;


            const offsetY =
                mapRect.top -
                containerRect.top;


            marker.style.width =
                `${markerSize}px`;


            marker.style.height =
                `${markerSize}px`;


            marker.style.left =
                `${
                    offsetX +
                    centerX -
                    markerSize / 2
                }px`;


            marker.style.top =
                `${
                    offsetY +
                    centerY -
                    markerSize / 2
                }px`;


            // ------------------------------------------------
            // TIPO EVENTO
            // ------------------------------------------------

            if (
                dungeonEvent.type ===
                "communication"
            ) {

                marker.classList.add(
                    "is-communication"
                );


                marker.textContent =
                    "◆";


                marker.title =
                    `EVENTO\nX ${x} • Y ${y}\n${dungeonEvent.message}`;

            }


            if (
                dungeonEvent.type ===
                "trap"
            ) {

                const state =
                    masterTrapStates.get(
                        dungeonEvent.id
                    );


                const cooldownActive =
                    isMasterTrapCooldownActive(
                        state
                    );


                marker.classList.add(
                    "is-trap"
                );


                if (
                    cooldownActive
                ) {

                    marker.classList.add(
                        "is-cooldown"
                    );

                } else {

                    marker.classList.add(
                        "is-active"
                    );

                }


                const icon =
                    document.createElement(
                        "span"
                    );


                icon.className =
                    "master-event-icon";


                icon.textContent =
                    "⚠";


                marker.appendChild(
                    icon
                );


                const countdown =
                    document.createElement(
                        "span"
                    );


                countdown.className =
                    "master-event-countdown";


                marker.appendChild(
                    countdown
                );


                updateSingleMasterTrapMarker(
                    marker,
                    dungeonEvent,
                    x,
                    y
                );

            }


            container.appendChild(
                marker
            );

        }
    );

}


// ============================================================
// TRAPPOLA IN COOLDOWN?
// ============================================================

function isMasterTrapCooldownActive(
    state
) {

    if (
        !state ||
        !state.disabled_until
    ) {

        return false;

    }


    const disabledUntil =
        new Date(
            state.disabled_until
        )
            .getTime();


    if (
        !Number.isFinite(
            disabledUntil
        )
    ) {

        return false;

    }


    return (
        disabledUntil >
        Date.now()
    );

}


// ============================================================
// AGGIORNA COUNTDOWN
// ============================================================

function updateMasterTrapCountdowns() {

    document
        .querySelectorAll(
            ".master-event-marker.is-trap"
        )
        .forEach(
            marker => {

                const eventId =
                    marker.dataset.eventId;


                const dungeonEvent =
                    Object.values(
                        MASTER_DUNGEON_EVENTS
                    )
                        .find(
                            event =>
                                event.id ===
                                eventId
                        );


                if (
                    !dungeonEvent
                ) {

                    return;

                }


                const entry =
                    Object.entries(
                        MASTER_DUNGEON_EVENTS
                    )
                        .find(
                            ([
                                key,
                                event
                            ]) =>
                                event.id ===
                                eventId
                        );


                if (
                    !entry
                ) {

                    return;

                }


                const [
                    coordinateKey
                ] =
                    entry;


                const [
                    x,
                    y
                ] =
                    coordinateKey
                        .split(",")
                        .map(Number);


                updateSingleMasterTrapMarker(
                    marker,
                    dungeonEvent,
                    x,
                    y
                );

            }
        );

}


// ============================================================
// AGGIORNA SINGOLA TRAPPOLA
// ============================================================

function updateSingleMasterTrapMarker(
    marker,
    dungeonEvent,
    x,
    y
) {

    const state =
        masterTrapStates.get(
            dungeonEvent.id
        );


    const countdownElement =
        marker.querySelector(
            ".master-event-countdown"
        );


    const cooldownActive =
        isMasterTrapCooldownActive(
            state
        );


    marker.classList.toggle(
        "is-cooldown",
        cooldownActive
    );


    marker.classList.toggle(
        "is-active",
        !cooldownActive
    );


    if (
        !cooldownActive
    ) {

        if (
            countdownElement
        ) {

            countdownElement.textContent =
                "";

        }


        marker.title =
            `TRAPPOLA ATTIVA\nX ${x} • Y ${y}\n${dungeonEvent.message}`;


        return;

    }


    const disabledUntil =
        new Date(
            state.disabled_until
        )
            .getTime();


    const remainingMs =
        Math.max(
            0,
            disabledUntil -
            Date.now()
        );


    const remainingSeconds =
        Math.ceil(
            remainingMs /
            1000
        );


    const minutes =
        Math.floor(
            remainingSeconds /
            60
        );


    const seconds =
        remainingSeconds %
        60;


    const countdownText =
        `${minutes}:${String(
            seconds
        ).padStart(
            2,
            "0"
        )}`;


    if (
        countdownElement
    ) {

        countdownElement.textContent =
            countdownText;

    }


    marker.title =
        `TRAPPOLA IN COOLDOWN\nX ${x} • Y ${y}\n${dungeonEvent.message}\nTempo residuo: ${countdownText}`;

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
    // PRESENCE
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
    // CHAT DEL PIANO
    // ========================================================

    dungeonChannel.on(
        "broadcast",
        {
            event:
                "floor-chat"
        },
        message => {

            const data =
                message.payload;


            if (!data) {

                return;

            }


            // Se per qualche motivo Supabase rimanda
            // il nostro messaggio allo stesso client,
            // non lo duplichiamo.

            if (
                data.master_user_id &&
                data.master_user_id ===
                currentUser.id
            ) {

                return;

            }


            appendMasterChatMessage(
                data,
                false
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


                setMasterChatConnected(
                    true
                );


                updateOnlineCounter();

            }


            if (
                status ===
                "CHANNEL_ERROR" ||
                status ===
                "TIMED_OUT" ||
                status ===
                "CLOSED"
            ) {

                realtimeReady =
                    false;


                setMasterChatConnected(
                    false
                );


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


    token.src =
        "immagini/token/" +
        player.token;


    token.alt =
        "Token di " +
        player.nome;


    token.title =
        player.nome;


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
// RIDISEGNA TOKEN
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
// CHAT MASTER - SETUP
// ============================================================

function setupMasterChat() {

    const form =
        document.getElementById(
            "master-chat-form"
        );


    const input =
        document.getElementById(
            "master-chat-input"
        );


    if (
        !form ||
        !input
    ) {

        return;

    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            await sendMasterChatMessage();

        }
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();


                form.requestSubmit();

            }

        }
    );

}


// ============================================================
// STATO CHAT
// ============================================================

function setMasterChatConnected(
    connected
) {

    const input =
        document.getElementById(
            "master-chat-input"
        );


    const button =
        document.getElementById(
            "master-chat-send"
        );


    const status =
        document.getElementById(
            "master-chat-status"
        );


    if (input) {

        input.disabled =
            !connected;

    }


    if (button) {

        button.disabled =
            !connected;

    }


    if (status) {

        status.textContent =
            connected
                ? "Online"
                : "Disconnessa";


        status.classList.toggle(
            "is-online",
            connected
        );

    }

}


// ============================================================
// INVIA MESSAGGIO MASTER
// ============================================================

async function sendMasterChatMessage() {

    const input =
        document.getElementById(
            "master-chat-input"
        );


    const feedback =
        document.getElementById(
            "master-chat-feedback"
        );


    if (!input) {

        return;

    }


    const text =
        input.value
            .trim();


    if (!text) {

        return;

    }


    if (
        !dungeonChannel ||
        !realtimeReady
    ) {

        if (feedback) {

            feedback.textContent =
                "Chat non connessa.";

        }


        return;

    }


    const payload = {

        message_id:
            `master-${Date.now()}`,

        character_id:
            null,

        master_user_id:
            currentUser.id,

        nome:
            "MASTER",

        text,

        sent_at:
            new Date()
                .toISOString()

    };


    // Mostra subito il messaggio al Master.

    appendMasterChatMessage(
        payload,
        true
    );


    input.value =
        "";


    if (feedback) {

        feedback.textContent =
            "";

    }


    const result =
        await dungeonChannel.send({

            type:
                "broadcast",

            event:
                "floor-chat",

            payload

        });


    if (
        result !== "ok" &&
        result !== undefined
    ) {

        console.warn(
            "Invio chat Master:",
            result
        );

    }

}


// ============================================================
// MOSTRA MESSAGGIO CHAT
// ============================================================

function appendMasterChatMessage(
    data,
    isMaster = false
) {

    const container =
        document.getElementById(
            "master-chat-messages"
        );


    if (
        !container ||
        !data
    ) {

        return;

    }


    const empty =
        container.querySelector(
            ".master-chat-empty"
        );


    if (empty) {

        empty.remove();

    }


    const message =
        document.createElement(
            "div"
        );


    message.className =
        "master-chat-message" +
        (
            isMaster ||
            data.nome ===
            "MASTER"
                ? " is-master"
                : ""
        );


    const meta =
        document.createElement(
            "div"
        );


    meta.className =
        "master-chat-meta";


    const author =
        document.createElement(
            "strong"
        );


    author.textContent =
        data.nome ||
        data.name ||
        "Giocatore";


    const time =
        document.createElement(
            "span"
        );


    time.textContent =
        formatChatTime(
            data.sent_at
        );


    meta.appendChild(
        author
    );


    meta.appendChild(
        time
    );


    const body =
        document.createElement(
            "div"
        );


    body.className =
        "master-chat-body";


    body.textContent =
        String(
            data.text ||
            ""
        );


    message.appendChild(
        meta
    );


    message.appendChild(
        body
    );


    container.appendChild(
        message
    );


    const messages =
        container.querySelectorAll(
            ".master-chat-message"
        );


    if (
        messages.length >
        100
    ) {

        messages[0].remove();

    }


    container.scrollTop =
        container.scrollHeight;

}


// ============================================================
// ORARIO CHAT
// ============================================================

function formatChatTime(
    value
) {

    const date =
        value
            ? new Date(value)
            : new Date();


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "";

    }


    return date.toLocaleTimeString(
        "it-IT",
        {
            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    );

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

        renderMasterEvents();

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


// ============================================================
// DASHBOARD MASTER v3
// Tutti i PG dal database + Presence online + combat spettatore
// ============================================================

const MASTER_COMBAT_EVENTS = [
    { id: "C1", x: 12, y: 4, encounter_id: "combat_1" },
    { id: "C2", x: 7,  y: 11, encounter_id: "combat_2" },
    { id: "C3", x: 13, y: 14, encounter_id: "combat_3" },
    { id: "C4", x: 19, y: 11, encounter_id: "combat_4" },
    { id: "C5", x: 11, y: 20, encounter_id: "combat_5" }
];

const allMasterPlayers = new Map();
const activeMasterCombats = new Map();
let masterDashboardRefreshTimer = null;

async function loadAllMasterCharacters() {
    const { data, error } = await db
        .from("characters")
        .select(`
            id,
            user_id,
            nome,
            livello,
            token,
            forza,
            resistenza,
            costituzione,
            intelligenza,
            destrezza,
            fortuna,
            current_hp,
            current_pm,
            dungeon_x,
            dungeon_y,
            active_combat_id
        `);

    if (error) {
        console.error("Errore caricamento PG Master:", error);
        return;
    }

    const currentIds = new Set();

    (data || []).forEach(characterData => {
        currentIds.add(characterData.id);

        const presence = onlinePlayers.get(characterData.id);

        const x = presence && Number.isFinite(Number(presence.x))
            ? Number(presence.x)
            : Number(characterData.dungeon_x);

        const y = presence && Number.isFinite(Number(presence.y))
            ? Number(presence.y)
            : Number(characterData.dungeon_y);

        allMasterPlayers.set(characterData.id, {
            ...characterData,
            character_id: characterData.id,
            nome: presence?.nome || presence?.name || characterData.nome || "Avventuriero",
            token: presence?.token || characterData.token || "token_1.png",
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            current_hp: presence?.current_hp !== undefined
                ? presence.current_hp
                : characterData.current_hp,
            active_combat_id: presence?.active_combat_id || characterData.active_combat_id || null,
            online: onlinePlayers.has(characterData.id)
        });
    });

    for (const characterId of Array.from(allMasterPlayers.keys())) {
        if (!currentIds.has(characterId)) {
            allMasterPlayers.delete(characterId);
            const token = playerTokens.get(characterId);
            if (token) token.remove();
            playerTokens.delete(characterId);
        }
    }

    renderAllTokens();
    updatePlayerList();
    updateOnlineCounter();
}

async function loadActiveMasterCombats() {
    const { data, error } = await db
        .from("combat_sessions")
        .select(`
            id,
            encounter_id,
            status,
            round_number,
            current_turn_entity_id
        `)
        .in("status", ["waiting", "active"]);

    if (error) {
        console.error("Errore caricamento combat Master:", error);
        return;
    }

    activeMasterCombats.clear();

    (data || []).forEach(combat => {
        activeMasterCombats.set(combat.id, combat);
    });

    renderActiveMasterCombats();
    renderMasterEvents();
}

function startMasterDashboardRefresh() {
    if (masterDashboardRefreshTimer) {
        clearInterval(masterDashboardRefreshTimer);
    }

    masterDashboardRefreshTimer = setInterval(async () => {
        await Promise.all([
            loadAllMasterCharacters(),
            loadActiveMasterCombats()
        ]);
    }, 4000);
}

function getActiveCombatForEncounter(encounterId) {
    return Array.from(activeMasterCombats.values()).find(
        combat => combat.encounter_id === encounterId
    ) || null;
}

function openMasterCombat(combatId) {
    if (!combatId) return;

    window.location.href =
        `combat.html?combat_id=${encodeURIComponent(combatId)}&mode=master`;
}

function renderActiveMasterCombats() {
    const list = document.getElementById("master-combat-list");
    const countElement = document.getElementById("master-combat-count");

    if (!list) return;

    const combats = Array.from(activeMasterCombats.values())
        .sort((a, b) => String(a.encounter_id || "").localeCompare(String(b.encounter_id || "")));

    list.innerHTML = "";

    if (countElement) {
        countElement.textContent = combats.length === 0
            ? "Nessun combattimento attivo"
            : combats.length === 1
                ? "1 combattimento attivo"
                : `${combats.length} combattimenti attivi`;
    }

    if (combats.length === 0) {
        const empty = document.createElement("div");
        empty.className = "master-player-empty";
        empty.textContent = "Nessun combattimento in corso.";
        list.appendChild(empty);
        return;
    }

    combats.forEach(combat => {
        const row = document.createElement("div");
        row.className = "master-combat-item";

        const info = document.createElement("div");
        const title = document.createElement("div");
        title.className = "master-combat-title";
        title.textContent = String(combat.encounter_id || "COMBATTIMENTO").toUpperCase();

        const meta = document.createElement("div");
        meta.className = "master-combat-meta";

        const participants = Array.from(allMasterPlayers.values())
            .filter(player => player.active_combat_id === combat.id)
            .map(player => player.nome);

        const participantText = participants.length
            ? ` · ${participants.join(", ")}`
            : "";

        meta.textContent =
            `${combat.status === "active" ? "IN CORSO" : "IN ATTESA"} · Round ${Number(combat.round_number) || 1}${participantText}`;

        info.append(title, meta);

        const watch = document.createElement("button");
        watch.type = "button";
        watch.className = "button master-combat-watch";
        watch.textContent = "OSSERVA";
        watch.addEventListener("click", () => openMasterCombat(combat.id));

        row.append(info, watch);
        list.appendChild(row);
    });
}

// ============================================================
// PRESENCE: non rimuove più i PG offline dal Master
// ============================================================

function syncPresencePlayers() {
    if (!dungeonChannel) return;

    const state = dungeonChannel.presenceState();
    const currentIds = new Set();

    Object.values(state).forEach(presences => {
        presences.forEach(presence => {
            if (!presence.character_id) return;

            currentIds.add(presence.character_id);

            onlinePlayers.set(presence.character_id, {
                ...presence,
                nome: presence.nome || presence.name || "Avventuriero"
            });

            const existing = allMasterPlayers.get(presence.character_id);

            if (existing) {
                allMasterPlayers.set(presence.character_id, {
                    ...existing,
                    nome: presence.nome || presence.name || existing.nome,
                    token: presence.token || existing.token,
                    x: Number.isFinite(Number(presence.x)) ? Number(presence.x) : existing.x,
                    y: Number.isFinite(Number(presence.y)) ? Number(presence.y) : existing.y,
                    current_hp: presence.current_hp !== undefined ? presence.current_hp : existing.current_hp,
                    active_combat_id: presence.active_combat_id || existing.active_combat_id || null,
                    online: true
                });
            }
        });
    });

    for (const characterId of Array.from(onlinePlayers.keys())) {
        if (!currentIds.has(characterId)) {
            onlinePlayers.delete(characterId);
            const existing = allMasterPlayers.get(characterId);
            if (existing) {
                allMasterPlayers.set(characterId, { ...existing, online: false });
            }
        }
    }

    renderAllTokens();
    updatePlayerList();
    updateOnlineCounter();
    renderActiveMasterCombats();
}

function updatePlayer(data) {
    if (!data || !data.character_id) return;

    const x = Number(data.x);
    const y = Number(data.y);

    onlinePlayers.set(data.character_id, {
        ...onlinePlayers.get(data.character_id),
        ...data,
        nome: data.nome || data.name || onlinePlayers.get(data.character_id)?.nome || "Avventuriero"
    });

    const existing = allMasterPlayers.get(data.character_id) || {
        id: data.character_id,
        character_id: data.character_id,
        nome: data.nome || data.name || "Avventuriero",
        token: data.token || "token_1.png"
    };

    allMasterPlayers.set(data.character_id, {
        ...existing,
        character_id: data.character_id,
        nome: data.nome || data.name || existing.nome,
        token: data.token || existing.token || "token_1.png",
        x: Number.isFinite(x) ? x : (existing.x ?? 0),
        y: Number.isFinite(y) ? y : (existing.y ?? 0),
        current_hp: data.current_hp !== undefined ? data.current_hp : existing.current_hp,
        active_combat_id: data.active_combat_id !== undefined
            ? data.active_combat_id
            : existing.active_combat_id,
        online: true
    });

    renderPlayerToken(data.character_id);
    updatePlayerList();
    updateOnlineCounter();
    renderActiveMasterCombats();
}

function removePlayer(characterId) {
    onlinePlayers.delete(characterId);

    const existing = allMasterPlayers.get(characterId);
    if (existing) {
        allMasterPlayers.set(characterId, { ...existing, online: false });
    }

    renderPlayerToken(characterId);
    updatePlayerList();
    updateOnlineCounter();
}

// ============================================================
// TOKEN: tutti i PG, online/offline/combat
// ============================================================

function renderPlayerToken(characterId) {
    const player = allMasterPlayers.get(characterId);
    if (!player) return;

    const image = document.getElementById("master-map-image");
    const container = document.getElementById("master-map");
    if (!image || !container) return;

    const mapRect = image.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (mapRect.width <= 0 || mapRect.height <= 0) return;

    const cellWidth = mapRect.width / MAP_COLUMNS;
    const cellHeight = mapRect.height / MAP_ROWS;

    let token = playerTokens.get(characterId);

    if (!token) {
        token = document.createElement("img");
        token.className = "master-player-token";
        token.addEventListener("click", event => {
            event.stopPropagation();
            openCharacterSheet(characterId);
        });
        container.appendChild(token);
        playerTokens.set(characterId, token);
    }

    token.src = "immagini/token/" + (player.token || "token_1.png");
    token.alt = "Token di " + (player.nome || "Avventuriero");
    token.title = `${player.nome || "Avventuriero"}${player.online ? " · ONLINE" : " · OFFLINE"}${player.active_combat_id ? " · IN COMBATTIMENTO" : ""}`;

    token.classList.toggle("is-online", !!player.online);
    token.classList.toggle("is-offline", !player.online);
    token.classList.toggle("is-in-combat", !!player.active_combat_id);

    const tokenSize = Math.min(cellWidth, cellHeight) * 0.92;
    token.style.width = `${tokenSize}px`;
    token.style.height = `${tokenSize}px`;

    const x = Number.isFinite(Number(player.x)) ? Number(player.x) : 0;
    const y = Number.isFinite(Number(player.y)) ? Number(player.y) : 0;

    const centerX = (x + 0.5) * cellWidth;
    const centerY = (y + 0.5) * cellHeight;
    const offsetX = mapRect.left - containerRect.left;
    const offsetY = mapRect.top - containerRect.top;

    token.style.left = `${offsetX + centerX - tokenSize / 2}px`;
    token.style.top = `${offsetY + centerY - tokenSize / 2}px`;
}

function renderAllTokens() {
    for (const characterId of allMasterPlayers.keys()) {
        renderPlayerToken(characterId);
    }
}

// ============================================================
// LISTA PG COMPLETA
// ============================================================

function updatePlayerList() {
    const list = document.getElementById("master-player-list");
    if (!list) return;

    list.innerHTML = "";

    if (allMasterPlayers.size === 0) {
        const empty = document.createElement("div");
        empty.className = "master-player-empty";
        empty.textContent = "Nessun personaggio presente nel piano.";
        list.appendChild(empty);
        return;
    }

    const players = Array.from(allMasterPlayers.values())
        .sort((a, b) => {
            if (!!a.online !== !!b.online) return a.online ? -1 : 1;
            if (!!a.active_combat_id !== !!b.active_combat_id) return a.active_combat_id ? -1 : 1;
            return String(a.nome || "").localeCompare(String(b.nome || ""), "it");
        });

    players.forEach(player => {
        const row = document.createElement("div");
        row.className = "master-player-item";
        row.classList.toggle("is-offline", !player.online);
        row.classList.toggle("is-combat", !!player.active_combat_id);

        const token = document.createElement("img");
        token.src = "immagini/token/" + (player.token || "token_1.png");
        token.alt = "";

        const info = document.createElement("div");
        info.className = "master-player-info";

        const name = document.createElement("span");
        name.className = "master-player-name";
        name.textContent = player.nome || "Avventuriero";

        const position = document.createElement("span");
        position.className = "master-player-position";
        position.textContent = `X ${Number(player.x) || 0} • Y ${Number(player.y) || 0}`;

        const statusRow = document.createElement("div");
        statusRow.className = "master-player-status-row";

        const onlineBadge = document.createElement("span");
        onlineBadge.className = `master-status-badge ${player.online ? "online" : "offline"}`;
        onlineBadge.textContent = player.online ? "● ONLINE" : "○ OFFLINE";
        statusRow.appendChild(onlineBadge);

        if (player.active_combat_id) {
            const combatBadge = document.createElement("span");
            combatBadge.className = "master-status-badge combat";
            combatBadge.textContent = "⚔ COMBAT";
            statusRow.appendChild(combatBadge);
        }

        info.append(name, position, statusRow);

        row.append(token, info);

        if (player.active_combat_id) {
            const watch = document.createElement("button");
            watch.type = "button";
            watch.className = "button master-inline-watch";
            watch.textContent = "OSSERVA";
            watch.addEventListener("click", event => {
                event.stopPropagation();
                openMasterCombat(player.active_combat_id);
            });
            row.appendChild(watch);
        }

        row.addEventListener("click", () => openCharacterSheet(player.character_id));
        list.appendChild(row);
    });
}

function updateOnlineCounter() {
    const element = document.getElementById("master-online-count");
    if (!element) return;

    const onlineCount = Array.from(allMasterPlayers.values()).filter(player => player.online).length;
    const total = allMasterPlayers.size;

    if (!realtimeReady) {
        element.textContent = `${total} PG totali · connessione realtime...`;
        return;
    }

    element.textContent = `${onlineCount} online · ${total} PG totali`;
}

// ============================================================
// EVENTI MASTER: comunicazioni + trappole + combat
// ============================================================

function renderMasterEvents() {
    const image = document.getElementById("master-map-image");
    const container = document.getElementById("master-map");
    if (!image || !container) return;

    container.querySelectorAll(".master-event-marker").forEach(marker => marker.remove());

    const mapRect = image.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (mapRect.width <= 0 || mapRect.height <= 0) return;

    const cellWidth = mapRect.width / MAP_COLUMNS;
    const cellHeight = mapRect.height / MAP_ROWS;
    const offsetX = mapRect.left - containerRect.left;
    const offsetY = mapRect.top - containerRect.top;

    const placeMarker = (x, y, marker) => {
        const markerSize = Math.min(cellWidth, cellHeight) * 0.72;
        marker.style.width = `${markerSize}px`;
        marker.style.height = `${markerSize}px`;
        marker.style.left = `${offsetX + (x + 0.5) * cellWidth - markerSize / 2}px`;
        marker.style.top = `${offsetY + (y + 0.5) * cellHeight - markerSize / 2}px`;
        container.appendChild(marker);
    };

    Object.entries(MASTER_DUNGEON_EVENTS).forEach(([coordinateKey, dungeonEvent]) => {
        const [x, y] = coordinateKey.split(",").map(Number);
        const marker = document.createElement("div");
        marker.className = "master-event-marker";
        marker.dataset.eventId = dungeonEvent.id;
        marker.dataset.eventType = dungeonEvent.type;

        if (dungeonEvent.type === "communication") {
            marker.classList.add("is-communication");
            marker.textContent = "◆";
            marker.title = `EVENTO\nX ${x} • Y ${y}\n${dungeonEvent.message}`;
        }

        if (dungeonEvent.type === "trap") {
            marker.classList.add("is-trap");
            const icon = document.createElement("span");
            icon.className = "master-event-icon";
            icon.textContent = "⚠";
            const countdown = document.createElement("span");
            countdown.className = "master-event-countdown";
            marker.append(icon, countdown);
            updateSingleMasterTrapMarker(marker, dungeonEvent, x, y);
        }

        placeMarker(x, y, marker);
    });

    MASTER_COMBAT_EVENTS.forEach(combatEvent => {
        const marker = document.createElement("div");
        marker.className = "master-event-marker is-combat";
        marker.dataset.eventId = combatEvent.id;
        marker.dataset.eventType = "combat";
        marker.textContent = "⚔";

        const liveCombat = getActiveCombatForEncounter(combatEvent.encounter_id);

        if (liveCombat) {
            marker.classList.add("has-live-combat");
            marker.title = `COMBATTIMENTO IN CORSO\n${combatEvent.id} · ${combatEvent.encounter_id}\nX ${combatEvent.x} • Y ${combatEvent.y}\nClicca per osservare`;
            marker.addEventListener("click", event => {
                event.stopPropagation();
                openMasterCombat(liveCombat.id);
            });
        } else {
            marker.title = `EVENTO COMBAT\n${combatEvent.id} · ${combatEvent.encounter_id}\nX ${combatEvent.x} • Y ${combatEvent.y}`;
        }

        placeMarker(combatEvent.x, combatEvent.y, marker);
    });
}

// Countdown hh:mm:ss quando supera un'ora
function updateSingleMasterTrapMarker(marker, dungeonEvent, x, y) {
    const state = masterTrapStates.get(dungeonEvent.id);
    const countdownElement = marker.querySelector(".master-event-countdown");
    const cooldownActive = isMasterTrapCooldownActive(state);

    marker.classList.toggle("is-cooldown", cooldownActive);
    marker.classList.toggle("is-active", !cooldownActive);

    if (!cooldownActive) {
        if (countdownElement) countdownElement.textContent = "";
        marker.title = `TRAPPOLA ATTIVA\nX ${x} • Y ${y}\n${dungeonEvent.message}`;
        return;
    }

    const disabledUntil = new Date(state.disabled_until).getTime();
    const remainingSeconds = Math.ceil(Math.max(0, disabledUntil - Date.now()) / 1000);
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    const countdownText = hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        : `${minutes}:${String(seconds).padStart(2, "0")}`;

    if (countdownElement) countdownElement.textContent = countdownText;

    marker.title = `TRAPPOLA IN COOLDOWN\nX ${x} • Y ${y}\n${dungeonEvent.message}\nTempo residuo: ${countdownText}`;
}

// ============================================================
// SCHEDA PG MASTER ESTESA
// ============================================================

async function openCharacterSheet(characterId) {
    const modal = document.getElementById("master-character-modal");
    if (!modal) return;

    showMessage("Caricamento scheda...");

    const { data, error } = await db
        .from("characters")
        .select(`
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
            current_hp,
            current_pm,
            dungeon_x,
            dungeon_y,
            active_combat_id
        `)
        .eq("id", characterId)
        .single();

    if (error) {
        console.error("Errore caricamento scheda:", error);
        showMessage("Impossibile caricare la scheda.");
        return;
    }

    const cached = allMasterPlayers.get(characterId);
    fillCharacterSheet({
        ...data,
        online: !!cached?.online,
        active_combat_id: cached?.active_combat_id || data.active_combat_id || null
    });

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    showMessage("");
}

function fillCharacterSheet(characterData) {
    const forza = getStat(characterData.forza);
    const resistenza = getStat(characterData.resistenza);
    const costituzione = getStat(characterData.costituzione);
    const intelligenza = getStat(characterData.intelligenza);
    const destrezza = getStat(characterData.destrezza);
    const fortuna = getStat(characterData.fortuna);

    setText("master-character-name", characterData.nome || "Avventuriero");
    setText("master-character-level", "Livello " + (Number(characterData.livello) || 1));

    const token = document.getElementById("master-character-token");
    if (token) {
        token.src = "immagini/token/" + (characterData.token || "token_1.png");
        token.alt = "Token di " + (characterData.nome || "personaggio");
    }

    setText("master-forza", forza);
    setText("master-resistenza", resistenza);
    setText("master-costituzione", costituzione);
    setText("master-intelligenza", intelligenza);
    setText("master-destrezza", destrezza);
    setText("master-fortuna", fortuna);

    const attack = Math.ceil(forza / 2);
    const defense = Math.ceil(7 + resistenza / 2);
    const life = Math.ceil(5 * costituzione / 2);
    const mana = Math.ceil(5 * intelligenza / 2);
    const movement = Math.ceil(4 + destrezza / 2);
    const critical = Math.min(50, Math.ceil(fortuna * (50 / 30)));

    setText("master-attack", attack);
    setText("master-defense", defense);
    setText("master-life", life);
    setText("master-mana", mana);
    setText("master-movement", movement);
    setText("master-critical", `${critical}%`);

    const currentHp = characterData.current_hp === null || characterData.current_hp === undefined
        ? life
        : Number(characterData.current_hp);
    const currentPm = characterData.current_pm === null || characterData.current_pm === undefined
        ? mana
        : Number(characterData.current_pm);

    setText("master-character-current-hp", `${currentHp} / ${life}`);
    setText("master-character-current-pm", `${currentPm} / ${mana}`);
    setText("master-character-online-status", characterData.online ? "● ONLINE" : "○ OFFLINE");

    setText(
        "master-character-position",
        `X ${Number(characterData.dungeon_x) || 0} • Y ${Number(characterData.dungeon_y) || 0}`
    );

    const combatBox = document.getElementById("master-character-combat-box");
    const observeButton = document.getElementById("master-character-observe-combat");

    if (characterData.active_combat_id) {
        const session = activeMasterCombats.get(characterData.active_combat_id);
        setText(
            "master-character-combat-label",
            session?.encounter_id
                ? `${session.encounter_id} · Round ${Number(session.round_number) || 1}`
                : characterData.active_combat_id
        );

        if (combatBox) combatBox.hidden = false;

        if (observeButton) {
            observeButton.onclick = () => openMasterCombat(characterData.active_combat_id);
        }
    } else {
        if (combatBox) combatBox.hidden = true;
        if (observeButton) observeButton.onclick = null;
    }
}

window.addEventListener("beforeunload", () => {
    if (masterDashboardRefreshTimer) {
        clearInterval(masterDashboardRefreshTimer);
        masterDashboardRefreshTimer = null;
    }
});
