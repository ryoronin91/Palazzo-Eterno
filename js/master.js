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


// ============================================================
// CHAT PERSISTENTE
// ============================================================

const MASTER_CHAT_FLOOR_ID =
    "floor_1";

const MASTER_CHAT_HISTORY_LIMIT =
    100;

const renderedMasterChatMessageIds =
    new Set();


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

            setupMasterFloorSelector();

            setupMasterChat();

            await loadMasterChatHistory();

            setupMap();

            // Prima leggiamo le sessioni attive: servono anche
            // per capire a quale piano appartiene un PG in combat.
            await loadActiveMasterCombats();

            await Promise.all([
                loadMasterTrapStates(),
                loadAllMasterCharacters(),
                loadMasterBossPassword(),
                loadMasterCooldownStates()
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


            appendMasterChatMessage(
                data,
                data.name === "MASTER" ||
                data.nome === "MASTER" ||
                data.sender_name === "MASTER"
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
// CARICA STORICO CHAT MASTER
// ============================================================

async function loadMasterChatHistory() {

    const container =
        document.getElementById(
            "master-chat-messages"
        );

    if (!container) {
        return;
    }

    try {

        const {
            data,
            error
        } =
            await db
                .from(
                    "dungeon_chat_messages"
                )
                .select(`
                    id,
                    character_id,
                    user_id,
                    sender_name,
                    message_text,
                    created_at
                `)
                .eq(
                    "floor_id",
                    MASTER_CHAT_FLOOR_ID
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                )
                .limit(
                    MASTER_CHAT_HISTORY_LIMIT
                );

        if (error) {
            throw error;
        }

        renderedMasterChatMessageIds.clear();

        container.innerHTML =
            "";

        const rows =
            Array.isArray(data)
                ? [...data]
                : [];

        if (
            rows.length === 0
        ) {

            container.innerHTML =
                `
                    <div class="master-chat-empty">
                        Nessun messaggio ancora.
                    </div>
                `;

            return;
        }

        rows.forEach(
            row => {

                appendMasterChatMessage(
                    {
                        id:
                            row.id,

                        character_id:
                            row.character_id,

                        master_user_id:
                            row.character_id === null
                                ? row.user_id
                                : null,

                        name:
                            row.sender_name,

                        text:
                            row.message_text,

                        timestamp:
                            row.created_at,

                        sent_at:
                            row.created_at
                    },
                    row.sender_name ===
                        "MASTER"
                );

            }
        );

    } catch (error) {

        console.error(
            "Errore caricamento storico chat Master:",
            error
        );

    }

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

    if (
        !input ||
        !currentUser
    ) {
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

    const originalValue =
        input.value;

    input.value =
        "";

    if (feedback) {
        feedback.textContent =
            "";
    }

    try {

        const {
            data: savedMessage,
            error
        } =
            await db
                .from(
                    "dungeon_chat_messages"
                )
                .insert({

                    floor_id:
                        MASTER_CHAT_FLOOR_ID,

                    character_id:
                        null,

                    user_id:
                        currentUser.id,

                    sender_name:
                        "MASTER",

                    message_text:
                        text

                })
                .select(`
                    id,
                    character_id,
                    user_id,
                    sender_name,
                    message_text,
                    created_at
                `)
                .single();

        if (error) {
            throw error;
        }

        const payload = {

            id:
                savedMessage.id,

            character_id:
                null,

            master_user_id:
                savedMessage.user_id ||
                currentUser.id,

            name:
                "MASTER",

            nome:
                "MASTER",

            text:
                savedMessage.message_text ||
                text,

            timestamp:
                savedMessage.created_at,

            sent_at:
                savedMessage.created_at

        };

        appendMasterChatMessage(
            payload,
            true
        );

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

    } catch (error) {

        console.error(
            "Errore salvataggio chat Master:",
            error
        );

        input.value =
            originalValue;

        if (feedback) {
            feedback.textContent =
                "Messaggio non inviato.";
        }

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

    const messageId =
        data.id ||
        data.message_id ||
        null;

    if (
        messageId &&
        renderedMasterChatMessageIds.has(
            String(messageId)
        )
    ) {
        return;
    }

    if (messageId) {
        renderedMasterChatMessageIds.add(
            String(messageId)
        );
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

    const authorName =
        data.name ||
        data.nome ||
        data.sender_name ||
        "Giocatore";

    message.className =
        "master-chat-message" +
        (
            isMaster ||
            authorName ===
            "MASTER"
                ? " is-master"
                : ""
        );

    if (messageId) {
        message.dataset.messageId =
            String(messageId);
    }

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
        authorName;

    const time =
        document.createElement(
            "span"
        );

    time.textContent =
        formatChatTime(
            data.sent_at ||
            data.timestamp ||
            data.created_at
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
            data.message_text ||
            ""
        );

    message.appendChild(
        meta
    );

    message.appendChild(
        body
    );

    container.prepend(
        message
    );

    const messages =
        container.querySelectorAll(
            ".master-chat-message"
        );

    if (
        messages.length >
        MASTER_CHAT_HISTORY_LIMIT
    ) {

        const last =
            messages[
                messages.length - 1
            ];

        const lastId =
            last?.dataset
                ?.messageId;

        if (lastId) {

            renderedMasterChatMessageIds.delete(
                lastId
            );

        }

        last?.remove();

    }

    container.scrollTop =
        0;

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
    { id: "C5", x: 11, y: 20, encounter_id: "combat_5" },
    { id: "BOSS1", x: 19, y: 20, encounter_id: "combat_boss", type: "boss" }
];

const MASTER_SPECIAL_EVENTS = [
    { id: "PVP1", x: 1, y: 14, type: "pvp", label: "PVP" },
    { id: "VENDOR1", x: 2, y: 11, type: "vendor", label: "VENDOR" }
];

const allMasterPlayers = new Map();
const activeMasterCombats = new Map();
const masterPlayerScores = new Map();
const masterMonkeyFingerOwners = new Set();
let masterDashboardRefreshTimer = null;

async function loadMasterCharacterExtras(characterIds) {
    const ids = Array.isArray(characterIds)
        ? characterIds.filter(Boolean)
        : [];

    if (ids.length === 0) {
        masterPlayerScores.clear();
        masterMonkeyFingerOwners.clear();
        return;
    }

    const [scoreResults, inventoryResult] = await Promise.all([
        Promise.all(
            ids.map(async characterId => {
                try {
                    const { data, error } = await db.rpc(
                        "get_character_final_score",
                        {
                            p_character_id: characterId
                        }
                    );

                    if (error) {
                        throw error;
                    }

                    return {
                        characterId,
                        score: Number(data) || 0
                    };
                } catch (error) {
                    console.error(
                        "Errore score Master per PG",
                        characterId,
                        error
                    );

                    return {
                        characterId,
                        score: masterPlayerScores.get(characterId) ?? 0
                    };
                }
            })
        ),

        db
            .from("character_inventory")
            .select("character_id, item_id, quantity")
            .in("character_id", ids)
            .eq("item_id", "dito_scimmia")
    ]);

    scoreResults.forEach(entry => {
        masterPlayerScores.set(
            entry.characterId,
            entry.score
        );
    });

    if (inventoryResult.error) {
        console.error(
            "Errore controllo Dito di Scimmia Master:",
            inventoryResult.error
        );
        return;
    }

    masterMonkeyFingerOwners.clear();

    (inventoryResult.data || []).forEach(entry => {
        if (
            entry.character_id &&
            (Number(entry.quantity) || 0) > 0
        ) {
            masterMonkeyFingerOwners.add(
                entry.character_id
            );
        }
    });
}


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

    const characterIds = (data || []).map(characterData => characterData.id);

    await loadMasterCharacterExtras(characterIds);

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
            score: masterPlayerScores.get(characterData.id) ?? 0,
            has_monkey_finger: masterMonkeyFingerOwners.has(characterData.id),
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
    renderMasterMonkeyFingerStatus();
}


// ============================================================
// BOX PASSWORD BOSS
// ============================================================

async function loadMasterBossPassword() {
    const passwordElement =
        document.getElementById("master-boss-password");

    const expiryElement =
        document.getElementById("master-boss-password-expiry");

    if (!passwordElement) {
        return;
    }

    try {
        const { data, error } = await db
            .from("dungeon_boss_gate_password")
            .select("password_text, cycle_started_at, cycle_expires_at")
            .eq("id", "boss_room_1")
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data?.password_text) {
            passwordElement.textContent = "NON DISPONIBILE";

            if (expiryElement) {
                expiryElement.textContent =
                    "Nessuna password attiva trovata.";
            }

            return;
        }

        passwordElement.textContent =
            String(data.password_text);

        if (expiryElement) {
            const expiresAt =
                data.cycle_expires_at
                    ? new Date(data.cycle_expires_at)
                    : null;

            expiryElement.textContent =
                expiresAt &&
                !Number.isNaN(expiresAt.getTime())
                    ? "Valida fino alle " +
                      expiresAt.toLocaleTimeString(
                          "it-IT",
                          {
                              hour: "2-digit",
                              minute: "2-digit"
                          }
                      )
                    : "Password del ciclo attuale";
        }

    } catch (error) {
        console.error(
            "Errore caricamento password Boss Master:",
            error
        );

        passwordElement.textContent = "ERRORE";

        if (expiryElement) {
            expiryElement.textContent =
                "Impossibile leggere la password attuale.";
        }
    }
}


// ============================================================
// BOX DITO DI SCIMMIA
// ============================================================

function renderMasterMonkeyFingerStatus() {
    const statusElement =
        document.getElementById(
            "master-monkey-finger-status"
        );

    const ownerElement =
        document.getElementById(
            "master-monkey-finger-owner"
        );

    const panel =
        document.querySelector(
            ".master-monkey-finger-panel"
        );

    if (!statusElement) {
        return;
    }

    const owners =
        Array.from(masterMonkeyFingerOwners)
            .map(characterId => {
                const player =
                    allMasterPlayers.get(characterId);

                return player?.nome || null;
            })
            .filter(Boolean);

    const available =
        owners.length === 0;

    statusElement.textContent =
        available
            ? "DISPONIBILE"
            : "IN POSSESSO";

    if (ownerElement) {
        ownerElement.textContent =
            available
                ? "Nessun PG lo possiede."
                : owners.length === 1
                    ? `In mano a: ${owners[0]}`
                    : `In mano a: ${owners.join(", ")}`;
    }

    if (panel) {
        panel.classList.toggle(
            "is-available",
            available
        );

        panel.classList.toggle(
            "is-owned",
            !available
        );
    }
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
            loadActiveMasterCombats(),
            loadMasterBossPassword()
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

        const score = document.createElement("span");
        score.className = "master-player-score";
        score.textContent = `SCORE ${Number(player.score) || 0}`;

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

        if (player.has_monkey_finger) {
            const fingerBadge = document.createElement("span");
            fingerBadge.className = "master-status-badge monkey-finger";
            fingerBadge.textContent = "☝ DITO DI SCIMMIA";
            statusRow.appendChild(fingerBadge);
        }

        info.append(name, position, score, statusRow);

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
        const isBoss = combatEvent.type === "boss";

        marker.className =
            "master-event-marker is-combat" +
            (isBoss ? " is-boss" : "");

        marker.dataset.eventId = combatEvent.id;
        marker.dataset.eventType = isBoss ? "boss" : "combat";
        marker.textContent = isBoss ? "👹" : "⚔";

        const liveCombat = getActiveCombatForEncounter(combatEvent.encounter_id);

        if (liveCombat) {
            marker.classList.add("has-live-combat");
            marker.title =
                `${isBoss ? "BOSS IN CORSO" : "COMBATTIMENTO IN CORSO"}\n` +
                `${combatEvent.id} · ${combatEvent.encounter_id}\n` +
                `X ${combatEvent.x} • Y ${combatEvent.y}\n` +
                "Clicca per osservare";

            marker.addEventListener("click", event => {
                event.stopPropagation();
                openMasterCombat(liveCombat.id);
            });
        } else {
            marker.title =
                `${isBoss ? "GOBLIN BOSS" : "EVENTO COMBAT"}\n` +
                `${combatEvent.id} · ${combatEvent.encounter_id}\n` +
                `X ${combatEvent.x} • Y ${combatEvent.y}`;
        }

        placeMarker(combatEvent.x, combatEvent.y, marker);
    });

    MASTER_SPECIAL_EVENTS.forEach(specialEvent => {
        const marker = document.createElement("div");

        marker.className =
            `master-event-marker is-special is-${specialEvent.type}`;

        marker.dataset.eventId = specialEvent.id;
        marker.dataset.eventType = specialEvent.type;

        marker.textContent =
            specialEvent.type === "pvp"
                ? "⚔"
                : "🐒";

        marker.title =
            `${specialEvent.label}\n` +
            `X ${specialEvent.x} • Y ${specialEvent.y}`;

        placeMarker(
            specialEvent.x,
            specialEvent.y,
            marker
        );
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
        active_combat_id: cached?.active_combat_id || data.active_combat_id || null,
        score: cached?.score ?? masterPlayerScores.get(characterId) ?? 0,
        has_monkey_finger:
            cached?.has_monkey_finger ??
            masterMonkeyFingerOwners.has(characterId)
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
    setText("master-character-score", Number(characterData.score) || 0);
    setText(
        "master-character-monkey-finger",
        characterData.has_monkey_finger ? "☝ SÌ" : "NO"
    );
    setText("master-character-online-status", characterData.online ? "● ONLINE" : "○ OFFLINE");

    const fingerBox = document
        .getElementById("master-character-monkey-finger")
        ?.closest(".master-runtime-box");

    if (fingerBox) {
        fingerBox.classList.toggle(
            "has-monkey-finger",
            !!characterData.has_monkey_finger
        );
    }

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


// ============================================================
// DASHBOARD MASTER v9
// PIANO 1 / LIVELLO BASE + COOLDOWN BOSS / COMBAT BASE
// ============================================================

let masterViewFloor = "dungeon";
let masterFloorSwitchInProgress = false;

const MASTER_BASE_CHANNEL_NAME =
    "palazzo-eterno-base";

const MASTER_BASE_CHAT_FLOOR_ID =
    "base";

const MASTER_DUNGEON_CHAT_FLOOR_ID =
    "floor_1";

const MASTER_BASE_MAP_COLUMNS =
    27;

const MASTER_BASE_MAP_ROWS =
    36;

const MASTER_BASE_COMBAT_EVENTS = [
    {
        id: "BASE_C1_LEFT",
        x: 8,
        y: 7,
        encounter_id: "base_combat_left",
        state_key: "left",
        label: "COMBAT BASE SINISTRO"
    },
    {
        id: "BASE_C1_RIGHT",
        x: 10,
        y: 7,
        encounter_id: "base_combat_right",
        state_key: "right",
        label: "COMBAT BASE DESTRO"
    }
];

let masterBossState = {
    available: true,
    cooldown_until: null
};

let masterBaseCombatStates = {
    left: {
        available: true,
        cooldown_until: null,
        remaining_seconds: 0
    },
    right: {
        available: true,
        cooldown_until: null,
        remaining_seconds: 0
    }
};

let masterCooldownCountdownTimer = null;


// ============================================================
// CONFIGURAZIONE PIANO
// ============================================================

function getMasterFloorConfig() {

    if (masterViewFloor === "base") {

        return {
            key: "base",
            title: "PALAZZO ETERNO - LIVELLO BASE",
            columns: MASTER_BASE_MAP_COLUMNS,
            rows: MASTER_BASE_MAP_ROWS,
            image: "base/immagini/base_map.png",
            imageAlt: "Mappa completa del Livello Base",
            channel: MASTER_BASE_CHANNEL_NAME,
            chatFloorId: MASTER_BASE_CHAT_FLOOR_ID,
            chatEvent: "base-chat",
            message: "Modalità Master connessa al Livello Base."
        };

    }


    return {
        key: "dungeon",
        title: "PALAZZO ETERNO - PIANO 1",
        columns: MAP_COLUMNS,
        rows: MAP_ROWS,
        image: "immagini/dungeon-test.png?v=2",
        imageAlt: "Mappa completa del dungeon",
        channel: DUNGEON_CHANNEL_NAME,
        chatFloorId: MASTER_DUNGEON_CHAT_FLOOR_ID,
        chatEvent: "floor-chat",
        message: "Modalità Master connessa al Piano 1."
    };

}


function getMasterMapColumns() {

    return getMasterFloorConfig().columns;

}


function getMasterMapRows() {

    return getMasterFloorConfig().rows;

}


function getMasterChatFloorId() {

    return getMasterFloorConfig().chatFloorId;

}


function getMasterChatBroadcastEvent() {

    return getMasterFloorConfig().chatEvent;

}


// ============================================================
// SELETTORE PIANO
// ============================================================

function setupMasterFloorSelector() {

    document
        .querySelectorAll(
            "[data-master-floor]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const floor =
                            button.dataset.masterFloor;


                        if (
                            !floor ||
                            floor === masterViewFloor ||
                            masterFloorSwitchInProgress
                        ) {

                            return;

                        }


                        await switchMasterFloor(
                            floor
                        );

                    }
                );

            }
        );


    updateMasterFloorInterface();

}


async function switchMasterFloor(
    floor
) {

    if (
        ![
            "dungeon",
            "base"
        ].includes(floor)
    ) {

        return;

    }


    masterFloorSwitchInProgress =
        true;


    try {

        setMasterChatConnected(
            false
        );


        realtimeReady =
            false;


        if (dungeonChannel) {

            try {

                await db.removeChannel(
                    dungeonChannel
                );

            } catch (error) {

                console.warn(
                    "Errore chiusura canale Master:",
                    error
                );

            }


            dungeonChannel =
                null;

        }


        masterViewFloor =
            floor;


        onlinePlayers.clear();


        allMasterPlayers.clear();


        playerTokens.forEach(
            token => token?.remove()
        );


        playerTokens.clear();


        renderedMasterChatMessageIds.clear();


        const chat =
            document.getElementById(
                "master-chat-messages"
            );


        if (chat) {

            chat.innerHTML =
                `
                    <div class="master-chat-empty">
                        Caricamento messaggi...
                    </div>
                `;

        }


        updateMasterFloorInterface();


        await loadActiveMasterCombats();


        await Promise.all([
            loadMasterCooldownStates(),
            loadAllMasterCharacters(),
            loadMasterChatHistory()
        ]);


        renderMasterEvents();


        await setupRealtime();


    } catch (error) {

        console.error(
            "Errore cambio piano Master:",
            error
        );


        showMessage(
            "Impossibile cambiare piano."
        );


    } finally {

        masterFloorSwitchInProgress =
            false;

    }

}


function updateMasterFloorInterface() {

    const config =
        getMasterFloorConfig();


    const title =
        document.getElementById(
            "master-floor-title"
        );


    if (title) {

        title.textContent =
            config.title;

    }


    document
        .querySelectorAll(
            "[data-master-floor]"
        )
        .forEach(
            button => {

                const active =
                    button.dataset.masterFloor ===
                    masterViewFloor;


                button.classList.toggle(
                    "is-active",
                    active
                );


                button.setAttribute(
                    "aria-pressed",
                    active
                        ? "true"
                        : "false"
                );

            }
        );


    const image =
        document.getElementById(
            "master-map-image"
        );


    if (image) {

        image.src =
            config.image;

        image.alt =
            config.imageAlt;

    }


    const map =
        document.getElementById(
            "master-map"
        );


    map?.classList.toggle(
        "is-base-view",
        masterViewFloor ===
            "base"
    );


    const dungeonOnlyLegendIds = [
        "master-legend-boss",
        "master-legend-pvp",
        "master-legend-vendor",
        "master-legend-trap",
        "master-legend-event"
    ];


    dungeonOnlyLegendIds.forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.hidden =
                    masterViewFloor ===
                    "base";

            }

        }
    );


    showMessage(
        masterViewFloor === "base"
            ? "Visualizzazione Livello Base."
            : "Visualizzazione Piano 1."
    );

}


