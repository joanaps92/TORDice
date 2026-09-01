const isLocalFile = window.location.protocol === 'file:';

// Initialize socket with error handling
let socket;
if (isLocalFile) {
    socket = { on: () => {}, emit: () => {}, connected: false };
} else {
    try {
        socket = io();
    } catch (e) {
        console.error("Error al inicializar Socket.io:", e);
        socket = { on: () => {}, emit: () => {}, connected: false };
    }
}

// Mock persistence for local testing
const getLocalHistory = (room) => JSON.parse(localStorage.getItem(`rpg_history_${room}`) || '[]');
const saveLocalHistory = (room, roll) => {
    const history = getLocalHistory(room);
    history.push(roll);
    if (history.length > 50) history.shift();
    localStorage.setItem(`rpg_history_${room}`, JSON.stringify(history));
};

// State
let currentUser = "";
let currentRoom = "";
let currentStance = "Posición abierta";
let currentD12Count = 1;
let currentD6Count = 0;

// Persistence helpers for last session
const LAST_USER_KEY = 'rpg_last_username';
const LAST_ROOM_KEY = 'rpg_last_room';
const saveLastSession = (user, room) => {
    localStorage.setItem(LAST_USER_KEY, user);
    localStorage.setItem(LAST_ROOM_KEY, room);
};
const getLastSession = () => ({
    user: localStorage.getItem(LAST_USER_KEY) || '',
    room: localStorage.getItem(LAST_ROOM_KEY) || ''
});

// Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const joinBtn = document.getElementById('join-btn');
const usernameInput = document.getElementById('username');
const roomnameInput = document.getElementById('roomname');
const userDisplay = document.getElementById('user-display');
const roomDisplay = document.getElementById('room-display');

// Dice Control Elements
const d12ValBadge = document.getElementById('d12-val-badge');
const d12Buttons = document.querySelectorAll('[data-d12]');
const d6ValBadge = document.getElementById('d6-val-badge');
const d6Chips = document.querySelectorAll('[data-d6]');
const d6DecBtn = document.getElementById('d6-dec-btn');
const d6IncBtn = document.getElementById('d6-inc-btn');
const d6VisualPreview = document.getElementById('d6-visual-preview');
const rollBtn = document.getElementById('roll-btn');
const rollBtnLabel = document.getElementById('roll-btn-label');

const historyList = document.getElementById('history-list');
const roomList = document.getElementById('room-list');
const roomListContainer = document.getElementById('room-list-container');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const leaveBtn = document.getElementById('leave-btn');
const activeUsersList = document.getElementById('active-users-list');
const userCountBadge = document.getElementById('user-count-badge');

const changeUsernameInput = document.getElementById('change-username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');
const stanceSelect = document.getElementById('stance-select');

// Battlefield Map Elements
const battlefieldToggleHeader = document.getElementById('battlefield-toggle-header');
const toggleBattlefieldBtn = document.getElementById('toggle-battlefield-btn');
const battlefieldCollapseBody = document.getElementById('battlefield-collapse-body');
const playersVanguardia = document.getElementById('players-vanguardia');
const playersAbierta = document.getElementById('players-abierta');
const playersDefensiva = document.getElementById('players-defensiva');
const playersRetaguardia = document.getElementById('players-retaguardia');
const battleZones = document.querySelectorAll('.battle-stance-zone');

// ==========================================
// ADVENTURER SHEET
// ==========================================
const adventurerScreen = document.getElementById('adventurer-screen');
const openAdventurerBtn = document.getElementById('open-adventurer-btn');
const openAdventurerButtons = document.querySelectorAll('.open-adventurer-btn');
const closeAdventurerBtn = document.getElementById('close-adventurer-btn');
const adventurerForm = document.getElementById('adventurer-form');
const attributePanels = document.getElementById('attribute-panels');
const combatSkills = document.getElementById('combat-skills');
const warGearList = document.getElementById('war-gear-list');
const addWarGearBtn = document.getElementById('add-war-gear-btn');
const exportAdventurerBtn = document.getElementById('export-adventurer-btn');
const resetAdventurerBtn = document.getElementById('reset-adventurer-btn');
const adventurerImport = document.getElementById('adventurer-import');
const saveAdventurerBtn = document.getElementById('save-adventurer-btn');
const sheetLibrarySelect = document.getElementById('sheet-library-select');
const adventurerSelect = document.getElementById('adventurer-select');
const ADVENTURER_KEY = 'tor_adventurer_draft';

