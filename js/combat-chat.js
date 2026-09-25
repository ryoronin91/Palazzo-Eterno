// ============================================================
// PALAZZO ETERNO
// COMBAT-CHAT.JS
// CHAT REALTIME DEL COMBATTIMENTO
// ============================================================


let combatChatChannel =
    null;


let combatChatInitialized =
    false;


const combatChatMessages =
    new Map();


// ============================================================
// AVVIO CHAT
// ============================================================

async function setupCombatChat() {

    if (
        combatChatInitialized
    ) {

        return;

    }


    if (
        !combatId
    ) {

        return;

    }


    const container =
        document.getElementById(
            "combat-chat-messages"
        );


    const input =
        document.getElementById(
            "combat-chat-input"
        );


    const sendButton =
        document.getElementById(
            "combat-chat-send"
        );


    if (
        !container ||
        !input ||
        !sendButton
    ) {

        console.warn(
            "Elementi chat non trovati."
        );


        return;

    }


    combatChatInitialized =
        true;


    // ========================================================
    // CONFIGURAZIONE INPUT
    // ========================================================

    input.maxLength =
        500;


    sendButton.disabled =
        true;


    input.addEventListener(
        "input",
        () => {

            sendButton.disabled =
                input.value
                    .trim()
                    .length === 0;

        }
    );


    sendButton.addEventListener(
        "click",
        async () => {

            await sendCombatChatMessage();

        }
    );


    input.addEventListener(
        "keydown",
        async event => {

            if (
                event.key !==
                "Enter"
            ) {

                return;

            }


            if (
                event.shiftKey
            ) {

                return;

            }


            event.preventDefault();


            await sendCombatChatMessage();

        }
    );


    // ========================================================
    // CARICA MESSAGGI ESISTENTI
    // ========================================================

    await loadCombatChatMessages();


    // ========================================================
    // ATTIVA REALTIME
    // ========================================================

    subscribeCombatChat();


    console.log(
        "CHAT COMBAT ATTIVA"
    );

}


// ============================================================
// CARICA CRONOLOGIA
// ============================================================

async function loadCombatChatMessages() {

    const {
        data,
        error
    } =
        await db
            .from(
                "combat_chat_messages"
            )
            .select(`
                id,
                combat_id,
                character_id,
                sender_name,
                message,
                created_at
            `)
            .eq(
                "combat_id",
                combatId
            )
            .order(
                "created_at",
                {

                    ascending:
                        false

                }
            )
            .limit(
                100
            );


    if (
        error
    ) {

        console.error(
            "Errore caricamento chat:",
            error
        );


        return;

    }


    combatChatMessages.clear();


    (
        data ||
        []
    )

        .reverse()

        .forEach(
            message => {

                combatChatMessages.set(
                    message.id,
                    message
                );

            }
        );


    renderCombatChat();

}


// ============================================================
// INVIO MESSAGGIO
// ============================================================

async function sendCombatChatMessage() {

    const input =
        document.getElementById(
            "combat-chat-input"
        );


    const sendButton =
        document.getElementById(
            "combat-chat-send"
        );


    if (
        !input ||
        !sendButton
    ) {

        return;

    }


    const text =
        input.value
            .trim();


    if (
        !text
    ) {

        return;

    }


    if (
        text.length >
        500
    ) {

        return;

    }


    // ========================================================
    // IDENTITÀ DEL MITTENTE
    // ========================================================

    let characterId =
        null;


    let senderName =
        "Avventuriero";


    if (
        masterObserverMode
    ) {

        senderName =
            "MASTER";

    } else if (
        currentCharacter
    ) {

        characterId =
            currentCharacter.id;


        senderName =
            currentCharacter.nome ||
            "Avventuriero";

    }


    // ========================================================
    // BLOCCA TEMPORANEAMENTE INVIO
    // ========================================================

    sendButton.disabled =
        true;


    input.disabled =
        true;


    try {

        const {
            data,
            error
        } =
            await db
                .from(
                    "combat_chat_messages"
                )
                .insert({

                    combat_id:
                        combatId,

                    character_id:
                        characterId,

                    sender_name:
                        senderName,

                    message:
                        text

                })
                .select(`
                    id,
                    combat_id,
                    character_id,
                    sender_name,
                    message,
                    created_at
                `)
                .single();


        if (
            error
        ) {

            throw error;

        }


        // ====================================================
        // MOSTRA SUBITO IL MESSAGGIO
        //
        // Realtime potrebbe arrivare poco dopo.
        // La Map evita duplicati.
        // ====================================================

        if (
            data
        ) {

            combatChatMessages.set(
                data.id,
                data
            );


            renderCombatChat();

        }


        input.value =
            "";


    } catch (
        error
    ) {

        console.error(
            "Errore invio chat:",
            error
        );


    } finally {

        input.disabled =
            false;


        sendButton.disabled =
            input.value
                .trim()
                .length === 0;


        input.focus();

    }

}