// ============================================================
// COOLDOWN
// ============================================================

async function loadMasterCooldownStates() {

    const jobs = [];


    jobs.push(
        (
            async () => {

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


                    masterBossState = {
                        available:
                            data?.available !==
                            false,

                        cooldown_until:
                            data?.cooldown_until ||
                            null
                    };


                } catch (error) {

                    console.error(
                        "Errore cooldown Boss Master:",
                        error
                    );

                }

            }
        )()
    );


    jobs.push(
        (
            async () => {

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


                    masterBaseCombatStates = {
                        left: {
                            available:
                                data?.left?.available !==
                                false,

                            cooldown_until:
                                data?.left?.cooldown_until ||
                                null,

                            remaining_seconds:
                                Number(
                                    data?.left?.remaining_seconds
                                ) || 0
                        },

                        right: {
                            available:
                                data?.right?.available !==
                                false,

                            cooldown_until:
                                data?.right?.cooldown_until ||
                                null,

                            remaining_seconds:
                                Number(
                                    data?.right?.remaining_seconds
                                ) || 0
                        }
                    };


                } catch (error) {

                    console.error(
                        "Errore cooldown combat Base Master:",
                        error
                    );

                }

            }
        )()
    );


    await Promise.all(
        jobs
    );


    renderMasterEvents();


    startMasterCooldownCountdown();

}


