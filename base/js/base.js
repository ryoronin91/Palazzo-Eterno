// ============================================================
// PALAZZO ETERNO
// BASE.JS
//
// Prima versione del "Livello Base".
// Mantiene lo stile e i dati del personaggio del dungeon,
// ma NON modifica dungeon_x / dungeon_y e non introduce ancora
// logiche di movimento, eventi o combattimento.
// ============================================================

console.log("BASE.JS CARICATO");

const db = supabaseClient;

const BASE_MAP_COLUMNS = 27;
const BASE_MAP_ROWS = 36;

let currentUser = null;
let character = null;
let equipmentBonuses = {
    attack_bonus: 0,
    defense_bonus: 0,
    forza_bonus: 0,
    resistenza_bonus: 0,
    costituzione_bonus: 0,
    intelligenza_bonus: 0,
    destrezza_bonus: 0,
    fortuna_bonus: 0
};

document.addEventListener("DOMContentLoaded", async () => {
    try {
        setMessage("Caricamento del Livello Base...");

        setupBaseVolumeControl();

        await loadBaseMapDefinition();
        await loadCharacter();
        await loadCharacterEquipment();

        updateCharacterPanel();

        setMessage(
            "Livello Base caricato. Movimento ed eventi verranno collegati quando sarà definita la funzione di questo livello."
        );
    } catch (error) {
        console.error("Errore avvio Livello Base:", error);
        setMessage(
            error?.message ||
            "Errore durante il caricamento del Livello Base.",
            true
        );
    }
});

async function loadBaseMapDefinition() {
    const response = await fetch("base.json", {
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error("Impossibile caricare base.json.");
    }

    const data = await response.json();

    const columns =
        Number(data?.grid?.columns) ||
        BASE_MAP_COLUMNS;

    const rows =
        Number(data?.grid?.rows) ||
        BASE_MAP_ROWS;

    if (
        columns !== BASE_MAP_COLUMNS ||
        rows !== BASE_MAP_ROWS
    ) {
        console.warn(
            `La mappa Base dichiara ${columns}x${rows}; ` +
            `la pagina è configurata per ${BASE_MAP_COLUMNS}x${BASE_MAP_ROWS}.`
        );
    }

    console.log("Definizione Livello Base caricata:", data);
}

async function loadCharacter() {
    const {
        data: { user },
        error: authError
    } = await db.auth.getUser();

    if (authError) {
        throw authError;
    }

    if (!user) {
        window.location.href = "../login.html";
        return;
    }

    currentUser = user;

    const { data, error } = await db
        .from("characters")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        window.location.href = "../personaggio.html";
        return;
    }

    character = data;
}

async function loadCharacterEquipment() {
    if (!character) {
        return;
    }

    const { data, error } = await db
        .from("character_inventory")
        .select(`
            equipped_slot,
            item:items (
                attack_bonus,
                defense_bonus,
                forza_bonus,
                resistenza_bonus,
                costituzione_bonus,
                intelligenza_bonus,
                destrezza_bonus,
                fortuna_bonus
            )
        `)
        .eq("character_id", character.id);

    if (error) {
        console.warn(
            "Equipaggiamento non disponibile nel Livello Base:",
            error
        );
        return;
    }

    equipmentBonuses = {
        attack_bonus: 0,
        defense_bonus: 0,
        forza_bonus: 0,
        resistenza_bonus: 0,
        costituzione_bonus: 0,
        intelligenza_bonus: 0,
        destrezza_bonus: 0,
        fortuna_bonus: 0
    };

    (data || [])
        .filter(entry => entry.equipped_slot && entry.item)
        .forEach(entry => {
            const item = entry.item;

            Object.keys(equipmentBonuses).forEach(key => {
                equipmentBonuses[key] +=
                    Number(item?.[key]) || 0;
            });
        });
}

function getEffectiveAttribute(attribute) {
    const base = Number(character?.[attribute]) || 1;
    const bonus =
        Number(
            equipmentBonuses[
                `${attribute}_bonus`
            ]
        ) || 0;

    return Math.max(
        1,
        Math.min(30, base + bonus)
    );
}

function getCalculatedStats() {
    const forza = getEffectiveAttribute("forza");
    const resistenza = getEffectiveAttribute("resistenza");
    const costituzione = getEffectiveAttribute("costituzione");
    const intelligenza = getEffectiveAttribute("intelligenza");
    const destrezza = getEffectiveAttribute("destrezza");
    const fortuna = getEffectiveAttribute("fortuna");

    return {
        forza,
        resistenza,
        costituzione,
        intelligenza,
        destrezza,
        fortuna,

        attack:
            Math.ceil(forza / 2) +
            (Number(equipmentBonuses.attack_bonus) || 0),

        defense:
            Math.ceil(7 + resistenza / 2) +
            (Number(equipmentBonuses.defense_bonus) || 0),

        maxHealth:
            Math.ceil(5 * costituzione / 2),

        maxMana:
            Math.ceil(5 * intelligenza / 2),

        movement:
            Math.ceil(4 + destrezza / 2),

        critical:
            Math.round(
                fortuna * (50 / 30) * 100
            ) / 100
    };
}

