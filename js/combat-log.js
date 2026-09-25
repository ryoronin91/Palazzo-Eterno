// ============================================================
// PALAZZO ETERNO
// COMBAT-LOG.JS
// REGISTRO DEL COMBATTIMENTO
// ============================================================


// ============================================================
// AGGIUNGE UNA VOCE AL REGISTRO
// ============================================================

function addCombatLog(
    text
) {

    const container =
        document.getElementById(
            "combat-log"
        );


    if (
        !container
    ) {

        return;

    }


    // ========================================================
    // RIMUOVE EVENTUALE PLACEHOLDER
    // ========================================================

    const placeholder =
        container.querySelector(
            ".combat-log-placeholder"
        );


    placeholder?.remove();


    // ========================================================
    // CREA RIGA
    // ========================================================

    const row =
        document.createElement(
            "div"
        );


    row.className =
        "combat-log-entry";


    row.textContent =
        text;


    // ========================================================
    // MESSAGGIO PIÙ RECENTE IN ALTO
    // ========================================================

    container.prepend(
        row
    );


    // Riporta lo scroll in alto
    // per mostrare subito il nuovo evento.

    container.scrollTop =
        0;

}