const newAdventurer = () => ({
    _id: null,
    informacionGeneral: { nombre: '', culturaHeroica: '', ocupacion: '', nivelDeVida: '', edad: 0, bendicionCultural: '', heredero: '' },
    atributos: { fuerza: { valor: 0, tn: 20 }, corazon: { valor: 0, tn: 20 }, mente: { valor: 0, tn: 20 } },
    estadisticas: { aguante: { maximo: 0, actual: 0 }, esperanza: { maxima: 0, actual: 0 }, parada: 0, cargaTotal: 0, fatiga: 0 },
    estados: { cansado: false, desanimado: false, herido: false, diasDeHerida: 0 },
    sombra: { puntos: 0, cicatrices: 0, senda: '', defectos: [] },
    desarrollo: { valor: 1, sabiduria: 1, puntosHabilidad: 0, puntosAventura: 0, virtudes: [], recompensas: [] },
    habilidades: { fuerza: { impresionar: { rango: 0, favorecida: false }, atletismo: { rango: 0, favorecida: false }, alerta: { rango: 0, favorecida: false }, cazar: { rango: 0, favorecida: false }, cantar: { rango: 0, favorecida: false }, oficio: { rango: 0, favorecida: false } }, corazon: { alentar: { rango: 0, favorecida: false }, viajar: { rango: 0, favorecida: false }, perspicacia: { rango: 0, favorecida: false }, curar: { rango: 0, favorecida: false }, cortesia: { rango: 0, favorecida: false }, guerrear: { rango: 0, favorecida: false } }, mente: { persuadir: { rango: 0, favorecida: false }, sigilo: { rango: 0, favorecida: false }, inspeccionar: { rango: 0, favorecida: false }, explorar: { rango: 0, favorecida: false }, acertijos: { rango: 0, favorecida: false }, saber: { rango: 0, favorecida: false } } },
    combate: { competencias: { hachas: 0, arcos: 0, lanzas: 0, espadas: 0 }, equipoGuerra: [{ item: { tipoItem: '', nombre: '', subtipoItem: '', dano: 0, herida: 0, carga: 0, competencia: '', notas: '' } }] },
    rasgosDistintivos: [], inventario: { objetosUtiles: [], equipoViaje: '', riqueza: 0 }, compania: { vinculoComunidad: '', puntuacionComunidad: 0, refugio: '' }
});
let adventurer = newAdventurer();
let adventurerId = null;
let savedAdventurers = [];
let assignedAdventurerId = localStorage.getItem('tor_assigned_adventurer') || '';
const getAt = (obj, path) => path.split('.').reduce((value, key) => value?.[key], obj);
const setAt = (obj, path, value) => { const parts = path.split('.'); const key = parts.pop(); const target = parts.reduce((value, part) => value[part], obj); target[key] = value; };
const newWarGearItem = () => ({ item: { tipoItem: '', nombre: '', subtipoItem: '', dano: 0, herida: 0, carga: 0, competencia: '', notas: '' } });
const displayName = key => ({ fuerza: 'Fuerza', corazon: 'Corazón', mente: 'Mente', impresionar: 'Impresionar', atletismo: 'Atletismo', alerta: 'Alerta', cazar: 'Cazar', cantar: 'Cantar', oficio: 'Oficio', alentar: 'Alentar', viajar: 'Viajar', perspicacia: 'Perspicacia', curar: 'Curar', cortesia: 'Cortesía', guerrear: 'Guerrear', persuadir: 'Persuadir', sigilo: 'Sigilo', inspeccionar: 'Inspeccionar', explorar: 'Explorar', acertijos: 'Acertijos', saber: 'Saber', hachas: 'Hachas', arcos: 'Arcos', lanzas: 'Lanzas', espadas: 'Espadas' }[key] || key);

