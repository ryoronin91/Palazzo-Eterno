// ============================================================
// PALAZZO ETERNO
// VENDOR.JS - UI DARK FANTASY
// ============================================================

console.log(
    "VENDOR.JS CARICATO"
);


// ============================================================
// SUPABASE
// ============================================================

const db =
    supabaseClient;


// ============================================================
// STATO
// ============================================================

let currentUser =
    null;

let character =
    null;

let characterInventory =
    [];

let vendorItems =
    [];

const VENDOR_ID =
    "vendor_manodiscimmia";

const NPC_ID =
    "npc_manodiscimmia";

let vendorVisitHistory =
    [];

let vendorAiBusy =
    false;


// ============================================================
// HEADER INVENTARIO PG
// ============================================================

function updateVendorPlayerInventoryHeader() {

    const title =
        document.getElementById(
            "player-inventory-title"
        );

    const goldAmount =
        document.getElementById(
            "player-gold-amount"
        );


    if (title) {

        const characterName =
            String(
                character?.nome ||
                "PG"
            )
                .trim()
                .toUpperCase();


        title.textContent =
            `INVENTARIO ${characterName}`;

    }


    if (goldAmount) {

        const goldEntry =
            characterInventory.find(
                entry => {

                    const item =
                        entry?.item || {};

                    const itemType =
                        String(
                            item.item_type ||
                            ""
                        ).toLowerCase();

                    const itemName =
                        String(
                            item.name ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    return (
                        itemType ===
                            "currency"
                        ||
                        item.id ===
                            "moneta_oro"
                        ||
                        itemName ===
                            "moneta d'oro"
                        ||
                        itemName ===
                            "monete d'oro"
                    );

                }
            );


        goldAmount.textContent =
            Number(
                goldEntry?.quantity
            ) || 0;

    }

}


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            await loadVendorCharacter();


            // ------------------------------------------------
            // ROUTER STATO PG
            // ------------------------------------------------

            if (
                await enforceVendorPageState()
            ) {

                return;

            }


            await loadVendorCharacterInventory();

            await loadVendorItems();

            updateVendorPlayerInventoryHeader();

            renderVendorCharacterInventory();

            renderVendorItems();

            setupVendorAiChat();

            setupVendorExitButton();


        } catch (error) {

            console.error(
                "Errore avvio vendor:",
                error
            );


            renderVendorInventoryError(
                error.message ||
                "Impossibile caricare l'inventario."
            );

        }

    }
);


// ============================================================
// CARICA PERSONAGGIO
// ============================================================

async function loadVendorCharacter() {

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
                "characters"
            )
            .select(`
                id,
                nome,
                score,
                active_combat_id,
                current_location
            `)
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();


    if (error) {

        throw error;

    }


    if (!data) {

        window.location.href =
            "personaggio.html";

        return;

    }


    character =
        data;

}


// ============================================================
// ROUTER STATO DEL PERSONAGGIO - VENDOR
// ============================================================
//
// Priorità:
// 1. active_combat_id  -> combat.html
// 2. current_location vendor -> resta nel vendor
// 3. qualsiasi altro stato -> dungeon.html
//
// Ritorna true quando è stato avviato un redirect.
//
// ============================================================

