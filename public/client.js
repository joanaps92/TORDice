const isLocalFile = window.location.protocol === 'file:';

// Bootstrap-based feedback used throughout the app instead of browser-native dialogs.
function showBootstrapModal(id) {
    const element = document.getElementById(id);
    if (!element || !window.bootstrap) return null;
    return bootstrap.Modal.getOrCreateInstance(element);
}

window.appAlert = function(message, title = 'Aviso') {
    const modal = showBootstrapModal('appFeedbackModal');
    if (!modal) return Promise.resolve();
    document.getElementById('app-feedback-title').textContent = title;
    document.getElementById('app-feedback-message').textContent = message;
    return new Promise(resolve => {
        const element = document.getElementById('appFeedbackModal');
        element.addEventListener('hidden.bs.modal', resolve, { once: true });
        modal.show();
    });
};

window.appConfirm = function(message, title = 'Confirmar') {
    const modal = showBootstrapModal('appConfirmModal');
    if (!modal) return Promise.resolve(false);
    const element = document.getElementById('appConfirmModal');
    const finish = value => {
        element.dataset.confirmResult = value ? 'true' : 'false';
        modal.hide();
    };
    document.getElementById('app-confirm-title').textContent = title;
    document.getElementById('app-confirm-message').textContent = message;
    document.getElementById('app-confirm-ok').onclick = () => finish(true);
    document.getElementById('app-confirm-cancel').onclick = () => finish(false);
    element.querySelector('.btn-close').onclick = () => finish(false);
    return new Promise(resolve => {
        element.addEventListener('hidden.bs.modal', () => resolve(element.dataset.confirmResult === 'true'), { once: true });
        modal.show();
    });
};

// Initialize socket with error handling
let socket = { on: () => {}, emit: () => {}, connected: false };

window.initSocket = function(token) {
    if (isLocalFile) return;
    try {
        socket = io({ auth: { token } });
        setupSocketListeners();
    } catch (e) {
        console.error("Error al inicializar Socket.io:", e);
    }
};

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
let currentRollMode = 'manual';
let adventureCatalog = [];
let adventureCharacters = [];
let adventureSessions = [];
let selectedAdventureId = '';
let currentAdventureSession = null;

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
const roomSelectionScreen = document.getElementById('room-selection-screen');
const appScreen = document.getElementById('app-screen');
const joinBtn = document.getElementById('join-btn');
const roomnameInput = document.getElementById('roomname');
const userDisplay = document.getElementById('user-display');
const roomDisplay = document.getElementById('room-display');
const adventureScreen = document.getElementById('adventure-screen');
const openAdventureModeBtn = document.getElementById('open-adventure-mode-btn');
const adventureBackBtn = document.getElementById('adventure-back-btn');
const adventureRefreshBtn = document.getElementById('adventure-refresh-btn');
const adventureList = document.getElementById('adventure-list');
const adventureCatalogCount = document.getElementById('adventure-catalog-count');
const adventureCharacterSelect = document.getElementById('adventure-character-select');
const adventureCharacterNote = document.getElementById('adventure-character-note');
const adventureSessionList = document.getElementById('adventure-session-list');
const adventureSessionPanel = document.getElementById('adventure-session-panel');
const adventureSessionStatus = document.getElementById('adventure-session-status');
const adventureSessionTitle = document.getElementById('adventure-session-title');
const adventureSessionCharacter = document.getElementById('adventure-session-character');
const adventureStateBadges = document.getElementById('adventure-state-badges');
const adventureSceneTitle = document.getElementById('adventure-scene-title');
const adventureSceneText = document.getElementById('adventure-scene-text');
const adventurePendingRoll = document.getElementById('adventure-pending-roll');
const adventureRollLabel = document.getElementById('adventure-roll-label');
const adventureRollSkill = document.getElementById('adventure-roll-skill');
const adventureRollBtn = document.getElementById('adventure-roll-btn');
const adventureRollResult = document.getElementById('adventure-roll-result');
const adventureChoiceSection = document.getElementById('adventure-choice-section');
const adventureChoices = document.getElementById('adventure-choices');
const adventureCompletedBox = document.getElementById('adventure-completed-box');
const adventureRestartBtn = document.getElementById('adventure-restart-btn');
const adventureHistory = document.getElementById('adventure-history');

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
const rollModeButtons = document.querySelectorAll('[data-roll-mode]');
const guidedRollPanel = document.getElementById('guided-roll-panel');
const manualRollControls = document.getElementById('manual-roll-controls');
const guidedRollSheetNote = document.getElementById('guided-roll-sheet-note');
const guidedRollSource = document.getElementById('guided-roll-source');
const guidedRollModifier = document.getElementById('guided-roll-modifier');
const guidedRollTarget = document.getElementById('guided-roll-target');
const guidedRollTargetField = document.querySelector('.guided-roll-target-field');
const guidedRollHope = document.getElementById('guided-roll-hope');
const guidedRollWeary = document.getElementById('guided-roll-weary');
const guidedRollIllFavoured = document.getElementById('guided-roll-ill-favoured');
const guidedRollPreview = document.getElementById('guided-roll-preview');
const guidedRollConfirm = document.getElementById('guided-roll-confirm');

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
const stanceDetailsModalElement = document.getElementById('stanceDetailsModal');
const stanceDetailsModal = stanceDetailsModalElement && window.bootstrap
    ? bootstrap.Modal.getOrCreateInstance(stanceDetailsModalElement)
    : null;
const stanceDetailsTitle = document.getElementById('stance-details-title');
const stanceDetailsSubtitle = document.getElementById('stance-details-subtitle');
const stanceDetailsIntro = document.getElementById('stance-details-intro');
const stanceDetailsEffects = document.getElementById('stance-details-effects');
const stanceDetailsTask = document.getElementById('stance-details-task');
const stanceDetailsNote = document.getElementById('stance-details-note');
const stanceDetailsNoteText = document.getElementById('stance-details-note-text');

const stanceDetails = {
    vanguardia: {
        title: 'Posición de vanguardia',
        subtitle: 'Combate cuerpo a cuerpo',
        intro: 'Intentas aprovechar cualquier oportunidad de ataque, hasta el punto de exponerte a las represalias de los enemigos.',
        effects: [
            'Puedes sumar (1d) a las tiradas de ataque.',
            'Todos los ataques cuerpo a cuerpo dirigidos contra ti pueden sumar (1d).'
        ],
        task: 'Intimidar a un enemigo.'
    },
    abierta: {
        title: 'Posición abierta',
        subtitle: 'Combate cuerpo a cuerpo',
        intro: 'Luchas sin escatimar esfuerzos, pero prestando la debida atención a las acciones de los enemigos.',
        effects: ['Sin ventaja ni desventaja.'],
        task: 'Reagrupar a los camaradas.'
    },
    defensiva: {
        title: 'Posición defensiva',
        subtitle: 'Combate cuerpo a cuerpo',
        intro: 'Luchas de forma conservadora, tratando de protegerte a ti mismo o a los demás y sin ceder terreno.',
        effects: [
            'Todos los ataques cuerpo a cuerpo dirigidos contra ti deben restar (1d).',
            'Tus tiradas de ataque deben restar (1d) por cada oponente al que te enfrentes.'
        ],
        task: 'Proteger a un compañero.'
    },
    retaguardia: {
        title: 'Posición de retaguardia',
        subtitle: 'Combate a distancia',
        intro: 'Te alejas de la presión del combate cuerpo a cuerpo para atacar a tus enemigos desde lejos.',
        effects: [
            'Solo puedes atacar a tus adversarios con armas a distancia.',
            'Solo puedes ser objetivo de atacantes que utilicen armas similares.'
        ],
        task: 'Preparar disparo.',
        note: 'Solo puedes adoptar esta posición si el número total de enemigos no es superior al doble del número de aventureros. Además, por cada héroe en Retaguardia debe haber otros dos aventureros luchando cuerpo a cuerpo.'
    }
};

document.querySelectorAll('.zone-details-btn').forEach(button => {
    button.addEventListener('click', event => {
        event.stopPropagation();
        const details = stanceDetails[button.dataset.stanceDetails];
        if (!details || !stanceDetailsModal) return;
        stanceDetailsTitle.textContent = details.title;
        stanceDetailsSubtitle.textContent = details.subtitle;
        stanceDetailsIntro.textContent = details.intro;
        stanceDetailsEffects.innerHTML = details.effects.map(effect => `<li>${effect}</li>`).join('');
        stanceDetailsTask.textContent = details.task;
        stanceDetailsNote.classList.toggle('d-none', !details.note);
        stanceDetailsNoteText.textContent = details.note || '';
        stanceDetailsModal.show();
    });
});

// Culture and occupation catalogs imported from guia-creacion-personajes.
let cultures = [];
let culturesPromise = null;
let occupations = [];
let occupationsPromise = null;
let equipmentCatalog = { weapons: [], armor: [], shields: [], helmets: [] };
let equipmentPromise = null;
const cultureSkillGroups = {
    fuerza: ['impresionar', 'atletismo', 'alerta', 'cazar', 'cantar', 'oficio'],
    corazon: ['alentar', 'viajar', 'perspicacia', 'curar', 'cortesia', 'guerrear'],
    mente: ['persuadir', 'sigilo', 'inspeccionar', 'explorar', 'acertijos', 'saber']
};
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const getCultureById = id => cultures.find(culture => culture.id === id) || null;
const getCultureByName = name => cultures.find(culture => culture.name === name) || null;
const getCultureByReference = reference => getCultureById(reference) || getCultureByName(reference) || null;
const getOccupationByName = name => occupations.find(occupation => occupation.name === name) || null;

async function loadCultures() {
    if (culturesPromise) return culturesPromise;
    culturesPromise = fetch('/data/culturas.json')
        .then(response => { if (!response.ok) throw new Error('No se pudieron cargar las culturas'); return response.json(); })
        .then(data => { cultures = data; renderCultureSelectors(); return cultures; })
        .catch(error => { console.error(error); cultures = []; return cultures; });
    return culturesPromise;
}

async function loadOccupations() {
    if (occupationsPromise) return occupationsPromise;
    occupationsPromise = fetch('/data/ocupaciones.json')
        .then(response => { if (!response.ok) throw new Error('No se pudieron cargar las ocupaciones'); return response.json(); })
        .then(data => { occupations = data; return occupations; })
        .catch(error => { console.error(error); occupations = []; return occupations; });
    return occupationsPromise;
}

async function loadEquipmentCatalog() {
    if (equipmentPromise) return equipmentPromise;
    equipmentPromise = fetch('/data/equipo-guerra.json')
        .then(response => { if (!response.ok) throw new Error('No se pudo cargar el equipo de guerra'); return response.json(); })
        .then(data => { equipmentCatalog = data; return equipmentCatalog; })
        .catch(error => { console.error(error); return equipmentCatalog; });
    return equipmentPromise;
}

function renderCultureSelectors() {
    const selects = document.querySelectorAll('[data-culture-select]');
    selects.forEach(select => {
        const selectedCulture = getCultureByReference(adventurer?.creation?.cultureId) || getCultureByName(adventurer?.informacionGeneral?.culturaHeroica);
        const currentId = selectedCulture?.id || select.value || '';
        select.innerHTML = `<option value="">Selecciona una cultura…</option>${cultures.map(culture => `<option value="${culture.id}">${escapeHtml(culture.name)}</option>`).join('')}`;
        select.value = currentId;
        if (selectedCulture && adventurer?.informacionGeneral) {
            adventurer.informacionGeneral.culturaHeroica = selectedCulture.name;
            if (adventurer.creation) adventurer.creation.cultureId = selectedCulture.id;
        }
    });
}

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
const TRANCOS_FEATURE = 'Trancos';
const TRANCOS_FEATURE_DESCRIPTION = 'Mientras viajas, se considera Inspirado en las tiradas de habilidad.';
const calculatedEditablePaths = new Set([
    'atributos.fuerza.tn', 'atributos.corazon.tn', 'atributos.mente.tn',
    'estadisticas.aguante.maximo', 'estadisticas.aguante.actual',
    'estadisticas.esperanza.maxima', 'estadisticas.esperanza.actual',
    'estadisticas.parada', 'estadisticas.cargaTotal', 'sombra.senda'
]);
let calculatedOverrides = new Set();

