// ============================================================
// PALAZZO ETERNO
// COMBAT-LOOT.JS
// VITTORIA, ORO E DRAFT BOTTINO
// ============================================================


// ============================================================
// SCHERMATA VITTORIA
// ============================================================

function renderCombatVictory() {

    const overlay =
        document.getElementById(
            "combat-victory-overlay"
        );


    if (!overlay) {

        return;

    }


    const victory =
        combatSession?.status ===
        "victory";


    overlay.classList.toggle(
        "visible",
        victory
    );


    overlay.setAttribute(
        "aria-hidden",
        victory
            ? "false"
            : "true"
    );


    if (!victory) {

        return;

    }


    if (
        combatTargetMode
    ) {

        cancelCombatTargeting();

    }


    if (
        !victoryLootLoaded &&
        !victoryLootLoading
    ) {

        loadVictoryLoot();

    }

}


// ============================================================
// CARICA LOOT VITTORIA
// ============================================================

async function loadVictoryLoot() {

    if (
        victoryLootLoaded ||
        victoryLootLoading ||
        !combatId
    ) {

        return;

    }


    victoryLootLoading =
        true;


    const container =
        document.getElementById(
            "combat-victory-loot"
        );


    if (
        container
    ) {

        container.textContent =
            "Generazione del bottino...";

    }


    try {

        // ====================================================
        // 1. GENERA IL LOOT
        //
        // Se è già stato generato,
        // la RPC non lo rigenera.
        // ====================================================

        const {
            error: generateError
        } =
            await db.rpc(
                "generate_combat_loot",
                {

                    p_combat_id:
                        combatId

                }
            );


        if (
            generateError
        ) {

            throw generateError;

        }


        // ====================================================
        // 2. DISTRIBUISCE AUTOMATICAMENTE L'ORO
        //
        // Solo i giocatori partecipanti eseguono questa RPC.
        // Il master osservatore non possiede un PG nel combat.
        //
        // La funzione SQL impedisce comunque una doppia
        // distribuzione.
        // ====================================================

        if (
            !masterObserverMode &&
            currentCharacter
        ) {

            const {
                error: distributeError
            } =
                await db.rpc(
                    "distribute_combat_gold",
                    {

                        p_combat_id:
                            combatId

                    }
                );


            if (
                distributeError
            ) {

                throw distributeError;

            }

        }


        // ====================================================
        // 3. RECUPERA LA QUOTA PERSONALE DI ORO
        // ====================================================

        let myGold =
            null;


        if (
            !masterObserverMode &&
            currentCharacter
        ) {

            const {
                data: goldData,
                error: goldError
            } =
                await db.rpc(
                    "get_my_combat_gold",
                    {

                        p_combat_id:
                            combatId

                    }
                );


            if (
                goldError
            ) {

                throw goldError;

            }


            myGold =
                Number(
                    goldData
                ) || 0;

        }


        // ====================================================
        // 4. RECUPERA IL LOOT COMPLETO
        // ====================================================

        const {
            data,
            error
        } =
            await db.rpc(
                "get_combat_loot",
                {

                    p_combat_id:
                        combatId

                }
            );


        if (
            error
        ) {

            throw error;

        }


        // ====================================================
        // 5. SALVA DATI LOCALI
        // ====================================================

        victoryLootData =
            data ||
            [];


        victoryGoldReceived =
            myGold;


        // ====================================================
        // 6. INIZIALIZZA IL DRAFT
        // ====================================================

        const {
            error: draftInitError
        } =
            await db.rpc(
                "initialize_combat_loot_draft",
                {

                    p_combat_id:
                        combatId

                }
            );


        if (
            draftInitError
        ) {

            throw draftInitError;

        }


        // ====================================================
        // 7. CARICA STATO DRAFT
        // ====================================================

        await refreshVictoryLootDraft();


        // ====================================================
        // 8. AVVIA TIMER DRAFT
        // ====================================================

        startVictoryLootDraftLoop();


        victoryLootLoaded =
            true;


    } catch (error) {

        console.error(
            "Errore caricamento loot:",
            error
        );


        if (
            container
        ) {

            container.textContent =
                "Errore durante il caricamento del bottino.";

        }


    } finally {

        victoryLootLoading =
            false;

    }

}


