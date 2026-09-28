// ============================================================
// PALAZZO ETERNO
// VENDOR.JS
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

            updateVendorPlayerInventoryHeader();

            renderVendorCharacterInventory();


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
                nome
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
