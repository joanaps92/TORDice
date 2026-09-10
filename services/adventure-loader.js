const fs = require('fs');
const path = require('path');

const ADVENTURES_DIR = path.join(__dirname, '..', 'data', 'adventures');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertAdventureId(id) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(String(id || ''))) {
        throw new Error('Identificador de aventura no válido.');
    }
}

function validateAdventure(adventure) {
    if (!adventure || typeof adventure !== 'object') throw new Error('La aventura no es válida.');
    if (!adventure.id || !adventure.title || !adventure.startSceneId || !Array.isArray(adventure.scenes)) {
        throw new Error('La aventura debe incluir id, title, startSceneId y scenes.');
    }

    const sceneIds = new Set();
    adventure.scenes.forEach(scene => {
        if (!scene.id || sceneIds.has(scene.id)) throw new Error(`Escena duplicada o sin id: ${scene.id || '(vacía)'}`);
        sceneIds.add(scene.id);
        if (typeof scene.text !== 'string' || !Array.isArray(scene.choices)) {
            throw new Error(`La escena ${scene.id} no tiene un formato válido.`);
        }
        const choiceIds = new Set();
        scene.choices.forEach(choice => {
            if (!choice.id || choiceIds.has(choice.id)) throw new Error(`Decisión duplicada en la escena ${scene.id}.`);
            choiceIds.add(choice.id);
        });
    });

    if (!sceneIds.has(adventure.startSceneId)) throw new Error('La escena inicial no existe.');
    const validateActions = (actions, context) => (actions || []).forEach(action => {
        if (!['SET_FLAG', 'ADD_HOPE', 'REMOVE_HOPE', 'ADD_ENDURANCE', 'REMOVE_ENDURANCE'].includes(action.type)) {
            throw new Error(`La acción de ${context} no está permitida.`);
        }
    });

    adventure.scenes.forEach(scene => {
        validateActions(scene.onEnter, `la escena ${scene.id}`);
        scene.choices.forEach(choice => {
        if (choice.nextSceneId && !sceneIds.has(choice.nextSceneId)) {
            throw new Error(`La decisión ${choice.id} apunta a una escena inexistente.`);
        }
        if (choice.skillCheck) {
            const { skill, successSceneId, failureSceneId } = choice.skillCheck;
            if (!skill || !sceneIds.has(successSceneId) || !sceneIds.has(failureSceneId)) {
                throw new Error(`La tirada de la decisión ${choice.id} no tiene destinos válidos.`);
            }
        } else if (!choice.nextSceneId) {
            throw new Error(`La decisión ${choice.id} no tiene destino.`);
        }
        (choice.conditions || []).forEach(condition => {
            if (!condition.flag || !['equals', 'notEquals'].includes(condition.operator)) {
                throw new Error(`La condición de la decisión ${choice.id} no es válida.`);
            }
        });
        validateActions(choice.actions, `la decisión ${choice.id}`);
        });
    });
    return adventure;
}

function loadAdventure(id) {
    assertAdventureId(id);
    const adventure = validateAdventure(readJson(path.join(ADVENTURES_DIR, `${id}.json`)));
    if (adventure.id !== id) throw new Error('El id del archivo no coincide con el id de la aventura.');
    return adventure;
}

function listAdventures() {
    const indexPath = path.join(ADVENTURES_DIR, 'index.json');
    return readJson(indexPath);
}

function loadDefaultCharacters() {
    return readJson(path.join(__dirname, '..', 'data', 'default-characters.json'));
}

function getDefaultCharacter(id) {
    return loadDefaultCharacters().find(character => character.id === id) || null;
}

module.exports = { listAdventures, loadAdventure, validateAdventure, getDefaultCharacter };
