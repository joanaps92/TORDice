const {
    SUPPORTED_SCHEMA_VERSION,
    VALID_ROLL_TYPES,
    VALID_SKILLS,
    normalizeSkill,
    toCanonicalAdventure,
    slugify
} = require('./adventure-contract');

const errors = (code, message, path) => ({ code, message, path });

function validateAdventureDocument(input) {
    const adventure = toCanonicalAdventure(input);
    const validationErrors = [];
    const warnings = [];
    const scenes = Array.isArray(adventure?.escenas) ? adventure.escenas : [];
    const legacyFormat = Boolean(adventure?._legacy);
    const sceneIds = new Set();

    if (!adventure || typeof adventure !== 'object' || Array.isArray(adventure)) {
        return { valid: false, errors: [errors('ADVENTURE_OBJECT', 'La aventura debe ser un objeto JSON.', '$')], warnings, stats: emptyStats() };
    }
    if (adventure.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
        validationErrors.push(errors('SCHEMA_VERSION', `schemaVersion debe ser ${SUPPORTED_SCHEMA_VERSION}.`, '$.schemaVersion'));
    }
    if (!adventure.id) adventure.id = slugify(adventure.titulo);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(String(adventure.id))) {
        validationErrors.push(errors('ADVENTURE_ID', 'El id debe usar minúsculas, números y guiones.', '$.id'));
    }
    for (const [field, label] of [['titulo', 'título'], ['descripcion', 'descripción'], ['ambientacion', 'ambientación'], ['duracion', 'duración'], ['dificultad', 'dificultad'], ['escenaInicial', 'escena inicial']]) {
        if (typeof adventure[field] !== 'string' || !adventure[field].trim()) {
            validationErrors.push(errors('REQUIRED_FIELD', `Falta el campo obligatorio ${label}.`, `$.${field}`));
        }
    }
    for (const field of ['tema', 'tono']) {
        if (adventure[field] !== undefined && (!Array.isArray(adventure[field]) || adventure[field].some(item => typeof item !== 'string'))) {
            validationErrors.push(errors('ARRAY_FIELD', `${field} debe ser un array de textos.`, `$.${field}`));
        }
    }
    if (!Array.isArray(adventure.escenas) || adventure.escenas.length === 0) {
        validationErrors.push(errors('SCENES_REQUIRED', 'La aventura debe contener al menos una escena.', '$.escenas'));
    }

    scenes.forEach((scene, index) => {
        const path = `$.escenas[${index}]`;
        if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
            validationErrors.push(errors('SCENE_OBJECT', 'La escena debe ser un objeto.', path));
            return;
        }
        if (!scene.id || typeof scene.id !== 'string') validationErrors.push(errors('SCENE_ID', 'La escena necesita un id.', `${path}.id`));
        else if (sceneIds.has(scene.id)) validationErrors.push(errors('DUPLICATE_SCENE', `La escena "${scene.id}" está repetida.`, `${path}.id`));
        else sceneIds.add(scene.id);
        if (typeof scene.titulo !== 'string' || !scene.titulo.trim()) validationErrors.push(errors('SCENE_TITLE', `La escena ${scene.id || '(sin id)'} necesita título.`, `${path}.titulo`));
        if (typeof scene.texto !== 'string') validationErrors.push(errors('SCENE_TEXT', `La escena ${scene.id || '(sin id)'} necesita texto.`, `${path}.texto`));
        if (scene.terminal !== undefined && typeof scene.terminal !== 'boolean') validationErrors.push(errors('SCENE_TERMINAL', 'terminal debe ser booleano.', `${path}.terminal`));
        if (scene.decisiones !== undefined && !Array.isArray(scene.decisiones)) validationErrors.push(errors('DECISIONS_ARRAY', 'decisiones debe ser un array.', `${path}.decisiones`));
        if (scene.tirada !== undefined) validateRoll(scene.tirada, `${path}.tirada`, validationErrors);
        if (scene.terminal && ((scene.decisiones || []).length || scene.tirada)) validationErrors.push(errors('TERMINAL_CONTENT', `La escena ${scene.id} está marcada como terminal pero contiene decisiones o tirada.`, path));
        const decisionIds = new Set();
        (scene.decisiones || []).forEach((decision, decisionIndex) => {
            const decisionPath = `${path}.decisiones[${decisionIndex}]`;
            if (!decision || typeof decision !== 'object') {
                validationErrors.push(errors('DECISION_OBJECT', 'La decisión debe ser un objeto.', decisionPath));
                return;
            }
            if (decision.id) {
                if (decisionIds.has(decision.id)) validationErrors.push(errors('DUPLICATE_DECISION', `La decisión ${decision.id} está repetida en la escena ${scene.id}.`, `${decisionPath}.id`));
                decisionIds.add(decision.id);
            }
            if (typeof decision.texto !== 'string' || !decision.texto.trim()) validationErrors.push(errors('DECISION_TEXT', 'La decisión necesita texto.', `${decisionPath}.texto`));
            if ((!decision.tirada && (typeof decision.destino !== 'string' || !decision.destino.trim()))) validationErrors.push(errors('DECISION_DESTINATION', `La decisión de la escena ${scene.id} no tiene destino.`, `${decisionPath}.destino`));
            if (decision.tirada) validateRoll(decision.tirada, `${decisionPath}.tirada`, validationErrors, legacyFormat);
        });
    });

    if (adventure.escenaInicial && sceneIds.size && !sceneIds.has(adventure.escenaInicial)) {
        validationErrors.push(errors('START_SCENE', `La escena inicial "${adventure.escenaInicial}" no existe.`, '$.escenaInicial'));
    }

    const references = [];
    scenes.forEach(scene => {
        (scene.decisiones || []).forEach(decision => {
            if (decision.destino) references.push([decision.destino, `La decisión de la escena ${scene.id} referencia una escena inexistente "${decision.destino}".`, `escena ${scene.id}`]);
            if (decision.tirada) references.push([decision.tirada.exito, `La tirada de la escena ${scene.id} referencia una escena inexistente "${decision.tirada.exito}".`, `escena ${scene.id}`]);
            if (decision.tirada) references.push([decision.tirada.fracaso, `La tirada de la escena ${scene.id} referencia una escena inexistente "${decision.tirada.fracaso}".`, `escena ${scene.id}`]);
        });
        if (scene.tirada) {
            references.push([scene.tirada.exito, `La tirada de la escena ${scene.id} referencia una escena inexistente "${scene.tirada.exito}".`, `escena ${scene.id}`]);
            references.push([scene.tirada.fracaso, `La tirada de la escena ${scene.id} referencia una escena inexistente "${scene.tirada.fracaso}".`, `escena ${scene.id}`]);
        }
    });
    references.forEach(([destination, message, context]) => {
        if (!destination || !sceneIds.has(destination)) validationErrors.push(errors('MISSING_REFERENCE', message, context));
    });

    const reachable = new Set();
    if (sceneIds.has(adventure.escenaInicial)) {
        const queue = [adventure.escenaInicial];
        while (queue.length) {
            const id = queue.shift();
            if (reachable.has(id)) continue;
            reachable.add(id);
            const scene = scenes.find(item => item.id === id);
            if (!scene) continue;
            const destinations = (scene.decisiones || []).flatMap(decision => [decision.destino, decision.tirada?.exito, decision.tirada?.fracaso]).concat(scene.tirada ? [scene.tirada.exito, scene.tirada.fracaso] : []);
            destinations.filter(destination => sceneIds.has(destination)).forEach(destination => queue.push(destination));
        }
    }
    scenes.filter(scene => scene.id && !reachable.has(scene.id)).forEach(scene => {
        validationErrors.push(errors('UNREACHABLE_SCENE', `La escena "${scene.id}" es inaccesible desde la escena inicial.`, `$.escenas[${scenes.indexOf(scene)}]`));
    });

    const stats = {
        scenes: scenes.length,
        rolls: scenes.filter(scene => scene.tirada).length + scenes.reduce((count, scene) => count + (scene.decisiones || []).filter(decision => decision.tirada).length, 0),
        terminals: scenes.filter(scene => scene.terminal).length,
        reachable: reachable.size
    };
    return { valid: validationErrors.length === 0, errors: validationErrors, warnings, stats, adventure };
}

