console.log("SCIAMANO-IB.JS CARICATO");


let pageBackgroundMusic = null;
const PALAZZO_MUSIC_VOLUME_KEY = "palazzo-eterno-dungeon-volume";
let vendorMusicVolume = loadVendorMusicVolume();


const VENDOR_ID = 'vendor_sciamano_scagliagrigia';
const REQUIRED_SCORE = 400;
const QUEST_TARGET = 12;


let currentUser = null;
let character = null;
let characterInventory = [];
let vendorItems = [];
let shamanTrialStatus = null;


function client() {
    return typeof db !== 'undefined' ? db : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
}


function loadVendorMusicVolume() {
    try {
        const saved = localStorage.getItem(PALAZZO_MUSIC_VOLUME_KEY);
        if (saved === null || saved === '') return 0.35;
        const value = Number(saved);
        return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.35;
    } catch (_) {
        return 0.35;
    }
}


function saveVendorMusicVolume(value) {
    try { localStorage.setItem(PALAZZO_MUSIC_VOLUME_KEY, String(value)); } catch (_) {}
}


function getVendorVolumeIcon(volume) {
    if (volume <= 0) return '🔇';
    if (volume < 0.5) return '🔉';
    return '🔊';
}


function updateVendorVolumeUI() {
    const button = document.getElementById('vendor-volume-button');
    const slider = document.getElementById('vendor-volume-slider');
    const value = document.getElementById('vendor-volume-value');
    const percentage = Math.round(vendorMusicVolume * 100);
    if (button) {
        button.textContent = getVendorVolumeIcon(vendorMusicVolume);
        button.title = `Volume musica: ${percentage}%`;
    }
    if (slider) slider.value = String(percentage);
    if (value) value.textContent = `${percentage}%`;
}


function setupVendorVolumeControl() {
    const button = document.getElementById('vendor-volume-button');
    const popover = document.getElementById('vendor-volume-popover');
    const slider = document.getElementById('vendor-volume-slider');
    if (!button || !popover || !slider) return;
    updateVendorVolumeUI();
    button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = popover.hidden === true;
        popover.hidden = !willOpen;
        button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    slider.addEventListener('input', () => {
        vendorMusicVolume = Math.max(0, Math.min(1, Number(slider.value) / 100));
        if (pageBackgroundMusic) pageBackgroundMusic.volume = vendorMusicVolume;
        saveVendorMusicVolume(vendorMusicVolume);
        updateVendorVolumeUI();
    });
    document.addEventListener('click', event => {
        if (!popover.hidden && !popover.contains(event.target) && event.target !== button) {
            popover.hidden = true;
            button.setAttribute('aria-expanded', 'false');
        }
    });
}


function startBackgroundMusic(source) {
    if (pageBackgroundMusic || !source) return;
    pageBackgroundMusic = new Audio(source);
    pageBackgroundMusic.loop = true;
    pageBackgroundMusic.volume = vendorMusicVolume;
    pageBackgroundMusic.preload = 'auto';
    const tryPlay = async () => {
        if (!pageBackgroundMusic) return;
        try { await pageBackgroundMusic.play(); } catch (_) {}
    };
    tryPlay();
    document.addEventListener('pointerdown', tryPlay, { once: true });
    document.addEventListener('keydown', tryPlay, { once: true });
}


function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}


function setDialogue(text) {
    const node = document.getElementById('dialogue-text');
    if (node) node.textContent = text;
}


function appendChat(author, text, player = false) {
    const log = document.getElementById('chat-log');
    if (!log) return;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble' + (player ? ' player' : '');
    bubble.innerHTML = `<strong>${escapeHtml(author)}</strong><span>${escapeHtml(text)}</span>`;
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
}


async function loadVendorCharacter() {
    const dbClient = client();
    if (!dbClient) throw new Error('Supabase non disponibile.');
    const { data: { session }, error: sessionError } = await dbClient.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.user) {
        window.location.href = '../../../../login.html';
        return;
    }
    currentUser = session.user;
    const { data, error } = await dbClient
        .from('characters')
        .select('id,nome,score')
        .eq('user_id', currentUser.id)
        .maybeSingle();
    if (error) throw error;
    if (!data) {
        window.location.href = '../../../../personaggio.html';
        return;
    }
    character = data;
}


