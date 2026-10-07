// ============================================================
// PALAZZO ETERNO
// COMBAT-LOG.JS
// REGISTRO DEL COMBATTIMENTO
// SINCRONIZZAZIONE MULTIPLAYER VIA SUPABASE REALTIME
// ============================================================

let combatLogChannel = null;

const COMBAT_LOG_MAX_ENTRIES = 15;

const renderedCombatLogIds = new Set();

function createCombatLogId() {
    if (
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID === "function"
    ) {
        return globalThis.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function renderCombatLogEntry(text, entryId = null) {
    const container = document.getElementById("combat-log");

    if (!container || !text) {
        return;
    }

    if (
        entryId &&
        renderedCombatLogIds.has(entryId)
    ) {
        return;
    }

    if (entryId) {
        renderedCombatLogIds.add(entryId);

        if (renderedCombatLogIds.size > 500) {
            const oldestId = renderedCombatLogIds.values().next().value;
            renderedCombatLogIds.delete(oldestId);
        }
    }

    const placeholder = container.querySelector(".combat-log-placeholder");
    placeholder?.remove();

    const row = document.createElement("div");
    row.className = "combat-log-entry";
    row.textContent = text;

    container.prepend(row);

    // Mantiene nel DOM soltanto le 15 azioni più recenti.
    // Le voci più vecchie vengono eliminate automaticamente.
    const entries = container.querySelectorAll(".combat-log-entry");

    for (
        let i = COMBAT_LOG_MAX_ENTRIES;
        i < entries.length;
        i++
    ) {
        entries[i].remove();
    }

    container.scrollTop = 0;
}


// ============================================================
// LOG SOLO LOCALE
// Istruzioni, errori, targeting e messaggi personali.
// ============================================================

function addCombatLog(text) {
    renderCombatLogEntry(text);
}


// ============================================================
// LOG CONDIVISO
// Azioni effettivamente eseguite nel combattimento.
// ============================================================

async function addSharedCombatLog(text) {
    if (!text) {
        return;
    }

    const entryId = createCombatLogId();

    renderCombatLogEntry(
        text,
        entryId
    );

    if (
        !combatLogChannel ||
        !combatId
    ) {
        console.warn(
            "Registro condiviso non ancora inizializzato:",
            text
        );

        return;
    }

    try {
        await combatLogChannel.send({
            type: "broadcast",
            event: "combat_log",
            payload: {
                id: entryId,
                combat_id: combatId,
                text,
                created_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error(
            "Errore invio registro condiviso:",
            error
        );
    }
}


// ============================================================
// AVVIO SINCRONIZZAZIONE REGISTRO
// ============================================================

async function setupCombatLogSync() {
    if (
        typeof db === "undefined" ||
        !db ||
        typeof combatId === "undefined" ||
        !combatId
    ) {
        return;
    }

    await cleanupCombatLogSync();

    combatLogChannel = db.channel(
        `palazzo-eterno-combat-log-${combatId}`,
        {
            config: {
                broadcast: {
                    self: false
                }
            }
        }
    );

    combatLogChannel.on(
        "broadcast",
        {
            event: "combat_log"
        },
        message => {
            const payload = message?.payload;

            if (
                !payload ||
                payload.combat_id !== combatId ||
                !payload.text
            ) {
                return;
            }

            renderCombatLogEntry(
                payload.text,
                payload.id || null
            );
        }
    );

    await new Promise((resolve, reject) => {
        let settled = false;

        combatLogChannel.subscribe(status => {
            if (status === "SUBSCRIBED") {
                if (!settled) {
                    settled = true;
                    resolve();
                }

                return;
            }

            if (
                status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT"
            ) {
                if (!settled) {
                    settled = true;
                    reject(
                        new Error(
                            "Impossibile sincronizzare il registro del combattimento."
                        )
                    );
                }
            }
        });
    });
}


// ============================================================
// CHIUSURA SINCRONIZZAZIONE REGISTRO
// ============================================================

async function cleanupCombatLogSync() {
    if (!combatLogChannel) {
        return;
    }

    try {
        await db.removeChannel(
            combatLogChannel
        );

    } catch (error) {
        console.warn(
            "Errore chiusura canale registro combat:",
            error
        );
    }

    combatLogChannel = null;
}