function renderSheetDynamicFields() {
    attributePanels.innerHTML = Object.entries(adventurer.habilidades).map(([attribute, skills]) => `<section class="attribute-panel"><h2 class="attribute-title">${displayName(attribute)}</h2><div class="attribute-stats"><label class="attribute-inline">Valor<input type="number" min="0" data-path="atributos.${attribute}.valor"></label><label class="attribute-inline" title="Número objetivo">NO<input type="number" min="0" data-path="atributos.${attribute}.tn" aria-label="Número objetivo"></label></div>${Object.keys(skills).map(skill => `<div class="skill-row"><span>${displayName(skill)}</span><input type="number" min="0" data-path="habilidades.${attribute}.${skill}.rango" aria-label="Rango de ${displayName(skill)}"><label title="Habilidad favorecida"><input type="checkbox" data-path="habilidades.${attribute}.${skill}.favorecida"> Fav.</label></div>`).join('')}</section>`).join('');
    combatSkills.innerHTML = Object.keys(adventurer.combate.competencias).map(skill => `<label>${displayName(skill)}<input type="number" min="0" data-path="combate.competencias.${skill}"></label>`).join('');
    if (!adventurer.combate.equipoGuerra.length) adventurer.combate.equipoGuerra.push(newWarGearItem());
    warGearList.innerHTML = adventurer.combate.equipoGuerra.map((_, index) => `<div class="war-gear-entry"><div class="d-flex justify-content-between align-items-center mb-2"><span class="war-gear-title">Equipo ${index + 1}</span><button class="btn btn-link text-danger p-0 remove-war-gear-btn" type="button" data-gear-index="${index}" title="Eliminar equipo"><i class="fa-solid fa-trash-can"></i></button></div><div class="equipment-grid"><label>Nombre<input data-path="combate.equipoGuerra.${index}.item.nombre"></label><label>Tipo<input data-path="combate.equipoGuerra.${index}.item.tipoItem"></label><label>Subtipo<input data-path="combate.equipoGuerra.${index}.item.subtipoItem"></label><label>Competencia<input data-path="combate.equipoGuerra.${index}.item.competencia"></label><label>Daño<input type="number" min="0" data-path="combate.equipoGuerra.${index}.item.dano"></label><label>Herida<input type="number" min="0" data-path="combate.equipoGuerra.${index}.item.herida"></label><label>Carga<input type="number" min="0" data-path="combate.equipoGuerra.${index}.item.carga"></label><label class="wide">Notas<input data-path="combate.equipoGuerra.${index}.item.notas"></label></div></div>`).join('');
}
function fillAdventurerForm() { renderSheetDynamicFields(); adventurerForm.querySelectorAll('[data-path]').forEach(input => { const value = getAt(adventurer, input.dataset.path); input.checked = input.type === 'checkbox' && Boolean(value); input.value = input.dataset.list ? (value || []).join(', ') : (input.type === 'checkbox' ? '' : (value ?? '')); }); }
function saveAdventurer() { localStorage.setItem(ADVENTURER_KEY, JSON.stringify(adventurer)); const status = document.getElementById('adventurer-save-status'); if (status) status.textContent = 'Borrador guardado en este dispositivo. Pulsa Guardar para sincronizarlo.'; }
function loadAdventurer() { try { const saved = JSON.parse(localStorage.getItem(ADVENTURER_KEY)); if (saved) adventurer = saved; } catch (_) { adventurer = newAdventurer(); } fillAdventurerForm(); }
function renderAdventurerSelects() {
    const options = savedAdventurers.map(item => `<option value="${item._id}">${item.nombre}</option>`).join('');
    if (sheetLibrarySelect) sheetLibrarySelect.innerHTML = `<option value="">Hojas guardadas…</option>${options}`;
    if (adventurerSelect) { adventurerSelect.innerHTML = `<option value="">Sin personaje asignado</option>${options}`; adventurerSelect.value = assignedAdventurerId; }
}
async function fetchAdventurers() {
    if (isLocalFile) return renderAdventurerSelects();
    try { const response = await fetch('/api/adventurers'); if (!response.ok) throw new Error(); savedAdventurers = await response.json(); renderAdventurerSelects(); }
    catch (_) { const status = document.getElementById('adventurer-save-status'); if (status) status.textContent = 'No se pudo conectar con la base de datos.'; }
}
async function saveAdventurerToDatabase() {
    if (isLocalFile) { alert('Abre la aplicación desde el servidor para guardar fichas en la base de datos.'); return; }
    if (!adventurer.informacionGeneral.nombre.trim()) {
        const nameInput = adventurerForm.querySelector('[data-path="informacionGeneral.nombre"]');
        nameInput.focus();
        document.getElementById('adventurer-save-status').textContent = 'Escribe el nombre del aventurero antes de guardar.';
        return;
    }
    const normalizedName = adventurer.informacionGeneral.nombre.trim().toLocaleLowerCase('es');
    const duplicate = savedAdventurers.find(item => item._id !== adventurerId && item.nombre.trim().toLocaleLowerCase('es') === normalizedName);
    if (duplicate) {
        document.getElementById('adventurer-save-status').textContent = 'Ya existe una hoja con ese nombre. Cámbialo antes de guardar.';
        return;
    }
    const status = document.getElementById('adventurer-save-status'); if (status) status.textContent = 'Guardando ficha…';
    try {
        const response = await fetch(adventurerId ? `/api/adventurers/${adventurerId}` : '/api/adventurers', { method: adventurerId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(adventurer) });
        if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.error || 'No se pudo guardar la ficha en la base de datos.'); } const stored = await response.json(); adventurerId = stored._id; saveAdventurer(); if (status) status.textContent = 'Ficha guardada en la base de datos.'; await fetchAdventurers(); if (sheetLibrarySelect) sheetLibrarySelect.value = adventurerId;
    } catch (error) { if (status) status.textContent = error.message; }
}