async function loadVendorCharacterInventory() {
    if (!character) {
        characterInventory = [];
        return;
    }
    const dbClient = client();
    const { data, error } = await dbClient
        .from('character_inventory')
        .select(`id,quantity,equipped_slot,item:items(id,name,description,item_type,equip_slot,heal_pf,heal_pm,gold_value,grants_ability_id)`) 
        .eq('character_id', character.id)
        .order('created_at', { ascending: true });
    if (error) throw error;
    characterInventory = Array.isArray(data) ? data : [];
}


function getPlayerGold() {
    const goldEntry = characterInventory.find(entry => entry?.item?.id === 'moneta_oro');
    return Math.max(0, Number(goldEntry?.quantity) || 0);
}


async function loadVendorItems() {
    const dbClient = client();
    const { data, error } = await dbClient
        .from('vendor_items')
        .select(`id,vendor_id,item_id,buy_price,min_score,unlimited,item:items(id,name,description,item_type,grants_ability_id)`) 
        .eq('vendor_id', VENDOR_ID)
        .order('buy_price', { ascending: true })
        .order('item_id', { ascending: true });
    if (error) throw error;
    vendorItems = Array.isArray(data) ? data : [];
}


function updateCharacterHeader() {
    const name = document.getElementById('player-name');
    const gold = document.getElementById('player-gold');
    const score = document.getElementById('player-score');
    if (name) name.textContent = character?.nome ? String(character.nome).toUpperCase() : 'SCAGLIAGRIGIA';
    if (gold) gold.textContent = String(getPlayerGold());
    if (score) {
        const currentScore = Math.max(0, Number(character?.score) || 0);
        score.textContent = `Risonanza: ${currentScore} / ${REQUIRED_SCORE}` + (currentScore >= REQUIRED_SCORE ? ' ✓' : ' ✗');
    }
}


function renderVendorCharacterInventory() {
    const container = document.getElementById('player-inventory');
    if (!container) return;
    const items = characterInventory.filter(entry => entry?.item && Number(entry.quantity) > 0 && entry.item.id !== 'moneta_oro');
    if (!items.length) {
        container.innerHTML = '<div class="empty-state">Inventario vuoto.</div>';
        return;
    }
    container.innerHTML = items.map(entry => {
        const item = entry.item;
        const tags = [];
        if (item.grants_ability_id) tags.push('Pergamena abilità');
        if (entry.equipped_slot) tags.push(`Equip: ${entry.equipped_slot}`);
        return `
            <article class="item-card">
                <h3>${escapeHtml(item.name || entry.item.id)}</h3>
                <p>${escapeHtml(item.description || 'Nessuna descrizione.')}</p>
                <div class="item-meta">
                    <span>Quantità: <strong>${Math.max(0, Number(entry.quantity) || 0)}</strong></span>
                    ${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}
                </div>
            </article>`;
    }).join('');
}


function renderVendorItems() {
    const container = document.getElementById('vendor-stock');
    if (!container) return;
    if (!vendorItems.length) {
        container.innerHTML = '<div class="empty-state">Nessuna pergamena disponibile.</div>';
        return;
    }
    const playerGold = getPlayerGold();
    const scoreValue = Math.max(0, Number(character?.score) || 0);
    container.innerHTML = vendorItems.map(row => {
        const item = row.item || {};
        const price = Math.max(0, Number(row.buy_price) || 0);
        const minScore = Math.max(0, Number(row.min_score) || 0);
        const canScore = scoreValue >= minScore;
        const canGold = playerGold >= price;
        const disabled = !(canScore && canGold);
        const status = !canScore ? `Richiede ${minScore} risonanza` : (!canGold ? 'Oro insufficiente' : 'Disponibile');
        return `
            <article class="stock-card">
                <h3>${escapeHtml(item.name || row.item_id)}</h3>
                <p>${escapeHtml(item.description || 'Pergamena rituale.')}</p>
                <div class="stock-meta">
                    <span>Abilità: <strong>${escapeHtml(item.grants_ability_id || '—')}</strong></span>
                    <span>Costo: <strong>${price}</strong> oro</span>
                    <span>Risonanza minima: <strong>${minScore}</strong></span>
                </div>
                <div class="price-line">
                    <span>${escapeHtml(status)}</span>
                    <button type="button" data-buy-item-id="${escapeHtml(row.item_id)}" ${disabled ? 'disabled' : ''}>ACQUISTA</button>
                </div>
            </article>`;
    }).join('');
    container.querySelectorAll('[data-buy-item-id]').forEach(button => {
        button.addEventListener('click', () => buyVendorItem(button));
    });
}


