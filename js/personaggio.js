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
// - massimo 30 per attributo
// - calcolo statistiche secondarie
// - scelta del token
// - salvataggio su Supabase
// - redirect alla scheda
//
// ============================================================


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "PERSONAGGIO.JS CARICATO"
        );


        // ====================================================
        // CONFIGURAZIONE
        // ====================================================

        const INITIAL_POINTS = 10;

        const MIN_ATTRIBUTE = 1;

        const MAX_ATTRIBUTE = 30;


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


        let currentUser = null;

        let currentCharacter = null;

        let selectedToken = null;


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


            // ---------------------------------------------
            // ATTACCO
            // Forza / 2
            // ---------------------------------------------

            const attack =
                Math.ceil(
                    forza / 2
                );


            // ---------------------------------------------
            // DIFESA
            // 7 + Resistenza / 2
            // ---------------------------------------------

            const defense =
                Math.ceil(
                    7 +
                    (resistenza / 2)
                );


            // ---------------------------------------------
            // VITA
            // 5 * (Costituzione / 2)
            // ---------------------------------------------

            const hp =
                Math.ceil(
                    5 *
                    (costituzione / 2)
                );


            // ---------------------------------------------
            // MANA
            // 5 * (Intelligenza / 2)
            // ---------------------------------------------

            const mana =
                Math.ceil(
                    5 *
                    (intelligenza / 2)
                );


            // ---------------------------------------------
            // MOVIMENTO
            // 4 + Destrezza / 2
            // ---------------------------------------------

            const movement =
                Math.ceil(
                    4 +
                    (destrezza / 2)
                );


            // ---------------------------------------------
            // CRITICO
            //
            // Fortuna 30 = 50%
            //
            // Fortuna 1 ≈ 1,67%
            // visualizzato arrotondato per eccesso
            // ---------------------------------------------

            const critical =
                Math.min(
                    50,
                    Math.ceil(
                        (fortuna / 60) *
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
        // AGGIORNA STATISTICHE SECONDARIE
        // ====================================================

        function updateSecondaryStats() {

            const secondary =
                calculateSecondaryStats();


            // ---------------------------------------------
            // ATTACCO
            // ---------------------------------------------

            const attackElement =
                document.getElementById(
                    "attack-display"
                );


            if (attackElement) {

                attackElement.textContent =
                    secondary.attack;

            }


            const attackSecondary =
                document.getElementById(
                    "attacco-secondary"
                );


            if (attackSecondary) {

                attackSecondary.textContent =
                    `Attacco: ${secondary.attack}`;

            }


            // ---------------------------------------------
            // DIFESA
            // ---------------------------------------------

            const defenseElement =
                document.getElementById(
                    "defense-display"
                );


            if (defenseElement) {

                defenseElement.textContent =
                    secondary.defense;

            }


            const defenseSecondary =
                document.getElementById(
                    "difesa-secondary"
                );


            if (defenseSecondary) {

                defenseSecondary.textContent =
                    `Difesa: ${secondary.defense}`;

            }


            // ---------------------------------------------
            // VITA
            // ---------------------------------------------

            const healthElement =
                document.getElementById(
                    "health-display"
                );


            if (healthElement) {

                healthElement.textContent =
                    secondary.hp;

            }


            const healthSecondary =
                document.getElementById(
                    "costituzione-secondary"
                );


            if (healthSecondary) {

                healthSecondary.textContent =
                    `Vita: ${secondary.hp}`;

            }


            // ---------------------------------------------
            // MANA
            // ---------------------------------------------

            const manaElement =
                document.getElementById(
                    "mana-display"
                );


            if (manaElement) {

                manaElement.textContent =
                    secondary.mana;

            }


            const manaSecondary =
                document.getElementById(
                    "intelligenza-secondary"
                );


            if (manaSecondary) {

                manaSecondary.textContent =
                    `Mana: ${secondary.mana}`;

            }


            // ---------------------------------------------
            // MOVIMENTO
            // ---------------------------------------------

            const movementElement =
                document.getElementById(
                    "movement-display"
                );


            if (movementElement) {

                movementElement.textContent =
                    secondary.movement;

            }


            const movementSecondary =
                document.getElementById(
                    "destrezza-secondary"
                );


            if (movementSecondary) {

                movementSecondary.textContent =
                    `Movimento: ${secondary.movement}`;

            }


            // ---------------------------------------------
            // CRITICO
            // ---------------------------------------------

            const criticalElement =
                document.getElementById(
                    "critical-display"
                );


            if (criticalElement) {

                criticalElement.textContent =
                    `${secondary.critical}%`;

            }


            const criticalSecondary =
                document.getElementById(
                    "fortuna-secondary"
                );


            if (criticalSecondary) {

                criticalSecondary.textContent =
                    `Critico: ${secondary.critical}%`;

            }

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
        // AGGIORNA PUNTI
        // ====================================================

        function updatePointsDisplay() {

            const remaining =
                getRemainingPoints();


            const pointsElement =
                document.getElementById(
                    "points-remaining"
                );


            if (pointsElement) {

                pointsElement.textContent =
                    remaining;

            }

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


                    // -----------------------------------------
                    // VALORE
                    // -----------------------------------------

                    const valueElement =
                        document.getElementById(
                            `${attribute}-value`
                        );


                    if (valueElement) {

                        valueElement.textContent =
                            value;

                    }


                    // -----------------------------------------
                    // PULSANTE -
                    // -----------------------------------------

                    const minusButton =
                        document.querySelector(
                            `.stat-minus[data-stat="${attribute}"]`
                        );


                    if (minusButton) {

                        minusButton.disabled =
                            value <=
                            MIN_ATTRIBUTE;

                    }


                    // -----------------------------------------
                    // PULSANTE +
                    // -----------------------------------------

                    const plusButton =
                        document.querySelector(
                            `.stat-plus[data-stat="${attribute}"]`
                        );


                    if (plusButton) {

                        plusButton.disabled =
                            value >=
                            MAX_ATTRIBUTE ||
                            getRemainingPoints() <= 0;

                    }

                }
            );


            updatePointsDisplay();

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

                            // ---------------------------------
                            // Rimuove selezione precedente
                            // ---------------------------------

                            tokenOptions.forEach(
                                option => {

                                    option.classList.remove(
                                        "selected"
                                    );

                                }
                            );


                            // ---------------------------------
                            // Seleziona token
                            // ---------------------------------

                            token.classList.add(
                                "selected"
                            );


                            selectedToken =
                                token.dataset.token;


                            console.log(
                                "Token selezionato:",
                                selectedToken
                            );


                            // ---------------------------------
                            // Anteprima
                            // ---------------------------------

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


                            // ---------------------------------
                            // Nome
                            // ---------------------------------

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


                // -----------------------------------------
                // REDIRECT
                // -----------------------------------------

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
        // SALVATAGGIO
        // ====================================================

        if (form) {

            form.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();


                    // -----------------------------------------
                    // CONTROLLO NOME
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
                    // CONTROLLO PUNTI
                    // -----------------------------------------

                    if (
                        getRemainingPoints() !== 0
                    ) {

                        showMessage(
                            "Devi utilizzare tutti i 10 punti abilità."
                        );


                        return;

                    }


                    // -----------------------------------------
                    // CONTROLLO TOKEN
                    // -----------------------------------------

                    if (!selectedToken) {

                        showMessage(
                            "Seleziona un token per il tuo personaggio."
                        );


                        return;

                    }


                    // -----------------------------------------
                    // CONTROLLO DUPLICATO
                    // -----------------------------------------

                    const alreadyExists =
                        await checkExistingCharacter();


                    if (alreadyExists) {

                        return;

                    }


                    // -----------------------------------------
                    // DATI DATABASE
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


                    console.log(
                        "Dati da salvare:",
                        characterData
                    );


                    // -----------------------------------------
                    // INSERT
                    // -----------------------------------------

                    const {
                        data,
                        error
                    } =
                        await supabaseClient
                            .from("characters")
                            .insert(
                                characterData
                            )
                            .select()
                            .single();


                    if (error) {

                        console.error(
                            "Errore salvataggio:",
                            error
                        );


                        showMessage(
                            "Errore durante il salvataggio: " +
                            error.message
                        );


                        return;

                    }


                    currentCharacter =
                        data;


                    console.log(
                        "Personaggio salvato:",
                        currentCharacter
                    );


                    // -----------------------------------------
                    // REDIRECT ALLA SCHEDA
                    // -----------------------------------------

                    window.location.href =
                        "scheda.html";

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
        // MESSAGGIO
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
        // AVVIO
        // ====================================================

        updateAttributesDisplay();

        setupTokenSelection();


        // ====================================================
        // SE ESISTE GIÀ UN PERSONAGGIO,
        // VAI ALLA SCHEDA
        // ====================================================

        await checkExistingCharacter();

    }
);