adventurerForm.addEventListener('input', event => { const input = event.target; if (!input.dataset.path) return; let value = input.type === 'checkbox' ? input.checked : input.value; if (input.type === 'number') value = Number(value || 0); if (input.dataset.list) value = value.split(',').map(item => item.trim()).filter(Boolean); setAt(adventurer, input.dataset.path, value); saveAdventurer(); });
addWarGearBtn.addEventListener('click', () => { adventurer.combate.equipoGuerra.push(newWarGearItem()); fillAdventurerForm(); saveAdventurer(); });
warGearList.addEventListener('click', event => { const button = event.target.closest('.remove-war-gear-btn'); if (!button) return; adventurer.combate.equipoGuerra.splice(Number(button.dataset.gearIndex), 1); fillAdventurerForm(); saveAdventurer(); });
openAdventurerButtons.forEach(button => button.addEventListener('click', () => { loadAdventurer(); fetchAdventurers(); loginScreen.classList.add('d-none'); appScreen.classList.add('d-none'); adventurerScreen.classList.remove('d-none'); window.scrollTo(0, 0); }));
closeAdventurerBtn.addEventListener('click', () => { adventurerScreen.classList.add('d-none'); (currentUser ? appScreen : loginScreen).classList.remove('d-none'); });
exportAdventurerBtn.addEventListener('click', () => { const blob = new Blob([JSON.stringify(adventurer, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${adventurer.informacionGeneral.nombre || 'aventurero'}.json`; link.click(); URL.revokeObjectURL(link.href); });
resetAdventurerBtn.addEventListener('click', () => { if (confirm('¿Reiniciar todos los campos de la ficha?')) { adventurer = newAdventurer(); saveAdventurer(); fillAdventurerForm(); } });
adventurerImport.addEventListener('change', event => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { adventurer = JSON.parse(reader.result); adventurerId = null; saveAdventurer(); fillAdventurerForm(); } catch (_) { alert('El archivo no contiene un JSON de aventurero válido.'); } }; reader.readAsText(file); event.target.value = ''; });
saveAdventurerBtn.addEventListener('click', saveAdventurerToDatabase);
sheetLibrarySelect.addEventListener('change', event => { const record = savedAdventurers.find(item => item._id === event.target.value); if (!record) return; adventurer = record.ficha; adventurerId = record._id; saveAdventurer(); fillAdventurerForm(); });
adventurerSelect.addEventListener('change', event => { assignedAdventurerId = event.target.value; localStorage.setItem('tor_assigned_adventurer', assignedAdventurerId); const record = savedAdventurers.find(item => item._id === assignedAdventurerId); if (!isLocalFile && currentRoom) socket.emit('update-user', { username: currentUser, stance: currentStance, adventurerId: assignedAdventurerId, adventurerName: record?.nombre || '' }); else renderLocalActiveUsers(); });

// ==========================================
// DICE SELECTION LOGIC (D12: 1-2, D6: 0-6)
// ==========================================

function updateRollButtonLabel() {
    if (!rollBtnLabel) return;
    const d6Text = currentD6Count > 0 ? ` + ${currentD6Count} D6` : '';
    rollBtnLabel.textContent = `¡LANZAR DADOS! (${currentD12Count} D12${d6Text})`;
}

function setD12Count(val) {
    currentD12Count = Math.max(1, Math.min(2, parseInt(val) || 1));
    
    d12Buttons.forEach(btn => {
        const btnVal = parseInt(btn.getAttribute('data-d12'));
        btn.classList.toggle('active', btnVal === currentD12Count);
    });

    if (d12ValBadge) {
        d12ValBadge.textContent = `${currentD12Count} ${currentD12Count === 1 ? 'Dado' : 'Dados'}`;
    }

    updateRollButtonLabel();
}

function setD6Count(val) {
    currentD6Count = Math.max(0, Math.min(6, parseInt(val) || 0));

    d6Chips.forEach(chip => {
        const chipVal = parseInt(chip.getAttribute('data-d6'));
        chip.classList.toggle('active', chipVal === currentD6Count);
    });

    if (d6ValBadge) {
        d6ValBadge.textContent = `${currentD6Count} ${currentD6Count === 1 ? 'Dado' : 'Dados'}`;
    }

    if (d6DecBtn) d6DecBtn.disabled = (currentD6Count <= 0);
    if (d6IncBtn) d6IncBtn.disabled = (currentD6Count >= 6);

    // Update Visual Dice Icons Preview
    if (d6VisualPreview) {
        d6VisualPreview.innerHTML = "";
        if (currentD6Count === 0) {
            d6VisualPreview.innerHTML = `<span class="text-muted small fst-italic">Sin dados D6</span>`;
        } else {
            for (let i = 1; i <= currentD6Count; i++) {
                const dice = document.createElement('span');
                dice.className = 'd6-mini-dice';
                dice.innerHTML = '<i class="fa-solid fa-dice-six"></i>';
                d6VisualPreview.appendChild(dice);
            }
        }
    }

    updateRollButtonLabel();
}

// Event Listeners for Dice Controls
d12Buttons.forEach(btn => {
    btn.addEventListener('click', () => {
        setD12Count(btn.getAttribute('data-d12'));
    });
});

d6Chips.forEach(chip => {
    chip.addEventListener('click', () => {
        setD6Count(chip.getAttribute('data-d6'));
    });
});

if (d6DecBtn) {
    d6DecBtn.addEventListener('click', () => {
        setD6Count(currentD6Count - 1);
    });
}

if (d6IncBtn) {
    d6IncBtn.addEventListener('click', () => {
        setD6Count(currentD6Count + 1);
    });
}

// Initialize Dice values
setD12Count(1);
setD6Count(0);

// ==========================================
// COLLAPSIBLE BATTLEFIELD MAP
// ==========================================

function toggleBattlefield(forceState) {
    if (!battlefieldCollapseBody) return;
    const isCurrentlyCollapsed = battlefieldCollapseBody.classList.contains('is-collapsed');
    const shouldCollapse = forceState !== undefined ? forceState : !isCurrentlyCollapsed;

    battlefieldCollapseBody.classList.toggle('is-collapsed', shouldCollapse);
    if (toggleBattlefieldBtn) {
        toggleBattlefieldBtn.classList.toggle('is-collapsed', shouldCollapse);
    }
    localStorage.setItem('rpg_battlefield_collapsed', shouldCollapse ? 'true' : 'false');
}

if (battlefieldToggleHeader) {
    battlefieldToggleHeader.addEventListener('click', () => toggleBattlefield());
}

if (toggleBattlefieldBtn) {
    toggleBattlefieldBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBattlefield();
    });
}

// Restore collapsed state from localStorage if previously collapsed
if (localStorage.getItem('rpg_battlefield_collapsed') === 'true') {
    toggleBattlefield(true);
}

// Helper to get stance badge info
function getStanceInfo(stance) {
    switch (stance) {
        case 'Posición de vanguardia':
            return {
                icon: 'fa-solid fa-khanda',
                short: 'Vanguardia',
                className: 'stance-badge-vanguardia'
            };
        case 'Posición defensiva':
            return {
                icon: 'fa-solid fa-shield',
                short: 'Defensiva',
                className: 'stance-badge-defensiva'
            };
        case 'Posición de retaguardia':
            return {
                icon: 'fa-solid fa-crosshairs',
                short: 'Retaguardia',
                className: 'stance-badge-retaguardia'
            };
        case 'Posición abierta':
        default:
            return {
                icon: 'fa-solid fa-shield-halved',
                short: 'Abierta',
                className: 'stance-badge-abierta'
            };
    }
}

// Interactive Battlefield Map Zones - Click to switch stance
battleZones.forEach(zone => {
    zone.addEventListener('click', () => {
        const targetStance = zone.getAttribute('data-stance');
        if (targetStance && targetStance !== currentStance) {
            currentStance = targetStance;
            if (stanceSelect) {
                stanceSelect.value = currentStance;
            }
            if (!isLocalFile) {
                socket.emit('update-user', { username: currentUser, stance: currentStance });
            } else {
                renderLocalActiveUsers();
            }
        }
    });
});

// Cambiar Nombre
function handleUpdateUsername() {
    const newName = changeUsernameInput.value.trim();
    if (!newName) {
        alert("Por favor, introduce un nombre válido.");
        return;
    }
    if (newName === currentUser) {
        return;
    }

    currentUser = newName;
    userDisplay.innerHTML = `<i class="fa-solid fa-user me-1"></i> ${currentUser}`;

    if (!isLocalFile) {
        socket.emit('update-user', { username: currentUser, stance: currentStance });
    } else {
        renderLocalActiveUsers();
    }
}

saveUsernameBtn.addEventListener('click', handleUpdateUsername);
changeUsernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleUpdateUsername();
    }
});

// Cambiar Postura / Posición
stanceSelect.addEventListener('change', (e) => {
    currentStance = e.target.value;
    if (!isLocalFile) {
        socket.emit('update-user', { username: currentUser, stance: currentStance });
    } else {
        renderLocalActiveUsers();
    }
});

// ==========================================
// LAST SESSION SUGGESTION
// ==========================================

const quickSuggestionContainer = document.getElementById('quick-suggestion-container');
const quickSuggestionText = document.getElementById('quick-suggestion-text');
const useSuggestionBtn = document.getElementById('use-suggestion-btn');

function initLastSessionSuggestion() {
    const { user, room } = getLastSession();
    if (!user && !room) return;

    if (quickSuggestionContainer && quickSuggestionText) {
        quickSuggestionText.textContent = `${user || '—'}  ·  ${room || '—'}`;
        quickSuggestionContainer.classList.remove('d-none');
    }
}

if (useSuggestionBtn) {
    useSuggestionBtn.addEventListener('click', () => {
        const { user, room } = getLastSession();
        if (user && usernameInput) usernameInput.value = user;
        if (room && roomnameInput) roomnameInput.value = room;
        usernameInput.focus();
        // Visual feedback
        useSuggestionBtn.innerHTML = '<i class="fa-solid fa-check me-1"></i> ¡Listo!';
        setTimeout(() => {
            useSuggestionBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate me-1"></i> Cargar';
        }, 1500);
    });
}

// Run on page load
initLastSessionSuggestion();
if (!isLocalFile) fetchAdventurers();

// Join Room
joinBtn.addEventListener('click', () => {
    const user = usernameInput.value.trim();
    const room = roomnameInput.value.trim();

    if (!user || !room) {
        alert("Por favor, introduce tu nombre y el nombre de la sala.");
        return;
    }

    currentUser = user;
    currentRoom = room;
    currentStance = stanceSelect.value || "Posición abierta";

    // Save last session for next time
    saveLastSession(currentUser, currentRoom);

    userDisplay.innerHTML = `<i class="fa-solid fa-user me-1"></i> ${currentUser}`;
    roomDisplay.innerHTML = `<i class="fa-solid fa-fort-awesome me-1"></i> Sala: ${currentRoom}`;
    changeUsernameInput.value = currentUser;

    if (isLocalFile) {
        // Mock join-room logic
        const history = getLocalHistory(currentRoom);
        historyList.innerHTML = "";
        if (history.length === 0) renderEmptyMessage();
        else history.forEach(roll => addRollToUI(roll, false));
        scrollToBottom();
        renderLocalActiveUsers();
    } else {
        socket.emit('join-room', {
            roomName: currentRoom,
            username: currentUser,
            stance: currentStance,
            adventurerId: assignedAdventurerId,
            adventurerName: savedAdventurers.find(item => item._id === assignedAdventurerId)?.nombre || ''
        });
    }

    loginScreen.classList.add('d-none');
    appScreen.classList.remove('d-none');
});

// Roll Dice
rollBtn.addEventListener('click', () => {
    const d12Count = currentD12Count;
    const d6Count = currentD6Count;

    const rollData = {
        room: currentRoom,
        user: currentUser,
        stance: currentStance,
        d12Count,
        d6Count
    };

    if (isLocalFile) {
        // Mock roll logic
        const d12Results = Array.from({ length: d12Count }, () => Math.floor(Math.random() * 12) + 1);
        const d6Results = Array.from({ length: d6Count }, () => Math.floor(Math.random() * 6) + 1);
        const total = [...d12Results, ...d6Results].reduce((a, b) => a + b, 0);
        const rollEntry = {
            id: Date.now(),
            user: currentUser,
            stance: currentStance,
            d12Results,
            d6Results,
            total,
            timestamp: new Date().toLocaleTimeString()
        };
        saveLocalHistory(currentRoom, rollEntry);
        // Remove empty message if present
        const emptyMsg = document.querySelector('.empty-msg');
        if (emptyMsg) emptyMsg.remove();
        addRollToUI(rollEntry, true);
        scrollToBottom();
    } else {
        socket.emit('roll-dice', rollData);
    }
});

// Clear History
clearHistoryBtn.addEventListener('click', () => {
    if (confirm("¿Seguro que quieres borrar todo el historial de esta sala?")) {
        if (isLocalFile) {
            localStorage.setItem(`rpg_history_${currentRoom}`, JSON.stringify([]));
            historyList.innerHTML = "";
            renderEmptyMessage();
        } else {
            socket.emit('clear-history', currentRoom);
        }
    }
});

// Leave Room
leaveBtn.addEventListener('click', () => {
    if (confirm("¿Seguro que quieres salir de la sala?")) {
        if (!isLocalFile) {
            window.location.reload();
        } else {
            loginScreen.classList.remove('d-none');
            appScreen.classList.add('d-none');
            currentUser = "";
            currentRoom = "";
        }
    }
});

// Helper for local file active users
function renderLocalActiveUsers() {
    renderUsersList([{ id: 'local', username: currentUser, stance: currentStance, adventurerId: assignedAdventurerId, adventurerName: savedAdventurers.find(item => item._id === assignedAdventurerId)?.nombre || '' }]);
}

// Render active users list AND battlefield map zones
function renderUsersList(users) {
    if (userCountBadge) {
        userCountBadge.textContent = users.length;
    }

    // 1. Render left panel list
    if (activeUsersList) {
        activeUsersList.innerHTML = "";
        users.forEach(userObj => {
            const username = typeof userObj === 'object' ? userObj.username : userObj;
            const stance = (typeof userObj === 'object' && userObj.stance) ? userObj.stance : 'Posición abierta';
            const adventurerName = (typeof userObj === 'object' && userObj.adventurerName) ? userObj.adventurerName : '';
            const isMe = (userObj.id && socket && userObj.id === socket.id) || username === currentUser;

            const info = getStanceInfo(stance);

            const card = document.createElement('div');
            card.className = `adventurer-card d-flex align-items-center justify-content-between p-2 rounded ${isMe ? 'is-current-user' : ''}`;
            
            card.innerHTML = `
                <div class="d-flex align-items-center gap-2 text-truncate">
                    <i class="fa-solid ${isMe ? 'fa-user-shield text-gold' : 'fa-user text-muted'}"></i>
                    <span class="fw-bold text-dark text-truncate">${username}</span>
                    ${isMe ? '<span class="badge bg-purple user-you-badge">Tú</span>' : ''}
                    ${adventurerName ? `<span class="small text-muted text-truncate" title="${adventurerName}"><i class="fa-solid fa-scroll me-1"></i>${adventurerName}</span>` : ''}
                </div>
                <span class="badge stance-badge ${info.className}" title="${stance}">
                    <i class="${info.icon} me-1"></i> ${info.short}
                </span>
            `;

            activeUsersList.appendChild(card);
        });
    }

    // 2. Render Battlefield Map Stance Zones
    if (playersVanguardia && playersAbierta && playersDefensiva && playersRetaguardia) {
        playersVanguardia.innerHTML = "";
        playersAbierta.innerHTML = "";
        playersDefensiva.innerHTML = "";
        playersRetaguardia.innerHTML = "";

        const zoneCounts = {
            'Posición de vanguardia': 0,
            'Posición abierta': 0,
            'Posición defensiva': 0,
            'Posición de retaguardia': 0
        };

        // Highlight zones based on current user position
        battleZones.forEach(zone => {
            const zoneStance = zone.getAttribute('data-stance');
            if (zoneStance === currentStance) {
                zone.classList.add('is-my-zone');
            } else {
                zone.classList.remove('is-my-zone');
            }
        });

        users.forEach(userObj => {
            const username = typeof userObj === 'object' ? userObj.username : userObj;
            const stance = (typeof userObj === 'object' && userObj.stance) ? userObj.stance : 'Posición abierta';
            const isMe = (userObj.id && socket && userObj.id === socket.id) || username === currentUser;

            const chip = document.createElement('div');
            chip.className = `battle-player-chip ${isMe ? 'is-you' : ''}`;
            chip.innerHTML = `
                <i class="fa-solid ${isMe ? 'fa-user-shield text-gold-light' : 'fa-user text-muted'}"></i>
                <span>${username}</span>
                ${isMe ? '<span class="badge bg-gold text-dark ms-1" style="font-size: 0.6rem; padding: 2px 5px;">Tú</span>' : ''}
            `;

            if (stance === 'Posición de vanguardia') {
                playersVanguardia.appendChild(chip);
                zoneCounts['Posición de vanguardia']++;
            } else if (stance === 'Posición defensiva') {
                playersDefensiva.appendChild(chip);
                zoneCounts['Posición defensiva']++;
            } else if (stance === 'Posición de retaguardia') {
                playersRetaguardia.appendChild(chip);
                zoneCounts['Posición de retaguardia']++;
            } else {
                playersAbierta.appendChild(chip);
                zoneCounts['Posición abierta']++;
            }
        });

        // Add empty placeholder if no one in zone
        if (zoneCounts['Posición de vanguardia'] === 0) {
            playersVanguardia.innerHTML = '<span class="empty-zone-placeholder"><i class="fa-regular fa-circle-dot me-1"></i>Sin aventureros en vanguardia</span>';
        }
        if (zoneCounts['Posición abierta'] === 0) {
            playersAbierta.innerHTML = '<span class="empty-zone-placeholder"><i class="fa-regular fa-circle-dot me-1"></i>Sin aventureros en posición abierta</span>';
        }
        if (zoneCounts['Posición defensiva'] === 0) {
            playersDefensiva.innerHTML = '<span class="empty-zone-placeholder"><i class="fa-regular fa-circle-dot me-1"></i>Sin aventureros en posición defensiva</span>';
        }
        if (zoneCounts['Posición de retaguardia'] === 0) {
            playersRetaguardia.innerHTML = '<span class="empty-zone-placeholder"><i class="fa-regular fa-circle-dot me-1"></i>Sin aventureros en retaguardia</span>';
        }
    }
}


// Socket Events
socket.on('load-history', (history) => {
    historyList.innerHTML = "";
    if (history.length === 0) {
        renderEmptyMessage();
    } else {
        history.forEach(roll => addRollToUI(roll, false));
        scrollToBottom();
    }
});

socket.on('new-roll', (roll) => {
    const emptyMsg = document.querySelector('.empty-msg');
    if (emptyMsg) emptyMsg.remove();

    addRollToUI(roll, true);
    scrollToBottom();
});

socket.on('connect', () => {
    console.log("Conectado al servidor de dados");
});

socket.on('connect_error', (err) => {
    console.error("Error de conexión:", err.message);
});

socket.on('disconnect', () => {
    console.warn("Desconectado del servidor");
});

socket.on('update-room-users', (users) => {
    renderUsersList(users);
});

socket.on('room-deleted', () => {
    alert("Esta sala ha sido eliminada por un administrador.");
    window.location.reload();
});

socket.on('update-rooms', (rooms) => {
    if (rooms.length === 0) {
        roomListContainer.classList.add('d-none');
        return;
    }

    roomListContainer.classList.remove('d-none');
    roomList.innerHTML = "";
    rooms.forEach(room => {
        const item = document.createElement('div');
        item.className = "list-group-item list-group-item-action room-item d-flex justify-content-between align-items-center py-2 px-3";
        
        const nameSpan = document.createElement('span');
        nameSpan.className = "flex-grow-1 cursor-pointer py-2";
        nameSpan.innerHTML = `<i class="fa-solid fa-door-open me-2 text-gold"></i> ${room}`;
        nameSpan.onclick = () => {
            roomnameInput.value = room;
            joinBtn.click();
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = "btn btn-link text-danger p-2 opacity-50 hover-opacity-100";
        deleteBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i>`;
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`¿Eliminar la sala "${room}" y todo su historial?`)) {
                if (isLocalFile) {
                    localStorage.removeItem(`rpg_history_${room}`);
                    item.remove();
                    if (roomList.children.length === 0) roomListContainer.classList.add('d-none');
                } else {
                    socket.emit('delete-room', room);
                }
            }
        };

        item.appendChild(nameSpan);
        item.appendChild(deleteBtn);
        roomList.appendChild(item);
    });
});