// ============================================================
// REALTIME
// ============================================================

function subscribeCombatChat() {

    if (
        combatChatChannel
    ) {

        return;

    }


    combatChatChannel =
        db.channel(
            `combat-chat-${combatId}`
        );


    combatChatChannel

        .on(
            "postgres_changes",
            {

                event:
                    "INSERT",

                schema:
                    "public",

                table:
                    "combat_chat_messages",

                filter:
                    `combat_id=eq.${combatId}`

            },
            payload => {

                const message =
                    payload.new;


                if (
                    !message ||
                    !message.id
                ) {

                    return;

                }


                combatChatMessages.set(
                    message.id,
                    message
                );


                renderCombatChat();

            }
        )

        .subscribe(
            status => {

                console.log(
                    "Realtime chat:",
                    status
                );

            }
        );

}


// ============================================================
// RENDER CHAT
// ============================================================

function renderCombatChat() {

    const container =
        document.getElementById(
            "combat-chat-messages"
        );


    if (
        !container
    ) {

        return;

    }


    container.replaceChildren();


    const messages =
        Array.from(
            combatChatMessages.values()
        )
            .sort(
                (
                    a,
                    b
                ) => {

                    return (
                        new Date(
                            a.created_at
                        ).getTime()
                        -
                        new Date(
                            b.created_at
                        ).getTime()
                    );

                }
            );


    if (
        messages.length ===
        0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "combat-chat-placeholder";


        empty.textContent =
            "Nessun messaggio.";


        container.appendChild(
            empty
        );


        return;

    }


    messages.forEach(
        message => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "combat-chat-message";


            // =================================================
            // MESSAGGIO PROPRIO
            // =================================================

            if (
                currentCharacter &&
                message.character_id ===
                    currentCharacter.id
            ) {

                row.classList.add(
                    "own-message"
                );

            }


            // =================================================
            // MASTER
            // =================================================

            if (
                !message.character_id &&
                message.sender_name ===
                    "MASTER"
            ) {

                row.classList.add(
                    "master-message"
                );

            }


            // =================================================
            // HEADER
            // =================================================

            const header =
                document.createElement(
                    "div"
                );


            header.className =
                "combat-chat-message-header";


            const sender =
                document.createElement(
                    "strong"
                );


            sender.className =
                "combat-chat-sender";


            sender.textContent =
                message.sender_name ||
                "Avventuriero";


            const time =
                document.createElement(
                    "span"
                );


            time.className =
                "combat-chat-time";


            time.textContent =
                formatCombatChatTime(
                    message.created_at
                );


            header.append(
                sender,
                time
            );


            // =================================================
            // TESTO
            // =================================================

            const body =
                document.createElement(
                    "div"
                );


            body.className =
                "combat-chat-message-text";


            body.textContent =
                message.message;


            // =================================================
            // ASSEMBLA
            // =================================================

            row.append(
                header,
                body
            );


            container.appendChild(
                row
            );

        }
    );


    // ========================================================
    // SCROLL ALL'ULTIMO MESSAGGIO
    // ========================================================

    container.scrollTop =
        container.scrollHeight;

}


// ============================================================
// ORARIO
// ============================================================

function formatCombatChatTime(
    value
) {

    if (
        !value
    ) {

        return "";

    }


    const date =
        new Date(
            value
        );


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
// CHIUSURA CHAT
// ============================================================

async function cleanupCombatChat() {

    if (
        !combatChatChannel
    ) {

        return;

    }


    try {

        await db.removeChannel(
            combatChatChannel
        );

    } catch (
        error
    ) {

        console.warn(
            "Errore chiusura chat:",
            error
        );

    }


    combatChatChannel =
        null;


    combatChatInitialized =
        false;

}