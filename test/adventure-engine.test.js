const test = require('node:test');
const assert = require('node:assert/strict');
const { AdventureEngine } = require('../services/adventure-engine');
const { loadAdventure } = require('../services/adventure-loader');

const fixedClock = () => new Date('2026-01-01T00:00:00.000Z');
const character = {
    ficha: {
        estadisticas: {
            esperanza: { actual: 11, maxima: 11 },
            aguante: { actual: 25, maximo: 25 }
        }
    }
};

test('carga la aventura técnica de tres escenas', () => {
    const adventure = loadAdventure('road-to-bree-prototype');
    assert.equal(adventure.startSceneId, 'road');
    assert.equal(adventure.scenes.length, 3);
    assert.equal(adventure.scenes[0].choices.length, 2);
});

test('una elección con habilidad queda pendiente y el éxito cambia de escena', () => {
    const adventure = loadAdventure('road-to-bree-prototype');
    const engine = new AdventureEngine(adventure, fixedClock);
    const session = engine.createSession({ sessionId: 'session-1', characterId: 'default:arathion', character });

    const pending = engine.chooseChoice(session, 'search-tracks');
    assert.equal(pending.status, 'pending-roll');
    assert.equal(pending.session.pendingRoll.skill, 'explorar');

    const resolved = engine.resolvePendingRoll(pending.session, {
        success: true,
        total: 18,
        outcome: 'success'
    });
    assert.equal(resolved.session.currentSceneId, 'tracks-found');
    assert.equal(resolved.session.storyFlags.discoveredOrcTracks, true);
    assert.equal(resolved.session.status, 'completed');
    assert.equal(resolved.session.pendingRoll, null);
    assert.ok(resolved.session.history.some(entry => entry.type === 'ROLL' && /Éxito/.test(entry.text)));

    const failedSession = engine.createSession({ sessionId: 'session-2', characterId: 'default:arathion', character });
    const failedPending = engine.chooseChoice(failedSession, 'search-tracks');
    const failed = engine.resolvePendingRoll(failedPending.session, { success: false, total: 3, outcome: 'failure' });
    assert.equal(failed.session.currentSceneId, 'tracks-missed');
    assert.equal(failed.session.storyFlags.discoveredOrcTracks, false);
});

test('las condiciones y acciones se validan en el motor', () => {
    const adventure = {
        id: 'conditions-test',
        title: 'Condiciones',
        startSceneId: 'start',
        scenes: [
            {
                id: 'start',
                text: 'Inicio',
                choices: [
                    { id: 'hidden', text: 'Oculta', nextSceneId: 'end', conditions: [{ flag: 'seen', operator: 'equals', value: true }] },
                    { id: 'set', text: 'Activar', nextSceneId: 'end', actions: [{ type: 'SET_FLAG', key: 'seen', value: true }] }
                ]
            },
            { id: 'end', text: 'Fin', choices: [] }
        ]
    };
    const engine = new AdventureEngine(adventure, fixedClock);
    const session = engine.createSession({ characterId: 'default:test', character });

    assert.deepEqual(engine.getAvailableChoices(engine.getScene('start'), session.storyFlags).map(choice => choice.id), ['set']);
    const result = engine.chooseChoice(session, 'set');
    assert.equal(result.session.storyFlags.seen, true);
});