function addRollToUI(roll, isNew) {
    const card = document.createElement('div');
    card.className = `roll-card p-3 ${isNew ? 'animate-slide-in' : ''}`;

    const d12Results = roll.d12Results || [];
    const d6Results = roll.d6Results || [];
    
    const d6Total = d6Results.reduce((a, b) => a + b, 0);
    const getD12SortValue = (v) => v === 11 ? -1 : (v === 12 ? 13 : v);
    
    let maxD12 = null;
    let minD12 = null;
    
    if (d12Results.length > 0) {
        maxD12 = d12Results.reduce((a, b) => getD12SortValue(a) > getD12SortValue(b) ? a : b);
        minD12 = d12Results.reduce((a, b) => getD12SortValue(a) < getD12SortValue(b) ? a : b);
    }

    const renderD12 = (val) => {
        if (val === 11) return `<img src="eye_of_sauron.png" class="dice-icon" title="Ojo de Sauron (Mínimo)">`;
        if (val === 12) return `<img src="gandalf_rune.png" class="dice-icon" title="Runa de Gandalf (Máximo)">`;
        return `<span class="dice-badge">${val}</span>`;
    };

    const d12Str = d12Results.length > 0 
        ? `<div class="mb-2"><span class="text-muted small fw-bold">D12:</span> ${d12Results.map(r => `<span class="me-1 d-inline-block">${renderD12(r)}</span>`).join('')}</div>` 
        : '';
        
    const d6Str = d6Results.length > 0 
        ? `<div class="mb-2"><span class="text-muted small fw-bold">D6:</span> ${d6Results.map(r => `<span class="dice-badge me-1">${r}</span>`).join('')}</div>` 
        : '';

    const stancePill = roll.stance ? (() => {
        const info = getStanceInfo(roll.stance);
        return `<span class="badge stance-badge ${info.className} ms-2" style="font-size: 0.7rem; font-weight: normal;"><i class="${info.icon} me-1"></i>${info.short}</span>`;
    })() : '';

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
                <div class="fw-bold text-dark mb-1 d-flex align-items-center flex-wrap">
                    <span>${roll.user}</span>
                    ${stancePill}
                    <span class="text-muted fw-normal ms-2" style="font-size: 0.75rem;">${roll.timestamp}</span>
                </div>
                ${d12Str}
                ${d6Str}
            </div>
            <div class="total-badge-container">
                ${d12Results.length === 1 ? `
                    <div class="total-badge">
                        <span class="total-val">${renderD12(d12Results[0])}</span>
                        <span class="total-label">D12</span>
                    </div>
                ` : ''}
                ${d12Results.length > 1 ? `
                    <div class="total-badge border-success">
                        <span class="total-val text-success">${renderD12(maxD12)}</span>
                        <span class="total-label">MAX D12</span>
                    </div>
                    <div class="total-badge border-danger">
                        <span class="total-val text-danger">${renderD12(minD12)}</span>
                        <span class="total-label">MIN D12</span>
                    </div>
                ` : ''}
                ${d6Results.length > 0 ? `
                    <div class="total-badge">
                        <span class="total-val">${d6Total}</span>
                        <span class="total-label">TOTAL D6</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    historyList.appendChild(card);
}

function renderEmptyMessage() {
    historyList.innerHTML = `
        <div class="text-center text-muted mt-5 py-5 empty-msg">
            <i class="fa-solid fa-ghost fa-3x mb-3 d-block"></i>
            <p>No hay tiradas aún... ¡Sé el primero!</p>
        </div>
    `;
}

function scrollToBottom() {
    historyList.scrollTop = historyList.scrollHeight;
}