async function enforceVendorPageState(
    refreshFromDatabase = false
) {

    if (
        refreshFromDatabase
    ) {

        const {
            data: {
                user
            },
            error: authError
        } =
            await db.auth.getUser();


        if (
            authError
        ) {

            console.error(
                "Errore controllo stato vendor:",
                authError
            );

            return false;

        }


        if (
            !user
        ) {

            window.location.replace(
                "login.html"
            );

            return true;

        }


        const {
            data,
            error
        } =
            await db
                .from(
                    "characters"
                )
                .select(
                    "id, nome, score, active_combat_id, current_location"
                )
                .eq(
                    "user_id",
                    user.id
                )
                .maybeSingle();


        if (
            error
        ) {

            console.error(
                "Errore lettura stato PG vendor:",
                error
            );

            return false;

        }


        if (
            !data
        ) {

            window.location.replace(
                "personaggio.html"
            );

            return true;

        }


        currentUser =
            user;


        character =
            data;

    }


    if (
        !character
    ) {

        return false;

    }


    // --------------------------------------------------------
    // COMBAT HA SEMPRE LA PRIORITÀ
    // --------------------------------------------------------

    if (
        character.active_combat_id
    ) {

        if (
            character.current_location !==
            "combat"
        ) {

            const {
                error
            } =
                await db
                    .from(
                        "characters"
                    )
                    .update({
                        current_location:
                            "combat"
                    })
                    .eq(
                        "id",
                        character.id
                    );


            if (
                error
            ) {

                console.error(
                    "Errore sincronizzazione stato combat dal vendor:",
                    error
                );

            } else {

                character.current_location =
                    "combat";

            }

        }


        window.location.replace(
            "combat.html"
        );

        return true;

    }


    // --------------------------------------------------------
    // IL PG È REALMENTE NEL VENDOR
    // --------------------------------------------------------

    if (
        character.current_location ===
        "vendor"
    ) {

        return false;

    }


    // --------------------------------------------------------
    // QUALSIASI ALTRO STATO TORNA AL DUNGEON
    // --------------------------------------------------------

    window.location.replace(
        "dungeon.html"
    );

    return true;

}


// ============================================================
// RIENTRO DA CACHE DEL BROWSER
// ============================================================
//
// Con Indietro/Avanti il browser può ripristinare vendor.html
// dalla BFCache senza rieseguire DOMContentLoaded.
// In quel caso rileggiamo lo stato reale da Supabase.
//
// ============================================================

window.addEventListener(
    "pageshow",
    async event => {

        if (
            !event.persisted
        ) {

            return;

        }


        try {

            await enforceVendorPageState(
                true
            );

        } catch (error) {

            console.error(
                "Errore controllo stato vendor al ritorno pagina:",
                error
            );

        }

    }
);


// ============================================================
// CARICA INVENTARIO REALE
// ============================================================

async function loadVendorCharacterInventory() {

    if (!character) {

        characterInventory =
            [];

        return;

    }


    const {
        data,
        error
    } =
        await db
            .from(
                "character_inventory"
            )
            .select(`
                id,
                quantity,
                equipped_slot,

                item:items (
                    id,
                    name,
                    description,
                    item_type,
                    equip_slot,
                    heal_pf,
                    heal_pm,
                    gold_value
                )
            `)
            .eq(
                "character_id",
                character.id
            );


    if (error) {

        throw error;

    }


    characterInventory =
        data || [];

}


// ============================================================
// CARICA MERCE VENDOR IN BASE ALLO SCORE
// ============================================================

async function loadVendorItems() {

    if (!character) {

        vendorItems =
            [];

        return;

    }


    const characterScore =
        Math.max(
            0,
            Number(
                character.score
            ) || 0
        );


    const {
        data,
        error
    } =
        await db
            .from(
                "vendor_items"
            )
            .select(`
                id,
                vendor_id,
                item_id,
                buy_price,
                min_score,
                unlimited,

                item:items (
                    id,
                    name,
                    description,
                    item_type,
                    equip_slot,
                    hand_rule,
                    attack_bonus,
                    defense_bonus,
                    forza_bonus,
                    resistenza_bonus,
                    costituzione_bonus,
                    intelligenza_bonus,
                    destrezza_bonus,
                    fortuna_bonus,
                    heal_pf,
                    heal_pm,
                    gold_value
                )
            `)
            .eq(
                "vendor_id",
                VENDOR_ID
            )
            .lte(
                "min_score",
                characterScore
            )
            .order(
                "min_score",
                {
                    ascending: true
                }
            )
            .order(
                "buy_price",
                {
                    ascending: true
                }
            );


    if (error) {

        throw error;

    }


    vendorItems =
        (data || [])
            .filter(
                row =>
                    row?.item
            );

}


// ============================================================
// RENDER MERCE VENDOR
// ============================================================

