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
    "vendor_floor_1";


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

            await loadVendorCharacterInventory();

            await loadVendorItems();

            updateVendorPlayerInventoryHeader();

            renderVendorCharacterInventory();

            renderVendorItems();


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
                score
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


    container.innerHTML =
        sortedItems
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


// ============================================================
// ICONA OGGETTO
// ============================================================

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