const newAdventurer = () => ({
    _id: null,
    trancos: false,
    creation: { version: 1, cultureId: '', attributeRoll: null, favoredSkills: [], occupationFavoredSkills: [], combatProficiencies: {}, additionalRanks: { skills: {}, combat: {} }, advancementPointsSpent: 0, equipment: { weapons: {}, armor: '', shield: '', helmet: '' }, distinctiveFeatures: [], occupationDistinctiveFeature: '', completed: false },
    informacionGeneral: { nombre: '', culturaHeroica: '', ocupacion: '', nivelDeVida: '', edad: 0, bendicionCultural: '', heredero: '' },
    atributos: { fuerza: { valor: 0, tn: 20 }, corazon: { valor: 0, tn: 20 }, mente: { valor: 0, tn: 20 } },
    estadisticas: { aguante: { maximo: 0, actual: 0 }, esperanza: { maxima: 0, actual: 0 }, parada: 0, cargaTotal: 0, fatiga: 0 },
    estados: { cansado: false, desanimado: false, herido: false, diasDeHerida: 0, lesiones: '' },
    sombra: { puntos: 0, cicatrices: 0, senda: '', defectos: [] },
    desarrollo: { valor: 1, sabiduria: 1, puntosHabilidad: 0, puntosAventura: 0, virtudes: '', recompensas: '' },
    habilidades: { fuerza: { impresionar: { rango: 0, favorecida: false }, atletismo: { rango: 0, favorecida: false }, alerta: { rango: 0, favorecida: false }, cazar: { rango: 0, favorecida: false }, cantar: { rango: 0, favorecida: false }, oficio: { rango: 0, favorecida: false } }, corazon: { alentar: { rango: 0, favorecida: false }, viajar: { rango: 0, favorecida: false }, perspicacia: { rango: 0, favorecida: false }, curar: { rango: 0, favorecida: false }, cortesia: { rango: 0, favorecida: false }, guerrear: { rango: 0, favorecida: false } }, mente: { persuadir: { rango: 0, favorecida: false }, sigilo: { rango: 0, favorecida: false }, inspeccionar: { rango: 0, favorecida: false }, explorar: { rango: 0, favorecida: false }, acertijos: { rango: 0, favorecida: false }, saber: { rango: 0, favorecida: false } } },
    combate: { competencias: { hachas: 0, arcos: 0, lanzas: 0, espadas: 0 }, equipoGuerra: [{ item: { tipoItem: '', nombre: '', subtipoItem: '', dano: 0, herida: '', carga: 0, competencia: '', notas: '', modificadorParada: 0 } }] },
    rasgosDistintivos: [], reglasEspeciales: [], inventario: { objetosUtiles: [], equipoViaje: '', riqueza: 0 }, compania: { vinculoComunidad: '', puntuacionComunidad: 0, refugio: '' }
});
let adventurer = newAdventurer();
let adventurerId = null;
let savedAdventurers = [];
let assignedAdventurerId = localStorage.getItem('tor_assigned_adventurer') || '';
const getAt = (obj, path) => path.split('.').reduce((value, key) => value?.[key], obj);
const setAt = (obj, path, value) => { const parts = path.split('.'); const key = parts.pop(); const target = parts.reduce((value, part) => value[part], obj); target[key] = value; };
const newWarGearItem = () => ({ item: { tipoItem: '', nombre: '', subtipoItem: '', dano: 0, herida: '', carga: 0, competencia: '', notas: '', modificadorParada: 0 } });
const displayName = key => ({ fuerza: 'Fuerza', corazon: 'Corazón', mente: 'Mente', impresionar: 'Impresionar', atletismo: 'Atletismo', alerta: 'Alerta', cazar: 'Cazar', cantar: 'Cantar', oficio: 'Oficio', alentar: 'Alentar', viajar: 'Viajar', perspicacia: 'Perspicacia', curar: 'Curar', cortesia: 'Cortesía', guerrear: 'Guerrear', persuadir: 'Persuadir', sigilo: 'Sigilo', inspeccionar: 'Inspeccionar', explorar: 'Explorar', acertijos: 'Acertijos', saber: 'Saber', hachas: 'Hachas', arcos: 'Arcos', lanzas: 'Lanzas', espadas: 'Espadas' }[key] || key);

function renderSheetDynamicFields() {
    attributePanels.innerHTML = Object.entries(adventurer.habilidades).map(([attribute, skills]) => `<section class="attribute-panel"><h2 class="attribute-title">${displayName(attribute)}</h2><div class="attribute-stats"><label class="attribute-inline">Valor<input type="number" min="0" data-path="atributos.${attribute}.valor"></label><label class="attribute-inline" title="Valor base editable">NO<input type="number" min="0" data-path="atributos.${attribute}.tn" aria-label="Número objetivo"></label></div>${Object.keys(skills).map(skill => `<div class="skill-row"><span>${displayName(skill)}</span><input type="number" min="0" data-path="habilidades.${attribute}.${skill}.rango" aria-label="Rango de ${displayName(skill)}"><label title="Habilidad favorecida"><input type="checkbox" data-path="habilidades.${attribute}.${skill}.favorecida"> Fav.</label></div>`).join('')}</section>`).join('');
    combatSkills.innerHTML = Object.keys(adventurer.combate.competencias).map(skill => `<label>${displayName(skill)}<input type="number" min="0" data-path="combate.competencias.${skill}"></label>`).join('');
    if (!adventurer.combate.equipoGuerra.length) adventurer.combate.equipoGuerra.push(newWarGearItem());
    warGearList.innerHTML = adventurer.combate.equipoGuerra.map((_, index) => `<div class="war-gear-entry"><div class="d-flex justify-content-between align-items-center mb-2"><span class="war-gear-title">Equipo ${index + 1}</span><button class="btn btn-link text-danger p-0 remove-war-gear-btn" type="button" data-gear-index="${index}" title="Eliminar equipo"><i class="fa-solid fa-trash-can"></i></button></div><div class="equipment-grid"><label>Nombre<input data-path="combate.equipoGuerra.${index}.item.nombre"></label><label>Tipo<input data-path="combate.equipoGuerra.${index}.item.tipoItem"></label><label>Subtipo<input data-path="combate.equipoGuerra.${index}.item.subtipoItem"></label><label>Competencia<input data-path="combate.equipoGuerra.${index}.item.competencia"></label><label>Daño<input type="number" min="0" data-path="combate.equipoGuerra.${index}.item.dano"></label><label>Herida<input data-path="combate.equipoGuerra.${index}.item.herida"></label><label>Carga<input type="number" min="0" data-path="combate.equipoGuerra.${index}.item.carga"></label><label class="wide">Notas<input data-path="combate.equipoGuerra.${index}.item.notas"></label></div></div>`).join('');
}
function syncTrancosRuleNotice() {
    const notice = document.getElementById('trancos-rule-note');
    if (!notice) return;
    notice.classList.toggle('d-none', !adventurer.trancos);
}
function fillAdventurerForm() { updateCalculatedFields(); renderSheetDynamicFields(); renderCultureSelectors(); adventurerForm.querySelectorAll('[data-path]').forEach(input => { const value = input.dataset.cultureSelect ? (getCultureByReference(adventurer.creation?.cultureId) || getCultureByName(adventurer.informacionGeneral.culturaHeroica))?.id || '' : getAt(adventurer, input.dataset.path); input.checked = input.type === 'checkbox' && Boolean(value); input.value = input.dataset.list ? (Array.isArray(value) ? value.join(', ') : (value ?? '')) : (input.type === 'checkbox' ? '' : (value ?? '')); }); syncTrancosRuleNotice(); }
function saveAdventurer() { localStorage.setItem(ADVENTURER_KEY, JSON.stringify(adventurer)); const status = document.getElementById('adventurer-save-status'); if (status) status.textContent = 'Borrador guardado en este dispositivo. Pulsa Guardar para sincronizarlo.'; }
function normalizeAdventurerSheet(sheet, trancos = false) {
    const base = newAdventurer();
    const normalized = { ...base, ...sheet, trancos: Boolean(sheet?.trancos ?? trancos), creation: { ...base.creation, ...sheet?.creation }, atributos: { ...base.atributos, ...sheet?.atributos }, estadisticas: { ...base.estadisticas, ...sheet?.estadisticas }, estados: { ...base.estados, ...sheet?.estados }, sombra: { ...base.sombra, ...sheet?.sombra }, desarrollo: { ...base.desarrollo, ...sheet?.desarrollo }, inventario: { ...base.inventario, ...sheet?.inventario }, combate: { ...base.combate, ...sheet?.combate, competencias: { ...base.combate.competencias, ...sheet?.combate?.competencias } } };
    normalized.combate.equipoGuerra = (sheet?.combate?.equipoGuerra || base.combate.equipoGuerra).map(gear => ({ ...newWarGearItem(), ...gear, item: { ...newWarGearItem().item, ...gear?.item, competencia: normalizeCombatKey(gear?.item?.competencia) } }));
    ['virtudes', 'recompensas'].forEach(key => {
        if (Array.isArray(normalized.desarrollo[key])) normalized.desarrollo[key] = normalized.desarrollo[key].join('\n');
    });
    if (Array.isArray(normalized.inventario.equipoViaje)) normalized.inventario.equipoViaje = normalized.inventario.equipoViaje.join('\n');
    return normalized;
}
function shadowPathForOccupation() {
    const fallback = { 'Buscador de tesoros': 'Mal del dragón', 'Campeón': 'Maldición de la venganza', 'Capitán': 'Atracción del poder', 'Erudito': 'Atracción de los secretos', 'Guardián': 'Camino de la desesperación', 'Mensajero': 'Locura del trotamundos' };
    return getOccupationByName(adventurer.informacionGeneral.ocupacion)?.shadowPath || fallback[adventurer.informacionGeneral.ocupacion] || '';
}
function normalizeCombatKey(value) {
    const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const aliases = { hacha: 'hachas', hachas: 'hachas', arco: 'arcos', arcos: 'arcos', lanza: 'lanzas', lanzas: 'lanzas', espada: 'espadas', espadas: 'espadas', pelea: 'pelea' };
    return aliases[normalized] || normalized;
}
function currentShieldParryModifier() { return (adventurer.combate?.equipoGuerra || []).reduce((total, gear) => total + Number(gear.item?.modificadorParada || 0), 0); }
function updateCalculatedFields() {
    const attributeTarget = adventurer.trancos ? 18 : 20;
    Object.entries(adventurer.atributos || {}).forEach(([attributeName, attribute]) => {
        const path = `atributos.${attributeName}.tn`;
        if (!calculatedOverrides.has(path)) attribute.tn = attributeTarget - Number(attribute.valor || 0);
    });
    if (!calculatedOverrides.has('estadisticas.cargaTotal')) {
        adventurer.estadisticas.cargaTotal = (adventurer.combate?.equipoGuerra || []).reduce((total, gear) => total + Number(gear.item?.carga || 0), 0);
    }
    if (!calculatedOverrides.has('estadisticas.parada') && Number.isFinite(Number(adventurer.creation?.baseParry))) {
        adventurer.estadisticas.parada = Number(adventurer.creation.baseParry) + currentShieldParryModifier();
    }
    if (!calculatedOverrides.has('sombra.senda')) adventurer.sombra.senda = shadowPathForOccupation();
}
function syncCalculatedInputs() {
    ['atributos.fuerza.tn', 'atributos.corazon.tn', 'atributos.mente.tn', 'estadisticas.cargaTotal', 'estadisticas.parada'].forEach(path => {
        const input = adventurerForm.querySelector(`[data-path="${path}"]`);
        if (input) input.value = getAt(adventurer, path) ?? '';
    });
    const parryNote = document.getElementById('parry-modifier-note');
    if (parryNote) {
        const modifier = currentShieldParryModifier();
        parryNote.textContent = modifier ? `Incluye +${modifier} por escudo` : 'Sin modificador de escudo';
    }
}
function setShadowPathFromOccupation() {
    if (!calculatedOverrides.has('sombra.senda')) adventurer.sombra.senda = shadowPathForOccupation();
}

// Guided creation: only identity data, the three attributes and the creation mode.
const guidedModalElement = document.getElementById('guidedAdventurerModal');
const guidedModal = guidedModalElement ? bootstrap.Modal.getOrCreateInstance(guidedModalElement) : null;
const guidedForm = document.getElementById('guided-adventurer-form');
const guidedStepContent = document.getElementById('guided-step-content');
const guidedTitle = document.getElementById('guided-title');
const guidedSubtitle = document.getElementById('guided-subtitle');
const guidedProgressBar = document.getElementById('guided-progress-bar');
const guidedProgressLabel = document.getElementById('guided-progress-label');
const guidedBackBtn = document.getElementById('guided-back-btn');
const guidedNextBtn = document.getElementById('guided-next-btn');
const guidedExitBtn = document.getElementById('guided-exit-btn');
const guidedCloseBtn = document.getElementById('guided-close-btn');
let guidedStep = 0;
const guidedStepCount = 10;
const guidedOccupations = ['Buscador de tesoros', 'Campeón', 'Capitán', 'Erudito', 'Guardián', 'Mensajero'];
const guidedSelectOptions = options => options.map(option => `<option value="${option}">${option}</option>`).join('');
let guidedDraft = { trancos: false, cultureId: '', attributeRoll: null, favoredSkills: [], occupationFavoredSkills: [], combatProficiencies: {}, additionalRanks: { skills: {}, combat: {} }, equipment: { weapons: {}, armor: '', shield: '', helmet: '' }, distinctiveFeatures: [], occupationTraitOption: '' };

function guidedField(path, label, type = 'text', extra = '') {
    return `<label class="guided-field">${label}<input class="form-control tor-input" type="${type}" data-guided-path="${path}" ${extra}></label>`;
}