// ============================================================
// LOOP DRAFT LOOT
// ============================================================

function startVictoryLootDraftLoop() {

    stopVictoryLootDraftLoop();


    victoryLootDraftInterval =
        setInterval(
            async () => {

                await refreshVictoryLootDraft();

            },
            1000
        );

}


// ============================================================
// STOP LOOP DRAFT
// ============================================================

function stopVictoryLootDraftLoop() {

    if (
        victoryLootDraftInterval
    ) {

        clearInterval(
            victoryLootDraftInterval
        );


        victoryLootDraftInterval =
            null;

    }

}


// ============================================================
// AGGIORNA STATO DRAFT
// ============================================================

async function refreshVictoryLootDraft() {

    if (
        !combatId
    ) {

        return;

    }


    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "get_combat_loot_draft_state",
                {

                    p_combat_id:
                        combatId

                }
            );


        if (
            error
        ) {

            throw error;

        }


        victoryLootDraftState =
            data;


        renderVictoryLoot(
            victoryLootData,
            victoryGoldReceived,
            victoryLootDraftState
        );


        if (
            data?.status ===
            "complete"
        ) {

            stopVictoryLootDraftLoop();

        }


    } catch (error) {

        console.error(
            "Errore aggiornamento draft loot:",
            error
        );

    }

}


// ============================================================
// PRENDI OGGETTO
// ============================================================

async function pickVictoryLootItem(
    itemId
) {

    if (
        victoryLootPickInProgress ||
        !itemId ||
        !victoryLootDraftState?.is_my_turn
    ) {

        return;

    }


    victoryLootPickInProgress =
        true;


    try {

        const {
            error
        } =
            await db.rpc(
                "pick_combat_loot_item",
                {

                    p_combat_id:
                        combatId,

                    p_item_id:
                        itemId

                }
            );


        if (
            error
        ) {

            throw error;

        }


        // Aggiorna subito inventario.
        await loadCharacterInventory();


        // Aggiorna subito stato draft.
        await refreshVictoryLootDraft();


    } catch (error) {

        console.error(
            "Errore scelta oggetto:",
            error
        );


        alert(
            cleanCombatError(
                error.message
            )
        );


        await refreshVictoryLootDraft();


    } finally {

        victoryLootPickInProgress =
            false;

    }

}


// ============================================================
// MOSTRA LOOT VITTORIA
// ============================================================