function startMasterCooldownCountdown() {

    if (
        masterCooldownCountdownTimer
    ) {

        clearInterval(
            masterCooldownCountdownTimer
        );

    }


    masterCooldownCountdownTimer =
        setInterval(
            () => {

                updateMasterCombatCooldownCountdowns();

            },
            1000
        );

}


function formatMasterCooldown(
    cooldownUntil
) {

    if (!cooldownUntil) {

        return "";

    }


    const end =
        new Date(
            cooldownUntil
        ).getTime();


    if (
        !Number.isFinite(
            end
        )
    ) {

        return "";

    }


    const seconds =
        Math.ceil(
            Math.max(
                0,
                end -
                Date.now()
            ) /
            1000
        );


    if (
        seconds <=
        0
    ) {

        return "";

    }


    const hours =
        Math.floor(
            seconds /
            3600
        );


    const minutes =
        Math.floor(
            (
                seconds %
                3600
            ) /
            60
        );


    const remainingSeconds =
        seconds %
        60;


    return hours >
        0

        ? `${hours}:${String(
            minutes
        ).padStart(
            2,
            "0"
        )}:${String(
            remainingSeconds
        ).padStart(
            2,
            "0"
        )}`

        : `${minutes}:${String(
            remainingSeconds
        ).padStart(
            2,
            "0"
        )}`;

}


function updateMasterCombatCooldownCountdowns() {

    document
        .querySelectorAll(
            ".master-event-marker[data-cooldown-until]"
        )
        .forEach(
            marker => {

                const countdown =
                    marker.querySelector(
                        ".master-event-countdown"
                    );


                const value =
                    formatMasterCooldown(
                        marker.dataset.cooldownUntil
                    );


                if (countdown) {

                    countdown.textContent =
                        value;

                }


                if (!value) {

                    marker.classList.remove(
                        "is-cooldown"
                    );


                    marker.classList.add(
                        "is-available"
                    );

                }

            }
        );

}