function renderVendorItems() {

    const container =
        document.querySelector(
            ".vendor-stock"
        );


    if (!container) {

        return;

    }


    if (
        !vendorItems.length
    ) {

        container.innerHTML = `
            <div class="inventory-empty">
                Nessuna merce disponibile.
            </div>
        `;

        return;

    }


    const sortedItems =
        [...vendorItems]
            .sort(
                (
                    a,
                    b
                ) => {

                    const scoreDifference =
                        (
                            Number(
                                a.min_score
                            ) || 0
                        )
                        -
                        (
                            Number(
                                b.min_score
                            ) || 0
                        );


                    if (
                        scoreDifference !== 0
                    ) {

                        return scoreDifference;

                    }


                    return String(
                        a.item?.name ||
                        ""
                    ).localeCompare(
                        String(
                            b.item?.name ||
                            ""
                        ),
                        "it"
                    );

                }
            );


    const groups = [
        {
            label: "OGGETTI BASE",
            min: 0,
            max: 99
        },
        {
            label: "OGGETTI COMUNI",
            min: 100,
            max: 199
        },
        {
            label: "OGGETTI RARI",
            min: 200,
            max: Infinity
        }
    ];


    let html =
        "";


    for (
        const group
        of groups
    ) {

        const groupItems =
            sortedItems.filter(
                row => {

                    const minScore =
                        Number(
                            row.min_score
                        ) || 0;


                    return (
                        minScore >= group.min
                        &&
                        minScore <= group.max
                    );

                }
            );


        if (
            !groupItems.length
        ) {

            continue;

        }


        html += `
            <div class="vendor-category-divider">
                <span>
                    ${group.label}
                </span>
            </div>
        `;


        html +=
            groupItems
                .map(
                    row => {

                        const price =
                            Math.max(
                                0,
                                Number(
                                    row.buy_price
                                ) || 0
                            );


                        return `
                            <article
                                class="vendor-stock-item"
                                data-vendor-item-id="${escapeVendorHtml(
                                    row.id
                                )}"
                                data-item-id="${escapeVendorHtml(
                                    row.item.id
                                )}"
                                data-price="${price}"
                                data-min-score="${Math.max(
                                    0,
                                    Number(
                                        row.min_score
                                    ) || 0
                                )}"
                            >

                                <div class="vendor-stock-name">
                                    ${escapeVendorHtml(
                                        row.item.name ||
                                        row.item.id
                                    )}
                                </div>

                                <div class="vendor-stock-price">
                                    ${price}
                                </div>

                                <button
                                    class="merchant-button vendor-buy-button"
                                    type="button"
                                    data-buy-item-id="${escapeVendorHtml(
                                        row.item.id
                                    )}"
                                    data-buy-price="${price}"
                                >
                                    COMPRA
                                </button>

                            </article>
                        `;

                    }
                )
                .join("");

    }


    container.innerHTML =
        html;

}



function getVendorInventoryItemIcon(
    entry
) {

    const item =
        entry?.item || {};

    const itemType =
        String(
            item.item_type ||
            ""
        ).toLowerCase();


    if (
        Number(
            item.heal_pf
        ) > 0
    ) {

        return "♥";

    }


    if (
        Number(
            item.heal_pm
        ) > 0
    ) {

        return "✦";

    }


    if (
        itemType ===
        "currency"
    ) {

        return "●";

    }


    if (
        itemType ===
        "weapon"
    ) {

        return "⚔";

    }


    if (
        itemType ===
        "armor"
    ) {

        return "◆";

    }


    if (
        itemType ===
        "accessory"
    ) {

        return "◇";

    }


    return "□";

}


// ============================================================
// ESCI DAL VENDOR
// ============================================================

function setupVendorExitButton() {

    const button =
        document.getElementById(
            "vendor-exit-button"
        );


    if (!button) {

        return;

    }


    button.addEventListener(
        "click",
        async () => {

            if (
                button.disabled
            ) {

                return;

            }


            try {

                button.disabled =
                    true;


                resetVendorVisitMemory();


                if (
                    !character ||
                    !character.id
                ) {

                    window.location.replace(
                        "dungeon.html"
                    );

                    return;

                }


                // --------------------------------------------
                // REGISTRA USCITA DAL VENDOR
                // --------------------------------------------

                const {
                    error
                } =
                    await db
                        .from(
                            "characters"
                        )
                        .update({
                            current_location:
                                "dungeon"
                        })
                        .eq(
                            "id",
                            character.id
                        );


                if (
                    error
                ) {

                    throw error;

                }


                character.current_location =
                    "dungeon";


                // replace evita di lasciare nella cronologia
                // una pagina vendor ormai non più valida.
                window.location.replace(
                    "dungeon.html"
                );


            } catch (error) {

                console.error(
                    "Errore uscita vendor:",
                    error
                );


                button.disabled =
                    false;


                setVendorDialogue(
                    "Il portale fa i capricci. Riprova tra un attimo."
                );

            }

        }
    );

}