function validateRoll(roll, path, validationErrors, legacyFormat = false) {
    if (!roll || typeof roll !== 'object') {
        validationErrors.push(errors('ROLL_OBJECT', 'La tirada debe ser un objeto.', path));
        return;
    }
    if (!VALID_ROLL_TYPES.has(roll.tipo)) validationErrors.push(errors('ROLL_TYPE', 'El tipo de tirada debe ser "habilidad".', `${path}.tipo`));
    if (!VALID_SKILLS.has(normalizeSkill(roll.habilidad))) validationErrors.push(errors('ROLL_SKILL', `La habilidad "${roll.habilidad || ''}" no es válida para EAU 2ª.`, `${path}.habilidad`));
    if (!(legacyFormat && roll.dificultad === undefined) && (!Number.isInteger(roll.dificultad) || roll.dificultad < 1 || roll.dificultad > 30)) validationErrors.push(errors('ROLL_DIFFICULTY', 'La dificultad debe ser un número entero entre 1 y 30.', `${path}.dificultad`));
    for (const field of ['exito', 'fracaso']) if (typeof roll[field] !== 'string' || !roll[field].trim()) validationErrors.push(errors('ROLL_DESTINATION', `La tirada necesita destino de ${field}.`, `${path}.${field}`));
}

function emptyStats() { return { scenes: 0, rolls: 0, terminals: 0, reachable: 0 }; }

module.exports = { validateAdventureDocument };