// ============================================================
// CHAT DINAMICA
// ============================================================

async function loadMasterChatHistory() {

    const container =
        document.getElementById(
            "master-chat-messages"
        );


    if (!container) {

        return;

    }


    try {

        const {
            data,
            error
        } =
            await db
                .from(
                    "dungeon_chat_messages"
                )
                .select(`
                    id,
                    character_id,
                    user_id,
                    sender_name,
                    message_text,
                    created_at
                `)
                .eq(
                    "floor_id",
                    getMasterChatFloorId()
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                )
                .limit(
                    MASTER_CHAT_HISTORY_LIMIT
                );


        if (error) {

            throw error;

        }


        renderedMasterChatMessageIds.clear();


        container.innerHTML =
            "";


        const rows =
            Array.isArray(data)
                ? [...data]
                : [];


        if (
            rows.length ===
            0
        ) {

            container.innerHTML =
                `
                    <div class="master-chat-empty">
                        Nessun messaggio ancora.
                    </div>
                `;


            return;

        }


        rows.forEach(
            row => {

                appendMasterChatMessage(
                    {
                        id:
                            row.id,

                        character_id:
                            row.character_id,

                        master_user_id:
                            row.character_id === null
                                ? row.user_id
                                : null,

                        name:
                            row.sender_name,

                        text:
                            row.message_text,

                        timestamp:
                            row.created_at,

                        sent_at:
                            row.created_at
                    },
                    row.sender_name ===
                        "MASTER"
                );

            }
        );


    } catch (error) {

        console.error(
            "Errore storico chat Master:",
            error
        );

    }

}


async function sendMasterChatMessage() {

    const input =
        document.getElementById(
            "master-chat-input"
        );


    const feedback =
        document.getElementById(
            "master-chat-feedback"
        );


    if (
        !input ||
        !currentUser
    ) {

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


    const originalValue =
        input.value;


    input.value =
        "";


    if (feedback) {

        feedback.textContent =
            "";

    }


    try {

        const {
            data: savedMessage,
            error
        } =
            await db
                .from(
                    "dungeon_chat_messages"
                )
                .insert({
                    floor_id:
                        getMasterChatFloorId(),

                    character_id:
                        null,

                    user_id:
                        currentUser.id,

                    sender_name:
                        "MASTER",

                    message_text:
                        text
                })
                .select(`
                    id,
                    character_id,
                    user_id,
                    sender_name,
                    message_text,
                    created_at
                `)
                .single();


        if (error) {

            throw error;

        }


        const payload = {
            id:
                savedMessage.id,

            character_id:
                null,

            master_user_id:
                savedMessage.user_id ||
                currentUser.id,

            name:
                "MASTER",

            nome:
                "MASTER",

            text:
                savedMessage.message_text ||
                text,

            timestamp:
                savedMessage.created_at,

            sent_at:
                savedMessage.created_at
        };


        appendMasterChatMessage(
            payload,
            true
        );


        await dungeonChannel.send({
            type:
                "broadcast",

            event:
                getMasterChatBroadcastEvent(),

            payload
        });


    } catch (error) {

        console.error(
            "Errore invio chat Master:",
            error
        );


        input.value =
            originalValue;


        if (feedback) {

            feedback.textContent =
                "Messaggio non inviato.";

        }

    }

}


// ============================================================
// REALTIME DINAMICO
// ============================================================

async function setupRealtime() {

    const config =
        getMasterFloorConfig();


    showMessage(
        masterViewFloor === "base"
            ? "Connessione al Livello Base..."
            : "Connessione al dungeon..."
    );


    dungeonChannel =
        db.channel(
            config.channel
        );


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


    dungeonChannel.on(
        "broadcast",
        {
            event:
                config.chatEvent
        },
        message => {

            const data =
                message.payload;


            if (!data) {

                return;

            }


            appendMasterChatMessage(
                data,
                data.name === "MASTER" ||
                data.nome === "MASTER" ||
                data.sender_name === "MASTER"
            );

        }
    );


    // Il Piano 1 invia player-move/player-state.
    // La Base mantiene comunque Presence aggiornata ad ogni passo.
    if (
        masterViewFloor ===
        "dungeon"
    ) {

        [
            "player-move",
            "player-state"
        ].forEach(
            eventName => {

                dungeonChannel.on(
                    "broadcast",
                    {
                        event:
                            eventName
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

            }
        );

    }


    await new Promise(
        resolve => {

            dungeonChannel.subscribe(
                status => {

                    console.log(
                        `Realtime Master ${masterViewFloor}:`,
                        status
                    );


                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {

                        realtimeReady =
                            true;


                        setMasterChatConnected(
                            true
                        );


                        syncPresencePlayers();


                        showMessage(
                            config.message
                        );


                        resolve();

                    }


                    if (
                        status === "CHANNEL_ERROR" ||
                        status === "TIMED_OUT" ||
                        status === "CLOSED"
                    ) {

                        realtimeReady =
                            false;


                        setMasterChatConnected(
                            false
                        );


                        resolve();

                    }

                }
            );

        }
    );

}


// ============================================================
// PRESENCE DINAMICA
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
                        !presence?.character_id
                    ) {

                        return;

                    }


                    currentIds.add(
                        presence.character_id
                    );


                    onlinePlayers.set(
                        presence.character_id,
                        {
                            ...presence,

                            nome:
                                presence.nome ||
                                presence.name ||
                                "Avventuriero"
                        }
                    );


                    const existing =
                        allMasterPlayers.get(
                            presence.character_id
                        );


                    if (existing) {

                        allMasterPlayers.set(
                            presence.character_id,
                            {
                                ...existing,

                                nome:
                                    presence.nome ||
                                    presence.name ||
                                    existing.nome,

                                token:
                                    presence.token ||
                                    existing.token,

                                x:
                                    Number.isFinite(
                                        Number(
                                            presence.x
                                        )
                                    )
                                        ? Number(
                                            presence.x
                                        )
                                        : existing.x,

                                y:
                                    Number.isFinite(
                                        Number(
                                            presence.y
                                        )
                                    )
                                        ? Number(
                                            presence.y
                                        )
                                        : existing.y,

                                current_hp:
                                    presence.current_hp !==
                                    undefined
                                        ? presence.current_hp
                                        : existing.current_hp,

                                active_combat_id:
                                    presence.active_combat_id !==
                                    undefined
                                        ? presence.active_combat_id
                                        : existing.active_combat_id,

                                online:
                                    true
                            }
                        );

                    }

                }
            );

        }
    );


    for (
        const characterId
        of Array.from(
            onlinePlayers.keys()
        )
    ) {

        if (
            !currentIds.has(
                characterId
            )
        ) {

            onlinePlayers.delete(
                characterId
            );


            const existing =
                allMasterPlayers.get(
                    characterId
                );


            if (existing) {

                allMasterPlayers.set(
                    characterId,
                    {
                        ...existing,
                        online:
                            false
                    }
                );

            }

        }

    }


    renderAllTokens();

    updatePlayerList();

    updateOnlineCounter();

    renderActiveMasterCombats();

}


// ============================================================
// PG DEL PIANO SELEZIONATO
// ============================================================

function isMasterCharacterOnSelectedFloor(
    characterData
) {

    const location =
        characterData?.current_location ||
        "dungeon";


    if (
        location ===
        "base"
    ) {

        return masterViewFloor ===
            "base";

    }


    if (
        location ===
        "combat" &&
        characterData?.active_combat_id
    ) {

        const session =
            activeMasterCombats.get(
                characterData.active_combat_id
            );


        const isBaseCombat =
            String(
                session?.encounter_id ||
                ""
            ).startsWith(
                "base_"
            );


        return masterViewFloor ===
            (
                isBaseCombat
                    ? "base"
                    : "dungeon"
            );

    }


    // vendor/PvP/dungeon appartengono al Piano 1.
    return masterViewFloor ===
        "dungeon";

}


