
Caricamento dei messaggi meno recenti…

Pasted text(6).txt
Documento
crea l'immagina per quello che sarà il vendor partendo da questa descrizione
Usa uno stile da videogioco semplice e posizionalo dietro un bancone in un negozio pieno di cianfrusaglie di ogni tipo

carino.. ma doveva essere un goblin dalla pelle grigia

ancora sbagliato.. un goblin dalla pelle grigia, dalla taglia piccola e maschio

ottimo, quest'ultima va bene! Ora creane delle copie con varie espressioni facciali tipo arrabbiato, stupito, contento, addormentato e con gli occhi a forma di dollaro






dobbiamo modificare la pagina login inserendo "password dimenticata"

Elaborato per 47s


Sì. Ho preparato il recupero password completo usando Supabase, non solo il link grafico. La pagina attuale usa già supabaseClient.auth.signInWithPassword(...), quindi ho mantenuto lo stesso sistema di autenticazione. 

Ora nella pagina di login compare “Password dimenticata?” sotto il campo password. Il flusso è: l’utente inserisce l’email → clicca il link → Supabase invia l’email di recupero → il link dell’email porta a reset-password.html → l’utente imposta la nuova password.

Scarica questi file:

Nel repository:

login_password_reset.html → login.html
auth_password_reset.js    → js/auth.js
reset-password.html       → reset-password.html
Nel nuovo login.html ho già messo:

<script src="js/auth.js?v=2"></script>

Importante: Supabase
Devi anche autorizzare la pagina di reset in Supabase. Vai in:

Authentication → URL Configuration → Redirect URLs

e aggiungi:

https://ryoronin91.github.io/Palazzo-Eterno/reset-password.html
Altrimenti Supabase potrebbe inviare l’email ma rifiutare il redirect verso la pagina dove impostare la nuova password.

Dopo commit/deploy fai Ctrl+F5 e possiamo provarlo subito con un account di test. 


login_password_reset.html
HTML

auth_password_reset.js
Codice

auth_password_reset_js.txt
Documento
Ancora 1



// ==========================================
// PALAZZO ETERNO
// AUTH.JS
// ==========================================
//
// Gestisce:
//
// - registrazione
// - login
// - controllo esistenza personaggio
// - redirect automatico
//
// ==========================================


// ==========================================
// REGISTRAZIONE
// ==========================================

const registerForm =
    document.getElementById(
        "register-form"
    );


if (registerForm) {

    registerForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const email =
                document
                    .getElementById("email")
                    .value
                    .trim();


            const password =
                document
                    .getElementById("password")
                    .value;


            const passwordConfirm =
                document
                    .getElementById("password-confirm")
                    .value;


            const message =
                document
                    .getElementById("message");


            message.textContent =
                "";


            // ==========================================
            // CONTROLLO PASSWORD
            // ==========================================

            if (
                password !==
                passwordConfirm
            ) {

                message.textContent =
                    "Le password non coincidono.";


                return;

            }


            try {

                const {
                    data,
                    error
                } =
                    await supabaseClient
                        .auth
                        .signUp({

                            email:
                                email,

                            password:
                                password

                        });


                if (error) {

                    throw error;

                }


                console.log(
                    "Account creato:",
                    data
                );


                message.textContent =
                    "Account creato! Controlla la tua email per confermare la registrazione.";


                registerForm.reset();


            } catch (error) {

                console.error(
                    error
                );


                message.textContent =
                    "Errore: " +
                    error.message;

            }

        }
    );

}


// ==========================================
// LOGIN
// ==========================================

