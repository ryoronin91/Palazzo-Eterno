// ============================================================
// PALAZZO ETERNO - PERSONAGGIO.JS
// ============================================================
// Gestisce creazione personaggio, point-buy, token e corredo iniziale.
//
// Corredo iniziale:
// - 3 oggetti equipaggiabili scelti dal giocatore
// - 1 Pozione cura mana
// - 1 Pozione cura vita
// - 10 Monete d'oro
// ============================================================

console.log("PERSONAGGIO.JS CARICATO");


document.addEventListener(
    "DOMContentLoaded",
    async () => {

        // ====================================================
        // CONFIGURAZIONE
        // ====================================================

        const INITIAL_POINTS = 10;

        const MIN_ATTRIBUTE = 1;

        const MAX_ATTRIBUTE = 30;

        const REQUIRED_STARTING_ITEMS = 3;


        const attributes = [

            "forza",

            "resistenza",

            "costituzione",

            "intelligenza",

            "destrezza",

            "fortuna"

        ];


        // ====================================================
        // VALORI ATTRIBUTI
        // ====================================================

        let attributeValues = {

            forza: 1,

            resistenza: 1,

            costituzione: 1,

            intelligenza: 1,

            destrezza: 1,

            fortuna: 1

        };


        // ====================================================
        // VARIABILI
        // ====================================================

        let currentUser = null;

        let currentCharacter = null;

        let selectedToken = null;

        let startingItems = [];


        const selectedStartingItems =
            new Set();


        // ====================================================
        // ELEMENTI HTML
        // ====================================================

        const form =
            document.getElementById(
                "character-form"
            );


        const message =
            document.getElementById(
                "character-message"
            );


        const logoutButton =
            document.getElementById(
                "logout-button"
            );


        // ====================================================
        // CONTROLLO LOGIN
        // ====================================================

        const {

            data: {
                user
            },

            error: userError

        } =
            await supabaseClient
                .auth
                .getUser();


        if (
            userError ||
            !user
        ) {

            console.log(
                "Utente non autenticato."
            );


            window.location.href =
                "login.html";


            return;

        }


        currentUser =
            user;


        // ====================================================
        // EMAIL
        // ====================================================

        const emailElement =
            document.getElementById(
                "user-email"
            );


        if (emailElement) {

            emailElement.textContent =
                user.email || "";

        }


        // ====================================================
        // MESSAGGI
        // ====================================================

        function showMessage(
            text
        ) {

            if (!message) {

                return;

            }


            message.textContent =
                text;

        }


        // ====================================================
        // CONTROLLO PERSONAGGIO ESISTENTE
        // ====================================================

        async function checkExistingCharacter() {

            console.log(
                "Controllo personaggio esistente..."
            );


            const {
                data,
                error
            } =
                await supabaseClient
                    .from("characters")
                    .select("id")
                    .eq(
                        "user_id",
                        currentUser.id
                    )
                    .maybeSingle();


            if (error) {

                console.error(
                    "Errore controllo personaggio:",
                    error
                );


                showMessage(
                    "Errore nel controllo del personaggio."
                );


                return true;

            }


            if (data) {

                currentCharacter =
                    data;


                window.location.href =
                    "scheda.html";


                return true;

            }


            return false;

        }


        // ====================================================
        // CALCOLO STATISTICHE SECONDARIE
        // ====================================================

        function calculateSecondaryStats() {

            const forza =
                attributeValues.forza;


            const resistenza =
                attributeValues.resistenza;


            const costituzione =
                attributeValues.costituzione;


            const intelligenza =
                attributeValues.intelligenza;


            const destrezza =
                attributeValues.destrezza;


            const fortuna =
                attributeValues.fortuna;


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


            const hp =
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
                        (
                            fortuna / 60
                        ) *
                        100
                    )
                );


            return {

                attack,

                defense,

                hp,

                mana,

                movement,

                critical

            };

        }


        // ====================================================
        // IMPOSTA TESTO
        // ====================================================

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


        // ====================================================
        // AGGIORNA STATISTICHE SECONDARIE
        // ====================================================

        function updateSecondaryStats() {

            const secondary =
                calculateSecondaryStats();


            setText(
                "attack-display",
                secondary.attack
            );


            setText(
                "attacco-secondary",
                `Attacco: ${secondary.attack}`
            );


            setText(
                "defense-display",
                secondary.defense
            );


            setText(
                "difesa-secondary",
                `Difesa: ${secondary.defense}`
            );


            setText(
                "health-display",
                secondary.hp
            );


            setText(
                "costituzione-secondary",
                `Vita: ${secondary.hp}`
            );


            setText(
                "mana-display",
                secondary.mana
            );


            setText(
                "intelligenza-secondary",
                `Mana: ${secondary.mana}`
            );


            setText(
                "movement-display",
                secondary.movement
            );


            setText(
                "destrezza-secondary",
                `Movimento: ${secondary.movement}`
            );


            setText(
                "critical-display",
                `${secondary.critical}%`
            );


            setText(
                "fortuna-secondary",
                `Critico: ${secondary.critical}%`
            );

        }


        // ====================================================
        // CALCOLO PUNTI SPESI
        // ====================================================

        function calculateSpentPoints() {

            return attributes.reduce(

                (
                    total,
                    attribute
                ) => {

                    return total +
                        (
                            attributeValues[
                                attribute
                            ] - 1
                        );

                },

                0

            );

        }


        // ====================================================
        // PUNTI RIMANENTI
        // ====================================================

        function getRemainingPoints() {

            return INITIAL_POINTS -
                calculateSpentPoints();

        }


        // ====================================================
        // AGGIORNA ATTRIBUTI
        // ====================================================

        function updateAttributesDisplay() {

            attributes.forEach(
                attribute => {

                    const value =
                        attributeValues[
                            attribute
                        ];


                    setText(
                        `${attribute}-value`,
                        value
                    );


                    const minusButton =
                        document.querySelector(
                            `.stat-minus[data-stat="${attribute}"]`
                        );


                    const plusButton =
                        document.querySelector(
                            `.stat-plus[data-stat="${attribute}"]`
                        );


                    if (minusButton) {

                        minusButton.disabled =
                            value <=
                            MIN_ATTRIBUTE;

                    }


                    if (plusButton) {

                        plusButton.disabled =
                            value >=
                            MAX_ATTRIBUTE ||
                            getRemainingPoints() <= 0;

                    }

                }
            );


            setText(
                "points-remaining",
                getRemainingPoints()
            );


            updateSecondaryStats();

        }


        // ====================================================
        // PULSANTI +
        // ====================================================

        document
            .querySelectorAll(
                ".stat-plus"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const attribute =
                                button.dataset.stat;


                            if (
                                !attributes.includes(
                                    attribute
                                )
                            ) {

                                return;

                            }


                            if (
                                attributeValues[
                                    attribute
                                ] >=
                                MAX_ATTRIBUTE
                            ) {

                                return;

                            }


                            if (
                                getRemainingPoints() <=
                                0
                            ) {

                                return;

                            }


                            attributeValues[
                                attribute
                            ] += 1;


                            updateAttributesDisplay();

                        }
                    );

                }
            );


        // ====================================================
        // PULSANTI -
        // ====================================================

        document
            .querySelectorAll(
                ".stat-minus"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const attribute =
                                button.dataset.stat;


                            if (
                                !attributes.includes(
                                    attribute
                                )
                            ) {

                                return;

                            }


                            if (
                                attributeValues[
                                    attribute
                                ] <=
                                MIN_ATTRIBUTE
                            ) {

                                return;

                            }


                            attributeValues[
                                attribute
                            ] -= 1;


                            updateAttributesDisplay();

                        }
                    );

                }
            );


        // ====================================================
        // TOKEN
        // ====================================================

        function setupTokenSelection() {

            const tokenOptions =
                document.querySelectorAll(
                    ".token-option"
                );


            const preview =
                document.getElementById(
                    "token-preview"
                );


            const selectedName =
                document.getElementById(
                    "selected-token-name"
                );


            tokenOptions.forEach(
                token => {

                    token.addEventListener(
                        "click",
                        () => {

                            tokenOptions.forEach(
                                option => {

                                    option.classList.remove(
                                        "selected"
                                    );

                                }
                            );


                            token.classList.add(
                                "selected"
                            );


                            selectedToken =
                                token.dataset.token;


                            if (preview) {

                                preview.innerHTML =
                                    "";


                                const image =
                                    document.createElement(
                                        "img"
                                    );


                                image.src =
                                    `immagini/token/${selectedToken}`;


                                image.alt =
                                    "Token selezionato";


                                preview.appendChild(
                                    image
                                );

                            }


                            if (selectedName) {

                                selectedName.textContent =
                                    "Token selezionato";

                            }

                        }
                    );

                }
            );

        }


        // ====================================================
        // CREA INTERFACCIA OGGETTI INIZIALI
        // ====================================================
        //
        // La sezione viene aggiunta automaticamente.
        // Non serve modificare personaggio.html.
        //
        // ====================================================

        function ensureStartingItemsUI() {

            if (
                document.getElementById(
                    "starting-items-list"
                )
            ) {

                return;

            }


            if (!form) {

                return;

            }


            // ------------------------------------------------
            // CSS
            // ------------------------------------------------

            const style =
                document.createElement(
                    "style"
                );


            style.textContent = `

                .starting-items-section {

                    margin-top: 35px;

                    margin-bottom: 30px;

                }


                .starting-items-description {

                    color: #aaa;

                    line-height: 1.6;

                    margin-bottom: 14px;

                }


                .starting-items-counter {

                    margin-bottom: 18px;

                    font-weight: bold;

                    color: #d4af67;

                }


                .starting-items-grid {

                    display: grid;

                    grid-template-columns:
                        repeat(
                            auto-fit,
                            minmax(220px, 1fr)
                        );

                    gap: 14px;

                }


                .starting-item {

                    text-align: left;

                    padding: 16px;

                    border-radius: 12px;

                    border:
                        2px solid
                        rgba(
                            255,
                            255,
                            255,
                            0.12
                        );

                    background:
                        rgba(
                            0,
                            0,
                            0,
                            0.28
                        );

                    color: inherit;

                    cursor: pointer;

                    transition:
                        border-color 0.15s ease,
                        transform 0.15s ease,
                        background 0.15s ease;

                }


                .starting-item:hover {

                    transform:
                        translateY(-2px);

                    border-color:
                        rgba(
                            184,
                            138,
                            59,
                            0.7
                        );

                }


                .starting-item.selected {

                    border-color:
                        #b88a3b;

                    background:
                        rgba(
                            184,
                            138,
                            59,
                            0.14
                        );

                    box-shadow:
                        0 0 0 2px
                        rgba(
                            184,
                            138,
                            59,
                            0.18
                        );

                }


                .starting-item-name {

                    font-weight: bold;

                    font-size: 17px;

                    margin-bottom: 8px;

                }


                .starting-item-description {

                    color: #bbb;

                    font-size: 14px;

                    line-height: 1.45;

                    min-height: 40px;

                }


                .starting-item-meta {

                    margin-top: 10px;

                    color: #d4af67;

                    font-size: 13px;

                    font-weight: bold;

                }


                .starting-kit-note {

                    margin-top: 18px;

                    padding:
                        14px 16px;

                    border-radius: 10px;

                    background:
                        rgba(
                            255,
                            255,
                            255,
                            0.05
                        );

                    color: #ccc;

                    line-height: 1.55;

                }


                @media (
                    max-width: 600px
                ) {

                    .starting-items-grid {

                        grid-template-columns:
                            1fr;

                    }

                }

            `;


            document.head.appendChild(
                style
            );


            // ------------------------------------------------
            // HTML
            // ------------------------------------------------

            const section =
                document.createElement(
                    "section"
                );


            section.className =
                "starting-items-section";


            section.innerHTML = `

                <h2>
                    Equipaggiamento iniziale
                </h2>


                <p class="starting-items-description">

                    Scegli
                    <strong>
                        3 oggetti equipaggiabili
                    </strong>
                    con cui iniziare l'avventura.

                    Gli oggetti scelti verranno messi
                    nello zaino e potrai equipaggiarli
                    dalla scheda del personaggio.

                </p>


                <div class="starting-items-counter">

                    Oggetti scelti:

                    <span id="starting-items-count">
                        0
                    </span>/3

                </div>


                <div
                    id="starting-items-list"
                    class="starting-items-grid"
                ></div>


                <div class="starting-kit-note">

                    Riceverai inoltre automaticamente:

                    <strong>
                        1 Pozione cura mana
                    </strong>,

                    <strong>
                        1 Pozione cura vita
                    </strong>

                    e

                    <strong>
                        10 Monete d'oro
                    </strong>.

                </div>

            `;


            form.parentNode.insertBefore(
                section,
                form
            );

        }


        // ====================================================
        // CARICA OGGETTI EQUIPAGGIABILI
        // ====================================================

        async function loadStartingItems() {

            console.log(
                "Caricamento oggetti iniziali..."
            );


            const {
                data,
                error
            } =
                await supabaseClient
                    .from("items")
                    .select(`
                        id,
                        name,
                        description,
                        item_type,
                        equip_slot,
                        hand_rule,
                        gold_value,
                        recipe_only
                    `)
                    .neq(
                        "equip_slot",
                        "none"
                    )
                    .eq(
                        "recipe_only",
                        false
                    )
                    .order(
                        "item_type",
                        {
                            ascending: true
                        }
                    )
                    .order(
                        "name",
                        {
                            ascending: true
                        }
                    );


            if (error) {

                console.error(
                    "Errore caricamento oggetti iniziali:",
                    error
                );


                showMessage(
                    "Impossibile caricare gli oggetti iniziali: " +
                    error.message
                );


                return;

            }


            startingItems =
                data || [];


            renderStartingItems();

        }


        // ====================================================
        // MOSTRA OGGETTI EQUIPAGGIABILI
        // ====================================================

        function renderStartingItems() {

            const container =
                document.getElementById(
                    "starting-items-list"
                );


            if (!container) {

                return;

            }


            container.replaceChildren();


            startingItems.forEach(
                item => {

                    const button =
                        document.createElement(
                            "button"
                        );


                    button.type =
                        "button";


                    button.className =
                        "starting-item";


                    button.dataset.itemId =
                        item.id;


                    if (
                        selectedStartingItems.has(
                            item.id
                        )
                    ) {

                        button.classList.add(
                            "selected"
                        );

                    }


                    // -----------------------------------------
                    // NOME
                    // -----------------------------------------

                    const name =
                        document.createElement(
                            "div"
                        );


                    name.className =
                        "starting-item-name";


                    name.textContent =
                        item.name;


                    // -----------------------------------------
                    // DESCRIZIONE
                    // -----------------------------------------

                    const description =
                        document.createElement(
                            "div"
                        );


                    description.className =
                        "starting-item-description";


                    description.textContent =
                        item.description ||
                        "Nessuna descrizione.";


                    // -----------------------------------------
                    // VALORE
                    // -----------------------------------------

                    const meta =
                        document.createElement(
                            "div"
                        );


                    meta.className =
                        "starting-item-meta";


                    meta.textContent =
                        `Valore: ${
                            Number(
                                item.gold_value
                            ) || 0
                        } MO`;


                    button.append(
                        name,
                        description,
                        meta
                    );


                    button.addEventListener(
                        "click",
                        () => {

                            toggleStartingItem(
                                item.id
                            );

                        }
                    );


                    container.appendChild(
                        button
                    );

                }
            );


            updateStartingItemsCounter();

        }


        // ====================================================
        // SELEZIONE / DESELEZIONE
        // ====================================================

        function toggleStartingItem(
            itemId
        ) {

            // ------------------------------------------------
            // DESELEZIONA
            // ------------------------------------------------

            if (
                selectedStartingItems.has(
                    itemId
                )
            ) {

                selectedStartingItems.delete(
                    itemId
                );


                renderStartingItems();


                return;

            }


            // ------------------------------------------------
            // MASSIMO 3
            // ------------------------------------------------

            if (
                selectedStartingItems.size >=
                REQUIRED_STARTING_ITEMS
            ) {

                showMessage(
                    "Puoi scegliere al massimo 3 oggetti iniziali."
                );


                return;

            }


            // ------------------------------------------------
            // SELEZIONA
            // ------------------------------------------------

            selectedStartingItems.add(
                itemId
            );


            renderStartingItems();

        }


        // ====================================================
        // CONTATORE
        // ====================================================

        function updateStartingItemsCounter() {

            setText(
                "starting-items-count",
                selectedStartingItems.size
            );

        }


        // ====================================================
        // CREA INVENTARIO INIZIALE
        // ====================================================

        async function saveStartingInventory(
            characterId
        ) {

            const inventoryRows = [

                // --------------------------------------------
                // 3 OGGETTI SCELTI
                // --------------------------------------------

                ...Array.from(
                    selectedStartingItems
                ).map(
                    itemId => ({

                        character_id:
                            characterId,

                        item_id:
                            itemId,

                        quantity:
                            1,

                        equipped_slot:
                            null

                    })
                ),


                // --------------------------------------------
                // POZIONE MANA
                // --------------------------------------------

                {

                    character_id:
                        characterId,

                    item_id:
                        "pozione_mana",

                    quantity:
                        1,

                    equipped_slot:
                        null

                },


                // --------------------------------------------
                // POZIONE VITA
                // --------------------------------------------

                {

                    character_id:
                        characterId,

                    item_id:
                        "pozione_vita",

                    quantity:
                        1,

                    equipped_slot:
                        null

                },


                // --------------------------------------------
                // 10 MONETE D'ORO
                // --------------------------------------------

                {

                    character_id:
                        characterId,

                    item_id:
                        "moneta_oro",

                    quantity:
                        10,

                    equipped_slot:
                        null

                }

            ];


            const {
                error
            } =
                await supabaseClient
                    .from(
                        "character_inventory"
                    )
                    .insert(
                        inventoryRows
                    );


            if (error) {

                throw error;

            }

        }


        // ====================================================
        // SALVATAGGIO PERSONAGGIO
        // ====================================================

        if (form) {

            form.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();


                    // -----------------------------------------
                    // NOME
                    // -----------------------------------------

                    const nameInput =
                        document.getElementById(
                            "nome"
                        );


                    const nome =
                        nameInput
                            ? nameInput.value.trim()
                            : "";


                    if (!nome) {

                        showMessage(
                            "Inserisci il nome del personaggio."
                        );


                        return;

                    }


                    // -----------------------------------------
                    // PUNTI
                    // -----------------------------------------

                    if (
                        getRemainingPoints() !==
                        0
                    ) {

                        showMessage(
                            "Devi utilizzare tutti i 10 punti abilità."
                        );


                        return;

                    }


                    // -----------------------------------------
                    // TOKEN
                    // -----------------------------------------

                    if (!selectedToken) {

                        showMessage(
                            "Seleziona un token per il tuo personaggio."
                        );


                        return;

                    }


                    // -----------------------------------------
                    // OGGETTI
                    // -----------------------------------------

                    if (
                        selectedStartingItems.size !==
                        REQUIRED_STARTING_ITEMS
                    ) {

                        showMessage(
                            "Devi scegliere esattamente 3 oggetti iniziali."
                        );


                        return;

                    }


                    // -----------------------------------------
                    // PERSONAGGIO GIÀ ESISTENTE
                    // -----------------------------------------

                    const alreadyExists =
                        await checkExistingCharacter();


                    if (alreadyExists) {

                        return;

                    }


                    // -----------------------------------------
                    // PULSANTE
                    // -----------------------------------------

                    const submitButton =
                        form.querySelector(
                            'button[type="submit"]'
                        );


                    if (submitButton) {

                        submitButton.disabled =
                            true;


                        submitButton.textContent =
                            "SALVATAGGIO...";

                    }


                    // -----------------------------------------
                    // DATI PERSONAGGIO
                    // -----------------------------------------

                    const characterData = {

                        user_id:
                            currentUser.id,

                        nome:
                            nome,

                        livello:
                            1,

                        forza:
                            attributeValues.forza,

                        resistenza:
                            attributeValues.resistenza,

                        costituzione:
                            attributeValues.costituzione,

                        intelligenza:
                            attributeValues.intelligenza,

                        destrezza:
                            attributeValues.destrezza,

                        fortuna:
                            attributeValues.fortuna,

                        token:
                            selectedToken,

                        updated_at:
                            new Date().toISOString()

                    };


                    try {

                        // -------------------------------------
                        // CREA PERSONAGGIO
                        // -------------------------------------

                        const {
                            data,
                            error
                        } =
                            await supabaseClient
                                .from(
                                    "characters"
                                )
                                .insert(
                                    characterData
                                )
                                .select()
                                .single();


                        if (error) {

                            throw error;

                        }


                        currentCharacter =
                            data;


                        console.log(
                            "Personaggio salvato:",
                            currentCharacter
                        );


                        // -------------------------------------
                        // CREA INVENTARIO
                        // -------------------------------------

                        try {

                            await saveStartingInventory(
                                currentCharacter.id
                            );

                        } catch (
                            inventoryError
                        ) {

                            console.error(
                                "Errore inventario iniziale:",
                                inventoryError
                            );


                            // ---------------------------------
                            // ROLLBACK
                            // ---------------------------------
                            //
                            // Se l'inventario non viene creato,
                            // eliminiamo il personaggio appena
                            // creato per non lasciare un PG
                            // incompleto.
                            //
                            // ---------------------------------

                            await supabaseClient
                                .from(
                                    "characters"
                                )
                                .delete()
                                .eq(
                                    "id",
                                    currentCharacter.id
                                );


                            currentCharacter =
                                null;


                            throw new Error(
                                "Inventario iniziale non creato: " +
                                inventoryError.message
                            );

                        }


                        // -------------------------------------
                        // SCHEDA
                        // -------------------------------------

                        window.location.href =
                            "scheda.html";


                    } catch (error) {

                        console.error(
                            "Errore creazione personaggio:",
                            error
                        );


                        showMessage(
                            "Errore durante la creazione del personaggio: " +
                            error.message
                        );


                        if (submitButton) {

                            submitButton.disabled =
                                false;


                            submitButton.textContent =
                                "SALVA PERSONAGGIO";

                        }

                    }

                }
            );

        }


        // ====================================================
        // LOGOUT
        // ====================================================

        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                async () => {

                    await supabaseClient
                        .auth
                        .signOut();


                    window.location.href =
                        "index.html";

                }
            );

        }


        // ====================================================
        // AVVIO
        // ====================================================

        updateAttributesDisplay();


        setupTokenSelection();


        // ====================================================
        // SE ESISTE GIÀ IL PERSONAGGIO
        // ====================================================

        const alreadyExists =
            await checkExistingCharacter();


        if (alreadyExists) {

            return;

        }


        // ====================================================
        // OGGETTI INIZIALI
        // ====================================================

        ensureStartingItemsUI();


        await loadStartingItems();

    }
);
