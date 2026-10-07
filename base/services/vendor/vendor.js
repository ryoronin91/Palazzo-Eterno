// ============================================================
// PALAZZO ETERNO
// VENDOR.JS - MANO DI SCIMMIA
// Posizione: base/services/vendor/vendor.js
// ============================================================

console.log("VENDOR.JS CARICATO");

// ============================================================
// MUSICA DI SOTTOFONDO
// ============================================================

let pageBackgroundMusic = null;

const PALAZZO_MUSIC_VOLUME_KEY =
    "palazzo-eterno-dungeon-volume";

let vendorMusicVolume =
    loadVendorMusicVolume();

function startBackgroundMusic(source) {
    if (pageBackgroundMusic || !source) {
        return;
    }

    pageBackgroundMusic =
        new Audio(source);

    pageBackgroundMusic.loop =
        true;

    pageBackgroundMusic.volume =
        vendorMusicVolume;

    pageBackgroundMusic.preload =
        "auto";

    const tryPlay =
        async () => {
            if (!pageBackgroundMusic) {
                return;
            }

            try {
                await pageBackgroundMusic.play();
            } catch (error) {
                // L'autoplay può essere bloccato fino
                // alla prima interazione dell'utente.
            }
        };

    tryPlay();

    document.addEventListener(
        "pointerdown",
        tryPlay,
        { once: true }
    );

    document.addEventListener(
        "keydown",
        tryPlay,
        { once: true }
    );
}

// ============================================================
// VOLUME MUSICA
// ============================================================

function loadVendorMusicVolume() {
    try {
        const saved =
            localStorage.getItem(
                PALAZZO_MUSIC_VOLUME_KEY
            );

        if (
            saved === null ||
            saved === ""
        ) {
            return 0.35;
        }

        const value =
            Number(saved);

        if (!Number.isFinite(value)) {
            return 0.35;
        }

        return Math.max(
            0,
            Math.min(1, value)
        );

    } catch (error) {
        return 0.35;
    }
}

function saveVendorMusicVolume(value) {
    try {
        localStorage.setItem(
            PALAZZO_MUSIC_VOLUME_KEY,
            String(value)
        );
    } catch (error) {
        // localStorage può essere disabilitato.
    }
}

function getVendorVolumeIcon(volume) {
    if (volume <= 0) {
        return "🔇";
    }

    if (volume < 0.5) {
        return "🔉";
    }

    return "🔊";
}

function updateVendorVolumeUI() {
    const button =
        document.getElementById(
            "vendor-volume-button"
        );

    const slider =
        document.getElementById(
            "vendor-volume-slider"
        );

    const value =
        document.getElementById(
            "vendor-volume-value"
        );

    const percentage =
        Math.round(
            vendorMusicVolume * 100
        );

    if (button) {
        button.textContent =
            getVendorVolumeIcon(
                vendorMusicVolume
            );

        button.title =
            `Volume musica: ${percentage}%`;
    }

    if (slider) {
        slider.value =
            String(percentage);
    }

    if (value) {
        value.textContent =
            `${percentage}%`;
    }
}

