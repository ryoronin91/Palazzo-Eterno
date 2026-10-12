// Palazzo Eterno - cambio equipaggiamento in combat.
// Server authoritative: turni, oggetti e modifiche vengono convalidati dalla RPC.
const COMBAT_EQUIPMENT_SLOTS = [
    ["hand_1", "Mano 1"], ["hand_2", "Mano 2"], ["armor", "Armatura"],
    ["accessory_1", "Accessorio 1"], ["accessory_2", "Accessorio 2"],
    ["accessory_3", "Accessorio 3"]
];
let combatEquipmentRows = [];
let combatEquipmentSlot = "hand_1";
let combatEquipmentBusy = false;

function canChangeCombatEquipment() {
    const player = getMyPlayerEntity();
    return Boolean(currentCharacter && combatId && player && player.status === "alive" &&
        isMyTurn() && player.action_used !== true && !combatEquipmentBusy);
}

function isCompatibleCombatEquipment(item, slot) {
    if (!item || !slot) return false;
    if (item.equip_slot === "armor") return slot === "armor";
    if (item.equip_slot === "accessory") return slot.startsWith("accessory_");
    if (item.equip_slot !== "hand") return false;
    return ["hand_1", "hand_2"].includes(slot) &&
        (!["two_handed", "main_hand_only"].includes(item.hand_rule) || slot === "hand_1");
}

function currentCombatEquipmentForSlot(slot) {
    const occupied = combatEquipmentRows.find(x => x.equipped_slot === slot);
    if (occupied) return occupied;
    if (slot === "hand_2") {
        const main = combatEquipmentRows.find(x => x.equipped_slot === "hand_1");
        if (main?.item?.hand_rule === "two_handed") return main;
    }
    return null;
}

async function openCombatEquipmentPanel() {
    if (!canChangeCombatEquipment()) return;
    cancelCombatTargeting();
    activeDrawer = "equipment";
    document.body.classList.add("combat-drawer-open");
    setText("combat-drawer-title", "EQUIPAGGIAMENTO");
    const container = document.getElementById("combat-drawer-body");
    if (container) container.textContent = "Caricamento equipaggiamento...";
    try {
        const { data, error } = await db.from("character_inventory")
            .select("id,item_id,quantity,equipped_slot,item:items(id,name,description,equip_slot,hand_rule)")
            .eq("character_id", currentCharacter.id)
            .order("created_at", { ascending: true });
        if (error) throw error;
        combatEquipmentRows = data || [];
        if (activeDrawer === "equipment") renderCombatEquipmentPanel();
    } catch (error) {
        console.error("Errore inventario equipaggiamento combat:", error);
        if (container && activeDrawer === "equipment") {
            container.textContent = error.message || "Impossibile caricare l'inventario.";
        }
    }
}

