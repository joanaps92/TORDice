const { validateAdventureDocument } = require('./adventure-validator');
const { toEngineAdventure, toCanonicalAdventure, clone } = require('./adventure-contract');

function parseAdventureJson(value) {
    if (typeof value === 'object' && value !== null) return clone(value);
    try { return JSON.parse(String(value || '')); }
    catch (error) {
        const syntax = error.message.match(/position (\d+)/i)?.[1];
        const wrapped = new Error(`El JSON no es válido${syntax ? ` (posición ${syntax})` : ''}.`);
        wrapped.code = 'INVALID_JSON';
        throw wrapped;
    }
}

function importAdventure(value) {
    const originalJson = parseAdventureJson(value);
    const result = validateAdventureDocument(originalJson);
    if (!result.valid) {
        const error = new Error('La aventura no supera la validación.');
        error.code = 'ADVENTURE_VALIDATION';
        error.validation = result;
        throw error;
    }
    const canonical = toCanonicalAdventure(result.adventure);
    delete canonical._legacy;
    return { originalJson, canonical, normalized: toEngineAdventure(canonical), validation: result };
}

module.exports = { parseAdventureJson, importAdventure };
