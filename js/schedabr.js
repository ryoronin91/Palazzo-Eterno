// ============================================================
// PALAZZO ETERNO
// SCHEDA.JS
// ============================================================
//
// Gestisce:
//
// - autenticazione del giocatore
// - caricamento del ruolo utente
// - caricamento del personaggio
// - visualizzazione degli attributi
// - calcolo delle statistiche secondarie
// - caricamento del token
// - caricamento inventario
// - visualizzazione equipaggiamento
// - visualizzazione zaino
// - caricamento delle note
// - salvataggio delle note
// - accesso modalità Master
// - logout
//
// ============================================================


console.log("SCHEDA.JS CARICATO");


// ============================================================
// CLIENT SUPABASE
// ============================================================

const db = supabaseClient;


// ============================================================
// VARIABILI
// ============================================================

let currentUser = null;

let character = null;

let currentUserRole = "player";

let characterInventory = [];


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "Pagina scheda pronta."
        );

        try {

            await checkUser();

            await loadUserRole();

            await loadCharacter();

            await loadInventory();

            displayCharacter();

            displayInventory();

            updateMasterEntryButton();

            setupEvents();

        } catch (error) {

            console.error(
                "Errore durante il caricamento della scheda:",
                error
            );

            showMessage(
                "Errore durante il caricamento della scheda: " +
                error.message
            );

        }

    }
);


// ============================================================
// CONTROLLO AUTENTICAZIONE
// ============================================================

async function checkUser() {

    const {
        data: {
            user
        },
        error
    } =
        await db.auth.getUser();


    if (error) {

        throw error;

    }


    if (!user) {

        window.location.href =
            "login.html";

        return;

    }


    currentUser =
        user;


    console.log(
        "Utente autenticato:",
        currentUser.id
    );


    const emailElement =
        document.getElementById(
            "user-email"
        );


    if (emailElement) {

        emailElement.textContent =
            currentUser.email || "";

    }

}


// ============================================================
// CARICAMENTO RUOLO UTENTE
// ============================================================

async function loadUserRole() {

    console.log(
        "Caricamento ruolo utente..."
    );


    const {
        data,
        error
    } =
        await db
            .from("user_roles")
            .select("role")
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();


    if (error) {

        throw error;

    }


    currentUserRole =
        data?.role ||
        "player";


    console.log(
        "Ruolo utente:",
        currentUserRole
    );

}


// ============================================================
// PULSANTE ACCESSO MASTER
// ============================================================

function updateMasterEntryButton() {

    const masterButton =
        document.getElementById(
            "master-entry-button"
        );


    if (!masterButton) {

        return;

    }


    if (
        currentUserRole ===
        "master"
    ) {

        masterButton.style.display =
            "inline-flex";

    } else {

        masterButton.style.display =
            "none";

    }

}


// ============================================================
// CARICAMENTO PERSONAGGIO
// ============================================================

async function loadCharacter() {

    console.log(
        "Caricamento personaggio..."
    );


    const {
        data,
        error
    } =
        await db
            .from("characters")
            .select("*")
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();


    if (error) {

        throw error;

    }


    if (!data) {

        console.log(
            "Nessun personaggio trovato."
        );


        window.location.href =
            "personaggio.html";

        return;

    }


    character =
        data;


    console.log(
        "Personaggio caricato:",
        character
    );

}


// ============================================================
// CARICAMENTO INVENTARIO
// ============================================================