function updateCharacterPanel() {
    if (!character) {
        return;
    }

    const stats = getCalculatedStats();
    const name =
        character.nome ||
        "Avventuriero";

    setText("character-name", name);
    setText("character-name-panel", name);
    setText(
        "character-level",
        Number(character.livello) || 1
    );

    const portrait =
        document.getElementById("character-token");

    if (portrait) {
        portrait.src =
            "../immagini/token/" +
            (
                character.token ||
                "token_1.png"
            );

        portrait.alt =
            `Token di ${name}`;
    }

    setText("forza-display", stats.forza);
    setText("resistenza-display", stats.resistenza);
    setText("costituzione-display", stats.costituzione);
    setText("intelligenza-display", stats.intelligenza);
    setText("destrezza-display", stats.destrezza);
    setText("fortuna-display", stats.fortuna);

    const currentPF =
        character.current_hp === null ||
        character.current_hp === undefined
            ? stats.maxHealth
            : Math.max(
                0,
                Math.min(
                    Number(character.current_hp),
                    stats.maxHealth
                )
            );

    const currentPM =
        character.current_pm === null ||
        character.current_pm === undefined
            ? stats.maxMana
            : Math.max(
                0,
                Math.min(
                    Number(character.current_pm),
                    stats.maxMana
                )
            );

    setText("attack-display", stats.attack);
    setText("defense-display", stats.defense);
    setText(
        "health-display",
        `${currentPF}/${stats.maxHealth}`
    );
    setText(
        "mana-display",
        `${currentPM}/${stats.maxMana}`
    );
    setText("movement-display", stats.movement);
    setText(
        "critical-display",
        `${stats.critical.toFixed(2)}%`
    );
}

function setText(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function setMessage(text, error = false) {
    const element =
        document.getElementById(
            "dungeon-message"
        );

    if (!element) {
        return;
    }

    element.textContent = text;
    element.classList.toggle(
        "error",
        !!error
    );
}

// ============================================================
// VOLUME
// ============================================================

const BASE_VOLUME_KEY =
    "palazzo-eterno-base-volume";

let baseVolume =
    loadBaseVolume();

let baseMusic = null;

function loadBaseVolume() {
    try {
        const saved =
            localStorage.getItem(
                BASE_VOLUME_KEY
            );

        const value =
            Number(saved);

        return Number.isFinite(value)
            ? Math.max(
                0,
                Math.min(1, value)
            )
            : 0.35;

    } catch {
        return 0.35;
    }
}

function volumeIcon(volume) {
    if (volume <= 0) return "🔇";
    if (volume < 0.5) return "🔉";
    return "🔊";
}

function setupBaseVolumeControl() {
    const control =
        document.querySelector(
            ".dungeon-volume-control"
        );

    const button =
        document.getElementById(
            "dungeon-volume-button"
        );

    const popover =
        document.getElementById(
            "dungeon-volume-popover"
        );

    const slider =
        document.getElementById(
            "dungeon-volume-slider"
        );

    const value =
        document.getElementById(
            "dungeon-volume-value"
        );

    if (
        !control ||
        !button ||
        !popover ||
        !slider
    ) {
        return;
    }

    const updateUI = () => {
        const percentage =
            Math.round(baseVolume * 100);

        button.textContent =
            volumeIcon(baseVolume);

        slider.value =
            String(percentage);

        if (value) {
            value.textContent =
                `${percentage}%`;
        }

        if (baseMusic) {
            baseMusic.volume =
                baseVolume;
        }
    };

    updateUI();

    button.addEventListener(
        "click",
        event => {
            event.preventDefault();
            event.stopPropagation();

            popover.hidden =
                !popover.hidden;

            button.setAttribute(
                "aria-expanded",
                popover.hidden
                    ? "false"
                    : "true"
            );
        }
    );

    slider.addEventListener(
        "input",
        () => {
            baseVolume =
                Math.max(
                    0,
                    Math.min(
                        1,
                        Number(slider.value) / 100
                    )
                );

            try {
                localStorage.setItem(
                    BASE_VOLUME_KEY,
                    String(baseVolume)
                );
            } catch {}

            updateUI();
        }
    );

    document.addEventListener(
        "click",
        event => {
            if (
                control.contains(
                    event.target
                )
            ) {
                return;
            }

            popover.hidden = true;

            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    );
}
