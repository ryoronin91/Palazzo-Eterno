// ============================================================
// PALAZZO ETERNO
// PERSONAGGIO.JS
// ============================================================
//
// Gestisce:
//
// - autenticazione Supabase
// - creazione del personaggio
// - controllo personaggio già esistente
// - 10 punti abilità iniziali
// - 6 attributi primari
// - minimo 1 / massimo 30 per attributo
// - calcolo statistiche secondarie
// - scelta del token
// - scelta di 3 oggetti iniziali
// - possibilità di scegliere più copie dello stesso oggetto
// - inventario iniziale
// - salvataggio su Supabase
// - redirect alla scheda
//
// ============================================================


console.log("PERSONAGGIO.JS CARICATO");


// ============================================================
// AVVIO
// ============================================================

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

        let selectedStartingItems = [];


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
        // IMPOSTA TESTO ELEMENTO
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

                console.log(
                    "Personaggio già esistente."
                );


                currentCharacter =
                    data;


                window.location.href =
                    "scheda.html";


                return true;

            }


            console.log(
                "Nessun personaggio trovato."
            );


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


            // ATTACCO

            const attack =
                Math.ceil(
                    forza / 2
                );


            // DIFESA

            const defense =
                Math.ceil(
                    7 +
                    (
                        resistenza / 2
                    )
                );


            // VITA

            const hp =
                Math.ceil(
                    5 *
                    (
                        costituzione / 2
                    )
                );


            // MANA

            const mana =
                Math.ceil(
                    5 *
                    (
                        intelligenza / 2
                    )
                );


            // MOVIMENTO

            const movement =
                Math.ceil(
                    4 +
                    (
                        destrezza / 2
                    )
                );


            // CRITICO

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


                            const currentValue =
                                attributeValues[
                                    attribute
                                ];


                            if (
                                currentValue >=
                                MAX_ATTRIBUTE
                            ) {

                                return;

                            }


                            if (
                                getRemainingPoints() <= 0
                            ) {

                                return;

                            }


                            attributeValues[
                                attribute
                            ] =
                                currentValue + 1;


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


                            const currentValue =
                                attributeValues[
                                    attribute
                                ];


                            if (
                                currentValue <=
                                MIN_ATTRIBUTE
                            ) {

                                return;

                            }


                            attributeValues[
                                attribute
                            ] =
                                currentValue - 1;


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


                            console.log(
                                "Token selezionato:",
                                selectedToken
                            );


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
        // CREA INTERFACCIA EQUIPAGGIAMENTO INIZIALE
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


            const style =
                document.createElement(
                    "style"
                );


            style.textContent = `

                .starting-items-section {

                    margin-top: 32px;

                    margin-bottom: 28px;

                }


                .starting-items-description {

                    color: #aaa;

                    line-height: 1.5;

                    margin-bottom: 12px;

                }


                .starting-items-counter {

                    display: inline-flex;

                    align-items: center;

                    padding: 7px 12px;

                    margin-bottom: 20px;

                    border-radius: 7px;

                    background:
                        rgba(
                            184,
                            138,
                            59,
                            0.10
                        );

                    border:
                        1px solid
                        rgba(
                            184,
                            138,
                            59,
                            0.30
                        );

                    color: #d4af67;

                    font-size: 13px;

                    font-weight: bold;

                }


                .starting-item-category {

                    margin-bottom: 22px;

                }


                .starting-item-category-title {

                    margin: 0 0 10px;

                    padding-bottom: 6px;

                    border-bottom:
                        1px solid
                        rgba(
                            184,
                            138,
                            59,
                            0.25
                        );

                    color: #d4af67;

                    font-size: 14px;

                    letter-spacing: 1px;

                }


                .starting-items-grid {

                    display: grid;

                    grid-template-columns:
                        repeat(
                            auto-fill,
                            minmax(
                                145px,
                                1fr
                            )
                        );

                    gap: 8px;

                }


                .starting-item {

                    position: relative;

                    min-height: 82px;

                    padding: 9px 10px;

                    box-sizing: border-box;

                    text-align: left;

                    border-radius: 7px;

                    border:
                        1px solid
                        rgba(
                            255,
                            255,
                            255,
                            0.10
                        );

                    background:
                        rgba(
                            255,
                            255,
                            255,
                            0.025
                        );

                    color: inherit;

                    transition:
                        border-color 0.12s ease,
                        background 0.12s ease,
                        transform 0.12s ease;

                }


                .starting-item:hover {

                    border-color:
                        rgba(
                            184,
                            138,
                            59,
                            0.55
                        );

                    background:
                        rgba(
                            184,
                            138,
                            59,
                            0.05
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
                            0.12
                        );

                }


                .starting-item-name {

                    padding-right: 30px;

                    font-size: 12px;

                    font-weight: bold;

                    margin-bottom: 4px;

                }


                .starting-item-description {

                    color: #aaa;

                    font-size: 10px;

                    line-height: 1.3;

                }


                .starting-item-meta {

                    margin-top: 6px;

                    color: #cda65b;

                    font-size: 9px;

                    font-weight: bold;

                }


                .starting-item-quantity {

                    position: absolute;

                    top: 6px;

                    right: 6px;

                    min-width: 22px;

                    height: 22px;

                    padding: 0 5px;

                    box-sizing: border-box;

                    display: flex;

                    align-items: center;

                    justify-content: center;

                    border-radius: 20px;

                    background: #b88a3b;

                    color: #111;

                    font-size: 10px;

                    font-weight: bold;

                }


                .starting-item-controls {

                    display: flex;

                    gap: 5px;

                    margin-top: 7px;

                }


                .starting-item-control {

                    flex: 1;

                    height: 23px;

                    padding: 0;

                    border-radius: 4px;

                    border:
                        1px solid
                        rgba(
                            184,
                            138,
                            59,
                            0.35
                        );

                    background:
                        rgba(
                            0,
                            0,
                            0,
                            0.25
                        );

                    color: #d4af67;

                    font-size: 14px;

                    line-height: 20px;

                    cursor: pointer;

                }


                .starting-item-control:hover:not(:disabled) {

                    background:
                        rgba(
                            184,
                            138,
                            59,
                            0.15
                        );

                }


                .starting-item-control:disabled {

                    opacity: 0.25;

                    cursor: default;

                }


                .starting-kit-note {

                    margin-top: 18px;

                    padding: 11px 13px;

                    border-radius: 7px;

                    background:
                        rgba(
                            255,
                            255,
                            255,
                            0.035
                        );

                    color: #bbb;

                    font-size: 11px;

                    line-height: 1.5;

                }


                @media (
                    max-width: 600px
                ) {

                    .starting-items-grid {

                        grid-template-columns:
                            repeat(
                                2,
                                1fr
                            );

                    }

                }


                @media (
                    max-width: 390px
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
                        3 oggetti
                    </strong>

                    con cui iniziare l'avventura.

                    Puoi scegliere anche più copie
                    dello stesso oggetto.

                </p>


                <div class="starting-items-counter">

                    Oggetti scelti:&nbsp;

                    <span id="starting-items-count">
                        0
                    </span>

                    /3

                </div>


                <div id="starting-items-list"></div>


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


            console.log(
                "Oggetti iniziali caricati:",
                startingItems
            );


            renderStartingItems();

        }


        // ====================================================
        // QUANTITÀ SELEZIONATA DI UN OGGETTO
        // ====================================================

        function getSelectedItemQuantity(
            itemId
        ) {

            return selectedStartingItems.filter(
                selectedId =>
                    selectedId ===
                    itemId
            ).length;

        }


        // ====================================================
        // AGGIUNGI OGGETTO
        // ====================================================

        function addStartingItem(
            itemId
        ) {

            if (
                selectedStartingItems.length >=
                REQUIRED_STARTING_ITEMS
            ) {

                showMessage(
                    "Hai già scelto 3 oggetti."
                );


                return;

            }


            selectedStartingItems.push(
                itemId
            );


            showMessage(
                ""
            );


            renderStartingItems();

        }


        // ====================================================
        // RIMUOVI OGGETTO
        // ====================================================

        function removeStartingItem(
            itemId
        ) {

            const index =
                selectedStartingItems.indexOf(
                    itemId
                );


            if (
                index === -1
            ) {

                return;

            }


            selectedStartingItems.splice(
                index,
                1
            );


            showMessage(
                ""
            );


            renderStartingItems();

        }


        // ====================================================
        // CONTATORE OGGETTI
        // ====================================================

        function updateStartingItemsCounter() {

            setText(
                "starting-items-count",
                selectedStartingItems.length
            );

        }


        // ====================================================
        // CREA CARTA OGGETTO
        // ====================================================

        function createStartingItemCard(
            item
        ) {

            const quantity =
                getSelectedItemQuantity(
                    item.id
                );


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "starting-item";


            if (
                quantity > 0
            ) {

                card.classList.add(
                    "selected"
                );

            }


            if (
                quantity > 0
            ) {

                const quantityElement =
                    document.createElement(
                        "div"
                    );


                quantityElement.className =
                    "starting-item-quantity";


                quantityElement.textContent =
                    `×${quantity}`;


                card.appendChild(
                    quantityElement
                );

            }


            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "starting-item-name";


            name.textContent =
                item.name;


            card.appendChild(
                name
            );


            const description =
                document.createElement(
                    "div"
                );


            description.className =
                "starting-item-description";


            description.textContent =
                item.description || "";


            card.appendChild(
                description
            );


            const value =
                document.createElement(
                    "div"
                );


            value.className =
                "starting-item-meta";


            value.textContent =
                `Valore: ${
                    Number(
                        item.gold_value
                    ) || 0
                } MO`;


            card.appendChild(
                value
            );


            const controls =
                document.createElement(
                    "div"
                );


            controls.className =
                "starting-item-controls";


            const minus =
                document.createElement(
                    "button"
                );


            minus.type =
                "button";


            minus.className =
                "starting-item-control";


            minus.textContent =
                "−";


            minus.disabled =
                quantity <= 0;


            minus.addEventListener(
                "click",
                () => {

                    removeStartingItem(
                        item.id
                    );

                }
            );


            const plus =
                document.createElement(
                    "button"
                );


            plus.type =
                "button";


            plus.className =
                "starting-item-control";


            plus.textContent =
                "+";


            plus.disabled =
                selectedStartingItems.length >=
                REQUIRED_STARTING_ITEMS;


            plus.addEventListener(
                "click",
                () => {

                    addStartingItem(
                        item.id
                    );

                }
            );


            controls.append(
                minus,
                plus
            );


            card.appendChild(
                controls
            );


            return card;

        }


        // ====================================================
        // MOSTRA OGGETTI DIVISI PER CATEGORIA
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


            const categories = [

                {
                    type: "weapon",
                    label: "ARMI"
                },

                {
                    type: "armor",
                    label: "ARMATURE"
                },

                {
                    type: "accessory",
                    label: "ACCESSORI"
                }

            ];


            categories.forEach(
                category => {

                    const categoryItems =
                        startingItems.filter(
                            item =>
                                item.item_type ===
                                category.type
                        );


                    if (
                        categoryItems.length === 0
                    ) {

                        return;

                    }


                    const section =
                        document.createElement(
                            "div"
                        );


                    section.className =
                        "starting-item-category";


                    const title =
                        document.createElement(
                            "h3"
                        );


                    title.className =
                        "starting-item-category-title";


                    title.textContent =
                        category.label;


                    section.appendChild(
                        title
                    );


                    const grid =
                        document.createElement(
                            "div"
                        );


                    grid.className =
                        "starting-items-grid";


                    categoryItems.forEach(
                        item => {

                            grid.appendChild(
                                createStartingItemCard(
                                    item
                                )
                            );

                        }
                    );


                    section.appendChild(
                        grid
                    );


                    container.appendChild(
                        section
                    );

                }
            );


            updateStartingItemsCounter();

        }


        // ====================================================
        // SALVA INVENTARIO INIZIALE
        // ====================================================

        async function saveStartingInventory(
            characterId
        ) {

            const selectedQuantities = {};


            selectedStartingItems.forEach(
                itemId => {

                    if (
                        !selectedQuantities[
                            itemId
                        ]
                    ) {

                        selectedQuantities[
                            itemId
                        ] = 0;

                    }


                    selectedQuantities[
                        itemId
                    ] += 1;

                }
            );


            const chosenRows =
                Object.entries(
                    selectedQuantities
                ).map(
                    (
                        [
                            itemId,
                            quantity
                        ]
                    ) => ({

                        character_id:
                            characterId,

                        item_id:
                            itemId,

                        quantity:
                            quantity,

                        equipped_slot:
                            null

                    })
                );


            const inventoryRows = [

                ...chosenRows,

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


            console.log(
                "Inventario iniziale creato:",
                inventoryRows
            );

        }


        // ====================================================
        // SALVATAGGIO PERSONAGGIO
        // ====================================================

        if (form) {

            form.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();


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


                    if (
                        getRemainingPoints() !==
                        0
                    ) {

                        showMessage(
                            "Devi utilizzare tutti i 10 punti abilità."
                        );


                        return;

                    }


                    if (!selectedToken) {

                        showMessage(
                            "Seleziona un token per il tuo personaggio."
                        );


                        return;

                    }


                    if (
                        selectedStartingItems.length !==
                        REQUIRED_STARTING_ITEMS
                    ) {

                        showMessage(
                            "Devi scegliere esattamente 3 oggetti iniziali."
                        );


                        return;

                    }


                    const alreadyExists =
                        await checkExistingCharacter();


                    if (alreadyExists) {

                        return;

                    }


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


                    console.log(
                        "Dati da salvare:",
                        characterData
                    );


                    try {

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
        // AVVIO INTERFACCIA
        // ====================================================

        updateAttributesDisplay();


        setupTokenSelection();


        const alreadyExists =
            await checkExistingCharacter();


        if (alreadyExists) {

            return;

        }


        ensureStartingItemsUI();


        await loadStartingItems();

    }
);