function renderCombatEquipmentPanel() {
    if (activeDrawer !== "equipment") return;
    const container = document.getElementById("combat-drawer-body");
    if (!container) return;
    container.replaceChildren();

    const help = document.createElement("p");
    help.className = "combat-equipment-help";
    help.textContent = "Cambia un oggetto o libera uno slot. Costa un'azione principale, non lo slot OGGETTO.";
    container.appendChild(help);

    const labelSlot = document.createElement("label");
    labelSlot.className = "combat-equipment-label";
    labelSlot.textContent = "SLOT DA MODIFICARE";
    container.appendChild(labelSlot);

    const slotSelect = document.createElement("select");
    slotSelect.className = "combat-equipment-select";
    for (const [slot, name] of COMBAT_EQUIPMENT_SLOTS) {
        const entry = currentCombatEquipmentForSlot(slot);
        const option = document.createElement("option");
        option.value = slot;
        option.textContent = name + " — " + (entry?.item?.name || "Vuoto");
        slotSelect.appendChild(option);
    }
    slotSelect.value = combatEquipmentSlot;
    container.appendChild(slotSelect);

    const labelItem = document.createElement("label");
    labelItem.className = "combat-equipment-label";
    labelItem.textContent = "OPERAZIONE";
    container.appendChild(labelItem);

    const itemSelect = document.createElement("select");
    itemSelect.className = "combat-equipment-select";
    container.appendChild(itemSelect);

    const preview = document.createElement("div");
    preview.className = "combat-equipment-preview";
    container.appendChild(preview);

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "combat-button combat-equipment-confirm";
    confirm.textContent = "CONFERMA CAMBIO · 1 AZIONE";
    container.appendChild(confirm);

    function describeSwap() {
        const slot = slotSelect.value;
        const chosen = itemSelect.value;
        confirm.disabled = !canChangeCombatEquipment() || !chosen;
        if (!chosen) {
            preview.textContent = "Seleziona una modifica per vedere quali oggetti verranno riposti.";
            return;
        }
        const replacing = [];
        const target = chosen === "__remove__" ? null :
            combatEquipmentRows.find(x => x.id === chosen);
        const oldInSlot = currentCombatEquipmentForSlot(slot);
        if (target?.item?.hand_rule === "two_handed") {
            for (const s of ["hand_1", "hand_2"]) {
                const old = currentCombatEquipmentForSlot(s);
                if (old && !replacing.some(x => x.id === old.id)) replacing.push(old);
            }
        } else if (oldInSlot) {
            replacing.push(oldInSlot);
        }
        const names = replacing.map(x => x.item?.name || x.item_id).join(", ");
        preview.textContent = (names ? "Riponi: " + names + ". " : "") +
            (target ? "Equipaggi: " + target.item.name + "." : "Lasci lo slot libero.") +
            " Consumi l'azione principale del turno.";
    }

    function fillChoices() {
        itemSelect.replaceChildren();
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "— Scegli un'operazione —";
        itemSelect.appendChild(blank);
        const old = currentCombatEquipmentForSlot(slotSelect.value);
        if (old) {
            const remove = document.createElement("option");
            remove.value = "__remove__";
            remove.textContent = "Riponi " + (old.item?.name || "oggetto") + " (senza sostituire)";
            itemSelect.appendChild(remove);
        }
        for (const entry of combatEquipmentRows) {
            if (entry.equipped_slot || Number(entry.quantity) <= 0 ||
                !isCompatibleCombatEquipment(entry.item, slotSelect.value)) continue;
            const option = document.createElement("option");
            option.value = entry.id;
            option.textContent = entry.item.name + (entry.quantity > 1 ? " ×" + entry.quantity : "");
            itemSelect.appendChild(option);
        }
        itemSelect.value = "";
        describeSwap();
    }

    slotSelect.addEventListener("change", () => {
        combatEquipmentSlot = slotSelect.value;
        fillChoices();
    });
    itemSelect.addEventListener("change", describeSwap);
    confirm.addEventListener("click", async () => {
        const selected = itemSelect.value;
        if (!selected || !canChangeCombatEquipment()) return;
        combatEquipmentBusy = true;
        confirm.disabled = true;
        confirm.textContent = "CAMBIO IN CORSO...";
        let committed = false;
        try {
            const { data, error } = await db.rpc("combat_change_equipment", {
                p_combat_id: combatId,
                p_character_id: currentCharacter.id,
                p_inventory_id: selected === "__remove__" ? null : selected,
                p_slot: slotSelect.value
            });
            if (error) throw error;
            committed = true;
            if (data) {
                currentCharacter.current_hp = Number(data.current_hp);
                currentCharacter.current_pm = Number(data.current_pm);
            }
            const removed = Array.isArray(data?.removed) ? data.removed : [];
            const label = currentCharacter?.nome || "Un giocatore";
            const action = data?.equipped
                ? (removed.length ? "ha riposto " + removed.join(", ") + " ed equipaggiato " :
                    "ha equipaggiato ") + data.equipped + "."
                : "ha riposto " + removed.join(", ") + ".";
            await addSharedCombatLog(label + " " + action);
            await Promise.all([
                loadCombatEntities(), loadCharacterInventory(),
                loadCharacterEquipment(), loadCharacterAbilities()
            ]);
            lastCombatEntitiesSnapshot = createCombatSnapshot();
            closeCombatDrawer();
            renderCombat();
        } catch (error) {
            console.error("Cambio equipaggiamento:", error);
            addCombatLog(committed
                ? "Cambio applicato, ma aggiornamento della schermata non riuscito: ricarica la pagina."
                : (error.message || "Cambio equipaggiamento non riuscito."));
        } finally {
            combatEquipmentBusy = false;
            if (activeDrawer === "equipment") {
                confirm.textContent = "CONFERMA CAMBIO · 1 AZIONE";
                describeSwap();
            }
            updateActionButtons();
        }
    });
    fillChoices();
}

function updateCombatEquipmentPanelAvailability() {
    if (activeDrawer !== "equipment") return;
    const confirm = document.querySelector(".combat-equipment-confirm");
    if (confirm && !canChangeCombatEquipment()) confirm.disabled = true;
}