// ============================================================
// OFFERTA SEGRETO
// ============================================================

function clearVendorSecretOffer() {

    const container =
        document.getElementById(
            "vendor-secret-offer"
        );


    if (!container) {

        return;

    }


    container.innerHTML =
        "";

    container.hidden =
        true;

}


function renderVendorSecretOffer(
    offer
) {

    const container =
        document.getElementById(
            "vendor-secret-offer"
        );


    if (!container) {

        return;

    }


    if (
        !offer
        ||
        !offer.secret_id
    ) {

        clearVendorSecretOffer();

        return;

    }


    const price =
        Math.max(
            0,
            Number(
                offer.price_gold
            ) || 0
        );


    const acceptsMonkeyHand =
        offer.payment_item_id ===
        "mano_scimmia";


    container.innerHTML = `
        <div class="vendor-secret-offer-title">
            AFFARE RISERVATO
        </div>

        <div class="vendor-secret-offer-name">
            ${escapeVendorHtml(
                offer.display_name ||
                "Informazione"
            )}
        </div>

        <div class="vendor-secret-payment-buttons">

            <button
                class="vendor-secret-buy-button"
                type="button"
                data-secret-id="${escapeVendorHtml(
                    offer.secret_id
                )}"
                data-payment-method="gold"
            >
                COMPRA · ${price} ORO
            </button>

            ${
                acceptsMonkeyHand
                    ? `
                        <button
                            class="vendor-secret-buy-button vendor-secret-buy-item-button"
                            type="button"
                            data-secret-id="${escapeVendorHtml(
                                offer.secret_id
                            )}"
                            data-payment-method="item"
                        >
                            PAGA · MANO DI SCIMMIA
                        </button>
                    `
                    : ""
            }

        </div>
    `;

    container.hidden =
        false;

}


// ============================================================
// ACQUISTA SEGRETO
// ============================================================

async function buyVendorSecret(
    button
) {

    if (
        !button
        ||
        button.disabled
    ) {

        return;

    }


    const secretId =
        String(
            button.dataset.secretId ||
            ""
        )
            .trim();


    if (!secretId) {

        return;

    }


    const paymentMethod =
        String(
            button.dataset.paymentMethod ||
            "gold"
        );


    const originalText =
        button.textContent;


    try {

        button.disabled =
            true;

        button.textContent =
            "...";


        const {
            data,
            error
        } =
            await db.rpc(
                "vendor_buy_secret",
                {
                    p_npc_id:
                        NPC_ID,

                    p_secret_id:
                        secretId,

                    p_payment_method:
                        paymentMethod
                }
            );


        if (error) {

            throw error;

        }


        await refreshVendorInventory();

        clearVendorSecretOffer();


        const secretName =
            String(
                data?.display_name ||
                "informazione"
            );


        const secretValue =
            String(
                data?.secret_value ||
                ""
            );


        const pricePaid =
            Number(
                data?.price_paid
            ) || 0;


        let reply;


        if (
            data?.already_owned
        ) {

            reply =
                `Questa te l'avevo già venduta, campione. ${secretName}: ${secretValue}`;

        } else {

            reply =
                `Affare fatto, campione. ${secretName}: ${secretValue}`;

        }


        setVendorDialogue(
            reply
        );


        vendorVisitHistory.push(
            {
                role:
                    "user",

                content:
                    data?.payment_method === "item"
                        ? `[EVENTO DI GIOCO CONFERMATO] Il PG ha acquistato il segreto "${secretName}" consegnando una mano di scimmia. Il segreto rivelato è: ${secretValue}`
                        : `[EVENTO DI GIOCO CONFERMATO] Il PG ha acquistato il segreto "${secretName}" pagando ${pricePaid} monete d'oro. Il segreto rivelato è: ${secretValue}`
            },
            {
                role:
                    "assistant",

                content:
                    reply
            }
        );


        vendorVisitHistory =
            vendorVisitHistory.slice(
                -10
            );


        console.log(
            "Segreto acquistato:",
            data
        );


    } catch (error) {

        console.error(
            "Errore acquisto segreto:",
            error
        );


        setVendorDialogue(
            error?.message ||
            "Non posso concludere questo affare."
        );


    } finally {

        button.disabled =
            false;

        button.textContent =
            originalText;

    }

}