function cultureSummary(culture) {
    if (!culture) return '<div class="guided-intro"><i class="fa-solid fa-book-open"></i><p>Selecciona una cultura para consultar sus reglas y continuar.</p></div>';
    const skills = Object.entries(culture.skills).filter(([, value]) => value > 0).map(([skill, value]) => `${displayName(skill)} ${value}`).join(' · ');
    return `<div class="culture-summary"><div class="culture-summary-header"><div><strong>${escapeHtml(culture.name)}</strong><small>${escapeHtml(culture.sourceBook)}</small></div><span class="culture-living">${escapeHtml(culture.standardOfLiving)}</span></div><div class="culture-summary-grid"><div><b>Bendición · ${escapeHtml(culture.blessing.title)}</b><p>${escapeHtml(culture.blessing.text)}</p></div><div><b>Estadísticas derivadas</b><p>Aguante +${culture.derivedStats.enduranceBonus} · Esperanza +${culture.derivedStats.hopeBonus} · Parada +${culture.derivedStats.parryBonus}</p></div><div class="wide"><b>Habilidades iniciales</b><p>${escapeHtml(skills)}</p></div></div></div>`;
}

function renderAttributeChoices(culture) {
    if (!culture) return '<div class="guided-intro"><p>Selecciona primero una cultura.</p></div>';
    const base = adventurer.trancos ? 18 : 20;
    const rows = culture.attributesTable.map(row => `<label class="attribute-choice ${guidedDraft.attributeRoll === row.roll ? 'selected' : ''}"><input type="radio" name="guided-attribute-roll" value="${row.roll}" data-guided-attribute="${row.roll}" ${guidedDraft.attributeRoll === row.roll ? 'checked' : ''}><span><b>Fila ${row.roll}</b><span>Fuerza ${row.strength} <em>NO ${base - row.strength}</em></span><span>Corazón ${row.heart} <em>NO ${base - row.heart}</em></span><span>Mente ${row.mind} <em>NO ${base - row.mind}</em></span></span></label>`).join('');
    return `<div class="guided-intro"><i class="fa-solid fa-dice-d6"></i><p>Elige una fila de atributos o tira 1d6. Los valores objetivo se calculan con base ${base}.</p></div><div class="attribute-choice-grid">${rows}</div><button type="button" class="btn btn-outline-danger mt-3" id="guided-roll-attributes"><i class="fa-solid fa-dice me-1"></i> Tirar 1d6</button>`;
}

