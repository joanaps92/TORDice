const { SKILL_ATTRIBUTES } = require('./dice-engine');

const SUPPORTED_SCHEMA_VERSION = 1;
const VALID_SKILLS = new Set(Object.values(SKILL_ATTRIBUTES).flat());
const VALID_ROLL_TYPES = new Set(['habilidad']);

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeSkill(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function slugify(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'aventura-sin-titulo';
}

function templateAdventure() {
    return {
        id: 'aventura-ejemplo',
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
        titulo: 'Título de la aventura',
        descripcion: 'Breve descripción de la aventura.',
        ambientacion: 'Eriador, Tercera Edad',
        duracion: '30-45 minutos',
        dificultad: 'Media',
        tema: ['viaje', 'investigacion'],
        tono: ['misterioso', 'melancolico'],
        escenaInicial: 'inicio',
        escenas: [
            {
                id: 'inicio',
                titulo: 'El comienzo',
                texto: 'Texto que verá el jugador.',
                terminal: false,
                decisiones: [{ id: 'seguir', texto: 'Seguir el sendero', destino: 'sendero' }]
            },
            {
                id: 'sendero',
                titulo: 'El sendero',
                texto: 'El camino desaparece entre los árboles.',
                terminal: false,
                decisiones: [],
                tirada: {
                    tipo: 'habilidad',
                    habilidad: 'Explorar',
                    dificultad: 14,
                    exito: 'final-exito',
                    fracaso: 'final-fracaso'
                }
            },
            { id: 'final-exito', titulo: 'Un camino seguro', texto: 'Has encontrado el camino.', terminal: true, decisiones: [] },
            { id: 'final-fracaso', titulo: 'Perdido entre las sombras', texto: 'El camino se pierde en el bosque.', terminal: true, decisiones: [] }
        ]
    };
}

function toCanonicalAdventure(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
    if (Array.isArray(input.escenas) || input.titulo || input.escenaInicial) return clone(input);

    // Compatibility adapter for adventures authored with the original engine contract.
    return {
        _legacy: true,
        id: input.id,
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
        titulo: input.title,
        descripcion: input.description || 'Aventura importada desde el formato anterior.',
        ambientacion: input.setting || 'Sin ambientación indicada',
        duracion: input.duration || 'Duración variable',
        dificultad: input.difficulty || 'Sin clasificar',
        tema: input.theme || [],
        tono: input.tone || [],
        escenaInicial: input.startSceneId,
        escenas: (input.scenes || []).map(scene => ({
            id: scene.id,
            titulo: scene.title || '',
            texto: scene.text,
            terminal: scene.terminal !== undefined ? Boolean(scene.terminal) : !(scene.choices || []).length,
            accionesEntrada: scene.onEnter || [],
            decisiones: (scene.choices || []).map(choice => ({
                id: choice.id,
                texto: choice.text,
                destino: choice.nextSceneId,
                tirada: choice.skillCheck ? {
                    tipo: 'habilidad',
                    habilidad: choice.skillCheck.skill,
                    dificultad: choice.skillCheck.difficulty,
                    exito: choice.skillCheck.successSceneId,
                    fracaso: choice.skillCheck.failureSceneId
                } : undefined,
                condiciones: choice.conditions,
                acciones: choice.actions
            }))
        }))
    };
}

function toEngineAdventure(input) {
    const adventure = toCanonicalAdventure(input);
    return {
        id: adventure.id || slugify(adventure.titulo),
        title: adventure.titulo,
        description: adventure.descripcion || '',
        duration: adventure.duracion || '',
        difficulty: adventure.dificultad || '',
        startSceneId: adventure.escenaInicial,
        scenes: (adventure.escenas || []).map(scene => ({
            id: scene.id,
            title: scene.titulo || '',
            text: scene.texto,
            terminal: Boolean(scene.terminal),
            onEnter: scene.accionesEntrada || [],
            choices: (scene.decisiones || []).map((decision, index) => ({
                id: decision.id || `${scene.id}-decision-${index + 1}`,
                text: decision.texto,
                nextSceneId: decision.destino,
                skillCheck: decision.tirada ? {
                    skill: normalizeSkill(decision.tirada.habilidad),
                    difficulty: decision.tirada.dificultad,
                    successSceneId: decision.tirada.exito,
                    failureSceneId: decision.tirada.fracaso
                } : undefined,
                conditions: decision.condiciones || [],
                actions: decision.acciones || []
            })).concat(scene.tirada ? [{
                id: `${scene.id}-tirada`,
                text: scene.tirada.texto || `Resolver prueba de ${scene.tirada.habilidad}`,
                skillCheck: {
                    skill: normalizeSkill(scene.tirada.habilidad),
                    difficulty: scene.tirada.dificultad,
                    successSceneId: scene.tirada.exito,
                    failureSceneId: scene.tirada.fracaso
                },
                actions: scene.tirada.acciones || []
            }] : [])
        }))
    };
}

module.exports = {
    SUPPORTED_SCHEMA_VERSION,
    VALID_ROLL_TYPES,
    VALID_SKILLS,
    clone,
    normalizeSkill,
    slugify,
    templateAdventure,
    toCanonicalAdventure,
    toEngineAdventure
};
