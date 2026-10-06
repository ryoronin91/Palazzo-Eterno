(() => {
    "use strict";

    const CONTENT = {
        novita: {
            title: "COSA C'È DI NUOVO",
            items: [
                "Il Livello Base è ora accessibile dal dungeon.",
                "Mano di Scimmia si è trasferito alla Base.",
                "Sono iniziati i lavori per i nuovi servizi della Base."
            ]
        },
        upgrade: {
            title: "PROSSIMI UPGRADE",
            items: [
                "Sistema di costruzione e potenziamento dei servizi.",
                "Scambio tra giocatori."
            ]
        },
        avvisi: {
            title: "AVVISI",
            items: [
                "Nuovi contenuti verranno aggiunti progressivamente."
            ]
        }
    };

    const escapeHtml = value =>
        String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    function markup(mode) {
        const isBase = mode === "base";
        return `
            <section class="shared-noticeboard" data-mode="${isBase ? "base" : "public"}" aria-label="Bacheca del Palazzo Eterno">
                <div class="shared-noticeboard-header">
                    <div class="shared-noticeboard-kicker">PALAZZO ETERNO</div>
                    <h2 class="shared-noticeboard-title"${isBase ? ' id="base-noticeboard-title"' : ""}>${isBase ? "BACHECA DELLA BASE" : "BACHECA"}</h2>
                </div>
                <nav class="shared-noticeboard-tabs" aria-label="Sezioni bacheca">
                    <button class="shared-noticeboard-tab active" type="button" data-noticeboard-tab="novita">NOVITÀ</button>
                    <button class="shared-noticeboard-tab" type="button" data-noticeboard-tab="upgrade">PROSSIMI UPGRADE</button>
                    <button class="shared-noticeboard-tab" type="button" data-noticeboard-tab="avvisi">AVVISI</button>
                </nav>
                <div class="shared-noticeboard-content">
                    <h3 data-noticeboard-title>COSA C'È DI NUOVO</h3>
                    <ul class="shared-noticeboard-list" data-noticeboard-list></ul>
                </div>
            </section>`;
    }

    function initHost(host) {
        const mode = host.dataset.noticeboardMode === "base" ? "base" : "public";
        host.innerHTML = markup(mode);

        const title = host.querySelector("[data-noticeboard-title]");
        const list = host.querySelector("[data-noticeboard-list]");
        const tabs = [...host.querySelectorAll("[data-noticeboard-tab]")];

        const render = tabId => {
            const section = CONTENT[tabId];
            if (!section) return;
            title.textContent = section.title;
            list.innerHTML = section.items.map(item => `<li>${escapeHtml(item)}</li>`).join("");
            tabs.forEach(button => {
                button.classList.toggle("active", button.dataset.noticeboardTab === tabId);
            });
        };

        tabs.forEach(button => {
            button.addEventListener("click", () => render(button.dataset.noticeboardTab));
        });

        render("novita");
    }

    document.querySelectorAll(".shared-noticeboard-host").forEach(initHost);
})();