function renderFavoredChoices(culture) {
    const occupation = getOccupationByName(adventurer.informacionGeneral.ocupacion);
    if (!culture || !occupation) return '<div class="guided-intro"><p>Selecciona primero la cultura y la ocupación.</p></div>';
    const selected = guidedDraft.occupationFavoredSkills || [];
    const trait = occupation.distinctiveFeature;
    const traitControl = trait.options
        ? `<label class="guided-field occupation-trait-field">Tipo de enemigo para «${escapeHtml(trait.name)}»<select class="form-select tor-select" data-guided-occupation-trait aria-required="true"><option value="">Selecciona un enemigo…</option>${trait.options.map(option => `<option value="${escapeHtml(option)}" ${option === guidedDraft.occupationTraitOption ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>`
        : '';
    const cultureSkills = culture.favoredSkillsChoices.map(skill => displayName(skill)).join(' · ');
    const occupationSkills = occupation.favoredSkillsChoices.map(skill => `<label class="guided-choice-list-item"><input type="checkbox" data-guided-favored="${skill}" ${selected.includes(skill) ? 'checked' : ''}> <span>${displayName(skill)}</span></label>`).join('');
    return `<div class="guided-intro"><i class="fa-solid fa-star"></i><p>La cultura ya aporta como favorecidas: <strong>${escapeHtml(cultureSkills)}</strong>. Elige exactamente dos habilidades favorecidas de la ocupación.</p></div><div class="guided-choice-list">${occupationSkills}</div><p class="guided-selection-count">Seleccionadas de la ocupación: <strong>${selected.length}</strong> de 2</p><div class="occupation-trait-card"><strong>Rasgo distintivo adicional: ${escapeHtml(trait.name)}</strong><p>${escapeHtml(trait.description)}</p>${traitControl}</div>`;
}

function guidedFavoredSkills(culture) {
    return [...new Set([...(culture?.favoredSkillsChoices || []), ...(guidedDraft.occupationFavoredSkills || [])])];
}

function occupationTraitLabel(occupation, option) {
    if (!occupation?.distinctiveFeature) return '';
    return option ? `${occupation.distinctiveFeature.name}: ${option}` : occupation.distinctiveFeature.name;
}

const skillRankCosts = [1, 2, 3, 5];
const combatRankCosts = [2, 4, 6];
const guidedCombatSkills = ['hachas', 'arcos', 'lanzas', 'espadas'];

function guidedCombatBaseRanks(culture, selections = guidedDraft.combatProficiencies) {
    const ranks = Object.fromEntries(guidedCombatSkills.map(skill => [skill, 0]));
    (culture?.combatProficiencies || []).forEach(choice => {
        const skill = selections?.[choice.id];
        if (skill in ranks) ranks[skill] += choice.rank;
    });
    return ranks;
}

function rankCost(rank, type) {
    const costs = type === 'combat' ? combatRankCosts : skillRankCosts;
    return costs[rank - 1] || Infinity;
}

function additionalCost(startingRank, purchased, type) {
    let total = 0;
    for (let index = 1; index <= purchased; index += 1) total += rankCost(startingRank + index, type);
    return total;
}

function calculateAdvancementPoints(culture, additionalRanks = guidedDraft.additionalRanks, selections = guidedDraft.combatProficiencies) {
    const skillPoints = Object.entries(additionalRanks?.skills || {}).reduce((total, [skill, purchased]) => total + additionalCost(culture?.skills?.[skill] || 0, Number(purchased) || 0, 'skill'), 0);
    const combatBase = guidedCombatBaseRanks(culture, selections);
    const combatPoints = Object.entries(additionalRanks?.combat || {}).reduce((total, [skill, purchased]) => total + additionalCost(combatBase[skill] || 0, Number(purchased) || 0, 'combat'), 0);
    return skillPoints + combatPoints;
}

function guidedAdvancementBudget() { return adventurer.trancos ? 15 : 10; }

function renderPurchaseRow(type, skill, baseRank, purchased, spent, budget) {
    const maxRank = type === 'combat' ? combatRankCosts.length : skillRankCosts.length;
    const totalRank = baseRank + purchased;
    const nextCost = totalRank < maxRank ? rankCost(totalRank + 1, type) : Infinity;
    const canAdd = totalRank < maxRank && spent + nextCost <= budget;
    return `<div class="guided-purchase-row"><div><strong>${displayName(skill)}</strong><small>Base ${baseRank} · Coste siguiente: ${Number.isFinite(nextCost) ? `${nextCost} puntos` : 'máximo'}</small></div><button type="button" class="guided-purchase-btn" data-guided-purchase="${type}" data-guided-purchase-key="${skill}" data-guided-purchase-delta="-1" ${purchased ? '' : 'disabled'} aria-label="Reducir ${displayName(skill)}">−</button><strong class="guided-purchase-rank">${totalRank}</strong><button type="button" class="guided-purchase-btn" data-guided-purchase="${type}" data-guided-purchase-key="${skill}" data-guided-purchase-delta="1" ${canAdd ? '' : 'disabled'} aria-label="Aumentar ${displayName(skill)}">+</button></div>`;
}

function renderAdditionalRanks(culture) {
    if (!culture) return '<div class="guided-intro"><p>Selecciona primero una cultura.</p></div>';
    const additionalRanks = guidedDraft.additionalRanks || { skills: {}, combat: {} };
    const budget = guidedAdvancementBudget();
    const spent = calculateAdvancementPoints(culture, additionalRanks);
    const skillRows = Object.entries(cultureSkillGroups).flatMap(([, skills]) => skills).map(skill => renderPurchaseRow('skills', skill, culture.skills[skill], Number(additionalRanks.skills?.[skill] || 0), spent, budget)).join('');
    const combatBase = guidedCombatBaseRanks(culture);
    const combatRows = guidedCombatSkills.map(skill => renderPurchaseRow('combat', skill, combatBase[skill], Number(additionalRanks.combat?.[skill] || 0), spent, budget)).join('');
    return `<div class="guided-intro"><i class="fa-solid fa-coins"></i><p>Tienes <strong>${budget} puntos</strong> para comprar rangos adicionales. Cada nivel se paga por separado y puedes mejorar habilidades o competencias que empiecen en rango 0. Costes: habilidades 1/2/3/5 · combate 2/4/6.</p></div><div class="guided-points-total"><span>Puntos gastados</span><strong>${spent} / ${budget}</strong><span>Disponibles</span><strong>${budget - spent}</strong></div><h6 class="guided-purchase-heading">Habilidades</h6><div class="guided-purchase-grid">${skillRows}</div><h6 class="guided-purchase-heading">Competencias de combate</h6><div class="guided-purchase-grid">${combatRows}</div>`;
}

function guidedCombatFinalRanks(culture) {
    const ranks = guidedCombatBaseRanks(culture);
    Object.entries(guidedDraft.additionalRanks?.combat || {}).forEach(([skill, purchased]) => { if (skill in ranks) ranks[skill] += Number(purchased) || 0; });
    return ranks;
}

function equipmentChoiceDetails(item, category) {
    if (!item) return '';
    if (category.startsWith('weapon')) return `Daño ${item.damage} · Herida ${item.injury} · Carga ${item.load}${item.notes ? ` · ${item.notes}` : ''}`;
    if (category === 'armor' || category === 'helmet') return `Protección ${item.protection} · Carga ${item.load}`;
    return `Modificador de Parada +${item.parryModifier} · Carga ${item.load}`;
}

function renderEquipmentSelect(label, category, selected, options, required = false) {
    const emptyLabel = category === 'armor' ? 'Selecciona una armadura…' : category.startsWith('weapon') ? 'Selecciona un arma…' : `Sin ${category === 'shield' ? 'escudo' : 'yelmo'}`;
    const emptyOption = required ? `<option value="">${emptyLabel}</option>` : `<option value="">${emptyLabel}</option>`;
    const selectedItem = options.find(item => item.id === selected);
    return `<label class="guided-field equipment-choice-field">${label}<select class="form-select tor-select" data-guided-equipment="${category}" ${required ? 'aria-required="true"' : ''}>${emptyOption}${options.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select>${selectedItem ? `<small class="equipment-choice-details">${escapeHtml(equipmentChoiceDetails(selectedItem, category))}</small>` : ''}</label>`;
}

function renderEquipmentChoices(culture) {
    if (!culture || !equipmentCatalog.weapons.length) return '<div class="guided-intro"><p>No se pudo cargar el catálogo de equipo.</p></div>';
    const equipment = guidedDraft.equipment || { weapons: {}, armor: '', shield: '', helmet: '' };
    const finalRanks = guidedCombatFinalRanks(culture);
    const weaponChoices = guidedCombatSkills.filter(skill => finalRanks[skill] > 0).map(skill => {
        const options = equipmentCatalog.weapons.filter(weapon => weapon.competence === skill);
        if (!equipment.weapons[skill] && options[0]) equipment.weapons[skill] = options[0].id;
        return renderEquipmentSelect(`Arma de ${displayName(skill)} (rango ${finalRanks[skill]})`, 'weapon-' + skill, equipment.weapons[skill], options, true);
    }).join('');
    const weaponCount = guidedCombatSkills.filter(skill => finalRanks[skill] > 0).length;
    const weaponFields = weaponChoices || '<p class="guided-empty-equipment">No tienes competencias de armas; puedes continuar sin seleccionar armas.</p>';
    return `<div class="guided-intro"><i class="fa-solid fa-swords"></i><p>Elige un arma por cada tipo de competencia con rango mayor que 0. Los tipos sin competencia no se recomiendan ni aparecen. La armadura es obligatoria; el escudo y el yelmo son opcionales.</p></div><div class="guided-equipment-section"><h6>Armas (${weaponCount})</h6><div class="guided-fields-grid">${weaponFields}</div></div><div class="guided-equipment-section"><h6>Protección</h6><div class="guided-fields-grid">${renderEquipmentSelect('Armadura', 'armor', equipment.armor, equipmentCatalog.armor, true)}${renderEquipmentSelect('Escudo (opcional)', 'shield', equipment.shield, equipmentCatalog.shields)}${renderEquipmentSelect('Yelmo (opcional)', 'helmet', equipment.helmet, equipmentCatalog.helmets)}</div></div>`;
}

function selectedEquipmentItems(equipment) {
    const items = [];
    Object.entries(equipment?.weapons || {}).forEach(([skill, id]) => {
        const item = equipmentCatalog.weapons.find(weapon => weapon.id === id);
        if (item) items.push({ item: { tipoItem: 'Arma', nombre: item.name, subtipoItem: '', dano: item.damage, herida: item.injury, carga: item.load, competencia: normalizeCombatKey(skill), notas: item.notes || '', modificadorParada: 0 } });
    });
    const armor = equipmentCatalog.armor.find(item => item.id === equipment?.armor);
    if (armor) items.push({ item: { tipoItem: 'Armadura', nombre: armor.name, subtipoItem: armor.type, dano: 0, herida: '', carga: armor.load, competencia: '', notas: `Protección: ${armor.protection}`, modificadorParada: 0 } });
    const shield = equipmentCatalog.shields.find(item => item.id === equipment?.shield);
    if (shield) items.push({ item: { tipoItem: 'Escudo', nombre: shield.name, subtipoItem: '', dano: 0, herida: '', carga: shield.load, competencia: '', notas: `Modificador de Parada: +${shield.parryModifier}`, modificadorParada: shield.parryModifier } });
    const helmet = equipmentCatalog.helmets.find(item => item.id === equipment?.helmet);
    if (helmet) items.push({ item: { tipoItem: 'Yelmo', nombre: helmet.name, subtipoItem: helmet.type, dano: 0, herida: '', carga: helmet.load, competencia: '', notas: `Protección: ${helmet.protection}`, modificadorParada: 0 } });
    return items;
}

function renderCombatChoices(culture) {
    if (!culture) return '<div class="guided-intro"><p>Selecciona primero una cultura.</p></div>';
    culture.combatProficiencies.forEach(choice => { if (!guidedDraft.combatProficiencies[choice.id]) guidedDraft.combatProficiencies[choice.id] = choice.options[0]; });
    const choices = culture.combatProficiencies.map(choice => {
        const value = guidedDraft.combatProficiencies[choice.id] || choice.options[0];
        return `<label class="guided-field"><span>${escapeHtml(choice.label)} <em class="guided-choice-rank">Rango ${choice.rank}</em></span><select class="form-select tor-select" data-guided-combat="${choice.id}">${choice.options.map(option => `<option value="${option}" ${option === value ? 'selected' : ''}>${displayName(option)}</option>`).join('')}</select></label>`;
    }).join('');
    return `<div class="guided-intro"><i class="fa-solid fa-shield-halved"></i><p>Elige la competencia que recibe cada rango indicado por la cultura.</p></div><div class="guided-fields-grid">${choices}</div>`;
}

function renderTraitChoices(culture) {
    if (!culture) return '<div class="guided-intro"><p>Selecciona primero una cultura.</p></div>';
    const selected = guidedDraft.distinctiveFeatures || [];
    const choices = culture.distinctiveFeatures.map(feature => `<label class="guided-trait-choice ${selected.includes(feature) ? 'selected' : ''}"><input type="checkbox" data-guided-trait="${escapeHtml(feature)}" ${selected.includes(feature) ? 'checked' : ''}><span>${escapeHtml(feature)}</span></label>`).join('');
    return `<div class="guided-intro"><i class="fa-solid fa-feather-pointed"></i><p>Elige exactamente dos rasgos distintivos de la lista disponible para ${escapeHtml(culture.name)}.</p></div><div class="guided-traits-grid">${choices}</div><p class="guided-selection-count">Seleccionados: <strong>${selected.length}</strong> de 2</p>`;
}

function applyCultureToAdventurer(source, culture, options = {}) {
    const result = JSON.parse(JSON.stringify(source));
    const row = culture.attributesTable.find(item => item.roll === Number(options.attributeRoll)) || culture.attributesTable[0];
    const occupation = getOccupationByName(result.informacionGeneral.ocupacion);
    const favoredSkills = options.favoredSkills?.length ? options.favoredSkills : [...new Set([...(culture.favoredSkillsChoices || []), ...(options.occupationFavoredSkills || [])])];
    const baseNO = result.trancos ? 18 : 20;
    const attributes = { fuerza: row.strength, corazon: row.heart, mente: row.mind };
    Object.entries(attributes).forEach(([key, value]) => { result.atributos[key].valor = value; result.atributos[key].tn = baseNO - value; });
    Object.entries(cultureSkillGroups).forEach(([group, groupSkills]) => groupSkills.forEach(skill => { result.habilidades[group][skill].rango = culture.skills[skill]; result.habilidades[group][skill].favorecida = favoredSkills.includes(skill); }));
    Object.entries(options.additionalRanks?.skills || {}).forEach(([skill, purchased]) => {
        const group = Object.entries(cultureSkillGroups).find(([, groupSkills]) => groupSkills.includes(skill))?.[0];
        if (group && skill in result.habilidades[group]) result.habilidades[group][skill].rango += Math.max(0, Number(purchased) || 0);
    });
    Object.keys(result.combate.competencias).forEach(skill => { result.combate.competencias[skill] = 0; });
    culture.combatProficiencies.forEach(choice => {
        const skill = options.combatProficiencies?.[choice.id];
        if (skill in result.combate.competencias) result.combate.competencias[skill] += choice.rank;
    });
    Object.entries(options.additionalRanks?.combat || {}).forEach(([skill, purchased]) => { if (skill in result.combate.competencias) result.combate.competencias[skill] += Math.max(0, Number(purchased) || 0); });
    result.informacionGeneral.culturaHeroica = culture.name;
    result.informacionGeneral.nivelDeVida = culture.standardOfLiving;
    result.informacionGeneral.bendicionCultural = `${culture.blessing.title}: ${culture.blessing.text}`;
    result.estadisticas.aguante.maximo = attributes.fuerza + culture.derivedStats.enduranceBonus;
    result.estadisticas.aguante.actual = result.estadisticas.aguante.maximo;
    result.estadisticas.esperanza.maxima = attributes.corazon + culture.derivedStats.hopeBonus;
    result.estadisticas.esperanza.actual = result.estadisticas.esperanza.maxima;
    const baseParry = attributes.mente + culture.derivedStats.parryBonus;
    if (options.equipment) result.combate.equipoGuerra = selectedEquipmentItems(options.equipment);
    const equipmentParryModifier = (result.combate.equipoGuerra || []).reduce((total, gear) => total + Number(gear.item?.modificadorParada || 0), 0);
    result.creation = { ...result.creation, baseParry };
    result.estadisticas.parada = baseParry + equipmentParryModifier;
    result.desarrollo.virtudes = (culture.virtues || []).map(virtue => `${virtue.title}: ${virtue.text}`).join('\n\n');
    const distinctiveFeatures = options.distinctiveFeatures || [];
    const occupationFeature = occupationTraitLabel(occupation, options.occupationTraitOption);
    const trancosFeature = result.trancos ? [TRANCOS_FEATURE] : [];
    result.rasgosDistintivos = [...distinctiveFeatures, ...(occupationFeature ? [occupationFeature] : []), ...trancosFeature];
    result.reglasEspeciales = result.trancos ? [TRANCOS_FEATURE + ': ' + TRANCOS_FEATURE_DESCRIPTION] : [];
    result.sombra.senda = occupation?.shadowPath || result.sombra.senda;
    result.creation = { ...result.creation, version: 1, cultureId: culture.id, attributeRoll: row.roll, favoredSkills, occupationFavoredSkills: [...(options.occupationFavoredSkills || [])], combatProficiencies: options.combatProficiencies || {}, additionalRanks: JSON.parse(JSON.stringify(options.additionalRanks || { skills: {}, combat: {} })), advancementPointsSpent: calculateAdvancementPoints(culture, options.additionalRanks, options.combatProficiencies), advancementPointsBudget: result.trancos ? 15 : 10, equipment: JSON.parse(JSON.stringify(options.equipment || { weapons: {}, armor: '', shield: '', helmet: '' })), distinctiveFeatures: [...distinctiveFeatures], occupationDistinctiveFeature: occupationFeature, trancosFeature: result.trancos ? TRANCOS_FEATURE : '', trancosRule: result.trancos ? TRANCOS_FEATURE_DESCRIPTION : '', trancosTravelInspired: Boolean(result.trancos), culturalShadowRule: culture.shadowRule, completed: true };
    return result;
}

function renderGuidedStep() {
    const culture = getCultureById(guidedDraft.cultureId);
    const steps = [
        {
            title: 'Elige una base de creación',
            subtitle: 'Puedes cambiar estos valores más adelante desde la ficha.',
            content: `<div class="guided-intro"><i class="fa-solid fa-feather-pointed"></i><p>La guía prepara únicamente los datos esenciales. El resto de la hoja queda disponible para introducirlo directamente y los valores calculados se ofrecen como base editable.</p></div><div class="guided-mode-grid"><label class="guided-mode-card"><input type="radio" name="guided-trancos" value="false" data-guided-mode><span><strong>Modo tradicional</strong><small>Valores objetivo con base 20 y 10 puntos de experiencia previa.</small></span></label><label class="guided-mode-card"><input type="radio" name="guided-trancos" value="true" data-guided-mode><span><strong>Modo Trancos</strong><small>Valores objetivo con base 18, 15 puntos y el rasgo Trancos.</small></span></label></div>`
        },
        {
            title: 'Datos del aventurero',
            subtitle: 'Completa los valores de la primera sección de la ficha.',
            content: `<div class="guided-fields-grid">${guidedField('informacionGeneral.nombre', 'Nombre', 'text', 'aria-required="true" placeholder="Nombre del aventurero"')}<label class="guided-field">Ocupación<select class="form-select tor-select" data-guided-path="informacionGeneral.ocupacion" aria-required="true"><option value="">Selecciona una ocupación…</option>${guidedSelectOptions(guidedOccupations)}</select></label>${guidedField('informacionGeneral.edad', 'Edad', 'number', 'min="0"')}${guidedField('informacionGeneral.heredero', 'Heredero')}${guidedField('sombra.defectos', 'Defectos', 'text', 'placeholder="Separados por comas"')}</div><div class="guided-calculated-note"><i class="fa-solid fa-wand-magic-sparkles me-1"></i> La cultura, el nivel de vida, la bendición y los rasgos distintivos se aplicarán en los pasos siguientes.</div>`
        },
        {
            title: 'Elige una cultura',
            subtitle: 'Consulta sus reglas antes de aplicarlas a la ficha.',
            content: `<label class="guided-field">Cultura heroica<select class="form-select tor-select" data-guided-culture aria-required="true"><option value="">Selecciona una cultura…</option>${cultures.map(item => `<option value="${item.id}" ${item.id === guidedDraft.cultureId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label>${cultureSummary(culture)}`
        },
        {
            title: 'Atributos principales',
            subtitle: 'Elige una fila de la cultura o tira 1d6.',
            content: renderAttributeChoices(culture)
        },
        {
            title: 'Habilidades favorecidas',
            subtitle: 'Elige dos habilidades y completa el rasgo de la ocupación.',
            content: renderFavoredChoices(culture)
        },
        {
            title: 'Competencias de combate',
            subtitle: 'Selecciona las competencias iniciales.',
            content: renderCombatChoices(culture)
        },
        {
            title: 'Compra de niveles',
            subtitle: 'Invierte los 10 puntos de experiencia previa.',
            content: renderAdditionalRanks(culture)
        },
        {
            title: 'Equipo de guerra',
            subtitle: 'Elige armas, armadura y protección opcional.',
            content: renderEquipmentChoices(culture)
        },
        {
            title: 'Rasgos distintivos',
            subtitle: 'Elige dos rasgos disponibles para la cultura.',
            content: renderTraitChoices(culture)
        },
        {
            title: 'Confirmar creación',
            subtitle: 'Comprueba las elecciones antes de aplicar la cultura.',
            content: `<div class="guided-summary"><div class="guided-summary-icon"><i class="fa-solid fa-scroll"></i></div><p>Se aplicará <strong>${escapeHtml(culture?.name || 'la cultura seleccionada')}</strong> a la ficha y todos los campos seguirán siendo editables.</p><div class="guided-summary-grid"><span>Fila de atributos</span><strong>${guidedDraft.attributeRoll || 'Pendiente'}</strong><span>Habilidades favorecidas</span><strong>${guidedFavoredSkills(culture).map(displayName).join(', ') || 'Ninguna'}</strong><span>Puntos de mejora</span><strong>${calculateAdvancementPoints(culture)} / ${guidedAdvancementBudget()}</strong><span>Rasgos distintivos</span><strong>${[...guidedDraft.distinctiveFeatures, occupationTraitLabel(getOccupationByName(adventurer.informacionGeneral.ocupacion), guidedDraft.occupationTraitOption), ...(adventurer.trancos ? [TRANCOS_FEATURE] : [])].filter(Boolean).join(', ') || 'Pendientes'}</strong><span>Número objetivo</span><strong>Base ${adventurer.trancos ? 18 : 20}</strong></div></div>`
        }
    ];
    const current = steps[guidedStep];
    guidedTitle.textContent = current.title;
    guidedSubtitle.textContent = current.subtitle;
    guidedStepContent.innerHTML = `${current.content}<div class="guided-error d-none" id="guided-error"></div>`;
    guidedProgressBar.style.width = `${((guidedStep + 1) / guidedStepCount) * 100}%`;
    guidedProgressLabel.textContent = `Paso ${guidedStep + 1} de ${guidedStepCount}`;
    guidedModalElement.querySelector('.progress').setAttribute('aria-valuenow', guidedStep + 1);
    guidedBackBtn.classList.toggle('d-none', guidedStep === 0);
    guidedNextBtn.innerHTML = guidedStep === guidedStepCount - 1 ? 'Terminar <i class="fa-solid fa-check ms-1"></i>' : 'Siguiente <i class="fa-solid fa-arrow-right ms-1"></i>';

    guidedStepContent.querySelectorAll('[data-guided-path]').forEach(input => {
        const value = getAt(adventurer, input.dataset.guidedPath);
        if (input.tagName === 'SELECT') input.value = value ?? '';
        else input.value = input.dataset.guidedPath.includes('defectos') || input.dataset.guidedPath === 'rasgosDistintivos' ? (Array.isArray(value) ? value.join(', ') : value ?? '') : (value ?? '');
    });
    const modeInput = guidedStepContent.querySelector(`[data-guided-mode][value="${adventurer.trancos ? 'true' : 'false'}"]`);
    if (modeInput) modeInput.checked = true;
}

function updateGuidedValue(input) {
    if (input.matches('[data-guided-mode]')) {
        const previousMode = adventurer.trancos;
        adventurer.trancos = input.value === 'true';
        guidedDraft.trancos = adventurer.trancos;
        if (previousMode !== adventurer.trancos) guidedDraft.additionalRanks = { skills: {}, combat: {} };
        updateCalculatedFields();
        return;
    }
    if (!input?.dataset?.guidedPath) return;
    const path = input.dataset.guidedPath;
    let value = input.value;
    if (input.type === 'number') value = Number(value || 0);
    if (path === 'sombra.defectos' || path === 'rasgosDistintivos') value = value.split(',').map(item => item.trim()).filter(Boolean);
    setAt(adventurer, path, value);
    if (path === 'informacionGeneral.ocupacion') setShadowPathFromOccupation();
    updateCalculatedFields();
}

function validateGuidedStep() {
    if (guidedStep === 0 || guidedStep === 5 || guidedStep === 6) return true;
    if (guidedStep === 2 && !guidedDraft.cultureId) return false;
    if (guidedStep === 3 && !guidedDraft.attributeRoll) return false;
    if (guidedStep === 4) {
        if (guidedDraft.occupationFavoredSkills.length !== 2) return false;
        if (getOccupationByName(adventurer.informacionGeneral.ocupacion)?.distinctiveFeature?.options && !guidedDraft.occupationTraitOption) return false;
        return true;
    }
    if (guidedStep === 7) {
        const culture = getCultureById(guidedDraft.cultureId);
        const finalRanks = guidedCombatFinalRanks(culture);
        const missingWeapon = guidedCombatSkills.some(skill => finalRanks[skill] > 0 && !guidedDraft.equipment?.weapons?.[skill]);
        if (missingWeapon || !guidedDraft.equipment?.armor) return false;
        return true;
    }
    if (guidedStep === 8 && guidedDraft.distinctiveFeatures.length !== 2) return false;
    const invalid = [...guidedStepContent.querySelectorAll('[aria-required="true"]')].find(input => !String(input.value).trim());
    if (!invalid) return true;
    invalid.focus();
    const error = document.getElementById('guided-error');
    error.textContent = 'Completa los campos obligatorios para continuar.';
    error.classList.remove('d-none');
    return false;
}

function closeGuidedAdventurerGuide() {
    updateCalculatedFields();
    fillAdventurerForm();
    saveAdventurer();
    if (guidedModal) guidedModal.hide();
}

function completeGuidedCreation() {
    const culture = getCultureById(guidedDraft.cultureId);
    if (!culture || !guidedDraft.attributeRoll) return;
    adventurer.trancos = Boolean(guidedDraft.trancos);
    adventurer = applyCultureToAdventurer(adventurer, culture, guidedDraft);
    calculatedOverrides = new Set();
    closeGuidedAdventurerGuide();
}

async function guideNewAdventurer() {
    await Promise.all([loadCultures(), loadOccupations(), loadEquipmentCatalog()]);
    const savedOccupation = getOccupationByName(adventurer.informacionGeneral.ocupacion);
    const savedOccupationFeature = adventurer.creation?.occupationDistinctiveFeature || '';
    const savedOccupationTraitOption = savedOccupation?.distinctiveFeature?.options?.find(option => savedOccupationFeature === `${savedOccupation.distinctiveFeature.name}: ${option}`) || '';
    guidedDraft = { trancos: Boolean(adventurer.trancos), cultureId: adventurer.creation?.cultureId || '', attributeRoll: adventurer.creation?.attributeRoll || null, favoredSkills: [...(adventurer.creation?.favoredSkills || [])], occupationFavoredSkills: [...(adventurer.creation?.occupationFavoredSkills || [])], combatProficiencies: { ...(adventurer.creation?.combatProficiencies || {}) }, additionalRanks: JSON.parse(JSON.stringify(adventurer.creation?.additionalRanks || { skills: {}, combat: {} })), equipment: JSON.parse(JSON.stringify(adventurer.creation?.equipment || { weapons: {}, armor: '', shield: '', helmet: '' })), distinctiveFeatures: [...(adventurer.creation?.distinctiveFeatures || adventurer.rasgosDistintivos || [])].filter(feature => feature !== TRANCOS_FEATURE), occupationTraitOption: savedOccupationTraitOption };
    guidedStep = 0;
    renderGuidedStep();
    if (guidedModal) guidedModal.show();
}

guidedForm.addEventListener('input', event => updateGuidedValue(event.target));
guidedForm.addEventListener('change', event => {
    const input = event.target;
    if (input.matches('[data-guided-culture]')) {
        guidedDraft.cultureId = input.value;
        guidedDraft.attributeRoll = null;
        guidedDraft.favoredSkills = [];
        guidedDraft.occupationFavoredSkills = [];
        guidedDraft.combatProficiencies = {};
        guidedDraft.additionalRanks = { skills: {}, combat: {} };
        guidedDraft.equipment = { weapons: {}, armor: '', shield: '', helmet: '' };
        guidedDraft.distinctiveFeatures = [];
        renderGuidedStep();
        return;
    }
    if (input.matches('[data-guided-mode]')) {
        updateGuidedValue(input);
        renderGuidedStep();
        return;
    }
    if (input.dataset.guidedPath === 'informacionGeneral.ocupacion') {
        updateGuidedValue(input);
        guidedDraft.favoredSkills = [];
        guidedDraft.occupationFavoredSkills = [];
        guidedDraft.occupationTraitOption = '';
        return;
    }
    if (input.matches('[data-guided-attribute]')) { guidedDraft.attributeRoll = Number(input.value); renderGuidedStep(); return; }
    if (input.matches('[data-guided-favored]')) {
        const selectedInputs = [...guidedStepContent.querySelectorAll('[data-guided-favored]:checked')];
        if (selectedInputs.length > 2) input.checked = false;
        guidedDraft.occupationFavoredSkills = [...guidedStepContent.querySelectorAll('[data-guided-favored]:checked')].map(item => item.dataset.guidedFavored);
        guidedDraft.favoredSkills = guidedFavoredSkills(getCultureById(guidedDraft.cultureId));
        renderGuidedStep();
        return;
    }
    if (input.matches('[data-guided-combat]')) { guidedDraft.combatProficiencies[input.dataset.guidedCombat] = input.value; guidedDraft.additionalRanks = { skills: {}, combat: {} }; guidedDraft.equipment = { weapons: {}, armor: '', shield: '', helmet: '' }; renderGuidedStep(); return; }
    if (input.matches('[data-guided-occupation-trait]')) { guidedDraft.occupationTraitOption = input.value; renderGuidedStep(); return; }
    if (input.matches('[data-guided-equipment]')) {
        const category = input.dataset.guidedEquipment;
        if (category.startsWith('weapon-')) guidedDraft.equipment.weapons[category.replace('weapon-', '')] = input.value;
        else guidedDraft.equipment[category] = input.value;
        renderGuidedStep();
        return;
    }
    if (input.matches('[data-guided-trait]')) {
        const selectedInputs = [...guidedStepContent.querySelectorAll('[data-guided-trait]:checked')];
        if (selectedInputs.length > 2) input.checked = false;
        guidedDraft.distinctiveFeatures = [...guidedStepContent.querySelectorAll('[data-guided-trait]:checked')].map(item => item.dataset.guidedTrait);
        renderGuidedStep();
        return;
    }
    updateGuidedValue(input);
});
guidedForm.addEventListener('click', event => {
    const purchaseButton = event.target.closest('[data-guided-purchase]');
    if (purchaseButton) {
        const culture = getCultureById(guidedDraft.cultureId);
        const type = purchaseButton.dataset.guidedPurchase;
        const skill = purchaseButton.dataset.guidedPurchaseKey;
        const delta = Number(purchaseButton.dataset.guidedPurchaseDelta);
        const current = Number(guidedDraft.additionalRanks?.[type]?.[skill] || 0);
        const next = Math.max(0, current + delta);
        const baseRank = type === 'combat' ? guidedCombatBaseRanks(culture)[skill] : culture?.skills?.[skill] || 0;
        const currentCost = additionalCost(baseRank, current, type);
        const nextCost = additionalCost(baseRank, next, type);
        const spent = calculateAdvancementPoints(culture, guidedDraft.additionalRanks);
        if (nextCost <= currentCost || spent - currentCost + nextCost <= guidedAdvancementBudget()) {
            guidedDraft.additionalRanks[type][skill] = next;
            if (!next) delete guidedDraft.additionalRanks[type][skill];
            guidedDraft.equipment = { weapons: {}, armor: '', shield: '', helmet: '' };
            renderGuidedStep();
        }
        return;
    }
    if (event.target.closest('#guided-roll-attributes')) { guidedDraft.attributeRoll = Math.floor(Math.random() * 6) + 1; renderGuidedStep(); }
});
guidedForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!validateGuidedStep()) { const error = document.getElementById('guided-error'); error.textContent = 'Completa la selección de este paso para continuar.'; error.classList.remove('d-none'); return; }
    if (guidedStep < guidedStepCount - 1) {
        guidedStep += 1;
        renderGuidedStep();
    } else completeGuidedCreation();
});
guidedBackBtn.addEventListener('click', () => { if (guidedStep > 0) { guidedStep -= 1; renderGuidedStep(); } });
guidedExitBtn.addEventListener('click', closeGuidedAdventurerGuide);
guidedCloseBtn.addEventListener('click', closeGuidedAdventurerGuide);

