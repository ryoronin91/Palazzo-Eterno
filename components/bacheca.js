(() => {
    const fallback = {
        novita: [
            "Il Livello Base è ora accessibile dal dungeon.",
            "Mano di Scimmia si è trasferito alla Base.",
            "Sono iniziati i lavori per i nuovi servizi della Base."
        ],
        upgrade: [
            "Sistema di costruzione e potenziamento dei servizi.",
            "Scambio tra giocatori."
        ],
        avvisi: ["Nuovi contenuti verranno aggiunti progressivamente."]
    };

    const titles = {
        novita: "COSA C'È DI NUOVO",
        upgrade: "PROSSIMI UPGRADE",
        avvisi: "AVVISI"
    };

    let content = { ...fallback };

    async function loadRemoteContent() {
        if (typeof supabaseClient === "undefined") return;
        try {
            const { data, error } = await supabaseClient
                .from("noticeboard_entries")
                .select("section, content, sort_order")
                .eq("active", true)
                .order("sort_order", { ascending: true });
            if (error) throw error;
            const next = { novita: [], upgrade: [], avvisi: [] };
            (data || []).forEach(row => {
                if (next[row.section]) next[row.section].push(String(row.content || ""));
            });
            if (Object.values(next).some(items => items.length)) content = next;
        } catch (error) {
            console.warn("Bacheca: uso contenuti locali di fallback.", error);
        }
    }

    function markup(mode) {
        const cls = mode === "base" ? "base-noticeboard" : "public-noticeboard";
        return `
            <div class="${cls}-header shared-noticeboard-header">
                <div class="${cls}-kicker shared-noticeboard-kicker">PALAZZO ETERNO</div>
                <h2 class="${cls}-title shared-noticeboard-title">${mode === "base" ? "BACHECA DELLA BASE" : "BACHECA"}</h2>
            </div>
            <nav class="${cls}-tabs shared-noticeboard-tabs" aria-label="Sezioni bacheca">
                <button class="${cls}-tab shared-noticeboard-tab active" type="button" data-noticeboard-tab="novita">NOVITÀ</button>
                <button class="${cls}-tab shared-noticeboard-tab" type="button" data-noticeboard-tab="upgrade">PROSSIMI UPGRADE</button>
                <button class="${cls}-tab shared-noticeboard-tab" type="button" data-noticeboard-tab="avvisi">AVVISI</button>
            </nav>
            <div class="${cls}-content shared-noticeboard-content">
                <h3 data-noticeboard-title></h3>
                <ul class="${cls}-content-list public-noticeboard-list shared-noticeboard-list" data-noticeboard-list></ul>
            </div>`;
    }

    function render(host, tab) {
        const items = content[tab] || [];
        const title = host.querySelector("[data-noticeboard-title]");
        const list = host.querySelector("[data-noticeboard-list]");
        if (title) title.textContent = titles[tab] || "BACHECA";
        if (list) {
            list.innerHTML = "";
            items.forEach(text => {
                const li = document.createElement("li"); li.textContent = text; list.appendChild(li);
            });
        }
        host.querySelectorAll("[data-noticeboard-tab]").forEach(button => button.classList.toggle("active", button.dataset.noticeboardTab === tab));
    }

    async function init() {
        await loadRemoteContent();
        document.querySelectorAll(".shared-noticeboard-host").forEach(host => {
            const mode = host.dataset.noticeboardMode || "public";
            host.innerHTML = markup(mode);
            host.querySelectorAll("[data-noticeboard-tab]").forEach(button => button.addEventListener("click", () => render(host, button.dataset.noticeboardTab)));
            render(host, "novita");
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
