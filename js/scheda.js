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

            displayCharacter();

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


    masterButton.hidden =
        currentUserRole !==
        "master";

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