function renderAdventurerSelects() {
    const options = savedAdventurers.map(item => `<option value="${item._id}">${item.nombre}</option>`).join('');
    if (sheetLibrarySelect) sheetLibrarySelect.innerHTML = `<option value="">Hojas guardadas…</option>${options}`;
    if (adventurerSelect) { adventurerSelect.innerHTML = `<option value="">Sin personaje asignado</option>${options}`; adventurerSelect.value = assignedAdventurerId; }
    refreshGuidedRollAvailability(true);
}
async function fetchAdventurers() {
    if (isLocalFile) return renderAdventurerSelects();
    try { 
        const token = localStorage.getItem('rpg_auth_token');
        const response = await fetch('/api/adventurers', { headers: { 'Authorization': `Bearer ${token}` } }); 
        if (!response.ok) throw new Error(); 
        savedAdventurers = await response.json(); 
        renderAdventurerSelects(); 
    }
    catch (_) { const status = document.getElementById('adventurer-save-status'); if (status) status.textContent = 'No se pudo conectar con la base de datos.'; }
}

const guidedSkillCatalog = Object.entries(cultureSkillGroups).flatMap(([attribute, skills]) => skills.map(key => ({ key, attribute })));

function getAssignedAdventurerForRoll() {
    const record = savedAdventurers.find(item => item._id === assignedAdventurerId);
    if (!record) return null;
    const sheet = normalizeAdventurerSheet(record.ficha, record.trancos);
    sheet._id = record._id;
    return { record, sheet };
}

function rollModifierValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(-10, Math.min(10, Math.trunc(parsed))) : 0;
}

function prepareSkillRoll(sheet, skillKey, modifiers = {}) {
    const definition = guidedSkillCatalog.find(skill => skill.key === skillKey);
    const skill = definition && sheet?.habilidades?.[definition.attribute]?.[skillKey];
    const attribute = definition && sheet?.atributos?.[definition.attribute];
    if (!definition || !skill || !attribute) return null;
    const favored = Boolean(skill.favorecida);
    const illFavoured = Boolean(modifiers.illFavoured);
    const hopeSpent = Boolean(modifiers.hopeSpent);
    const hopeBonus = hopeSpent ? Math.max(0, Number(attribute.valor) || 0) : 0;
    const baseTarget = sheet.trancos ? 18 : 20;
    return {
        adventurerId: String(sheet._id || ''),
        adventurerName: sheet.informacionGeneral?.nombre || 'Aventurero',
        type: 'skill',
        sourceKey: skillKey,
        label: displayName(skillKey),
        attributeKey: definition.attribute,
        attributeValue: Number(attribute.valor) || 0,
        featDice: illFavoured || favored ? 2 : 1,
        successDice: Math.max(0, Math.min(6, Math.trunc(Number(skill.rango) || 0))),
        targetNumber: Math.max(0, Number.isFinite(Number(attribute.tn)) ? Number(attribute.tn) : baseTarget - (Number(attribute.valor) || 0)),
        hopeSpent,
        hopeBonus,
        modifier: rollModifierValue(modifiers.modifier) + hopeBonus,
        weary: Boolean(modifiers.weary),
        illFavoured,
        featDiceMode: illFavoured ? 'worst' : (favored ? 'best' : 'normal'),
        weapon: null
    };
}