async function loadAllMasterCharacters() {

    const {
        data,
        error
    } =
        await db
            .from(
                "characters"
            )
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
                base_x,
                base_y,
                current_location,
                active_combat_id
            `);


    if (error) {

        console.error(
            "Errore caricamento PG Master:",
            error
        );


        return;

    }


    const rows =
        (
            data ||
            []
        ).filter(
            isMasterCharacterOnSelectedFloor
        );


    const characterIds =
        rows.map(
            characterData =>
                characterData.id
        );


    await loadMasterCharacterExtras(
        characterIds
    );


    const currentIds =
        new Set();


    allMasterPlayers.clear();


    rows.forEach(
        characterData => {

            currentIds.add(
                characterData.id
            );


            const presence =
                onlinePlayers.get(
                    characterData.id
                );


            const storedX =
                masterViewFloor === "base"
                    ? Number(
                        characterData.base_x
                    )
                    : Number(
                        characterData.dungeon_x
                    );


            const storedY =
                masterViewFloor === "base"
                    ? Number(
                        characterData.base_y
                    )
                    : Number(
                        characterData.dungeon_y
                    );


            const x =
                presence &&
                Number.isFinite(
                    Number(
                        presence.x
                    )
                )

                    ? Number(
                        presence.x
                    )

                    : storedX;


            const y =
                presence &&
                Number.isFinite(
                    Number(
                        presence.y
                    )
                )

                    ? Number(
                        presence.y
                    )

                    : storedY;


            allMasterPlayers.set(
                characterData.id,
                {
                    ...characterData,

                    character_id:
                        characterData.id,

                    nome:
                        presence?.nome ||
                        presence?.name ||
                        characterData.nome ||
                        "Avventuriero",

                    token:
                        presence?.token ||
                        characterData.token ||
                        "token_1.png",

                    x:
                        Number.isFinite(
                            x
                        )
                            ? x
                            : 0,

                    y:
                        Number.isFinite(
                            y
                        )
                            ? y
                            : 0,

                    current_hp:
                        presence?.current_hp !==
                        undefined
                            ? presence.current_hp
                            : characterData.current_hp,

                    active_combat_id:
                        presence?.active_combat_id !==
                        undefined
                            ? presence.active_combat_id
                            : characterData.active_combat_id ||
                              null,

                    score:
                        masterPlayerScores.get(
                            characterData.id
                        ) ??
                        0,

                    has_monkey_finger:
                        masterMonkeyFingerOwners.has(
                            characterData.id
                        ),

                    online:
                        onlinePlayers.has(
                            characterData.id
                        )
                }
            );

        }
    );


    for (
        const [
            characterId,
            token
        ]
        of Array.from(
            playerTokens.entries()
        )
    ) {

        if (
            !currentIds.has(
                characterId
            )
        ) {

            token?.remove();

            playerTokens.delete(
                characterId
            );

        }

    }


    renderAllTokens();

    updatePlayerList();

    updateOnlineCounter();

    renderMasterMonkeyFingerStatus();

}


// ============================================================
// TOKEN CON GRIGLIA DINAMICA
// ============================================================

function renderPlayerToken(
    characterId
) {

    const player =
        allMasterPlayers.get(
            characterId
        );


    if (!player) {

        const old =
            playerTokens.get(
                characterId
            );


        old?.remove();

        playerTokens.delete(
            characterId
        );


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
        mapRect.width <=
            0 ||
        mapRect.height <=
            0
    ) {

        return;

    }


    const cellWidth =
        mapRect.width /
        getMasterMapColumns();


    const cellHeight =
        mapRect.height /
        getMasterMapRows();


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
        (
            player.token ||
            "token_1.png"
        );


    token.alt =
        "Token di " +
        (
            player.nome ||
            "Avventuriero"
        );


    token.title =
        `${player.nome || "Avventuriero"}` +
        `${player.online ? " · ONLINE" : " · OFFLINE"}` +
        `${player.active_combat_id ? " · IN COMBATTIMENTO" : ""}`;


    token.classList.toggle(
        "is-online",
        !!player.online
    );


    token.classList.toggle(
        "is-offline",
        !player.online
    );


    token.classList.toggle(
        "is-in-combat",
        !!player.active_combat_id
    );


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


    const x =
        Number.isFinite(
            Number(
                player.x
            )
        )
            ? Number(
                player.x
            )
            : 0;


    const y =
        Number.isFinite(
            Number(
                player.y
            )
        )
            ? Number(
                player.y
            )
            : 0;


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


    token.style.left =
        `${offsetX + centerX - tokenSize / 2}px`;


    token.style.top =
        `${offsetY + centerY - tokenSize / 2}px`;

}


// ============================================================
// EVENTI MAPPA DINAMICI
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


    container
        .querySelectorAll(
            ".master-event-marker"
        )
        .forEach(
            marker =>
                marker.remove()
        );


    const mapRect =
        image.getBoundingClientRect();


    const containerRect =
        container.getBoundingClientRect();


    if (
        mapRect.width <=
            0 ||
        mapRect.height <=
            0
    ) {

        return;

    }


    const cellWidth =
        mapRect.width /
        getMasterMapColumns();


    const cellHeight =
        mapRect.height /
        getMasterMapRows();


    const offsetX =
        mapRect.left -
        containerRect.left;


    const offsetY =
        mapRect.top -
        containerRect.top;


    const placeMarker =
        (
            x,
            y,
            marker
        ) => {

            const markerSize =
                Math.min(
                    cellWidth,
                    cellHeight
                ) *
                0.72;


            marker.style.width =
                `${markerSize}px`;


            marker.style.height =
                `${markerSize}px`;


            marker.style.left =
                `${
                    offsetX +
                    (
                        x +
                        0.5
                    ) *
                    cellWidth -
                    markerSize /
                    2
                }px`;


            marker.style.top =
                `${
                    offsetY +
                    (
                        y +
                        0.5
                    ) *
                    cellHeight -
                    markerSize /
                    2
                }px`;


            container.appendChild(
                marker
            );

        };


    if (
        masterViewFloor ===
        "base"
    ) {

        MASTER_BASE_COMBAT_EVENTS.forEach(
            combatEvent => {

                const state =
                    masterBaseCombatStates[
                        combatEvent.state_key
                    ] ||
                    {
                        available:
                            true,
                        cooldown_until:
                            null
                    };


                const marker =
                    document.createElement(
                        "div"
                    );


                marker.className =
                    "master-event-marker is-base-combat";


                marker.dataset.eventId =
                    combatEvent.id;


                marker.textContent =
                    "⚔";


                const activeCombat =
                    getActiveCombatForEncounter(
                        combatEvent.encounter_id
                    );


                if (activeCombat) {

                    marker.classList.add(
                        "has-live-combat"
                    );


                    marker.title =
                        `${combatEvent.label}\n` +
                        `X ${combatEvent.x} • Y ${combatEvent.y}\n` +
                        "COMBATTIMENTO IN CORSO\nClicca per osservare";


                    marker.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();

                            openMasterCombat(
                                activeCombat.id
                            );

                        }
                    );


                } else if (
                    state.available !==
                    false
                ) {

                    marker.classList.add(
                        "is-available"
                    );


                    marker.title =
                        `${combatEvent.label}\n` +
                        `X ${combatEvent.x} • Y ${combatEvent.y}\n` +
                        "DISPONIBILE";


                } else {

                    marker.classList.add(
                        "is-cooldown"
                    );


                    marker.dataset.cooldownUntil =
                        state.cooldown_until ||
                        "";


                    const countdown =
                        document.createElement(
                            "span"
                        );


                    countdown.className =
                        "master-event-countdown";


                    countdown.textContent =
                        formatMasterCooldown(
                            state.cooldown_until
                        );


                    marker.appendChild(
                        countdown
                    );


                    marker.title =
                        `${combatEvent.label}\n` +
                        `X ${combatEvent.x} • Y ${combatEvent.y}\n` +
                        "IN COOLDOWN";

                }


                placeMarker(
                    combatEvent.x,
                    combatEvent.y,
                    marker
                );

            }
        );


        return;

    }


    // --------------------------------------------------------
    // EVENTI PIANO 1
    // --------------------------------------------------------

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

                marker.classList.add(
                    "is-trap"
                );


                const icon =
                    document.createElement(
                        "span"
                    );


                icon.className =
                    "master-event-icon";


                icon.textContent =
                    "⚠";


                const countdown =
                    document.createElement(
                        "span"
                    );


                countdown.className =
                    "master-event-countdown";


                marker.append(
                    icon,
                    countdown
                );


                updateSingleMasterTrapMarker(
                    marker,
                    dungeonEvent,
                    x,
                    y
                );

            }


            placeMarker(
                x,
                y,
                marker
            );

        }
    );


    MASTER_COMBAT_EVENTS.forEach(
        combatEvent => {

            const marker =
                document.createElement(
                    "div"
                );


            const isBoss =
                combatEvent.type ===
                "boss";


            marker.className =
                "master-event-marker is-combat" +
                (
                    isBoss
                        ? " is-boss"
                        : ""
                );


            marker.dataset.eventId =
                combatEvent.id;


            marker.dataset.eventType =
                isBoss
                    ? "boss"
                    : "combat";


            marker.textContent =
                isBoss
                    ? "👹"
                    : "⚔";


            const liveCombat =
                getActiveCombatForEncounter(
                    combatEvent.encounter_id
                );


            if (liveCombat) {

                marker.classList.add(
                    "has-live-combat"
                );


                marker.title =
                    `${
                        isBoss
                            ? "BOSS IN CORSO"
                            : "COMBATTIMENTO IN CORSO"
                    }\n` +
                    `${combatEvent.id} · ${combatEvent.encounter_id}\n` +
                    `X ${combatEvent.x} • Y ${combatEvent.y}\n` +
                    "Clicca per osservare";


                marker.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();


                        openMasterCombat(
                            liveCombat.id
                        );

                    }
                );


            } else if (
                isBoss &&
                masterBossState.available ===
                false
            ) {

                marker.classList.add(
                    "is-cooldown"
                );


                marker.dataset.cooldownUntil =
                    masterBossState.cooldown_until ||
                    "";


                const countdown =
                    document.createElement(
                        "span"
                    );


                countdown.className =
                    "master-event-countdown";


                countdown.textContent =
                    formatMasterCooldown(
                        masterBossState.cooldown_until
                    );


                marker.appendChild(
                    countdown
                );


                marker.title =
                    `GOBLIN BOSS IN COOLDOWN\n` +
                    `X ${combatEvent.x} • Y ${combatEvent.y}`;


            } else {

                marker.classList.add(
                    "is-available"
                );


                marker.title =
                    `${
                        isBoss
                            ? "GOBLIN BOSS"
                            : "EVENTO COMBAT"
                    }\n` +
                    `${combatEvent.id} · ${combatEvent.encounter_id}\n` +
                    `X ${combatEvent.x} • Y ${combatEvent.y}`;

            }


            placeMarker(
                combatEvent.x,
                combatEvent.y,
                marker
            );

        }
    );


    MASTER_SPECIAL_EVENTS.forEach(
        specialEvent => {

            const marker =
                document.createElement(
                    "div"
                );


            marker.className =
                `master-event-marker is-special is-${specialEvent.type}`;


            marker.dataset.eventId =
                specialEvent.id;


            marker.dataset.eventType =
                specialEvent.type;


            marker.textContent =
                specialEvent.type ===
                "pvp"
                    ? "⚔"
                    : "🐒";


            marker.title =
                `${specialEvent.label}\n` +
                `X ${specialEvent.x} • Y ${specialEvent.y}`;


            placeMarker(
                specialEvent.x,
                specialEvent.y,
                marker
            );

        }
    );

}


// ============================================================
// SCHEDA PG: COORDINATE DEL PIANO SELEZIONATO
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
                base_x,
                base_y,
                current_location,
                active_combat_id
            `)
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


    const cached =
        allMasterPlayers.get(
            characterId
        );


    fillCharacterSheet({
        ...data,

        online:
            !!cached?.online,

        active_combat_id:
            cached?.active_combat_id ||
            data.active_combat_id ||
            null,

        score:
            cached?.score ??
            masterPlayerScores.get(
                characterId
            ) ??
            0,

        has_monkey_finger:
            cached?.has_monkey_finger ??
            masterMonkeyFingerOwners.has(
                characterId
            ),

        master_display_x:
            cached?.x ??
            (
                masterViewFloor === "base"
                    ? data.base_x
                    : data.dungeon_x
            ),

        master_display_y:
            cached?.y ??
            (
                masterViewFloor === "base"
                    ? data.base_y
                    : data.dungeon_y
            )
    });


    modal.hidden =
        false;


    document.body.style.overflow =
        "hidden";


    showMessage(
        ""
    );

}


