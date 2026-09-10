const SKILL_ATTRIBUTES = Object.freeze({
    fuerza: ['impresionar', 'atletismo', 'alerta', 'cazar', 'cantar', 'oficio'],
    corazon: ['alentar', 'viajar', 'perspicacia', 'curar', 'cortesia', 'guerrear'],
    mente: ['persuadir', 'sigilo', 'inspeccionar', 'explorar', 'acertijos', 'saber']
});

const COMBAT_ALIASES = Object.freeze({
    hacha: 'hachas', hachas: 'hachas',
    arco: 'arcos', arcos: 'arcos',
    lanza: 'lanzas', lanzas: 'lanzas',
    espada: 'espadas', espadas: 'espadas',
    pelea: 'pelea'
});

function normalizeCombatKey(value) {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    return COMBAT_ALIASES[normalized] || normalized;
}

function getSkillDefinition(sourceKey) {
    const key = String(sourceKey || '').trim();
    const attributeKey = Object.entries(SKILL_ATTRIBUTES)
        .find(([, skills]) => skills.includes(key))?.[0];
    return attributeKey ? { sourceKey: key, attributeKey } : null;
}

function getSkillRollProfile(ficha, sourceKey, modifiers = {}) {
    const definition = getSkillDefinition(sourceKey);
    const skill = definition && ficha?.habilidades?.[definition.attributeKey]?.[definition.sourceKey];
    const attribute = definition && ficha?.atributos?.[definition.attributeKey];
    if (!definition || !skill || !attribute) return null;

    const favored = Boolean(skill.favorecida);
    const illFavoured = Boolean(modifiers.illFavoured);
    const hopeSpent = Boolean(modifiers.hopeSpent);
    const hopeBonus = hopeSpent ? Math.max(0, Number(attribute.valor) || 0) : 0;
    const baseTarget = ficha.trancos ? 18 : 20;
    const targetNumber = Number.isFinite(Number(attribute.tn))
        ? Number(attribute.tn)
        : baseTarget - (Number(attribute.valor) || 0);

    return {
        ...definition,
        label: definition.sourceKey,
        attributeValue: Number(attribute.valor) || 0,
        successDice: Math.max(0, Math.min(6, Math.trunc(Number(skill.rango) || 0))),
        featDice: illFavoured || favored ? 2 : 1,
        featDiceMode: illFavoured ? 'worst' : (favored ? 'best' : 'normal'),
        targetNumber: Math.max(0, targetNumber),
        hopeBonus,
        modifier: Number(modifiers.modifier) || 0
    };
}

function effectiveFeatDie(d12Results, featDiceMode) {
    if (featDiceMode === 'normal' || d12Results.length < 2) {
        return d12Results.reduce((total, value) => total + value, 0);
    }

    const sortValue = value => value === 11 ? -1 : (value === 12 ? 13 : value);
    return d12Results.reduce((selected, value) => {
        if (featDiceMode === 'worst') return sortValue(selected) < sortValue(value) ? selected : value;
        return sortValue(selected) > sortValue(value) ? selected : value;
    });
}

function rollDice({ d12Count, d6Count, modifier = 0, featDiceMode = 'normal', random = Math.random }) {
    if (!Number.isInteger(d12Count) || d12Count < 1 || d12Count > 2) {
        throw new Error('La tirada debe tener uno o dos dados de proeza.');
    }
    if (!Number.isInteger(d6Count) || d6Count < 0 || d6Count > 6) {
        throw new Error('La tirada debe tener entre cero y seis dados de éxito.');
    }
    if (!['normal', 'best', 'worst'].includes(featDiceMode)) {
        throw new Error('La modalidad del dado de proeza no es válida.');
    }

    const d12Results = Array.from({ length: d12Count }, () => Math.floor(random() * 12) + 1);
    const d6Results = Array.from({ length: d6Count }, () => Math.floor(random() * 6) + 1);
    const effectiveDie = effectiveFeatDie(d12Results, featDiceMode);
    const total = effectiveDie + d6Results.reduce((sum, value) => sum + value, 0) + Number(modifier || 0);

    return {
        d12Results,
        d6Results,
        effectiveFeatDie: effectiveDie,
        total,
        modifier: Number(modifier || 0)
    };
}

function resolveSkillRoll({ ficha, sourceKey, modifiers = {}, random = Math.random }) {
    const profile = getSkillRollProfile(ficha, sourceKey, modifiers);
    if (!profile) return null;

    const roll = rollDice({
        d12Count: profile.featDice,
        d6Count: profile.successDice,
        modifier: profile.modifier + profile.hopeBonus,
        featDiceMode: profile.featDiceMode,
        random
    });

    return {
        ...profile,
        ...roll,
        success: roll.total >= profile.targetNumber,
        failure: roll.total < profile.targetNumber,
        outcome: roll.total >= profile.targetNumber ? 'success' : 'failure'
    };
}

module.exports = {
    SKILL_ATTRIBUTES,
    normalizeCombatKey,
    getSkillDefinition,
    getSkillRollProfile,
    rollDice,
    resolveSkillRoll
};