const loginForm =
    document.getElementById(
        "login-form"
    );


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const email =
                document
                    .getElementById("email")
                    .value
                    .trim();


            const password =
                document
                    .getElementById("password")
                    .value;


            const message =
                document
                    .getElementById("message");


            message.textContent =
                "";


            try {

                // ==========================================
                // LOGIN SUPABASE
                // ==========================================

                const {
                    data,
                    error
                } =
                    await supabaseClient
                        .auth
                        .signInWithPassword({

                            email:
                                email,

                            password:
                                password

                        });


                if (error) {

                    throw error;

                }


                console.log(
                    "Login effettuato:",
                    data
                );


                // ==========================================
                // UTENTE
                // ==========================================

                const user =
                    data.user;


                if (!user) {

                    throw new Error(
                        "Utente non trovato dopo il login."
                    );

                }


                // ==========================================
                // CONTROLLO PERSONAGGIO
                // ==========================================

                console.log(
                    "Controllo personaggio dell'utente..."
                );


                const {
                    data: character,
                    error: characterError
                } =
                    await supabaseClient
                        .from("characters")
                        .select("id")
                        .eq(
                            "user_id",
                            user.id
                        )
                        .maybeSingle();


                if (characterError) {

                    console.error(
                        "Errore controllo personaggio:",
                        characterError
                    );


                    throw characterError;

                }


                // ==========================================
                // PERSONAGGIO ESISTENTE
                // ==========================================

                if (character) {

                    console.log(
                        "Personaggio trovato:",
                        character.id
                    );


                    window.location.href =
                        "scheda.html";


                    return;

                }


                // ==========================================
                // NESSUN PERSONAGGIO
                // ==========================================

                console.log(
                    "Nessun personaggio trovato."
                );


                window.location.href =
                    "personaggio.html";


            } catch (error) {

                console.error(
                    error
                );


                message.textContent =
                    "Errore: " +
                    error.message;

            }

        }
    );

}

// ==========================================
// PASSWORD DIMENTICATA
// ==========================================

const forgotPasswordLink =
    document.getElementById(
        "forgot-password-link"
    );


if (forgotPasswordLink) {

    forgotPasswordLink.addEventListener(
        "click",
        async event => {

            event.preventDefault();


            const emailInput =
                document.getElementById(
                    "email"
                );


            const message =
                document.getElementById(
                    "message"
                );


            const email =
                emailInput
                    ?.value
                    .trim() ||
                "";


            if (!email) {

                message.textContent =
                    "Inserisci prima la tua email.";

                emailInput?.focus();

                return;

            }


            forgotPasswordLink.style.pointerEvents =
                "none";


            const originalText =
                forgotPasswordLink.textContent;


            forgotPasswordLink.textContent =
                "Invio email...";


            try {

                const basePath =
                    window.location.pathname
                        .replace(
                            /[^/]*$/,
                            ""
                        );


                const redirectTo =
                    `${window.location.origin}${basePath}reset-password.html`;


                const {
                    error
                } =
                    await supabaseClient
                        .auth
                        .resetPasswordForEmail(
                            email,
                            {
                                redirectTo:
                                    redirectTo
                            }
                        );


                if (error) {

                    throw error;

                }


                message.textContent =
                    "Ti abbiamo inviato un'email per reimpostare la password. Controlla anche la cartella spam.";


            } catch (error) {

                console.error(
                    "Errore recupero password:",
                    error
                );


                message.textContent =
                    "Errore: " +
                    (
                        error.message ||
                        "Impossibile inviare l'email di recupero."
                    );

            } finally {

                forgotPasswordLink.textContent =
                    originalText;


                forgotPasswordLink.style.pointerEvents =
                    "";

            }

        }
    );

}


// ==========================================
// NUOVA PASSWORD
// ==========================================

const resetPasswordForm =
    document.getElementById(
        "reset-password-form"
    );


if (resetPasswordForm) {

    resetPasswordForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const password =
                document
                    .getElementById(
                        "new-password"
                    )
                    .value;


            const passwordConfirm =
                document
                    .getElementById(
                        "new-password-confirm"
                    )
                    .value;


            const message =
                document.getElementById(
                    "message"
                );


            message.textContent =
                "";


            if (
                password.length <
                6
            ) {

                message.textContent =
                    "La password deve contenere almeno 6 caratteri.";

                return;

            }


            if (
                password !==
                passwordConfirm
            ) {

                message.textContent =
                    "Le password non coincidono.";

                return;

            }


            const submitButton =
                resetPasswordForm
                    .querySelector(
                        'button[type="submit"]'
                    );


            if (submitButton) {

                submitButton.disabled =
                    true;

                submitButton.textContent =
                    "SALVATAGGIO...";

            }


            try {

                const {
                    error
                } =
                    await supabaseClient
                        .auth
                        .updateUser({

                            password:
                                password

                        });


                if (error) {

                    throw error;

                }


                message.textContent =
                    "Password aggiornata correttamente. Ora puoi accedere.";


                resetPasswordForm.reset();


                setTimeout(
                    () => {

                        window.location.href =
                            "login.html";

                    },
                    1800
                );


            } catch (error) {

                console.error(
                    "Errore aggiornamento password:",
                    error
                );


                message.textContent =
                    "Errore: " +
                    (
                        error.message ||
                        "Impossibile aggiornare la password."
                    );


                if (submitButton) {

                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        "SALVA NUOVA PASSWORD";

                }

            }

        }
    );

}
