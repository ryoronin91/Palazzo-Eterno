// ============================================================
// PALAZZO ETERNO
// SCHEDA.JS
// ============================================================
//
// Gestisce:
//
// - autenticazione del giocatore
// - caricamento del personaggio
// - visualizzazione degli attributi
// - calcolo delle statistiche secondarie
// - caricamento del token
// - caricamento delle note
// - salvataggio delle note
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

            await loadCharacter();

            displayCharacter();

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


    // --------------------------------------------------------
    // Nessun personaggio
    // --------------------------------------------------------

    if (!data) {

        console.log(
            "Nessun personaggio trovato."
        );


        // Se non esiste ancora un personaggio,
        // mandiamo il giocatore alla pagina di creazione.

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
// VISUALIZZAZIONE PERSONAGGIO
// ============================================================

function displayCharacter() {

    if (!character) {

        return;
    }


    // ========================================================
    // NOME
    // ========================================================

    const nameElement =
        document.getElementById(
            "character-name"
        );


    if (nameElement) {

        nameElement.textContent =
            character.nome ||
            "Avventuriero";

    }


    // ========================================================
    // LIVELLO
    // ========================================================

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


    // ========================================================
    // TOKEN
    // ========================================================

    displayToken();


    // ========================================================
    // ATTRIBUTI
    // ========================================================

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


    // ========================================================
    // STATISTICHE SECONDARIE
    // ========================================================

    calculateSecondaryStats();


    // ========================================================
    // NOTE
    // ========================================================

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


    // --------------------------------------------------------
    // Se non è stato selezionato un token
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Il database contiene il nome del file
    //
    // Esempio:
    //
    // token_1.png
    //
    // oppure:
    //
    // token_5.png
    //
    // --------------------------------------------------------

    let tokenPath =
        character.token;


    // --------------------------------------------------------
    // Se il valore non contiene già un percorso,
    // utilizziamo la cartella immagini/token.
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Gestione errore immagine
    // --------------------------------------------------------

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
// FORMULE:
//
// Attacco     = Forza / 2
//
// Difesa      = 7 + Resistenza / 2
//
// Vita        = 5 * (Costituzione / 2)
//
// Mana        = 5 * (Intelligenza / 2)
//
// Movimento   = 4 + Destrezza / 2
//
// Critico     = Fortuna / 6
//
// Tutti i calcoli vengono arrotondati PER ECCESSO.
//
// Esempi:
//
// 0.5 → 1
// 1.5 → 2
// 2.5 → 3
//
// Per il critico:
//
// Fortuna 1  → 17%
// Fortuna 30 → 50%
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


    // ========================================================
    // ATTACCO
    // ========================================================

    const attack =
        Math.ceil(
            forza / 2
        );


    // ========================================================
    // DIFESA
    // ========================================================

    const defense =
        Math.ceil(
            7 +
            (
                resistenza / 2
            )
        );


    // ========================================================
    // VITA
    // ========================================================

    const life =
        Math.ceil(
            5 *
            (
                costituzione / 2
            )
        );


    // ========================================================
    // MANA
    // ========================================================

    const mana =
        Math.ceil(
            5 *
            (
                intelligenza / 2
            )
        );


    // ========================================================
    // MOVIMENTO
    // ========================================================

    const movement =
        Math.ceil(
            4 +
            (
                destrezza / 2
            )
        );


    // ========================================================
    // CRITICO
    // ========================================================
    //
    // Fortuna 1  = 1 / 6  = 16.66... → 17%
    //
    // Fortuna 30 = 30 / 6 = 5
    //
    // Per ottenere il 50% massimo:
    //
    // 30 / 6 = 5
    //
    // quindi convertiamo il valore da 1-5
    // nella probabilità 10%-50%.
    //
    // Fortuna 1  = 10%
    // Fortuna 30 = 50%
    //
    // ========================================================

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


    // ========================================================
    // VISUALIZZAZIONE
    // ========================================================

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


    console.log(
        "Statistiche secondarie:",
        {
            attack,
            defense,
            life,
            mana,
            movement,
            critical
        }
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
// EVENTI
// ============================================================

function setupEvents() {

    // --------------------------------------------------------
    // SALVATAGGIO NOTE
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // LOGOUT
    // --------------------------------------------------------

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


    console.log(
        "Salvataggio note..."
    );


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


        console.log(
            "Note salvate."
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


    // Dopo alcuni secondi
    // rimuoviamo il messaggio.

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