document.addEventListener(
    "click",
    event => {

        const secretButton =
            event.target.closest(
                ".vendor-secret-buy-button"
            );


        if (secretButton) {

            buyVendorSecret(
                secretButton
            );

        }

    }
);


// ============================================================
// IA MANO DI SCIMMIA
// Memoria valida soltanto durante questa visita/pagina.
// ============================================================

function setupVendorAiChat() {

    const form =
        document.getElementById(
            "vendor-ai-form"
        );

    const input =
        document.getElementById(
            "vendor-ai-input"
        );


    if (
        !form
        ||
        !input
    ) {

        return;

    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            await sendVendorAiMessage();

        }
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                input.value =
                    "";

                input.blur();

            }

        }
    );

}


// ============================================================
// INVIA MESSAGGIO ALLA EDGE FUNCTION
// ============================================================

async function sendVendorAiMessage() {

    if (vendorAiBusy) {

        return;

    }


    const input =
        document.getElementById(
            "vendor-ai-input"
        );

    const button =
        document.getElementById(
            "vendor-ai-send"
        );


    if (
        !input
        ||
        !button
    ) {

        return;

    }


    const message =
        String(
            input.value ||
            ""
        )
            .trim()
            .slice(
                0,
                500
            );


    if (!message) {

        return;

    }


    const previousReply =
        document.getElementById(
            "vendor-dialogue-text"
        )?.textContent
        ||
        "";


    vendorAiBusy =
        true;

    input.disabled =
        true;

    button.disabled =
        true;

    button.textContent =
        "...";

    input.value =
        "";


    clearVendorSecretOffer();

    setVendorDialogue(
        "Mano di Scimmia ti squadra per un momento..."
    );


    try {

        const {
            data,
            error
        } =
            await db.functions.invoke(
                "vendor-ai",
                {
                    body: {
                        npc_id:
                            NPC_ID,

                        message:
                            message,

                        history:
                            vendorVisitHistory
                    }
                }
            );


        if (error) {

            let detail =
                error.message ||
                "Errore nella chiamata alla funzione.";


            // In alcune versioni di supabase-js il corpo della
            // risposta della Edge Function è disponibile qui.
            if (
                error.context
                &&
                typeof error.context.json === "function"
            ) {

                try {

                    const body =
                        await error.context.json();


                    if (
                        body?.error
                    ) {

                        detail =
                            body.error;

                    }

                } catch (_) {

                    // Mantiene il messaggio originale.

                }

            }


            throw new Error(
                detail
            );

        }


        const reply =
            String(
                data?.reply ||
                ""
            )
                .trim();


        if (!reply) {

            throw new Error(
                "Mano di Scimmia è rimasto insolitamente senza parole."
            );

        }


        vendorVisitHistory.push(
            {
                role:
                    "user",

                content:
                    message
            },
            {
                role:
                    "assistant",

                content:
                    reply
            }
        );


        // Manteniamo soltanto gli ultimi 10 messaggi
        // (5 scambi) della visita.
        if (
            vendorVisitHistory.length >
            10
        ) {

            vendorVisitHistory =
                vendorVisitHistory.slice(
                    -10
                );

        }


        setVendorDialogue(
            reply
        );

        renderVendorSecretOffer(
            data?.offer ||
            null
        );


    } catch (error) {

        console.error(
            "Errore IA vendor:",
            error
        );


        setVendorDialogue(
            `Ugh... qualcosa nel portale non funziona. (${error.message || "errore sconosciuto"})`
        );


        // Se fallisce la richiesta non registriamo il messaggio
        // nella memoria della visita.

        if (
            !previousReply
        ) {

            console.warn(
                "Nessuna risposta precedente da ripristinare."
            );

        }


    } finally {

        vendorAiBusy =
            false;

        input.disabled =
            false;

        button.disabled =
            false;

        button.textContent =
            "PARLA";

        input.focus();

    }

}