function normalizeTrialStatus(data) {
    const usesObj = data?.uses && typeof data.uses === 'object' ? data.uses : {};
    return {
        completed: Boolean(data?.completed),
        totalCompleted: Number(data?.total_completed) || 0,
        counts: {
            sanguinamento: Number(data?.sanguinamento ?? data?.sanguinamento_uses ?? usesObj.sanguinamento) || 0,
            succhiasangue: Number(data?.succhiasangue ?? data?.succhiasangue_uses ?? usesObj.succhiasangue) || 0,
            veleno: Number(data?.veleno ?? data?.veleno_uses ?? usesObj.veleno) || 0
        },
        available: true,
        error: ''
    };
}


async function loadShamanTrialStatus() {
    const feedback = document.getElementById('quest-feedback');
    const dbClient = client();
    if (!dbClient) {
        shamanTrialStatus = { available: false, completed: false, totalCompleted: 0, counts: { sanguinamento: 0, succhiasangue: 0, veleno: 0 }, error: 'Supabase non disponibile.' };
        renderShamanTrialStatus();
        return;
    }
    try {
        const { data, error } = await dbClient.rpc('scagliagrigia_shaman_trial_status');
        if (error) throw error;
        shamanTrialStatus = normalizeTrialStatus(data || {});
    } catch (error) {
        shamanTrialStatus = { available: false, completed: false, totalCompleted: 0, counts: { sanguinamento: 0, succhiasangue: 0, veleno: 0 }, error: error.message || 'Missione non disponibile.' };
    }
    renderShamanTrialStatus();
}


function renderShamanTrialStatus() {
    const status = shamanTrialStatus || { counts: { sanguinamento: 0, succhiasangue: 0, veleno: 0 }, completed: false, totalCompleted: 0, available: false, error: '' };
    const ids = ['sanguinamento', 'succhiasangue', 'veleno'];
    ids.forEach(id => {
        const node = document.getElementById(`quest-${id}`);
        if (node) node.textContent = `${Math.min(QUEST_TARGET, Math.max(0, Number(status.counts[id]) || 0))} / ${QUEST_TARGET}`;
    });
    const feedback = document.getElementById('quest-feedback');
    const button = document.getElementById('quest-claim');
    if (feedback) {
        if (!status.available) feedback.textContent = status.error || 'Missione in preparazione.';
        else if (status.completed) feedback.textContent = `Hai già completato questa missione nel ciclo corrente. Missioni della tribù completate: ${status.totalCompleted}/5.`;
        else {
            const allDone = ids.every(id => (Number(status.counts[id]) || 0) >= QUEST_TARGET);
            feedback.textContent = allDone
                ? `Le tre afflizioni sono state padroneggiate. Missioni della tribù completate: ${status.totalCompleted}/5.`
                : `Usa le tre abilità in combattimento. Missioni della tribù completate: ${status.totalCompleted}/5.`;
        }
    }
    if (button) {
        const allDone = ids.every(id => (Number(status.counts[id]) || 0) >= QUEST_TARGET);
        button.disabled = !(status.available && !status.completed && allDone);
    }
}