async function loadInventory() {

    console.log(
        "Caricamento inventario..."
    );


    if (!character) {

        characterInventory = [];

        return;

    }


    const {
        data,
        error
    } =
        await db
            .from("character_inventory")
            .select(`
                id,
                character_id,
                item_id,
                quantity,
                equipped_slot,
                created_at,
                updated_at,
                item:items (
                    id,
                    name,
                    description,
                    item_type,
                    equip_slot,
                    hand_rule,
                    stackable,
                    max_stack,
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
                    unique_world,
                    vendor_unlimited,
                    recipe_only
                )
            `)
            .eq(
                "character_id",
                character.id
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if (error) {

        throw error;

    }


    characterInventory =
        data || [];


    console.log(
        "Inventario caricato:",
        characterInventory
    );

}


// ============================================================
// VISUALIZZAZIONE PERSONAGGIO
// ============================================================

function displayCharacter() {

    if (!character) {

        return;

    }


    const nameElement =
        document.getElementById(
            "character-name"
        );


    if (nameElement) {

        nameElement.textContent =
            character.nome ||
            "Avventuriero";

    }


    const levelElement =
        document.getElementById(
            "character-level"
        );


    if (levelElement) {

        const level =
            Number(
                character.livello
            ) || 1;


        levelElement.textContent =
            `Livello ${level}`;

    }


    displayToken();


    displayAttribute(
        "forza",
        character.forza
    );


    displayAttribute(
        "resistenza",
        character.resistenza
    );


    displayAttribute(
        "costituzione",
        character.costituzione
    );


    displayAttribute(
        "intelligenza",
        character.intelligenza
    );


    displayAttribute(
        "destrezza",
        character.destrezza
    );


    displayAttribute(
        "fortuna",
        character.fortuna
    );


    calculateSecondaryStats();


    const notesElement =
        document.getElementById(
            "character-notes"
        );


    if (notesElement) {

        notesElement.value =
            character.notes || "";

    }

}


// ============================================================
// VISUALIZZA UN ATTRIBUTO
// ============================================================

function displayAttribute(
    attributeName,
    value
) {

    const element =
        document.getElementById(
            `${attributeName}-display`
        );


    if (!element) {

        console.warn(
            `Elemento ${attributeName}-display non trovato.`
        );

        return;

    }


    const numericValue =
        Number(value);


    if (
        Number.isFinite(
            numericValue
        )
    ) {

        element.textContent =
            numericValue;

    } else {

        element.textContent =
            "1";

    }

}


// ============================================================
// TOKEN
// ============================================================

function displayToken() {

    const tokenElement =
        document.getElementById(
            "character-token"
        );


    if (!tokenElement) {

        return;

    }


    if (
        !character.token
    ) {

        tokenElement.style.display =
            "none";

        console.warn(
            "Il personaggio non ha un token associato."
        );

        return;

    }


    let tokenPath =
        character.token;


    if (
        !tokenPath.includes("/")
    ) {

        tokenPath =
            `immagini/token/${tokenPath}`;

    }


    tokenElement.src =
        tokenPath;


    tokenElement.alt =
        `Token di ${character.nome || "personaggio"}`;


    tokenElement.style.display =
        "block";


    tokenElement.onerror =
        () => {

            console.error(
                "Impossibile caricare il token:",
                tokenPath
            );

            tokenElement.style.display =
                "none";

        };

}


// ============================================================
// CALCOLO STATISTICHE SECONDARIE
// ============================================================
//
// PER ORA:
//
// gli oggetti vengono visualizzati ma i loro bonus NON vengono
// ancora applicati alle statistiche.
//
// Lo faremo nel prossimo passaggio.
//
// ============================================================

function calculateSecondaryStats() {

    const forza =
        getAttributeValue(
            "forza"
        );


    const resistenza =
        getAttributeValue(
            "resistenza"
        );


    const costituzione =
        getAttributeValue(
            "costituzione"
        );


    const intelligenza =
        getAttributeValue(
            "intelligenza"
        );


    const destrezza =
        getAttributeValue(
            "destrezza"
        );


    const fortuna =
        getAttributeValue(
            "fortuna"
        );


    const attack =
        Math.ceil(
            forza / 2
        );


    const defense =
        Math.ceil(
            7 +
            (
                resistenza / 2
            )
        );


    const life =
        Math.ceil(
            5 *
            (
                costituzione / 2
            )
        );


    const mana =
        Math.ceil(
            5 *
            (
                intelligenza / 2
            )
        );


    const movement =
        Math.ceil(
            4 +
            (
                destrezza / 2
            )
        );


    const critical =
        Math.min(
            50,
            Math.ceil(
                fortuna *
                (
                    50 / 30
                )
            )
        );


    setSecondaryValue(
        "attack-display",
        attack
    );


    setSecondaryValue(
        "defense-display",
        defense
    );


    setSecondaryValue(
        "life-display",
        life
    );


    setSecondaryValue(
        "mana-display",
        mana
    );


    setSecondaryValue(
        "movement-display",
        movement
    );


    setSecondaryValue(
        "critical-display",
        `${critical}%`
    );

}


// ============================================================
// RECUPERA VALORE ATTRIBUTO
// ============================================================

function getAttributeValue(
    attributeName
) {

    const value =
        Number(
            character[attributeName]
        );


    if (
        !Number.isFinite(
            value
        )
    ) {

        return 1;

    }


    return Math.max(
        1,
        Math.min(
            30,
            value
        )
    );

}


// ============================================================
// IMPOSTA STATISTICA SECONDARIA
// ============================================================

function setSecondaryValue(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (!element) {

        console.warn(
            `Elemento ${elementId} non trovato.`
        );

        return;

    }


    element.textContent =
        value;

}


// ============================================================
// VISUALIZZAZIONE INVENTARIO
// ============================================================

function displayInventory() {

    displayEquipment();

    displayBackpack();

}


// ============================================================
// EQUIPAGGIAMENTO
// ============================================================

function displayEquipment() {

    const slots = {

        hand_1: {
            htmlKey: "hand-1",
            label: "Mano 1"
        },

        hand_2: {
            htmlKey: "hand-2",
            label: "Mano 2"
        },

        armor: {
            htmlKey: "armor",
            label: "Armatura"
        },

        accessory_1: {
            htmlKey: "accessory-1",
            label: "Accessorio 1"
        },

        accessory_2: {
            htmlKey: "accessory-2",
            label: "Accessorio 2"
        },

        accessory_3: {
            htmlKey: "accessory-3",
            label: "Accessorio 3"
        }

    };


    for (
        const [
            slotName,
            slotInfo
        ]
        of Object.entries(slots)
    ) {

        const inventoryEntry =
            characterInventory.find(
                entry =>
                    entry.equipped_slot ===
                    slotName
            ) || null;


        renderEquipmentSlot(
            slotInfo.htmlKey,
            slotInfo.label,
            inventoryEntry
        );

    }

}


// ============================================================
// DISEGNA UNO SLOT EQUIPAGGIAMENTO
// ============================================================

function renderEquipmentSlot(
    htmlKey,
    slotLabel,
    inventoryEntry
) {

    const container =
        document.getElementById(
            `equipment-slot-${htmlKey}`
        );


    if (!container) {

        return;

    }


    let content =
        container.querySelector(
            "[data-equipment-content]"
        );


    if (!content) {

        content =
            document.createElement(
                "div"
            );


        content.setAttribute(
            "data-equipment-content",
            "true"
        );


        content.className =
            "equipment-dynamic-content";


        container.appendChild(
            content
        );

    }


    content.replaceChildren();


    if (
        !inventoryEntry ||
        !inventoryEntry.item
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "equipment-empty";


        empty.textContent =
            "Vuoto";


        content.appendChild(
            empty
        );


        return;

    }


    const item =
        inventoryEntry.item;


    const name =
        document.createElement(
            "div"
        );


    name.className =
        "equipment-item-name";


    name.textContent =
        item.name;


    content.appendChild(
        name
    );


    if (item.description) {

        const description =
            document.createElement(
                "div"
            );


        description.className =
            "equipment-item-description";


        description.textContent =
            item.description;


        content.appendChild(
            description
        );

    }


    const value =
        document.createElement(
            "div"
        );


    value.className =
        "equipment-item-value";


    value.textContent =
        `Valore: ${Number(item.gold_value) || 0} MO`;


    content.appendChild(
        value
    );

}


// ============================================================
// ZAINO
// ============================================================

function displayBackpack() {

    const backpackList =
        document.getElementById(
            "backpack-list"
        );


    const backpackCount =
        document.getElementById(
            "backpack-count"
        );


    const backpackEmpty =
        document.getElementById(
            "backpack-empty"
        );


    const backpackItems =
        characterInventory.filter(
            entry =>
                !entry.equipped_slot
        );


    const totalObjects =
        backpackItems.reduce(
            (
                total,
                entry
            ) =>
                total +
                (
                    Number(
                        entry.quantity
                    ) || 0
                ),
            0
        );


    if (backpackCount) {

        backpackCount.textContent =
            totalObjects === 1
                ? "1 oggetto"
                : `${totalObjects} oggetti`;

    }


    if (backpackEmpty) {

        backpackEmpty.style.display =
            backpackItems.length === 0
                ? ""
                : "none";

    }


    if (!backpackList) {

        return;

    }


    backpackList.replaceChildren();


    if (
        backpackItems.length === 0
    ) {

        return;

    }


    for (
        const inventoryEntry
        of backpackItems
    ) {

        renderBackpackItem(
            backpackList,
            inventoryEntry
        );

    }

}


// ============================================================
// DISEGNA UN OGGETTO NELLO ZAINO
// ============================================================

function renderBackpackItem(
    backpackList,
    inventoryEntry
) {

    const item =
        inventoryEntry.item;


    if (!item) {

        return;

    }


    const quantity =
        Number(
            inventoryEntry.quantity
        ) || 1;


    const card =
        document.createElement(
            "div"
        );


    card.className =
        "backpack-item";


    card.dataset.inventoryId =
        inventoryEntry.id;


    card.dataset.itemId =
        inventoryEntry.item_id;


    // --------------------------------------------------------
    // PARTE PRINCIPALE
    // --------------------------------------------------------

    const main =
        document.createElement(
            "div"
        );


    main.className =
        "backpack-item-main";


    // --------------------------------------------------------
    // NOME
    // --------------------------------------------------------

    const name =
        document.createElement(
            "div"
        );


    name.className =
        "backpack-item-name";


    name.textContent =
        item.name;


    if (
        quantity > 1
    ) {

        const quantityElement =
            document.createElement(
                "span"
            );


        quantityElement.className =
            "backpack-item-quantity";


        quantityElement.textContent =
            ` ×${quantity}`;


        name.appendChild(
            quantityElement
        );

    }


    main.appendChild(
        name
    );


    // --------------------------------------------------------
    // DESCRIZIONE
    // --------------------------------------------------------

    if (item.description) {

        const description =
            document.createElement(
                "div"
            );


        description.className =
            "backpack-item-description";


        description.textContent =
            item.description;


        main.appendChild(
            description
        );

    }


    // --------------------------------------------------------
    // VALORE ECONOMICO
    // --------------------------------------------------------

    const value =
        document.createElement(
            "div"
        );


    value.className =
        "backpack-item-value";


    const unitValue =
        Number(
            item.gold_value
        ) || 0;


    value.textContent =
        `Valore: ${unitValue} MO`;


    if (
        quantity > 1
    ) {

        const totalValue =
            unitValue *
            quantity;


        value.textContent +=
            ` ciascuno · Totale: ${totalValue} MO`;

    }


    main.appendChild(
        value
    );


    card.appendChild(
        main
    );


    backpackList.appendChild(
        card
    );

}


// ============================================================
// EVENTI
// ============================================================

function setupEvents() {

    const saveNotesButton =
        document.getElementById(
            "save-notes-button"
        );


    if (saveNotesButton) {

        saveNotesButton.addEventListener(
            "click",
            saveNotes
        );

    }


    const logoutButton =
        document.getElementById(
            "logout-button"
        );


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            logout
        );

    }

}


