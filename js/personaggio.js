// ============================================================
// PALAZZO ETERNO
// PERSONAGGIO.JS
// ============================================================
//
// CREAZIONE PERSONAGGIO IN 3 STEP:
//
// 1. Identità / Token / Attributi
// 2. Scelta di 3 abilità
// 3. Scelta di 3 equipaggiamenti
//
// Alla conferma finale salva:
//
// - characters
// - character_abilities
// - character_inventory
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

        const REQUIRED_STARTING_ABILITIES = 3;

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


        // ----------------------------------------------------
        // STEP
        // ----------------------------------------------------

        let currentStep = 1;


        // ----------------------------------------------------
        // ABILITÀ
        // ----------------------------------------------------

        let availableAbilities = [];

        let selectedAbilities = [];


        // ----------------------------------------------------
        // EQUIPAGGIAMENTO
        // ----------------------------------------------------

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
                text || "";

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


                            showMessage(
                                ""
                            );

                        }
                    );

                }
            );

        }


        // ====================================================
        // STEP
        // ====================================================

        function showStep(
            stepNumber
        ) {

            currentStep =
                stepNumber;


            document
                .querySelectorAll(
                    ".creation-step"
                )
                .forEach(
                    step => {

                        const number =
                            Number(
                                step.dataset.step
                            );


                        step.classList.toggle(
                            "active",
                            number === stepNumber
                        );

                    }
                );


            document
                .querySelectorAll(
                    ".creation-progress-step"
                )
                .forEach(
                    indicator => {

                        const number =
                            Number(
                                indicator.dataset.progressStep
                            );


                        indicator.classList.remove(
                            "active",
                            "completed"
                        );


                        if (
                            number === stepNumber
                        ) {

                            indicator.classList.add(
                                "active"
                            );

                        } else if (
                            number < stepNumber
                        ) {

                            indicator.classList.add(
                                "completed"
                            );

                        }

                    }
                );


            showMessage(
                ""
            );


            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

        }


        // ====================================================
        // VALIDAZIONE STEP 1
        // ====================================================

        function validateStep1() {

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


                nameInput?.focus();


                return false;

            }


            if (!selectedToken) {

                showMessage(
                    "Seleziona un token per il tuo personaggio."
                );


                return false;

            }


            if (
                getRemainingPoints() !== 0
            ) {

                showMessage(
                    "Devi utilizzare tutti i 10 punti attributo."
                );


                return false;

            }


            return true;

        }


        // ====================================================
        // VALIDAZIONE STEP 2
        // ====================================================

        function validateStep2() {

            if (
                selectedAbilities.length !==
                REQUIRED_STARTING_ABILITIES
            ) {

                showMessage(
                    "Devi scegliere esattamente 3 abilità iniziali."
                );


                return false;

            }


            return true;

        }


        // ====================================================
        // VALIDAZIONE STEP 3
        // ====================================================

        function validateStep3() {

            if (
                selectedStartingItems.length !==
                REQUIRED_STARTING_ITEMS
            ) {

                showMessage(
                    "Devi scegliere esattamente 3 oggetti iniziali."
                );


                return false;

            }


            return true;

        }


        // ====================================================
        // EVENTI NAVIGAZIONE STEP
        // ====================================================

        function setupStepNavigation() {

            const nextStep1 =
                document.getElementById(
                    "next-step-1"
                );


            const previousStep2 =
                document.getElementById(
                    "previous-step-2"
                );


            const nextStep2 =
                document.getElementById(
                    "next-step-2"
                );


            const previousStep3 =
                document.getElementById(
                    "previous-step-3"
                );


            nextStep1?.addEventListener(
                "click",
                () => {

                    if (
                        !validateStep1()
                    ) {

                        return;

                    }


                    showStep(
                        2
                    );

                }
            );


            previousStep2?.addEventListener(
                "click",
                () => {

                    showStep(
                        1
                    );

                }
            );


            nextStep2?.addEventListener(
                "click",
                () => {

                    if (
                        !validateStep2()
                    ) {

                        return;

                    }


                    showStep(
                        3
                    );

                }
            );


            previousStep3?.addEventListener(
                "click",
                () => {

                    showStep(
                        2
                    );

                }
            );

        }


        // ====================================================
        // CARICA ABILITÀ
        // ====================================================

        async function loadAbilities() {

            console.log(
                "Caricamento abilità..."
            );


            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "abilities"
                    )
                    .select(`
                        id,
                        name,
                        description,
                        ability_type,
                        pm_cost,
                        max_level
                    `)
                    .order(
                        "name",
                        {
                            ascending: true
                        }
                    );


            if (error) {

                console.error(
                    "Errore caricamento abilità:",
                    error
                );


                throw new Error(
                    "Impossibile caricare le abilità: " +
                    error.message
                );

            }


            availableAbilities =
                data || [];


            console.log(
                "Abilità caricate:",
                availableAbilities
            );


            renderAbilities();

        }


        // ====================================================
        // ABILITÀ SELEZIONATA?
        // ====================================================

        function isAbilitySelected(
            abilityId
        ) {

            return selectedAbilities.includes(
                abilityId
            );

        }


        // ====================================================
        // SELEZIONA / DESELEZIONA ABILITÀ
        // ====================================================

        function toggleAbility(
            abilityId
        ) {

            const index =
                selectedAbilities.indexOf(
                    abilityId
                );


            // ------------------------------------------------
            // DESELEZIONE
            // ------------------------------------------------

            if (
                index !== -1
            ) {

                selectedAbilities.splice(
                    index,
                    1
                );


                showMessage(
                    ""
                );


                renderAbilities();


                return;

            }


            // ------------------------------------------------
            // MASSIMO 3
            // ------------------------------------------------

            if (
                selectedAbilities.length >=
                REQUIRED_STARTING_ABILITIES
            ) {

                showMessage(
                    "Puoi scegliere massimo 3 abilità iniziali."
                );


                return;

            }


            // ------------------------------------------------
            // SELEZIONE
            // ------------------------------------------------

            selectedAbilities.push(
                abilityId
            );


            showMessage(
                ""
            );


            renderAbilities();

        }


        // ====================================================
        // CREA CARTA ABILITÀ
        // ====================================================

        function createAbilityCard(
            ability
        ) {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "ability-card";


            card.setAttribute(
                "role",
                "button"
            );


            card.setAttribute(
                "tabindex",
                "0"
            );


            const selected =
                isAbilitySelected(
                    ability.id
                );


            if (selected) {

                card.classList.add(
                    "selected"
                );

            }


            // ------------------------------------------------
            // COSTO
            // ------------------------------------------------

            const cost =
                document.createElement(
                    "div"
                );


            cost.className =
                "ability-cost";


            cost.textContent =
                `${Number(ability.pm_cost) || 0} PM`;


            card.appendChild(
                cost
            );


            // ------------------------------------------------
            // NOME
            // ------------------------------------------------

            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "ability-name";


            name.textContent =
                ability.name;


            card.appendChild(
                name
            );


            // ------------------------------------------------
            // DESCRIZIONE
            // ------------------------------------------------

            const description =
                document.createElement(
                    "div"
                );


            description.className =
                "ability-description";


            description.textContent =
                ability.description || "";


            card.appendChild(
                description
            );


            // ------------------------------------------------
            // LIVELLO
            // ------------------------------------------------

            const level =
                document.createElement(
                    "div"
                );


            level.className =
                "ability-level";


            level.textContent =
                "LIVELLO 1";


            card.appendChild(
                level
            );


            // ------------------------------------------------
            // CLICK
            // ------------------------------------------------

            card.addEventListener(
                "click",
                () => {

                    toggleAbility(
                        ability.id
                    );

                }
            );


            // ------------------------------------------------
            // TASTIERA
            // ------------------------------------------------

            card.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key !== "Enter" &&
                        event.key !== " "
                    ) {

                        return;

                    }


                    event.preventDefault();


                    toggleAbility(
                        ability.id
                    );

                }
            );


            return card;

        }


        // ====================================================
        // MOSTRA ABILITÀ
        // ====================================================

        function renderAbilities() {

            const container =
                document.getElementById(
                    "abilities-list"
                );


            if (!container) {

                return;

            }


            container.replaceChildren();


            availableAbilities.forEach(
                ability => {

                    container.appendChild(
                        createAbilityCard(
                            ability
                        )
                    );

                }
            );


            setText(
                "selected-abilities-count",
                selectedAbilities.length
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


                throw new Error(
                    "Impossibile caricare gli oggetti iniziali: " +
                    error.message
                );

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
        // SALVA ABILITÀ INIZIALI
        // ====================================================

        async function saveStartingAbilities(
            characterId
        ) {

            const rows =
                selectedAbilities.map(
                    abilityId => ({

                        character_id:
                            characterId,

                        ability_id:
                            abilityId,

                        level:
                            1

                    })
                );


            const {
                error
            } =
                await supabaseClient
                    .from(
                        "character_abilities"
                    )
                    .insert(
                        rows
                    );


            if (error) {

                throw error;

            }


            console.log(
                "Abilità iniziali salvate:",
                rows
            );

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
        // CANCELLA PERSONAGGIO IN CASO DI ERRORE
        // ====================================================

        async function rollbackCharacter(
            characterId
        ) {

            if (!characterId) {

                return;

            }


            console.warn(
                "Rollback creazione personaggio..."
            );


            const {
                error
            } =
                await supabaseClient
                    .from(
                        "characters"
                    )
                    .delete()
                    .eq(
                        "id",
                        characterId
                    );


            if (error) {

                console.error(
                    "Errore durante il rollback:",
                    error
                );

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


                    // ------------------------------------------------
                    // CONTROLLO TUTTI GLI STEP
                    // ------------------------------------------------

                    if (
                        !validateStep1()
                    ) {

                        showStep(
                            1
                        );


                        return;

                    }


                    if (
                        !validateStep2()
                    ) {

                        showStep(
                            2
                        );


                        return;

                    }


                    if (
                        !validateStep3()
                    ) {

                        showStep(
                            3
                        );


                        return;

                    }


                    const alreadyExists =
                        await checkExistingCharacter();


                    if (alreadyExists) {

                        return;

                    }


                    const nameInput =
                        document.getElementById(
                            "nome"
                        );


                    const nome =
                        nameInput
                            ? nameInput.value.trim()
                            : "";


                    const submitButton =
                        document.getElementById(
                            "save-character-button"
                        );


                    if (submitButton) {

                        submitButton.disabled =
                            true;


                        submitButton.textContent =
                            "SALVATAGGIO...";

                    }


                    showMessage(
                        "Creazione del personaggio in corso..."
                    );


                    // ------------------------------------------------
                    // PF / PM INIZIALI
                    // ------------------------------------------------

                    const secondary =
                        calculateSecondaryStats();


                    // ------------------------------------------------
                    // DATI PERSONAGGIO
                    // ------------------------------------------------

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

                        current_hp:
                            secondary.hp,

                        current_pm:
                            secondary.mana,

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

                        // ============================================
                        // 1. CREA PERSONAGGIO
                        // ============================================

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

                            // ========================================
                            // 2. SALVA ABILITÀ
                            // ========================================

                            await saveStartingAbilities(
                                currentCharacter.id
                            );


                            // ========================================
                            // 3. SALVA INVENTARIO
                            // ========================================

                            await saveStartingInventory(
                                currentCharacter.id
                            );

                        } catch (
                            relatedDataError
                        ) {

                            console.error(
                                "Errore durante il salvataggio dei dati iniziali:",
                                relatedDataError
                            );


                            // Eliminando characters,
                            // character_abilities e
                            // character_inventory vengono eliminati
                            // grazie a ON DELETE CASCADE.

                            await rollbackCharacter(
                                currentCharacter.id
                            );


                            currentCharacter =
                                null;


                            throw new Error(
                                "Creazione incompleta: " +
                                relatedDataError.message
                            );

                        }


                        // ============================================
                        // COMPLETATO
                        // ============================================

                        showMessage(
                            "Personaggio creato!"
                        );


                        window.location.href =
                            "scheda.html";


                    } catch (
                        error
                    ) {

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

        try {

            // ------------------------------------------------
            // PRIMA VERIFICHIAMO CHE NON ESISTA GIÀ
            // ------------------------------------------------

            const alreadyExists =
                await checkExistingCharacter();


            if (alreadyExists) {

                return;

            }


            // ------------------------------------------------
            // INTERFACCIA
            // ------------------------------------------------

            updateAttributesDisplay();


            setupTokenSelection();


            setupStepNavigation();


            showStep(
                1
            );


            // ------------------------------------------------
            // DATI DAL DATABASE
            // ------------------------------------------------

            await Promise.all([

                loadAbilities(),

                loadStartingItems()

            ]);


            console.log(
                "Creazione personaggio pronta."
            );


        } catch (
            error
        ) {

            console.error(
                "Errore inizializzazione creazione personaggio:",
                error
            );


            showMessage(
                error.message ||
                "Errore durante il caricamento della creazione personaggio."
            );

        }

    }
);