async function buyVendorItem(button) {
    if (!button || button.disabled) return;
    const itemId = button.dataset.buyItemId;
    const dbClient = client();
    const originalText = button.textContent;
    try {
        button.disabled = true;
        button.textContent = '...';
        const { error } = await dbClient.rpc('vendor_buy_item', {
            p_vendor_id: VENDOR_ID,
            p_item_id: itemId,
            p_quantity: 1
        });
        if (error) throw error;
        await loadVendorCharacterInventory();
        updateCharacterHeader();
        renderVendorCharacterInventory();
        renderVendorItems();
        const item = vendorItems.find(row => row.item_id === itemId);
        setDialogue(`Lo Sciamano ti consegna ${item?.item?.name || itemId}. «Studia. Poi torna con il sangue ancora caldo sulle mani.»`);
    } catch (error) {
        setDialogue(error.message || 'Acquisto non riuscito.');
    } finally {
        if (button.isConnected) {
            button.disabled = false;
            button.textContent = originalText;
        }
        renderVendorItems();
    }
}


async function claimQuest() {
    const button = document.getElementById('quest-claim');
    if (!button || button.disabled) return;
    const dbClient = client();
    const originalText = button.textContent;
    try {
        button.disabled = true;
        button.textContent = '...';
        const { error } = await dbClient.rpc('scagliagrigia_shaman_trial_claim');
        if (error) throw error;
        setDialogue('Lo Sciamano annuisce lentamente. «Hai versato abbastanza dolore. La tribù ricorderà la tua disciplina.»');
        await loadShamanTrialStatus();
    } catch (error) {
        const feedback = document.getElementById('quest-feedback');
        if (feedback) feedback.textContent = error.message || 'Impossibile riscuotere il riconoscimento.';
    } finally {
        if (button.isConnected) button.textContent = originalText;
    }
}


const SHAMAN_NPC_ID = 'npc_sciamano_scagliagrigia';
let shamanHistory = [];
let shamanBusy = false;


function setupChat() {
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');
    const send = form?.querySelector('button[type="submit"]');
    if (!form || !input) return;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (shamanBusy) return;
        const message = String(input.value || '').trim().slice(0, 400);
        if (!message) return;
        appendChat(character?.nome || 'TU', message, true);
        input.value = '';
        shamanBusy = true;
        input.disabled = true;
        if (send) { send.disabled = true; send.textContent = '...'; }
        try {
            const dbClient = client();
            if (!dbClient) throw new Error('Supabase non disponibile');
            const { data, error } = await dbClient.functions.invoke('vendor-ai', {
                body: { npc_id: SHAMAN_NPC_ID, message, history: shamanHistory }
            });
            if (error) throw error;
            const reply = String(data?.reply || '').trim();
            if (!reply) throw new Error('Nessuna risposta dello Sciamano');
            appendChat('SCIAMANO', reply);
            shamanHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
            shamanHistory = shamanHistory.slice(-10);
        } catch (error) {
            console.error('Errore IA Sciamano:', error);
            appendChat('SISTEMA', 'Lo Sciamano tace. Il rituale di comunicazione non riesce. Riprova.');
        } finally {
            shamanBusy = false;
            input.disabled = false;
            if (send) { send.disabled = false; send.textContent = 'PARLA'; }
            input.focus();
        }
    });
}


function setupExit() {
    const button = document.getElementById('exit-button');
    if (!button) return;
    button.addEventListener('click', () => {
        window.location.href = '../../piano-Ib.html';
    });
}


document.addEventListener('DOMContentLoaded', async () => {
    startBackgroundMusic('../../../../music/piano-Ia.mp3');
    setupVendorVolumeControl();
    setupExit();
    setupChat();
    const claimButton = document.getElementById('quest-claim');
    if (claimButton) claimButton.addEventListener('click', claimQuest);
    try {
        await loadVendorCharacter();
        await loadVendorCharacterInventory();
        await loadVendorItems();
        updateCharacterHeader();
        renderVendorCharacterInventory();
        renderVendorItems();
        await loadShamanTrialStatus();
    } catch (error) {
        console.error('Errore caricamento Sciamano Scagliagrigia:', error);
        setDialogue(`Il fumo della capanna soffoca i sensi. (${error.message || 'errore sconosciuto'})`);
        const inventory = document.getElementById('player-inventory');
        const stock = document.getElementById('vendor-stock');
        if (inventory) inventory.innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'Errore caricamento inventario.')}</div>`;
        if (stock) stock.innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'Errore caricamento vendor.')}</div>`;
        const feedback = document.getElementById('quest-feedback');
        if (feedback) feedback.textContent = error.message || 'Errore caricamento missione.';
    }
});