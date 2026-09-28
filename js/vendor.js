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
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            await loadVendorCharacter();

            await loadVendorCharacterInventory();

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
                entry =>
                    entry?.item
                    &&
                    Number(
                        entry.quantity
                    ) > 0
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
                                <div class="player-item-meta">
                                    Equipaggiato: ${escapeVendorHtml(
                                        entry.equipped_slot
                                    )}
                                </div>
                            `
                            : "";


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
                            <div
                                class="player-item-icon"
                                aria-hidden="true"
                            >
                                ${getVendorInventoryItemIcon(
                                    entry
                                )}
                            </div>

                            <div class="player-item-main">

                                <div class="player-item-name">
                                    ${escapeVendorHtml(
                                        entry.item.name ||
                                        entry.item.id
                                    )}
                                </div>

                                ${equipped}

                            </div>

                            <div class="player-item-quantity">
                                ×${Number(
                                    entry.quantity
                                ) || 0}
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