function fillCharacterSheet(
    characterData
) {

    const forza =
        getStat(
            characterData.forza
        );


    const resistenza =
        getStat(
            characterData.resistenza
        );


    const costituzione =
        getStat(
            characterData.costituzione
        );


    const intelligenza =
        getStat(
            characterData.intelligenza
        );


    const destrezza =
        getStat(
            characterData.destrezza
        );


    const fortuna =
        getStat(
            characterData.fortuna
        );


    setText(
        "master-character-name",
        characterData.nome ||
        "Avventuriero"
    );


    setText(
        "master-character-level",
        "Livello " +
        (
            Number(
                characterData.livello
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
                characterData.token ||
                "token_1.png"
            );


        token.alt =
            "Token di " +
            (
                characterData.nome ||
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
            resistenza /
            2
        );


    const life =
        Math.ceil(
            5 *
            costituzione /
            2
        );


    const mana =
        Math.ceil(
            5 *
            intelligenza /
            2
        );


    const movement =
        Math.ceil(
            4 +
            destrezza /
            2
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


    const currentHp =
        characterData.current_hp === null ||
        characterData.current_hp === undefined

            ? life

            : Number(
                characterData.current_hp
            );


    const currentPm =
        characterData.current_pm === null ||
        characterData.current_pm === undefined

            ? mana

            : Number(
                characterData.current_pm
            );


    setText(
        "master-character-current-hp",
        `${currentHp} / ${life}`
    );


    setText(
        "master-character-current-pm",
        `${currentPm} / ${mana}`
    );


    setText(
        "master-character-score",
        Number(
            characterData.score
        ) ||
        0
    );


    setText(
        "master-character-monkey-finger",
        characterData.has_monkey_finger
            ? "☝ SÌ"
            : "NO"
    );


    setText(
        "master-character-online-status",
        characterData.online
            ? "● ONLINE"
            : "○ OFFLINE"
    );


    const fingerBox =
        document
            .getElementById(
                "master-character-monkey-finger"
            )
            ?.closest(
                ".master-runtime-box"
            );


    if (fingerBox) {

        fingerBox.classList.toggle(
            "has-monkey-finger",
            !!characterData.has_monkey_finger
        );

    }


    setText(
        "master-character-position",
        `X ${
            Number(
                characterData.master_display_x
            ) ||
            0
        } • Y ${
            Number(
                characterData.master_display_y
            ) ||
            0
        }`
    );


    const combatBox =
        document.getElementById(
            "master-character-combat-box"
        );


    const observeButton =
        document.getElementById(
            "master-character-observe-combat"
        );


    if (
        characterData.active_combat_id
    ) {

        const session =
            activeMasterCombats.get(
                characterData.active_combat_id
            );


        setText(
            "master-character-combat-label",
            session?.encounter_id
                ? `${session.encounter_id} · Round ${Number(session.round_number) || 1}`
                : characterData.active_combat_id
        );


        if (combatBox) {

            combatBox.hidden =
                false;

        }


        if (observeButton) {

            observeButton.onclick =
                () =>
                    openMasterCombat(
                        characterData.active_combat_id
                    );

        }


    } else {

        if (combatBox) {

            combatBox.hidden =
                true;

        }


        if (observeButton) {

            observeButton.onclick =
                null;

        }

    }

}


// ============================================================
// REFRESH DASHBOARD DINAMICO
// ============================================================

function startMasterDashboardRefresh() {

    if (
        masterDashboardRefreshTimer
    ) {

        clearInterval(
            masterDashboardRefreshTimer
        );

    }


    masterDashboardRefreshTimer =
        setInterval(
            async () => {

                await loadActiveMasterCombats();


                await Promise.all([
                    loadAllMasterCharacters(),
                    loadMasterBossPassword(),
                    loadMasterCooldownStates()
                ]);

            },
            4000
        );

}


// ============================================================
// RIDIMENSIONAMENTO v9
// ============================================================

window.addEventListener(
    "resize",
    () => {

        renderAllTokens();

        renderMasterEvents();

    }
);


// ============================================================
// CLEANUP v9
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (
            masterCooldownCountdownTimer
        ) {

            clearInterval(
                masterCooldownCountdownTimer
            );


            masterCooldownCountdownTimer =
                null;

        }

    }
);


// ============================================================
// CENTRO DI CONTROLLO MASTER v12
// Bacheca + riepilogo operativo + servizi/vendor
// ============================================================

const MASTER_NOTICEBOARD_SECTIONS = ["novita", "upgrade", "avvisi"];
const MASTER_UNIQUE_ITEMS = [
    { item_id: "dito_scimmia", label: "Dito di Scimmia" }
];

let masterControlServices = [];
let masterControlUniqueState = [];

window.addEventListener("DOMContentLoaded", () => {
    setupMasterControlCenter();
});

function setupMasterControlCenter() {
    const modal = document.getElementById("master-control-center");
    const open = document.getElementById("master-control-center-button");
    const close = document.getElementById("master-control-center-close");
    const refresh = document.getElementById("master-control-refresh");
    const saveNoticeboard = document.getElementById("master-noticeboard-save");

    if (!modal || !open) return;

    const closeModal = () => {
        modal.hidden = true;
        document.body.style.overflow = "";
    };

    open.addEventListener("click", async () => {
        modal.hidden = false;
        document.body.style.overflow = "hidden";
        await loadMasterControlCenter();
    });

    close?.addEventListener("click", closeModal);
    modal.querySelectorAll("[data-close-control-center]").forEach(el => el.addEventListener("click", closeModal));
    refresh?.addEventListener("click", loadMasterControlCenter);
    saveNoticeboard?.addEventListener("click", saveMasterNoticeboard);

    document.querySelectorAll("[data-master-control-tab]").forEach(button => {
        button.addEventListener("click", () => setMasterControlTab(button.dataset.masterControlTab));
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !modal.hidden) closeModal();
    });
}