function setupVendorVolumeControl() {
    const control =
        document.querySelector(
            ".vendor-volume-control"
        );

    const button =
        document.getElementById(
            "vendor-volume-button"
        );

    const popover =
        document.getElementById(
            "vendor-volume-popover"
        );

    const slider =
        document.getElementById(
            "vendor-volume-slider"
        );

    if (
        !control ||
        !button ||
        !popover ||
        !slider
    ) {
        return;
    }

    updateVendorVolumeUI();

    button.addEventListener(
        "click",
        event => {
            event.preventDefault();
            event.stopPropagation();

            const willOpen =
                popover.hidden === true;

            popover.hidden =
                !willOpen;

            button.setAttribute(
                "aria-expanded",
                willOpen
                    ? "true"
                    : "false"
            );
        }
    );

    slider.addEventListener(
        "input",
        () => {
            vendorMusicVolume =
                Math.max(
                    0,
                    Math.min(
                        1,
                        Number(
                            slider.value
                        ) / 100
                    )
                );

            if (pageBackgroundMusic) {
                pageBackgroundMusic.volume =
                    vendorMusicVolume;
            }

            saveVendorMusicVolume(
                vendorMusicVolume
            );

            updateVendorVolumeUI();
        }
    );

    document.addEventListener(
        "click",
        event => {
            if (
                control.contains(
                    event.target
                )
            ) {
                return;
            }

            popover.hidden =
                true;

            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    );
}

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
        startBackgroundMusic(
            "../../../music/vendor.mp3"
        );

        setupVendorVolumeControl();

        try {
            await loadVendorCharacter();
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
            "../../../login.html";

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
            "../../../personaggio.html";

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
                    gold_value,
                    grants_ability_id
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
                    gold_value,
                    grants_ability_id
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

    if (!vendorItems.length) {
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
                (a, b) => {
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
            max: 99,
            excludeAbilityScroll: true
        },
        {
            label: "OGGETTI COMUNI",
            min: 100,
            max: 199,
            excludeAbilityScroll: true
        },
        {
            label: "OGGETTI RARI",
            min: 200,
            max: Infinity,
            excludeAbilityScroll: true
        },
        {
            label: "PERGAMENE ABILITÀ",
            min: 300,
            max: Infinity,
            abilityScrollOnly: true
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

                    const isAbilityScroll =
                        Boolean(
                            row.item
                                ?.grants_ability_id
                        );

                    if (
                        group.abilityScrollOnly
                        &&
                        !isAbilityScroll
                    ) {
                        return false;
                    }

                    if (
                        group.excludeAbilityScroll
                        &&
                        isAbilityScroll
                    ) {
                        return false;
                    }

                    return (
                        minScore >= group.min
                        &&
                        minScore <= group.max
                    );
                }
            );

        if (!groupItems.length) {
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

                                <div class="vendor-buy-group">

                                    <button
                                        class="merchant-button vendor-buy-button"
                                        type="button"
                                        data-buy-item-id="${escapeVendorHtml(
                                            row.item.id
                                        )}"
                                        data-buy-price="${price}"
                                        data-buy-quantity="1"
                                    >
                                        ×1
                                    </button>

                                    <button
                                        class="merchant-button vendor-buy-button"
                                        type="button"
                                        data-buy-item-id="${escapeVendorHtml(
                                            row.item.id
                                        )}"
                                        data-buy-price="${price}"
                                        data-buy-quantity="5"
                                    >
                                        ×5
                                    </button>

                                    <button
                                        class="merchant-button vendor-buy-button"
                                        type="button"
                                        data-buy-item-id="${escapeVendorHtml(
                                            row.item.id
                                        )}"
                                        data-buy-price="${price}"
                                        data-buy-quantity="10"
                                    >
                                        ×10
                                    </button>

                                </div>

                            </article>
                        `;
                    }
                )
                .join("");
    }

    container.innerHTML =
        html;

    const goldEntry =
        characterInventory.find(
            entry =>
                entry?.item?.id ===
                "moneta_oro"
        );

    const gold =
        Math.max(
            0,
            Number(
                goldEntry?.quantity
            ) || 0
        );

    container
        .querySelectorAll(
            ".vendor-buy-button"
        )
        .forEach(
            button => {
                const price =
                    Math.max(
                        0,
                        Number(
                            button.dataset.buyPrice
                        ) || 0
                    );

                const quantity =
                    Math.max(
                        1,
                        Number(
                            button.dataset.buyQuantity
                        ) || 1
                    );

                button.disabled =
                    gold <
                    price * quantity;
            }
        );
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
// Il Vendor ora appartiene esclusivamente al Livello Base.
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
            button.disabled =
                true;

            try {
                if (
                    character &&
                    character.id
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
                                    "base"
                            })
                            .eq(
                                "id",
                                character.id
                            );

                    if (error) {
                        throw error;
                    }
                }

                resetVendorVisitMemory();

                window.location.href =
                    "../../base.html";

            } catch (error) {
                console.error(
                    "Errore uscita dal vendor:",
                    error
                );

                setVendorDialogue(
                    "Non riesco a lasciarti andare. Riprova."
                );

                button.disabled =
                    false;
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
                    data?.payment_method ===
                        "item"
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
        !form ||
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


function isPalaceOriginQuestion(message) {
    const normalized = String(message || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const directPhrases = [
        "come sono finito qui",
        "come sono arrivato qui",
        "perche sono qui",
        "perche mi trovo qui",
        "cosa ci faccio qui",
        "chi mi ha portato qui",
        "come sono finito nel palazzo",
        "come sono arrivato nel palazzo",
        "come sono entrato nel palazzo",
        "perche sono nel palazzo",
        "perche mi trovo nel palazzo"
    ];

    if (directPhrases.some(phrase => normalized.includes(phrase))) return true;

    const asksHow = normalized.includes("come") || normalized.includes("perche") || normalized.includes("chi");
    const aboutArrival = normalized.includes("finito") || normalized.includes("arrivato") || normalized.includes("portato") || normalized.includes("entrato") || normalized.includes("trovo");
    const aboutPlace = normalized.includes("qui") || normalized.includes("palazzo");

    return asksHow && aboutArrival && aboutPlace;
}

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
        !input ||
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

    if (isPalaceOriginQuestion(message)) {
        input.value = "";
        const reply = "È doloroso ricordare, vero? Ti aiuto io.";
        vendorVisitHistory.push({ role: "user", content: message }, { role: "assistant", content: reply });
        if (vendorVisitHistory.length > 10) vendorVisitHistory = vendorVisitHistory.slice(-10);
        setVendorDialogue(reply);
        input.disabled = true;
        button.disabled = true;
        button.textContent = "...";
        window.setTimeout(() => {
            window.location.href = "../../../intro/intro.html?return=mano";
        }, 1800);
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

            if (
                error.context
                &&
                typeof error.context.json ===
                    "function"
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

        if (!previousReply) {
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

    // Ricalcola subito quali acquisti sono disponibili
    // in base al nuovo saldo di monete.
    renderVendorItems();
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

    const unitPrice =
        Math.max(
            0,
            Number(
                button.dataset.buyPrice
            ) || 0
        );

    const buyQuantity =
        Math.max(
            1,
            Math.floor(
                Number(
                    button.dataset.buyQuantity
                ) || 1
            )
        );

    if (!itemId) {
        return;
    }

    const totalPrice =
        unitPrice *
        buyQuantity;

    const row =
        button.closest(
            ".vendor-stock-item"
        );

    const rowButtons =
        row?.querySelectorAll(
            ".vendor-buy-button"
        ) || [];

    const originalText =
        button.textContent;

    try {
        rowButtons.forEach(
            currentButton => {
                currentButton.disabled =
                    true;
            }
        );

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
                        itemId,

                    p_quantity:
                        buyQuantity
                }
            );

        if (error) {
            throw error;
        }

        await refreshVendorInventory();
        renderVendorItems();

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
            buyQuantity === 1
                ? `Affare fatto. ${itemName} è tuo per ${totalPrice} monete d'oro.`
                : `Affare fatto. ${buyQuantity} × ${itemName} sono tuoi per ${totalPrice} monete d'oro.`;

        setVendorDialogue(
            tradeReply
        );

        vendorVisitHistory.push(
            {
                role:
                    "user",

                content:
                    `[EVENTO DI GIOCO CONFERMATO] Il PG ha acquistato ${buyQuantity} × ${itemName} per ${totalPrice} monete d'oro.`
            },
            {
                role:
                    "assistant",

                content:
                    tradeReply
            }
        );

        vendorVisitHistory =
            vendorVisitHistory.slice(
                -10
            );

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
        if (button?.isConnected) {
            button.textContent =
                originalText;
        }
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

    const sellQuantity =
        Math.max(
            1,
            Math.floor(
                Number(
                    button.dataset.sellQuantity
                ) || 1
            )
        );

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

    const ownedQuantity =
        Math.max(
            0,
            Number(
                inventoryEntry?.quantity
            ) || 0
        );

    if (
        ownedQuantity <
        sellQuantity
    ) {
        setVendorDialogue(
            `Non ne hai abbastanza. Ne possiedi ${ownedQuantity}.`
        );

        return;
    }

    const itemName =
        inventoryEntry
            ?.item
            ?.name
        ||
        itemId
        ||
        "Oggetto";

    const unitSellPrice =
        Math.max(
            0,
            Number(
                inventoryEntry
                    ?.item
                    ?.gold_value
            ) || 0
        );

    const totalSellPrice =
        unitSellPrice *
        sellQuantity;

    const originalText =
        button.textContent;

    const rowButtons =
        row?.querySelectorAll(
            ".player-item-sell-button"
        ) || [];

    try {
        rowButtons.forEach(
            currentButton => {
                currentButton.disabled =
                    true;
            }
        );

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
                        ),

                    p_quantity:
                        sellQuantity
                }
            );

        if (error) {
            throw error;
        }

        await refreshVendorInventory();

        const tradeReply =
            sellQuantity === 1
                ? `Prendo ${itemName}. Ti darò ${totalSellPrice} monete d'oro.`
                : `Prendo ${sellQuantity} × ${itemName}. Ti darò ${totalSellPrice} monete d'oro.`;

        setVendorDialogue(
            tradeReply
        );

        vendorVisitHistory.push(
            {
                role:
                    "user",

                content:
                    `[EVENTO DI GIOCO CONFERMATO] Il PG ha venduto ${sellQuantity} × ${itemName} per ${totalSellPrice} monete d'oro.`
            },
            {
                role:
                    "assistant",

                content:
                    tradeReply
            }
        );

        vendorVisitHistory =
            vendorVisitHistory.slice(
                -10
            );

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

        rowButtons.forEach(
            currentButton => {
                const quantity =
                    Math.max(
                        1,
                        Number(
                            currentButton.dataset.sellQuantity
                        ) || 1
                    );

                currentButton.disabled =
                    ownedQuantity <
                    quantity;
            }
        );

    } finally {
        if (button?.isConnected) {
            button.textContent =
                originalText;
        }
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
// RENDER INVENTARIO PG
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
                (a, b) =>
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

                    const quantity =
                        Math.max(
                            0,
                            Number(
                                entry.quantity
                            ) || 0
                        );

                    const sellDisabled =
                        entry.equipped_slot
                            ? "disabled"
                            : "";

                    const sell5Disabled =
                        (
                            entry.equipped_slot
                            ||
                            quantity < 5
                        )
                            ? "disabled"
                            : "";

                    const sell10Disabled =
                        (
                            entry.equipped_slot
                            ||
                            quantity < 10
                        )
                            ? "disabled"
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

                            <div class="player-item-quantity">
                                ×${quantity}
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

                                <div class="player-item-sell-group">

                                    <button
                                        class="player-item-sell-button"
                                        type="button"
                                        data-sell-item-id="${escapeVendorHtml(
                                            entry.item.id
                                        )}"
                                        data-sell-quantity="1"
                                        ${sellDisabled}
                                    >
                                        ×1
                                    </button>

                                    <button
                                        class="player-item-sell-button"
                                        type="button"
                                        data-sell-item-id="${escapeVendorHtml(
                                            entry.item.id
                                        )}"
                                        data-sell-quantity="5"
                                        ${sell5Disabled}
                                    >
                                        ×5
                                    </button>

                                    <button
                                        class="player-item-sell-button"
                                        type="button"
                                        data-sell-item-id="${escapeVendorHtml(
                                            entry.item.id
                                        )}"
                                        data-sell-quantity="10"
                                        ${sell10Disabled}
                                    >
                                        ×10
                                    </button>

                                </div>

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
