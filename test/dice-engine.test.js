const test = require('node:test');
const assert = require('node:assert/strict');
const { getSkillRollProfile, resolveSkillRoll } = require('../services/dice-engine');

const ficha = {
    trancos: false,
    atributos: { mente: { valor: 5, tn: 15 } },
    habilidades: { mente: { explorar: { rango: 2, favorecida: false } } }
};

function sequence(...values) {
    const pending = [...values];
    return () => pending.shift() ?? 0;
}

test('prepara una tirada de habilidad usando la ficha real', () => {
    const profile = getSkillRollProfile(ficha, 'explorar');

    assert.equal(profile.attributeKey, 'mente');
    assert.equal(profile.successDice, 2);
    assert.equal(profile.featDice, 1);
    assert.equal(profile.targetNumber, 15);
});

test('resuelve fallo y éxito sin duplicar la lógica de dados', () => {
    const failure = resolveSkillRoll({ ficha, sourceKey: 'explorar', random: sequence(0, 0, 0) });
    assert.equal(failure.total, 3);
    assert.equal(failure.outcome, 'failure');
    assert.equal(failure.success, false);

    const success = resolveSkillRoll({ ficha, sourceKey: 'explorar', random: sequence(0.99, 0.99, 0.99) });
    assert.equal(success.total, 24);
    assert.equal(success.outcome, 'success');
    assert.equal(success.success, true);
});

test('la habilidad favorecida usa dos dados de proeza', () => {
    const favoredFicha = {
        ...ficha,
        habilidades: { mente: { explorar: { rango: 0, favorecida: true } } }
    };
    const result = resolveSkillRoll({ ficha: favoredFicha, sourceKey: 'explorar', random: sequence(0, 0.99) });

    assert.deepEqual(result.d12Results, [1, 12]);
    assert.equal(result.effectiveFeatDie, 12);
    assert.equal(result.featDiceMode, 'best');
});