function setMasterControlTab(tab) {
    document.querySelectorAll("[data-master-control-tab]").forEach(button => {
        button.classList.toggle("is-active", button.dataset.masterControlTab === tab);
    });
    document.querySelectorAll("[data-master-control-pane]").forEach(pane => {
        pane.classList.toggle("is-active", pane.dataset.masterControlPane === tab);
    });
}

async function loadMasterControlCenter() {
    const button = document.getElementById("master-control-refresh");
    if (button) button.disabled = true;

    try {
        // Prima aggiorna le sorgenti già usate dalla dashboard.
        await loadActiveMasterCombats();
        await Promise.all([
            loadAllMasterCharacters(),
            loadMasterBossPassword(),
            loadMasterCooldownStates(),
            loadMasterTrapStates(),
            loadMasterControlServices(),
            loadMasterUniqueItems(),
            loadMasterNoticeboardEditor()
        ]);
        renderMasterControlOverview();
        renderMasterControlPlayers();
        renderMasterControlServices();
        renderMasterControlUniqueItems();
        renderMasterControlCombats();
        renderMasterControlCooldowns();
        syncMasterControlBossPassword();
    } catch (error) {
        console.error("Errore Centro di Controllo Master:", error);
    } finally {
        if (button) button.disabled = false;
    }
}

async function loadMasterControlServices() {
    const { data, error } = await db
        .from("base_services")
        .select("*")
        .order("display_name", { ascending: true });

    if (error) {
        console.error("Errore servizi Master:", error);
        masterControlServices = [];
        return;
    }
    masterControlServices = Array.isArray(data) ? data : [];
}

async function loadMasterUniqueItems() {
    const ids = MASTER_UNIQUE_ITEMS.map(item => item.item_id);
    const { data, error } = await db
        .from("character_inventory")
        .select("character_id, item_id, quantity")
        .in("item_id", ids);

    if (error) {
        console.error("Errore oggetti unici Master:", error);
        masterControlUniqueState = [];
        return;
    }

    masterControlUniqueState = MASTER_UNIQUE_ITEMS.map(definition => {
        const holdings = (data || []).filter(row =>
            row.item_id === definition.item_id && (Number(row.quantity) || 0) > 0
        );
        const owners = holdings.map(row => ({
            character_id: row.character_id,
            quantity: Number(row.quantity) || 0,
            name: allMasterPlayers.get(row.character_id)?.nome || row.character_id
        }));
        return { ...definition, available: owners.length === 0, owners };
    });
}

function renderMasterControlOverview() {
    const players = Array.from(allMasterPlayers.values());
    const online = players.filter(p => p.online).length;
    const combats = Array.from(activeMasterCombats.values());
    const uniqueOwned = masterControlUniqueState.filter(item => !item.available).length;

    setText("master-control-player-count", String(players.length));
    setText("master-control-player-detail", `${online} online · ${players.length - online} offline`);
    setText("master-control-combat-count", String(combats.length));
    setText("master-control-combat-detail", combats.length ? "Sessioni waiting / active" : "Nessun combattimento in corso");

    const bossCooldown = masterBossState.available === false;
    setText("master-control-boss-state", bossCooldown ? "COOLDOWN" : "DISPONIBILE");
    setText("master-control-boss-detail", bossCooldown ? (formatMasterCooldown(masterBossState.cooldown_until) || "Cooldown attivo") : "Goblin Boss affrontabile");

    setText("master-control-unique-count", `${uniqueOwned}/${MASTER_UNIQUE_ITEMS.length}`);
    setText("master-control-unique-detail", uniqueOwned ? "Oggetti attualmente posseduti" : "Tutti disponibili");
}

function renderMasterControlPlayers() {
    const container = document.getElementById("master-control-players");
    if (!container) return;
    const players = Array.from(allMasterPlayers.values()).sort((a,b) => String(a.nome||"").localeCompare(String(b.nome||""), "it"));
    container.innerHTML = "";
    if (!players.length) {
        container.innerHTML = '<div class="master-control-empty">Nessun personaggio nel piano selezionato.</div>';
        return;
    }
    players.forEach(player => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "master-control-row";
        const info = document.createElement("div");
        info.className = "master-control-row-main";
        const title = document.createElement("strong");
        title.textContent = player.nome || "Avventuriero";
        const meta = document.createElement("small");
        meta.textContent = `LV ${Number(player.livello)||1} · SCORE ${Number(player.score)||0} · X ${Number(player.x)||0} Y ${Number(player.y)||0}${player.active_combat_id ? " · COMBAT" : ""}`;
        const state = document.createElement("span");
        state.className = `master-control-state ${player.online ? "master-control-good" : ""}`;
        state.textContent = player.online ? "ONLINE" : "OFFLINE";
        info.append(title, meta); row.append(info, state);
        row.addEventListener("click", () => openCharacterSheet(player.character_id));
        container.appendChild(row);
    });
}