function renderVictoryLoot(
    loot,
    myGold = 0,
    draft = null
) {

    const container =
        document.getElementById(
            "combat-victory-loot"
        );


    if (
        !container
    ) {

        return;

    }


    let html =
        "";


    // ========================================================
    // ORO PERSONALE
    // ========================================================

    html += `
        <div class="victory-loot-gold">

            <div class="victory-loot-gold-label">
                HAI RICEVUTO
            </div>

            <div class="victory-loot-gold-value">

                <span class="victory-gold-coin"></span>

                <strong>
                    ${Number(myGold) || 0}
                </strong>

                monete d'oro

            </div>

        </div>
    `;


    // ========================================================
    // DRAFT NON ANCORA DISPONIBILE
    // ========================================================

    if (
        !draft
    ) {

        html += `
            <div class="victory-loot-empty">
                Preparazione della spartizione...
            </div>
        `;


        container.innerHTML =
            html;


        return;

    }


    // ========================================================
    // DRAFT COMPLETATO
    // ========================================================

    if (
        draft.status ===
        "complete"
    ) {

        html += `
            <div class="victory-loot-draft-complete">
                SPARTIZIONE COMPLETATA
            </div>
        `;


        const myItems =
            Array.isArray(
                draft.my_items
            )

                ? draft.my_items

                : [];


        if (
            myItems.length >
            0
        ) {

            html += `
                <div class="victory-loot-items">

                    <div class="victory-loot-gold-label">
                        HAI OTTENUTO
                    </div>
            `;


            for (
                const item
                of myItems
            ) {

                html += `
                    <div class="victory-loot-item">

                        <span>
                            ${
                                escapeCombatHtml(
                                    item.item_name ||
                                    item.item_id
                                )
                            }
                        </span>

                        <strong>
                            ×${
                                Number(
                                    item.quantity
                                ) || 0
                            }
                        </strong>

                    </div>
                `;

            }


            html += `
                </div>
            `;


        } else {

            html += `
                <div class="victory-loot-empty">
                    Non hai ottenuto oggetti.
                </div>
            `;

        }


        container.innerHTML =
            html;


        return;

    }


    // ========================================================
    // TURNO ATTUALE DEL DRAFT
    // ========================================================

    const seconds =
        Math.max(
            0,
            Number(
                draft.seconds_remaining
            ) || 0
        );


    html += `
        <div class="victory-loot-turn">

            <div class="victory-loot-turn-label">
                TURNO DI
            </div>

            <div class="victory-loot-turn-player">
                ${
                    escapeCombatHtml(
                        draft.current_player_name ||
                        "Giocatore"
                    )
                }
            </div>

            <div class="victory-loot-timer">
                ${seconds}s
            </div>

        </div>
    `;


    // ========================================================
    // TURNO DEL GIOCATORE
    // ========================================================

    if (
        draft.is_my_turn
    ) {

        html += `
            <div class="victory-loot-your-turn">
                È il tuo turno. Scegli un oggetto.
            </div>
        `;

    } else {

        html += `
            <div class="victory-loot-waiting">
                Attendi che il giocatore scelga.
            </div>
        `;

    }


    // ========================================================
    // OGGETTI DISPONIBILI
    // ========================================================

    const items =
        Array.isArray(
            draft.items
        )

            ? draft.items

            : [];


    if (
        items.length ===
        0
    ) {

        html += `
            <div class="victory-loot-empty">
                Nessun oggetto rimasto.
            </div>
        `;


    } else {

        html += `
            <div class="victory-loot-items">
        `;


        for (
            const item
            of items
        ) {

            html += `
                <div class="victory-loot-item">

                    <div class="victory-loot-item-info">

                        <span>
                            ${
                                escapeCombatHtml(
                                    item.item_name ||
                                    item.item_id
                                )
                            }
                        </span>

                        <strong>
                            ×${
                                Number(
                                    item.quantity
                                ) || 0
                            }
                        </strong>

                    </div>


                    <button
                        type="button"
                        class="victory-loot-pick"
                        data-item-id="${
                            escapeCombatHtml(
                                item.item_id
                            )
                        }"
                        ${
                            draft.is_my_turn
                                ? ""
                                : "disabled"
                        }
                    >
                        PRENDI
                    </button>

                </div>
            `;

        }


        html += `
            </div>
        `;

    }


    container.innerHTML =
        html;


    // ========================================================
    // EVENTI PULSANTI
    // ========================================================

    container
        .querySelectorAll(
            ".victory-loot-pick"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        if (
                            button.disabled
                        ) {

                            return;

                        }


                        button.disabled =
                            true;


                        await pickVictoryLootItem(
                            button.dataset.itemId
                        );

                    }
                );

            }
        );

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeCombatHtml(
    value
) {

    return String(
        value ??
        ""
    )

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


// ============================================================
// PULSANTE USCITA VITTORIA
// ============================================================

function setupVictoryExitButton() {

    const button =
        document.getElementById(
            "combat-victory-exit"
        );


    if (
        !button
    ) {

        return;

    }


    button.addEventListener(
        "click",
        () => {

            stopVictoryLootDraftLoop();


            window.location.href =
                "dungeon.html";

        }
    );

}