// ============================================================
// RESET MEMORIA VISITA
// ============================================================

function resetVendorVisitMemory() {

    vendorVisitHistory =
        [];

}


// ============================================================
// FEEDBACK DIALOGO VENDOR
// ============================================================

function setVendorDialogue(
    message
) {

    const dialogue =
        document.getElementById(
            "vendor-dialogue-text"
        );


    if (dialogue) {

        dialogue.textContent =
            message;

    }

}


// ============================================================
// AGGIORNA INVENTARIO DOPO COMPRA / VENDI
// ============================================================

async function refreshVendorInventory() {

    await loadVendorCharacterInventory();

    updateVendorPlayerInventoryHeader();

    renderVendorCharacterInventory();

}


// ============================================================
// COMPRA
// ============================================================

async function buyVendorItem(
    button
) {

    if (
        !button
        ||
        button.disabled
    ) {

        return;

    }


    const itemId =
        button.dataset.buyItemId;

    const price =
        Number(
            button.dataset.buyPrice
        ) || 0;


    if (!itemId) {

        return;

    }


    const originalText =
        button.textContent;


    try {

        button.disabled =
            true;

        button.textContent =
            "...";


        const {
            data,
            error
        } =
            await db.rpc(
                "vendor_buy_item",
                {
                    p_vendor_id:
                        VENDOR_ID,

                    p_item_id:
                        itemId
                }
            );


        if (error) {

            throw error;

        }


        await refreshVendorInventory();


        const item =
            vendorItems.find(
                row =>
                    row.item_id ===
                    itemId
            );


        const itemName =
            item?.item?.name ||
            itemId;


        const tradeReply =
            `Affare fatto. ${itemName} è tuo per ${price} monete d'oro.`;

        setVendorDialogue(
            tradeReply
        );

        vendorVisitHistory.push(
            {
                role: "user",
                content: `[EVENTO DI GIOCO CONFERMATO] Il PG ha acquistato ${itemName} per ${price} monete d'oro.`
            },
            {
                role: "assistant",
                content: tradeReply
            }
        );

        vendorVisitHistory =
            vendorVisitHistory.slice(-10);


        console.log(
            "Acquisto completato:",
            data
        );


    } catch (error) {

        console.error(
            "Errore acquisto:",
            error
        );


        setVendorDialogue(
            error?.message ||
            "Non posso concludere questo affare."
        );


    } finally {

        button.disabled =
            false;

        button.textContent =
            originalText;

    }

}


// ============================================================
// VENDI
// ============================================================

async function sellVendorItem(
    button
) {

    if (
        !button
        ||
        button.disabled
    ) {

        return;

    }


    const row =
        button.closest(
            ".player-item"
        );


    const inventoryId =
        row?.dataset
            ?.inventoryId;


    if (!inventoryId) {

        return;

    }


    const itemId =
        row?.dataset
            ?.itemId;


    const inventoryEntry =
        characterInventory.find(
            entry =>
                String(
                    entry.id
                ) ===
                String(
                    inventoryId
                )
        );


    const itemName =
        inventoryEntry
            ?.item
            ?.name
        ||
        itemId
        ||
        "Oggetto";


    const sellPrice =
        Math.max(
            0,
            Number(
                inventoryEntry
                    ?.item
                    ?.gold_value
            ) || 0
        );


    const originalText =
        button.textContent;


    try {

        button.disabled =
            true;

        button.textContent =
            "...";


        const {
            data,
            error
        } =
            await db.rpc(
                "vendor_sell_item",
                {
                    p_inventory_id:
                        String(
                            inventoryId
                        )
                }
            );


        if (error) {

            throw error;

        }


        await refreshVendorInventory();


        const tradeReply =
            `Prendo ${itemName}. Ti darò ${sellPrice} monete d'oro.`;

        setVendorDialogue(
            tradeReply
        );

        vendorVisitHistory.push(
            {
                role: "user",
                content: `[EVENTO DI GIOCO CONFERMATO] Il PG ha venduto ${itemName} per ${sellPrice} monete d'oro.`
            },
            {
                role: "assistant",
                content: tradeReply
            }
        );

        vendorVisitHistory =
            vendorVisitHistory.slice(-10);


        console.log(
            "Vendita completata:",
            data
        );


    } catch (error) {

        console.error(
            "Errore vendita:",
            error
        );


        setVendorDialogue(
            error?.message ||
            "Non posso acquistare questo oggetto."
        );


    } finally {

        button.disabled =
            false;

        button.textContent =
            originalText;

    }

}