function renderMasterControlServices() {
    const container = document.getElementById("master-control-services");
    if (!container) return;
    container.innerHTML = "";
    if (!masterControlServices.length) {
        container.innerHTML = '<div class="master-control-empty">Nessun servizio trovato in base_services.</div>';
        return;
    }
    masterControlServices.forEach(service => {
        const row = document.createElement("div"); row.className = "master-control-row";
        const info = document.createElement("div"); info.className = "master-control-row-main";
        const title = document.createElement("strong"); title.textContent = service.display_name || service.service_key || "Servizio";
        const meta = document.createElement("small");
        const parts = [`LV ${Number(service.current_level)||1}`];
        if (service.maintenance_seconds != null) parts.push(`manutenzione ${service.maintenance_seconds}s`);
        if (service.construction_seconds != null) parts.push(`costruzione ${service.construction_seconds}s`);
        meta.textContent = parts.join(" · ");
        const state = document.createElement("span"); state.className = "master-control-state";
        state.textContent = String(service.status || "SCONOSCIUTO").toUpperCase();
        const normalized = String(service.status || "").toLowerCase();
        if (normalized === "active") state.classList.add("master-control-good");
        if (normalized === "building" || normalized === "maintenance") state.classList.add("master-control-warn");
        info.append(title, meta); row.append(info, state); container.appendChild(row);
    });
}

function renderMasterControlUniqueItems() {
    const container = document.getElementById("master-control-unique-items");
    if (!container) return;
    container.innerHTML = "";
    masterControlUniqueState.forEach(item => {
        const row = document.createElement("div"); row.className = "master-control-row";
        const info = document.createElement("div"); info.className = "master-control-row-main";
        const title = document.createElement("strong"); title.textContent = item.label;
        const meta = document.createElement("small");
        meta.textContent = item.available ? "Nessun personaggio lo possiede." : item.owners.map(owner => `${owner.name}${owner.quantity > 1 ? ` ×${owner.quantity}` : ""}`).join(", ");
        const state = document.createElement("span"); state.className = `master-control-state ${item.available ? "master-control-good" : "master-control-warn"}`;
        state.textContent = item.available ? "DISPONIBILE" : "IN POSSESSO";
        info.append(title, meta); row.append(info, state); container.appendChild(row);
    });
}

function renderMasterControlCombats() {
    const container = document.getElementById("master-control-combats");
    if (!container) return;
    const combats = Array.from(activeMasterCombats.values());
    container.innerHTML = "";
    if (!combats.length) { container.innerHTML = '<div class="master-control-empty">Nessun combattimento attivo.</div>'; return; }
    combats.forEach(combat => {
        const row = document.createElement("div"); row.className = "master-control-row";
        const info = document.createElement("div"); info.className = "master-control-row-main";
        const title = document.createElement("strong"); title.textContent = String(combat.encounter_id || "COMBAT").toUpperCase();
        const participants = Array.from(allMasterPlayers.values()).filter(p => p.active_combat_id === combat.id).map(p => p.nome);
        const meta = document.createElement("small"); meta.textContent = `${combat.status || "active"} · Round ${Number(combat.round_number)||1}${participants.length ? ` · ${participants.join(", ")}` : ""}`;
        const watch = document.createElement("button"); watch.type="button"; watch.className="button master-combat-watch"; watch.textContent="OSSERVA"; watch.addEventListener("click",()=>openMasterCombat(combat.id));
        info.append(title,meta); row.append(info,watch); container.appendChild(row);
    });
}

function renderMasterControlCooldowns() {
    const container = document.getElementById("master-control-cooldowns");
    if (!container) return;
    const items = [];
    items.push({ label:"Goblin Boss", available: masterBossState.available !== false, until: masterBossState.cooldown_until });
    for (const event of MASTER_BASE_COMBAT_EVENTS) {
        const state = masterBaseCombatStates[event.state_key] || {};
        items.push({ label:event.label, available: state.available !== false, until: state.cooldown_until });
    }
    Object.entries(MASTER_DUNGEON_EVENTS).forEach(([coords,event]) => {
        if (event.type !== "trap") return;
        const state = masterTrapStates.get(event.id);
        items.push({ label:`Trappola ${event.id} · ${coords}`, available: !isMasterTrapCooldownActive(state), until: state?.disabled_until });
    });
    container.innerHTML="";
    items.forEach(item=>{
        const row=document.createElement("div"); row.className="master-control-row";
        const info=document.createElement("div"); info.className="master-control-row-main";
        const title=document.createElement("strong"); title.textContent=item.label;
        const meta=document.createElement("small"); meta.textContent=item.available ? "Pronto / disponibile" : `Fine: ${formatMasterDateTime(item.until)}`;
        const state=document.createElement("span"); state.className=`master-control-state ${item.available ? "master-control-good" : "master-control-warn"}`;
        state.textContent=item.available ? "PRONTO" : (formatMasterCooldown(item.until)||"COOLDOWN");
        info.append(title,meta); row.append(info,state); container.appendChild(row);
    });
}

function syncMasterControlBossPassword() {
    const password = document.getElementById("master-boss-password")?.textContent || "-";
    const expiry = document.getElementById("master-boss-password-expiry")?.textContent || "";
    setText("master-control-boss-password", password);
    setText("master-control-boss-password-expiry", expiry);
}

function formatMasterDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("it-IT", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

async function loadMasterNoticeboardEditor() {
    const feedback = document.getElementById("master-noticeboard-feedback");
    const { data, error } = await db
        .from("noticeboard_entries")
        .select("id, section, content, sort_order, active")
        .eq("active", true)
        .order("sort_order", { ascending: true });

    if (error) {
        console.error("Errore caricamento bacheca Master:", error);
        if (feedback) feedback.textContent = "Bacheca non disponibile: esegui prima lo SQL incluso nel pacchetto.";
        return;
    }

    MASTER_NOTICEBOARD_SECTIONS.forEach(section => {
        const textarea = document.getElementById(`master-noticeboard-${section}`);
        if (!textarea) return;
        textarea.value = (data || []).filter(row => row.section === section).map(row => row.content).join("\n");
    });
    if (feedback) feedback.textContent = "";
}

async function saveMasterNoticeboard() {
    const button = document.getElementById("master-noticeboard-save");
    const feedback = document.getElementById("master-noticeboard-feedback");
    if (button) button.disabled = true;
    if (feedback) feedback.textContent = "Salvataggio...";

    try {
        const rows = [];
        MASTER_NOTICEBOARD_SECTIONS.forEach(section => {
            const value = document.getElementById(`master-noticeboard-${section}`)?.value || "";
            value.split(/\r?\n/).map(v => v.trim()).filter(Boolean).forEach((content, index) => {
                rows.push({ section, content, sort_order:index, active:true });
            });
        });

        const { error: deleteError } = await db.from("noticeboard_entries").delete().in("section", MASTER_NOTICEBOARD_SECTIONS);
        if (deleteError) throw deleteError;
        if (rows.length) {
            const { error: insertError } = await db.from("noticeboard_entries").insert(rows);
            if (insertError) throw insertError;
        }

        if (feedback) feedback.textContent = "Bacheca aggiornata. Le tre pagine leggeranno questi contenuti al prossimo caricamento.";
    } catch (error) {
        console.error("Errore salvataggio bacheca:", error);
        if (feedback) feedback.textContent = `Errore: ${error.message || "salvataggio non riuscito"}`;
    } finally {
        if (button) button.disabled = false;
    }
}
