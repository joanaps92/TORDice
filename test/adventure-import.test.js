const test = require('node:test');
const assert = require('node:assert/strict');
const { templateAdventure, toEngineAdventure } = require('../services/adventure-contract');
const { parseAdventureJson, importAdventure } = require('../services/adventure-import-service');
const { validateAdventureDocument } = require('../services/adventure-validator');

test('la plantilla generada es válida y contiene métricas útiles', () => {
    const result = validateAdventureDocument(templateAdventure());
    assert.equal(result.valid, true);
    assert.deepEqual(result.stats, { scenes: 4, rolls: 1, terminals: 2, reachable: 4 });
});

test('el validador informa referencias, finales con decisiones e inaccesibles', () => {
    const adventure = templateAdventure();
    adventure.escenas[0].decisiones[0].destino = 'no-existe';
    adventure.escenas[2].terminal = true;
    adventure.escenas[2].decisiones = [{ texto: 'Romper regla', destino: 'inicio' }];
    adventure.escenas.push({ id: 'rama-muerta', titulo: 'Rama muerta', texto: 'Nunca se alcanza.', terminal: true, decisiones: [] });
    const result = validateAdventureDocument(adventure);
    assert.equal(result.valid, false);
    assert.match(result.errors.find(error => error.code === 'MISSING_REFERENCE').message, /no-existe/);
    assert.ok(result.errors.some(error => error.code === 'TERMINAL_CONTENT'));
    assert.ok(result.errors.some(error => error.code === 'UNREACHABLE_SCENE'));
});

test('importa JSON en texto y normaliza la tirada de escena al motor', () => {
    const imported = importAdventure(JSON.stringify(templateAdventure()));
    assert.equal(imported.normalized.startSceneId, 'inicio');
    const rollScene = imported.normalized.scenes.find(scene => scene.id === 'sendero');
    assert.equal(rollScene.choices[0].skillCheck.skill, 'explorar');
    assert.equal(rollScene.choices[0].skillCheck.difficulty, 14);
});

test('los documentos con JSON incorrecto devuelven un error concreto', () => {
    assert.throws(() => parseAdventureJson('{"titulo":}'), /JSON no es válido/);
});

test('mantiene compatibilidad con el contrato antiguo', () => {
    const old = {
        id: 'legacy', title: 'Antigua', startSceneId: 'start', scenes: [
            { id: 'start', title: 'Inicio', text: 'Texto', choices: [{ id: 'end', text: 'Fin', nextSceneId: 'end' }] },
            { id: 'end', title: 'Fin', text: 'Fin', choices: [] }
        ]
    };
    const imported = importAdventure(old);
    assert.equal(imported.canonical.schemaVersion, 1);
    assert.equal(toEngineAdventure(imported.canonical).scenes.length, 2);
});