// ============================================================
// CLICK PULSANTI DINAMICI
// ============================================================

document.addEventListener(
    "click",
    event => {

        const buyButton =
            event.target.closest(
                ".vendor-buy-button"
            );


        if (buyButton) {

            buyVendorItem(
                buyButton
            );

            return;

        }


        const sellButton =
            event.target.closest(
                ".player-item-sell-button"
            );


        if (sellButton) {

            sellVendorItem(
                sellButton
            );

        }

    }
);


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeVendorHtml(
    value
) {

    return String(
        value ?? ""
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
// RENDER INVENTARIO
// ============================================================

function renderVendorCharacterInventory() {

    const container =
        document.getElementById(
            "player-inventory-list"
        );


    if (!container) {

        return;

    }


    const entries =
        characterInventory
            .filter(
                entry => {

                    if (
                        !entry?.item
                        ||
                        Number(
                            entry.quantity
                        ) <= 0
                    ) {

                        return false;

                    }


                    const item =
                        entry.item;

                    const itemType =
                        String(
                            item.item_type ||
                            ""
                        ).toLowerCase();

                    const itemName =
                        String(
                            item.name ||
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    return !(
                        itemType ===
                            "currency"
                        ||
                        item.id ===
                            "moneta_oro"
                        ||
                        itemName ===
                            "moneta d'oro"
                        ||
                        itemName ===
                            "monete d'oro"
                    );

                }
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    String(
                        a.item?.name ||
                        ""
                    ).localeCompare(
                        String(
                            b.item?.name ||
                            ""
                        ),
                        "it"
                    )
            );


    if (!entries.length) {

        container.innerHTML = `
            <div class="inventory-empty">
                Inventario vuoto.
            </div>
        `;

        return;

    }


    container.innerHTML =
        entries
            .map(
                entry => {

                    const equipped =
                        entry.equipped_slot
                            ? `
                                <div class="player-item-equipped">
                                    EQUIPAGGIATO
                                </div>
                            `
                            : "";


                    const value =
                        Math.max(
                            0,
                            Number(
                                entry.item.gold_value
                            ) || 0
                        );


                    return `
                        <article
                            class="player-item"
                            data-inventory-id="${escapeVendorHtml(
                                entry.id
                            )}"
                            data-item-id="${escapeVendorHtml(
                                entry.item.id
                            )}"
                        >

                            <div class="player-item-quantity">
                                ×${Number(
                                    entry.quantity
                                ) || 0}
                            </div>

                            <div class="player-item-center">

                                <div class="player-item-name">
                                    ${escapeVendorHtml(
                                        entry.item.name ||
                                        entry.item.id
                                    )}
                                </div>

                                ${equipped}

                            </div>

                            <div class="player-item-actions">

                                <div class="player-item-value">
                                    ${value}
                                </div>

                                <button
                                    class="player-item-sell-button"
                                    type="button"
                                    data-sell-item-id="${escapeVendorHtml(
                                        entry.item.id
                                    )}"
                                >
                                    VENDI
                                </button>

                            </div>

                        </article>
                    `;

                }
            )
            .join("");

}


// ============================================================
// ERRORE INVENTARIO
// ============================================================

function renderVendorInventoryError(
    message
) {

    const container =
        document.getElementById(
            "player-inventory-list"
        );


    if (!container) {

        return;

    }


    container.innerHTML = `
        <div class="player-inventory-status">
            ${escapeVendorHtml(
                message
            )}
        </div>
    `;

}
