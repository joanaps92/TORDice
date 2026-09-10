const clone = value => JSON.parse(JSON.stringify(value));

class AdventureEngine {
    constructor(adventure, clock = () => new Date()) {
        this.adventure = adventure;
        this.clock = clock;
    }

    getScene(sceneId) {
        return this.adventure.scenes.find(scene => scene.id === sceneId) || null;
    }

    evaluateCondition(condition, flags) {
        const currentValue = flags?.[condition.flag];
        if (condition.operator === 'equals') return currentValue === condition.value;
        if (condition.operator === 'notEquals') return currentValue !== condition.value;
        throw new Error(`Operador de condición no permitido: ${condition.operator}`);
    }

    evaluateConditions(conditions, flags) {
        return !conditions?.length || conditions.every(condition => this.evaluateCondition(condition, flags));
    }

    getAvailableChoices(scene, flags) {
        return (scene?.choices || []).filter(choice => this.evaluateConditions(choice.conditions, flags));
    }

    ensureSessionState(session) {
        if (!session.storyFlags || typeof session.storyFlags !== 'object' || Array.isArray(session.storyFlags)) session.storyFlags = {};
        if (!session.adventureState || typeof session.adventureState !== 'object' || Array.isArray(session.adventureState)) session.adventureState = {};
        if (!Array.isArray(session.history)) session.history = [];
        return session;
    }

    createSession({ sessionId, characterId, character }) {
        const ficha = character?.ficha || {};
        const session = {
            id: sessionId || null,
            adventureId: this.adventure.id,
            characterId,
            currentSceneId: this.adventure.startSceneId,
            status: 'active',
            storyFlags: {},
            adventureState: {
                hope: Number(ficha.estadisticas?.esperanza?.actual) || 0,
                maxHope: Number(ficha.estadisticas?.esperanza?.maxima) || 0,
                endurance: Number(ficha.estadisticas?.aguante?.actual) || 0,
                maxEndurance: Number(ficha.estadisticas?.aguante?.maximo) || 0
            },
            pendingRoll: null,
            history: [],
            startedAt: this.clock(),
            updatedAt: this.clock()
        };

        this.enterScene(session, session.currentSceneId);
        return session;
    }

    record(session, type, text, sceneId = session.currentSceneId, metadata = undefined) {
        this.ensureSessionState(session);
        const entry = { timestamp: this.clock(), sceneId, type, text };
        if (metadata !== undefined) entry.metadata = metadata;
        session.history.push(entry);
    }

    applyActions(session, actions = []) {
        this.ensureSessionState(session);
        actions.forEach(action => {
            if (!action || typeof action !== 'object') throw new Error('Acción narrativa no válida.');
            switch (action.type) {
                case 'SET_FLAG':
                    if (!action.key) throw new Error('SET_FLAG necesita una clave.');
                    session.storyFlags[action.key] = action.value;
                    break;
                case 'ADD_HOPE':
                    session.adventureState.hope = Math.min(session.adventureState.maxHope, session.adventureState.hope + Number(action.value || 0));
                    break;
                case 'REMOVE_HOPE':
                    session.adventureState.hope = Math.max(0, session.adventureState.hope - Number(action.value || 0));
                    break;
                case 'ADD_ENDURANCE':
                    session.adventureState.endurance = Math.min(session.adventureState.maxEndurance, session.adventureState.endurance + Number(action.value || 0));
                    break;
                case 'REMOVE_ENDURANCE':
                    session.adventureState.endurance = Math.max(0, session.adventureState.endurance - Number(action.value || 0));
                    break;
                default:
                    throw new Error(`Acción narrativa no permitida: ${action.type}`);
            }
        });
    }

    enterScene(session, sceneId) {
        const scene = this.getScene(sceneId);
        if (!scene) throw new Error(`La escena ${sceneId} no existe.`);
        session.currentSceneId = scene.id;
        this.applyActions(session, scene.onEnter);
        this.record(session, 'SCENE', scene.text, scene.id);
        if (!this.getAvailableChoices(scene, session.storyFlags).length) session.status = 'completed';
        session.updatedAt = this.clock();
        return scene;
    }

    chooseChoice(inputSession, choiceId) {
        const session = this.ensureSessionState(clone(inputSession));
        if (session.status !== 'active') throw new Error('La partida ya no está activa.');
        if (session.pendingRoll) throw new Error('La partida tiene una tirada pendiente.');

        const scene = this.getScene(session.currentSceneId);
        const choice = this.getAvailableChoices(scene, session.storyFlags).find(item => item.id === choiceId);
        if (!choice) throw new Error('La decisión no está disponible en la escena actual.');
        this.record(session, 'CHOICE', choice.text, scene.id, { choiceId: choice.id });

        if (choice.skillCheck) {
            if (!choice.skillCheck.skill || !choice.skillCheck.successSceneId || !choice.skillCheck.failureSceneId) {
                throw new Error('La tirada de habilidad está incompleta.');
            }
            session.pendingRoll = {
                choiceId: choice.id,
                skill: choice.skillCheck.skill,
                label: choice.text,
                createdAt: this.clock()
            };
            session.updatedAt = this.clock();
            return { session, status: 'pending-roll', choice, skillCheck: choice.skillCheck };
        }

        if (!choice.nextSceneId) throw new Error('La decisión no tiene una escena siguiente.');
        this.applyActions(session, choice.actions);
        const nextScene = this.enterScene(session, choice.nextSceneId);
        return { session, status: session.status === 'completed' ? 'completed' : 'scene', scene: nextScene, choice };
    }

    resolvePendingRoll(inputSession, result) {
        const session = this.ensureSessionState(clone(inputSession));
        if (session.status !== 'active') throw new Error('La partida ya no está activa.');
        if (!session.pendingRoll) throw new Error('La partida no tiene ninguna tirada pendiente.');

        const currentScene = this.getScene(session.currentSceneId);
        const choice = currentScene?.choices?.find(item => item.id === session.pendingRoll.choiceId);
        if (!choice?.skillCheck) throw new Error('La tirada pendiente ya no es válida.');

        const success = Boolean(result?.success);
        const skill = session.pendingRoll.skill;
        const nextSceneId = success ? choice.skillCheck.successSceneId : choice.skillCheck.failureSceneId;
        this.applyActions(session, choice.actions);
        session.pendingRoll = null;
        this.record(session, 'ROLL', `${skill} → ${success ? 'Éxito' : 'Fallo'}.`, currentScene.id, { result });
        const nextScene = this.enterScene(session, nextSceneId);
        return { session, status: session.status === 'completed' ? 'completed' : 'scene', scene: nextScene, choice, result };
    }
}

module.exports = { AdventureEngine };