function prepareWeaponRoll(sheet, gearIndex, modifiers = {}) {
    const gear = sheet?.combate?.equipoGuerra?.[Number(gearIndex)];
    const item = gear?.item;
    const competenceKey = normalizeCombatKey(item?.competencia);
    const rank = Number(sheet?.combate?.competencias?.[competenceKey] || 0);
    if (!item?.nombre || !competenceKey || rank <= 0) return null;
    const hopeSpent = Boolean(modifiers.hopeSpent);
    const attribute = sheet?.atributos?.fuerza || {};
    const hopeBonus = hopeSpent ? Math.max(0, Number(attribute.valor) || 0) : 0;
    const weapon = {
        name: item.nombre,
        competence: competenceKey,
        damage: Number(item.dano) || 0,
        injury: item.herida || '',
        load: Number(item.carga) || 0,
        notes: item.notas || ''
    };
    return {
        adventurerId: String(sheet._id || ''),
        adventurerName: sheet.informacionGeneral?.nombre || 'Aventurero',
        type: 'attack',
        sourceKey: competenceKey,
        gearIndex: Number(gearIndex),
        label: item.nombre,
        attributeKey: 'fuerza',
        attributeValue: Number(attribute.valor) || 0,
        featDice: Boolean(modifiers.illFavoured) ? 2 : 1,
        successDice: Math.max(0, Math.min(6, Math.trunc(rank))),
        targetNumber: Math.max(0, Math.min(99, Number(modifiers.targetNumber) || 15)),
        hopeSpent,
        hopeBonus,
        modifier: rollModifierValue(modifiers.modifier) + hopeBonus,
        weary: Boolean(modifiers.weary),
        illFavoured: Boolean(modifiers.illFavoured),
        featDiceMode: modifiers.illFavoured ? 'worst' : 'normal',
        weapon
    };
}

window.prepareSkillRoll = prepareSkillRoll;
window.prepareWeaponRoll = prepareWeaponRoll;

function getGuidedRollModifiers() {
    return {
        modifier: rollModifierValue(guidedRollModifier?.value),
        targetNumber: Math.max(0, Math.min(99, Number(guidedRollTarget?.value) || 15)),
        hopeSpent: Boolean(guidedRollHope?.checked),
        weary: Boolean(guidedRollWeary?.checked),
        illFavoured: Boolean(guidedRollIllFavoured?.checked)
    };
}

function validWeaponChoices(sheet) {
    return (sheet?.combate?.equipoGuerra || []).map((gear, index) => {
        const item = gear?.item || {};
        const competence = normalizeCombatKey(item.competencia);
        const rank = Number(sheet?.combate?.competencias?.[competence] || 0);
        return item.nombre && competence && rank > 0 ? { index, item, competence, rank } : null;
    }).filter(Boolean);
}

function renderGuidedRollSourceOptions() {
    const selected = getAssignedAdventurerForRoll();
    if (!guidedRollSource || !selected) return;
    const options = currentRollMode === 'skill'
        ? guidedSkillCatalog.map(skill => {
            const skillData = selected.sheet.habilidades?.[skill.attribute]?.[skill.key] || {};
            const rank = Number(skillData.rango) || 0;
            const favoredLabel = skillData.favorecida ? ' · Favorecida' : '';
            return `<option value="${skill.key}">${displayName(skill.key)} · ${displayName(skill.attribute)} · Rango ${rank}${favoredLabel}</option>`;
        })
        : validWeaponChoices(selected.sheet).map(weapon => `<option value="${weapon.index}">${escapeHtml(weapon.item.nombre)} · ${displayName(weapon.competence)} ${weapon.rank}</option>`);
    guidedRollSource.innerHTML = options.length ? options.join('') : '<option value="">No hay opciones válidas</option>';
    guidedRollSource.disabled = !options.length;
    if (guidedRollTargetField) guidedRollTargetField.classList.toggle('d-none', currentRollMode !== 'attack');
    renderGuidedRollPreview();
}

function renderGuidedRollPreview() {
    const selected = getAssignedAdventurerForRoll();
    if (!guidedRollPreview || !guidedRollConfirm) return;
    if (!selected || !guidedRollSource?.value) {
        guidedRollPreview.innerHTML = '<span class="text-muted">No hay una acción preparada con la ficha seleccionada.</span>';
        guidedRollConfirm.disabled = true;
        return;
    }
    const modifiers = getGuidedRollModifiers();
    const request = currentRollMode === 'skill'
        ? prepareSkillRoll(selected.sheet, guidedRollSource.value, modifiers)
        : prepareWeaponRoll(selected.sheet, guidedRollSource.value, modifiers);
    if (!request) {
        guidedRollPreview.innerHTML = '<span class="text-muted">La acción seleccionada no tiene datos suficientes.</span>';
        guidedRollConfirm.disabled = true;
        return;
    }
    const modifierText = request.modifier ? ` ${request.modifier >= 0 ? '+' : '−'} ${Math.abs(request.modifier)}` : '';
    const diceText = `${request.featDice}d12 + ${request.successDice}d6`;
    const stateText = [request.hopeSpent ? `Esperanza +${request.hopeBonus}` : '', request.weary ? 'Cansado' : '', request.illFavoured ? 'Desfavorecido' : ''].filter(Boolean).join(' · ');
    const weaponText = request.weapon ? ` · Daño ${escapeHtml(request.weapon.damage)} · Herida ${escapeHtml(request.weapon.injury)}` : '';
    guidedRollPreview.innerHTML = `<strong>${escapeHtml(request.adventurerName)} intenta ${escapeHtml(request.label)}</strong><span>${diceText}${modifierText} contra NO ${request.targetNumber}${weaponText}</span>${stateText ? `<small>${escapeHtml(stateText)}</small>` : ''}`;
    guidedRollConfirm.disabled = false;
    guidedRollConfirm.dataset.request = JSON.stringify(request);
}

function resetGuidedRollState() {
    const selected = getAssignedAdventurerForRoll();
    if (guidedRollModifier) guidedRollModifier.value = '0';
    if (guidedRollTarget) guidedRollTarget.value = '15';
    if (guidedRollHope) guidedRollHope.checked = false;
    if (guidedRollWeary) guidedRollWeary.checked = Boolean(selected?.sheet?.estados?.cansado);
    if (guidedRollIllFavoured) guidedRollIllFavoured.checked = Boolean(selected?.sheet?.estados?.desanimado);
}

function refreshGuidedRollAvailability(resetState = false) {
    const hasSheet = Boolean(getAssignedAdventurerForRoll());
    rollModeButtons.forEach(button => { if (button.dataset.rollMode !== 'manual') button.disabled = !hasSheet; });
    if (!hasSheet && currentRollMode !== 'manual') setRollMode('manual');
    if (guidedRollSheetNote) guidedRollSheetNote.textContent = hasSheet ? `Ficha seleccionada: ${getAssignedAdventurerForRoll().sheet.informacionGeneral?.nombre || 'Sin nombre'}` : 'Selecciona un personaje en la sala para preparar tiradas.';
    if (resetState) resetGuidedRollState();
    if (currentRollMode !== 'manual') renderGuidedRollSourceOptions();
}

function setRollMode(mode) {
    if (mode !== 'manual' && !getAssignedAdventurerForRoll()) mode = 'manual';
    currentRollMode = mode;
    rollModeButtons.forEach(button => {
        const active = button.dataset.rollMode === mode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const guided = mode !== 'manual';
    guidedRollPanel?.classList.toggle('d-none', !guided);
    manualRollControls?.classList.toggle('d-none', guided);
    if (guided) renderGuidedRollSourceOptions();
}

rollModeButtons.forEach(button => button.addEventListener('click', () => setRollMode(button.dataset.rollMode)));
guidedRollSource?.addEventListener('change', renderGuidedRollPreview);
[guidedRollModifier, guidedRollTarget, guidedRollHope, guidedRollWeary, guidedRollIllFavoured].forEach(input => input?.addEventListener('input', renderGuidedRollPreview));
[guidedRollHope, guidedRollWeary, guidedRollIllFavoured].forEach(input => input?.addEventListener('change', renderGuidedRollPreview));

async function saveAdventurerToDatabase() {
    if (isLocalFile) { appAlert('Abre la aplicación desde el servidor para guardar fichas en la base de datos.'); return; }
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
        const token = localStorage.getItem('rpg_auth_token');
        const response = await fetch(adventurerId ? `/api/adventurers/${adventurerId}` : '/api/adventurers', { method: adventurerId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(adventurer) });
        if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.error || 'No se pudo guardar la ficha en la base de datos.'); } const stored = await response.json(); adventurerId = stored._id; saveAdventurer(); if (status) status.textContent = 'Ficha guardada en la base de datos.'; await fetchAdventurers(); if (sheetLibrarySelect) sheetLibrarySelect.value = adventurerId;
    } catch (error) { if (status) status.textContent = error.message; }
}