// ============================================================
// SALVA NOTE
// ============================================================

async function saveNotes() {

    const notesElement =
        document.getElementById(
            "character-notes"
        );


    if (!notesElement) {

        return;

    }


    const notes =
        notesElement.value;


    const saveButton =
        document.getElementById(
            "save-notes-button"
        );


    if (saveButton) {

        saveButton.disabled =
            true;

        saveButton.textContent =
            "SALVATAGGIO...";

    }


    try {

        const {
            data,
            error
        } =
            await db
                .from("characters")
                .update({

                    notes:
                        notes,

                    updated_at:
                        new Date().toISOString()

                })
                .eq(
                    "id",
                    character.id
                )
                .select()
                .single();


        if (error) {

            throw error;

        }


        character =
            data;


        showMessage(
            "Note salvate correttamente!"
        );


    } catch (error) {

        console.error(
            "Errore salvataggio note:",
            error
        );


        showMessage(
            "Errore durante il salvataggio delle note: " +
            error.message
        );


    } finally {

        if (saveButton) {

            saveButton.disabled =
                false;

            saveButton.textContent =
                "SALVA NOTE";

        }

    }

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    console.log(
        "Logout..."
    );


    const {
        error
    } =
        await db.auth.signOut();


    if (error) {

        console.error(
            "Errore logout:",
            error
        );

        return;

    }


    window.location.href =
        "index.html";

}


// ============================================================
// MESSAGGI
// ============================================================

function showMessage(
    text
) {

    const element =
        document.getElementById(
            "sheet-message"
        );


    if (!element) {

        return;

    }


    element.textContent =
        text;


    setTimeout(
        () => {

            if (
                element.textContent ===
                text
            ) {

                element.textContent =
                    "";

            }

        },
        4000
    );

}
