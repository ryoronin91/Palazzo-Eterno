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