adventurerForm.addEventListener('input', event => { const input = event.target; if (!input.dataset.path || input.dataset.cultureSelect) return; let value = input.type === 'checkbox' ? input.checked : input.value; if (input.type === 'number') value = Number(value || 0); if (input.dataset.list) value = value.split(',').map(item => item.trim()).filter(Boolean); if (calculatedEditablePaths.has(input.dataset.path)) calculatedOverrides.add(input.dataset.path); setAt(adventurer, input.dataset.path, value); if (input.dataset.path === 'informacionGeneral.ocupacion') { setShadowPathFromOccupation(); const shadowPathInput = adventurerForm.querySelector('[data-path="sombra.senda"]'); if (shadowPathInput) shadowPathInput.value = adventurer.sombra.senda; } updateCalculatedFields(); syncCalculatedInputs(); saveAdventurer(); });
adventurerForm.addEventListener('change', async event => {
    const input = event.target;
    if (input.dataset.cultureSelect) {
        const selected = getCultureByReference(input.value);
        const previousId = adventurer.creation?.cultureId || '';
        if (adventurer.creation?.completed && selected?.id !== previousId) {
            const accepted = await appConfirm('La ficha ya tiene una cultura aplicada. Cambiarla no sobrescribirá sus valores; tendrás que volver a ejecutar el asistente para recalcularla. ¿Continuar?', 'Cambiar cultura');
            if (!accepted) { fillAdventurerForm(); return; }
            adventurer.creation.completed = false;
        }
        adventurer.informacionGeneral.culturaHeroica = selected?.name || '';
        adventurer.creation.cultureId = selected?.id || '';
        saveAdventurer();
        return;
    }
    if (input.dataset.path === 'informacionGeneral.ocupacion') { setShadowPathFromOccupation(); const shadowPathInput = adventurerForm.querySelector('[data-path="sombra.senda"]'); if (shadowPathInput) shadowPathInput.value = adventurer.sombra.senda; saveAdventurer(); }
});
addWarGearBtn.addEventListener('click', () => { adventurer.combate.equipoGuerra.push(newWarGearItem()); fillAdventurerForm(); saveAdventurer(); });
warGearList.addEventListener('click', event => { const button = event.target.closest('.remove-war-gear-btn'); if (!button) return; adventurer.combate.equipoGuerra.splice(Number(button.dataset.gearIndex), 1); fillAdventurerForm(); saveAdventurer(); });
openAdventurerButtons.forEach(button => button.addEventListener('click', async () => {
    await loadCultures();
    await fetchAdventurers();
    const assignedSheet = currentRoom && assignedAdventurerId ? savedAdventurers.find(item => item._id === assignedAdventurerId) : null;
    const creatingNewSheet = !assignedSheet;
    adventurer = assignedSheet ? normalizeAdventurerSheet(assignedSheet.ficha, assignedSheet.trancos) : newAdventurer();
    calculatedOverrides = assignedSheet ? new Set(calculatedEditablePaths) : new Set();
    adventurerId = assignedSheet?._id || null;
    setShadowPathFromOccupation();
    fillAdventurerForm();
    roomSelectionScreen.classList.add('d-none'); appScreen.classList.add('d-none'); adventurerScreen.classList.remove('d-none'); window.scrollTo(0, 0);
    if (creatingNewSheet) guideNewAdventurer();
}));
closeAdventurerBtn.addEventListener('click', () => { adventurerScreen.classList.add('d-none'); (currentRoom ? appScreen : roomSelectionScreen).classList.remove('d-none'); });
exportAdventurerBtn.addEventListener('click', () => { const blob = new Blob([JSON.stringify(adventurer, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${adventurer.informacionGeneral.nombre || 'aventurero'}.json`; link.click(); URL.revokeObjectURL(link.href); });
resetAdventurerBtn.addEventListener('click', async () => { if (await appConfirm('¿Reiniciar todos los campos de la ficha?', 'Reiniciar ficha')) { adventurer = newAdventurer(); calculatedOverrides = new Set(); saveAdventurer(); fillAdventurerForm(); } });
adventurerImport.addEventListener('change', event => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { adventurer = normalizeAdventurerSheet(JSON.parse(reader.result)); calculatedOverrides = new Set(calculatedEditablePaths); adventurerId = null; saveAdventurer(); fillAdventurerForm(); } catch (_) { appAlert('El archivo no contiene un JSON de aventurero válido.', 'Importación no válida'); } }; reader.readAsText(file); event.target.value = ''; });
saveAdventurerBtn.addEventListener('click', saveAdventurerToDatabase);
sheetLibrarySelect.addEventListener('change', event => { const record = savedAdventurers.find(item => item._id === event.target.value); if (!record) return; adventurer = normalizeAdventurerSheet(record.ficha, record.trancos); adventurerId = record._id; setShadowPathFromOccupation(); saveAdventurer(); fillAdventurerForm(); });
adventurerSelect.addEventListener('change', event => { assignedAdventurerId = event.target.value; localStorage.setItem('tor_assigned_adventurer', assignedAdventurerId); const record = savedAdventurers.find(item => item._id === assignedAdventurerId); refreshGuidedRollAvailability(true); if (!isLocalFile && currentRoom) socket.emit('update-user', { username: currentUser, stance: currentStance, adventurerId: assignedAdventurerId, adventurerName: record?.nombre || '' }); else renderLocalActiveUsers(); });

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
        appAlert("Por favor, introduce un nombre válido.");
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
    const { room } = getLastSession();
    if (!room) return;

    if (quickSuggestionContainer && quickSuggestionText) {
        quickSuggestionText.textContent = `${window.currentUser || '—'}  ·  ${room}`;
        quickSuggestionContainer.classList.remove('d-none');
    }
}

if (useSuggestionBtn) {
    useSuggestionBtn.addEventListener('click', () => {
        const { room } = getLastSession();
        if (room && roomnameInput) roomnameInput.value = room;
        if (roomnameInput) roomnameInput.focus();
        // Visual feedback
        useSuggestionBtn.innerHTML = '<i class="fa-solid fa-check me-1"></i> ¡Listo!';
        setTimeout(() => {
            useSuggestionBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate me-1"></i> Cargar';
        }, 1500);
    });
}

// ==========================================
// NARRATIVE ADVENTURES
// ==========================================

function adventureAuthHeaders(json = false) {
    const headers = { Authorization: `Bearer ${localStorage.getItem('rpg_auth_token') || ''}` };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
}

async function adventureRequest(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: { ...adventureAuthHeaders(Boolean(options.body)), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
    return data;
}

function selectedAdventure() {
    return adventureCatalog.find(adventure => adventure.id === selectedAdventureId) || adventureCatalog[0] || null;
}

function renderAdventureCatalog() {
    if (!adventureList) return;
    adventureCatalogCount.textContent = adventureCatalog.length;
    if (!adventureCatalog.length) {
        adventureList.innerHTML = '<p class="adventure-empty-note">No hay relatos publicados todavía.</p>';
        return;
    }

    if (!selectedAdventureId || !adventureCatalog.some(adventure => adventure.id === selectedAdventureId)) {
        selectedAdventureId = adventureCatalog[0].id;
    }

    adventureList.innerHTML = adventureCatalog.map(adventure => {
        const isSelected = adventure.id === selectedAdventureId;
        const activeSession = (adventure.activeSessions || []).find(session => session.status === 'active');
        return `
            <article class="adventure-card ${isSelected ? 'is-selected' : ''}" data-adventure-id="${escapeHtml(adventure.id)}" tabindex="0">
                <div class="adventure-card-icon"><i class="fa-solid fa-compass"></i></div>
                <div class="adventure-card-body">
                    <div class="adventure-card-title-row"><h3>${escapeHtml(adventure.title)}</h3>${activeSession ? '<span class="adventure-active-pill">En curso</span>' : ''}</div>
                    <p>${escapeHtml(adventure.description)}</p>
                    <div class="adventure-card-meta"><span><i class="fa-regular fa-clock me-1"></i>${escapeHtml(adventure.duration || 'Duración variable')}</span><span><i class="fa-solid fa-shield-halved me-1"></i>${escapeHtml(adventure.difficulty || 'Sin clasificar')}</span></div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger adventure-start-card-btn">${activeSession ? 'Continuar' : 'Comenzar'}</button>
            </article>
        `;
    }).join('');

    adventureList.querySelectorAll('.adventure-card').forEach(card => {
        const select = () => {
            selectedAdventureId = card.dataset.adventureId;
            renderAdventureCatalog();
            updateAdventureCharacterNote();
        };
        card.addEventListener('click', select);
        card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
        card.querySelector('.adventure-start-card-btn').addEventListener('click', event => {
            event.stopPropagation();
            startAdventure(card.dataset.adventureId);
        });
    });
    updateAdventureCharacterNote();
}

function updateAdventureCharacterNote() {
    const selected = selectedAdventure();
    if (!adventureCharacterNote || !selected) return;
    const active = (selected.activeSessions || []).length;
    adventureCharacterNote.textContent = active
        ? 'Ya tienes una partida guardada para este relato; puedes continuarla desde el panel de crónicas.'
        : 'El personaje se usará para calcular las tiradas de habilidad.';
}

function renderAdventureCharacters() {
    if (!adventureCharacterSelect) return;
    if (!adventureCharacters.length) {
        adventureCharacterSelect.innerHTML = '<option value="">No hay personajes disponibles</option>';
        return;
    }
    const previous = adventureCharacterSelect.value;
    adventureCharacterSelect.innerHTML = adventureCharacters.map(character => `
        <option value="${escapeHtml(character.id)}">${escapeHtml(character.nombre)}${character.description ? ` · ${escapeHtml(character.description)}` : ''}</option>
    `).join('');
    if (adventureCharacters.some(character => character.id === previous)) adventureCharacterSelect.value = previous;
}

function adventureTitleForSession(session) {
    return adventureCatalog.find(adventure => adventure.id === session.adventureId)?.title || session.adventureId;
}

function renderAdventureSessions() {
    if (!adventureSessionList) return;
    if (!adventureSessions.length) {
        adventureSessionList.innerHTML = '<p class="adventure-empty-note">Todavía no has comenzado ninguna crónica.</p>';
        return;
    }
    adventureSessionList.innerHTML = adventureSessions.map(session => {
        const title = adventureTitleForSession(session);
        const status = session.status === 'active' ? 'En curso' : 'Completada';
        const statusClass = session.status === 'active' ? 'active' : 'completed';
        const date = session.updatedAt ? new Date(session.updatedAt).toLocaleDateString('es-ES') : '';
        return `
            <button type="button" class="adventure-session-item" data-session-id="${escapeHtml(session.id)}">
                <span class="adventure-session-item-icon"><i class="fa-solid ${session.status === 'active' ? 'fa-feather-pointed' : 'fa-check'}"></i></span>
                <span class="adventure-session-item-body"><strong>${escapeHtml(title)}</strong><small>${status} · ${date}</small></span>
                <span class="adventure-session-status ${statusClass}">${status}</span>
            </button>
        `;
    }).join('');
    adventureSessionList.querySelectorAll('[data-session-id]').forEach(button => button.addEventListener('click', () => loadAdventureSession(button.dataset.sessionId)));
}

function renderAdventureState(session) {
    const state = session.adventureState || {};
    const badges = [];
    if (Number(state.maxHope) > 0) badges.push(`<span class="adventure-state-badge hope"><i class="fa-solid fa-heart me-1"></i>Esperanza ${Number(state.hope) || 0}/${Number(state.maxHope)}</span>`);
    if (Number(state.maxEndurance) > 0) badges.push(`<span class="adventure-state-badge endurance"><i class="fa-solid fa-bolt me-1"></i>Aguante ${Number(state.endurance) || 0}/${Number(state.maxEndurance)}</span>`);
    Object.entries(session.storyFlags || {}).filter(([, value]) => value === true).forEach(([key]) => badges.push(`<span class="adventure-state-badge flag"><i class="fa-solid fa-flag me-1"></i>${escapeHtml(key)}</span>`));
    adventureStateBadges.innerHTML = badges.join('');
}

function renderAdventureHistory(session) {
    if (!adventureHistory) return;
    const history = session.history || [];
    adventureHistory.innerHTML = history.length
        ? history.map(entry => `<div class="adventure-history-entry"><span>${escapeHtml(entry.type === 'SCENE' ? 'Escena' : entry.type === 'CHOICE' ? 'Decisión' : 'Tirada')}</span><p>${escapeHtml(entry.text)}</p></div>`).join('')
        : '<p class="adventure-empty-note">Aún no hay acontecimientos registrados.</p>';
}

function renderAdventureSession(session, roll = null) {
    currentAdventureSession = session;
    adventureSessionPanel.classList.remove('d-none');
    adventureSessionTitle.textContent = session.adventure?.title || adventureTitleForSession(session);
    adventureSessionCharacter.textContent = session.character?.nombre ? `Interpretando a ${session.character.nombre}` : '';
    adventureSessionStatus.textContent = session.status === 'completed' ? 'CRÓNICA COMPLETADA' : 'CRÓNICA ACTIVA';
    adventureSceneTitle.textContent = session.scene?.title || 'Fin de la crónica';
    adventureSceneText.textContent = session.scene?.text || 'La historia ha llegado a su conclusión.';
    renderAdventureState(session);
    renderAdventureHistory(session);

    const pendingRoll = session.pendingRoll;
    adventurePendingRoll.classList.toggle('d-none', !pendingRoll);
    adventureChoiceSection.classList.toggle('d-none', Boolean(pendingRoll) || session.status === 'completed');
    adventureCompletedBox.classList.toggle('d-none', session.status !== 'completed');
    if (pendingRoll) {
        adventureRollLabel.textContent = pendingRoll.label || 'Resolver la prueba';
        adventureRollSkill.textContent = `Habilidad: ${displayName(pendingRoll.skill)}`;
    }
    adventureChoices.innerHTML = (session.scene?.choices || []).map(choice => `
        <button type="button" class="adventure-choice-btn" data-choice-id="${escapeHtml(choice.id)}">
            <span class="adventure-choice-number"><i class="fa-solid ${choice.skillCheck ? 'fa-dice-d20' : 'fa-arrow-right'}"></i></span>
            <span><strong>${escapeHtml(choice.text)}</strong>${choice.skillCheck ? '<small>Requiere una tirada de habilidad</small>' : ''}</span>
            <i class="fa-solid fa-chevron-right ms-auto"></i>
        </button>
    `).join('');
    adventureChoices.querySelectorAll('[data-choice-id]').forEach(button => button.addEventListener('click', () => chooseAdventureChoice(button.dataset.choiceId)));
    if (roll) showAdventureRollResult(roll);
    else adventureRollResult.classList.add('d-none');
    adventureSessionPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showAdventureRollResult(roll) {
    const success = roll.outcome === 'success' || roll.success;
    adventureRollResult.className = `adventure-roll-result ${success ? 'success' : 'failure'}`;
    adventureRollResult.innerHTML = `<i class="fa-solid ${success ? 'fa-circle-check' : 'fa-circle-xmark'}"></i><span><strong>${success ? 'Éxito' : 'Fallo'}</strong><small>Resultado ${escapeHtml(roll.total)} contra NO ${escapeHtml(roll.targetNumber)}</small></span>`;
    adventureRollResult.classList.remove('d-none');
}

async function loadAdventureSession(sessionId) {
    try {
        const session = await adventureRequest(`/api/adventure-sessions/${encodeURIComponent(sessionId)}`);
        renderAdventureSession(session);
    } catch (error) {
        appAlert(error.message, 'No se pudo cargar la crónica');
    }
}

async function chooseAdventureChoice(choiceId) {
    if (!currentAdventureSession) return;
    const buttons = [...adventureChoices.querySelectorAll('button')];
    buttons.forEach(button => { button.disabled = true; });
    try {
        const data = await adventureRequest(`/api/adventure-sessions/${currentAdventureSession.id}/choices`, {
            method: 'POST', body: JSON.stringify({ choiceId })
        });
        renderAdventureSession(data.session);
        await loadAdventureModeData(false);
    } catch (error) {
        buttons.forEach(button => { button.disabled = false; });
        appAlert(error.message, 'Decisión no disponible');
    }
}

async function resolveAdventureRoll() {
    if (!currentAdventureSession) return;
    adventureRollBtn.disabled = true;
    adventureRollBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Lanzando…';
    try {
        const data = await adventureRequest(`/api/adventure-sessions/${currentAdventureSession.id}/roll`, { method: 'POST', body: '{}' });
        renderAdventureSession(data.session, data.roll);
        await loadAdventureModeData(false);
    } catch (error) {
        appAlert(error.message, 'No se pudo resolver la tirada');
    } finally {
        adventureRollBtn.disabled = false;
        adventureRollBtn.innerHTML = '<i class="fa-solid fa-dice me-1"></i> Lanzar';
    }
}

async function startAdventure(adventureId = selectedAdventureId) {
    const characterId = adventureCharacterSelect?.value;
    if (!adventureId || !characterId) {
        appAlert('Selecciona una aventura y un personaje antes de comenzar.', 'Preparar crónica');
        return;
    }
    const startButton = adventureList.querySelector(`[data-adventure-id="${CSS.escape(adventureId)}"] .adventure-start-card-btn`);
    if (startButton) startButton.classList.add('fa-spin');
    try {
        const session = await adventureRequest('/api/adventure-sessions', { method: 'POST', body: JSON.stringify({ adventureId, characterId }) });
        renderAdventureSession(session);
        await loadAdventureModeData(false);
    } catch (error) {
        appAlert(error.message, 'No se pudo comenzar la aventura');
    } finally {
        if (startButton) startButton.classList.remove('fa-spin');
    }
}

async function loadAdventureModeData(resetSession = true) {
    if (isLocalFile) {
        adventureList.innerHTML = '<p class="adventure-empty-note">El modo Aventuras necesita una conexión con el servidor.</p>';
        return;
    }
    try {
        const [catalog, characters, sessions] = await Promise.all([
            adventureRequest('/api/adventures'), adventureRequest('/api/adventure-characters'), adventureRequest('/api/adventure-sessions')
        ]);
        adventureCatalog = catalog;
        adventureCharacters = characters;
        adventureSessions = sessions;
        renderAdventureCatalog();
        renderAdventureCharacters();
        renderAdventureSessions();
        if (resetSession) {
            currentAdventureSession = null;
            adventureSessionPanel.classList.add('d-none');
        }
    } catch (error) {
        adventureList.innerHTML = `<p class="adventure-empty-note text-danger">${escapeHtml(error.message)}</p>`;
    }
}

function openAdventureMode() {
    roomSelectionScreen.classList.add('d-none');
    appScreen.classList.add('d-none');
    adventurerScreen.classList.add('d-none');
    adventureScreen.classList.remove('d-none');
    adventureScreen.classList.add('d-block');
    loadAdventureModeData();
}

if (openAdventureModeBtn) openAdventureModeBtn.addEventListener('click', openAdventureMode);
if (adventureBackBtn) adventureBackBtn.addEventListener('click', () => {
    adventureScreen.classList.add('d-none');
    roomSelectionScreen.classList.remove('d-none');
    roomSelectionScreen.classList.add('d-flex');
});
if (adventureRefreshBtn) adventureRefreshBtn.addEventListener('click', () => loadAdventureModeData(false));
if (adventureRollBtn) adventureRollBtn.addEventListener('click', resolveAdventureRoll);
if (adventureRestartBtn) adventureRestartBtn.addEventListener('click', () => startAdventure(currentAdventureSession?.adventure?.id || selectedAdventureId));
if (adventureList) adventureList.addEventListener('dblclick', event => {
    const card = event.target.closest('[data-adventure-id]');
    if (card) startAdventure(card.dataset.adventureId);
});

// Run on page load
initLastSessionSuggestion();
loadCultures();
if (!isLocalFile) fetchAdventurers();

// Join Room
joinBtn.addEventListener('click', () => {
    const user = window.currentUser || currentUser;
    const room = roomnameInput.value.trim();

    if (!user || !room) {
        appAlert("Por favor, escribe el nombre de la sala a la que deseas entrar.");
        return;
    }

    currentUser = user;
    currentRoom = room;
    currentStance = stanceSelect.value || "Posición abierta";

    // Save last session for next time
    saveLastSession(currentUser, currentRoom);

    userDisplay.innerHTML = `<i class="fa-solid fa-user me-1"></i> ${currentUser}`;
    roomDisplay.innerHTML = `<i class="fa-solid fa-landmark me-1"></i> Sala: ${currentRoom}`;
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

    roomSelectionScreen.classList.add('d-none');
    appScreen.classList.remove('d-none');
});

function featDieSortValue(value) { return value === 11 ? -1 : (value === 12 ? 13 : value); }

function calculatePreparedTotal(d12Results, d6Results, request) {
    const d6Total = d6Results.reduce((total, value) => total + value, 0);
    if (!request || request.featDiceMode === 'normal' || d12Results.length < 2) {
        return d12Results.reduce((total, value) => total + value, 0) + d6Total + Number(request?.modifier || 0);
    }
    const selected = request.featDiceMode === 'worst'
        ? d12Results.reduce((a, b) => featDieSortValue(a) < featDieSortValue(b) ? a : b)
        : d12Results.reduce((a, b) => featDieSortValue(a) > featDieSortValue(b) ? a : b);
    return selected + d6Total + Number(request.modifier || 0);
}

function localRoll(request = null) {
    const d12Count = request?.featDice || currentD12Count;
    const d6Count = request?.successDice ?? currentD6Count;
    const d12Results = Array.from({ length: d12Count }, () => Math.floor(Math.random() * 12) + 1);
    const d6Results = Array.from({ length: d6Count }, () => Math.floor(Math.random() * 6) + 1);
    const total = calculatePreparedTotal(d12Results, d6Results, request);
    return {
        id: Date.now(),
        user: currentUser,
        stance: currentStance,
        d12Results,
        d6Results,
        total,
        timestamp: new Date().toLocaleTimeString(),
        ...(request ? { adventurerId: request.adventurerId, adventurerName: request.adventurerName, rollType: request.type, actionKey: request.sourceKey, actionLabel: request.label, targetNumber: request.targetNumber, modifier: request.modifier, hopeSpent: request.hopeSpent, weary: request.weary, illFavoured: request.illFavoured, featDiceMode: request.featDiceMode, effectiveFeatDie: request.featDiceMode === 'normal' ? d12Results[0] : (request.featDiceMode === 'worst' ? d12Results.reduce((a, b) => featDieSortValue(a) < featDieSortValue(b) ? a : b) : d12Results.reduce((a, b) => featDieSortValue(a) > featDieSortValue(b) ? a : b)), outcome: total >= request.targetNumber ? 'success' : 'failure', weapon: request.weapon } : {})
    };
}

function executeRoll(request = null) {
    if (request && !currentRoom) return;
    const d12Count = request?.featDice || currentD12Count;
    const d6Count = request?.successDice ?? currentD6Count;
    const rollData = { room: currentRoom, user: currentUser, stance: currentStance, d12Count, d6Count, rollContext: request };
    if (isLocalFile) {
        const rollEntry = localRoll(request);
        saveLocalHistory(currentRoom, rollEntry);
        document.querySelector('.empty-msg')?.remove();
        addRollToUI(rollEntry, true);
        scrollToBottom();
    } else {
        socket.emit('roll-dice', rollData);
    }
}

// Roll Dice
rollBtn.addEventListener('click', () => executeRoll());
guidedRollConfirm?.addEventListener('click', () => {
    try { executeRoll(JSON.parse(guidedRollConfirm.dataset.request || 'null')); }
    catch (_) { appAlert('No se pudo preparar esta tirada.', 'Tirada no válida'); }
});

// Clear History
clearHistoryBtn.addEventListener('click', () => {
    appConfirm("¿Seguro que quieres borrar todo el historial de esta sala?", 'Borrar historial').then(confirmed => { if (confirmed) {
        if (isLocalFile) {
            localStorage.setItem(`rpg_history_${currentRoom}`, JSON.stringify([]));
            historyList.innerHTML = "";
            renderEmptyMessage();
        } else {
            socket.emit('clear-history', currentRoom);
        }
    } });
});

// Leave Room
leaveBtn.addEventListener('click', () => {
    appConfirm("¿Seguro que quieres salir de la sala?", 'Salir de la sala').then(confirmed => { if (confirmed) {
        if (!isLocalFile) {
            window.location.reload();
        } else {
            roomSelectionScreen.classList.remove('d-none');
            appScreen.classList.add('d-none');
            currentUser = "";
            currentRoom = "";
        }
    } });
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

        battleZones.forEach(zone => {
            const zoneStance = zone.getAttribute('data-stance');
            zone.classList.toggle('is-my-zone', zoneStance === currentStance);
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
                playersVanguardia.appendChild(chip); zoneCounts['Posición de vanguardia']++;
            } else if (stance === 'Posición defensiva') {
                playersDefensiva.appendChild(chip); zoneCounts['Posición defensiva']++;
            } else if (stance === 'Posición de retaguardia') {
                playersRetaguardia.appendChild(chip); zoneCounts['Posición de retaguardia']++;
            } else {
                playersAbierta.appendChild(chip); zoneCounts['Posición abierta']++;
            }
        });

        if (zoneCounts['Posición de vanguardia'] === 0) playersVanguardia.innerHTML = '<span class="empty-zone-placeholder"><i class="fa-regular fa-circle-dot me-1"></i>Sin aventureros en vanguardia</span>';
        if (zoneCounts['Posición abierta'] === 0) playersAbierta.innerHTML = '<span class="empty-zone-placeholder"><i class="fa-regular fa-circle-dot me-1"></i>Sin aventureros en posición abierta</span>';
        if (zoneCounts['Posición defensiva'] === 0) playersDefensiva.innerHTML = '<span class="empty-zone-placeholder"><i class="fa-regular fa-circle-dot me-1"></i>Sin aventureros en posición defensiva</span>';
        if (zoneCounts['Posición de retaguardia'] === 0) playersRetaguardia.innerHTML = '<span class="empty-zone-placeholder"><i class="fa-regular fa-circle-dot me-1"></i>Sin aventureros en retaguardia</span>';
    }
}

function setupSocketListeners() {
socket.on('load-history', (history) => {
    historyList.innerHTML = "";
    if (history.length === 0) renderEmptyMessage();
    else { history.forEach(roll => addRollToUI(roll, false)); scrollToBottom(); }
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

socket.on('roll-error', (message) => {
    appAlert(message || 'No se pudo lanzar la tirada.', 'Tirada no válida');
});

socket.on('disconnect', () => {
    console.warn("Desconectado del servidor");
});

socket.on('update-room-users', (users) => {
    renderUsersList(users);
});

socket.on('room-deleted', () => {
     appAlert("Esta sala ha sido eliminada por un administrador.").then(() => window.location.reload());
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
            appConfirm(`¿Eliminar la sala "${room}" y todo su historial?`, 'Eliminar sala').then(confirmed => { if (confirmed) {
                if (isLocalFile) {
                    localStorage.removeItem(`rpg_history_${room}`);
                    item.remove();
                    if (roomList.children.length === 0) roomListContainer.classList.add('d-none');
                } else {
                    socket.emit('delete-room', room);
                }
            } });
        };

        item.appendChild(nameSpan);
        item.appendChild(deleteBtn);
        roomList.appendChild(item);
    });
});
}

function addRollToUI(roll, isNew) {
    const card = document.createElement('div');
    card.className = `roll-card p-3 ${isNew ? 'animate-slide-in' : ''}`;

    const d12Results = roll.d12Results || [];
    const d6Results = roll.d6Results || [];
    
    const allDiceTotal = [...d12Results, ...d6Results].reduce((total, value) => total + value, 0);
    const d6Total = d6Results.reduce((total, value) => total + value, 0);
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

    const isContextualRoll = Boolean(roll.rollType && roll.actionLabel);
    const outcomeLabel = roll.outcome === 'success' ? 'ÉXITO' : (roll.outcome === 'failure' ? 'FALLO' : 'RESULTADO');
    const outcomeClass = roll.outcome === 'success' ? 'text-success' : (roll.outcome === 'failure' ? 'text-danger' : '');
    const contextualDetails = isContextualRoll
        ? `<div class="roll-context-line"><strong>${escapeHtml(roll.adventurerName || roll.user)} · ${escapeHtml(roll.actionLabel)}</strong>${roll.weapon ? ` <span>· Daño ${escapeHtml(roll.weapon.damage)} · Herida ${escapeHtml(roll.weapon.injury)}</span>` : ''}<span class="text-muted"> · ${roll.total} contra NO ${roll.targetNumber}</span></div>`
        : '';

    const totalsMarkup = isContextualRoll
        ? `
            <div class="total-badge ${roll.outcome === 'success' ? 'border-success' : (roll.outcome === 'failure' ? 'border-danger' : '')}">
                <span class="total-val ${outcomeClass}">${roll.total}</span>
                <span class="total-label ${outcomeClass}">${outcomeLabel}</span>
            </div>
        `
        : d12Results.length === 2
        ? `
            <div class="total-badge border-success">
                <span class="total-val text-success">${maxD12 + d6Total}</span>
                <span class="total-label">TOTAL MÁXIMO</span>
            </div>
            <div class="total-badge border-danger">
                <span class="total-val text-danger">${minD12 + d6Total}</span>
                <span class="total-label">TOTAL MÍNIMO</span>
            </div>
        `
        : `
            <div class="total-badge">
                <span class="total-val">${allDiceTotal}</span>
                <span class="total-label">TOTAL</span>
            </div>
        `;

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
                <div class="fw-bold text-dark mb-1 d-flex align-items-center flex-wrap">
                    <span>${escapeHtml(roll.user)}</span>
                    ${stancePill}
                    <span class="text-muted fw-normal ms-2" style="font-size: 0.75rem;">${roll.timestamp}</span>
                </div>
                ${contextualDetails}
                ${d12Str}
                ${d6Str}
            </div>
            <div class="total-badge-container">
                ${totalsMarkup}
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

