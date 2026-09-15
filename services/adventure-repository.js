const { Adventure, AdventureVersion } = require('../db');
const { importAdventure } = require('./adventure-import-service');
const { listAdventures: listFileAdventures, loadAdventure } = require('./adventure-loader');

function summary(adventure) {
    return {
        id: adventure.adventureId,
        title: adventure.title,
        description: adventure.description || '',
        duration: adventure.duration || '',
        difficulty: adventure.difficulty || '',
        ambientacion: adventure.ambientacion || '',
        status: adventure.status,
        version: adventure.currentVersion,
        publishedVersion: adventure.publishedVersion,
        createdAt: adventure.createdAt,
        updatedAt: adventure.updatedAt
    };
}

async function saveImportedAdventure(value, userId) {
    const imported = importAdventure(value);
    const now = new Date();
    let adventure = await Adventure.findOne({ adventureId: imported.canonical.id });
    const version = adventure ? adventure.currentVersion + 1 : 1;
    if (!adventure) {
        adventure = await Adventure.create({
            adventureId: imported.canonical.id,
            title: imported.canonical.titulo,
            description: imported.canonical.descripcion || '',
            ambientacion: imported.canonical.ambientacion || '',
            duration: imported.canonical.duracion || '',
            difficulty: imported.canonical.dificultad || '',
            status: 'draft',
            currentVersion: version,
            createdBy: userId,
            createdAt: now,
            updatedAt: now
        });
    } else {
        adventure.title = imported.canonical.titulo;
        adventure.description = imported.canonical.descripcion || '';
        adventure.ambientacion = imported.canonical.ambientacion || '';
        adventure.duration = imported.canonical.duracion || '';
        adventure.difficulty = imported.canonical.dificultad || '';
        adventure.currentVersion = version;
        adventure.status = 'draft';
        adventure.updatedAt = now;
        await adventure.save();
    }
    await AdventureVersion.create({
        adventureId: adventure.adventureId,
        version,
        schemaVersion: imported.canonical.schemaVersion,
        originalJson: imported.canonical,
        normalizedJson: imported.normalized,
        createdBy: userId,
        createdAt: now
    });
    return { adventure, version, validation: imported.validation };
}

async function getAdventure(adventureId, { publishedOnly = false, current = true } = {}) {
    const adventure = await Adventure.findOne({ adventureId }).lean();
    if (!adventure) return null;
    const version = publishedOnly ? adventure.publishedVersion : (current ? adventure.currentVersion : adventure.publishedVersion);
    if (!version) return { adventure, version: null, content: null };
    const content = await AdventureVersion.findOne({ adventureId, version }).lean();
    return { adventure, version, content };
}

async function listAdventures({ publishedOnly = false } = {}) {
    const query = publishedOnly ? { status: 'published' } : {};
    return Adventure.find(query).sort({ updatedAt: -1 }).lean();
}

async function publishAdventure(adventureId, userId) {
    const adventure = await Adventure.findOne({ adventureId });
    if (!adventure) return null;
    adventure.status = 'published';
    adventure.publishedVersion = adventure.currentVersion;
    adventure.updatedAt = new Date();
    await adventure.save();
    return adventure;
}

async function unpublishAdventure(adventureId) {
    const adventure = await Adventure.findOne({ adventureId });
    if (!adventure) return null;
    adventure.status = 'draft';
    adventure.updatedAt = new Date();
    await adventure.save();
    return adventure;
}

async function deleteAdventure(adventureId) {
    const adventure = await Adventure.findOneAndDelete({ adventureId });
    if (!adventure) return null;
    await AdventureVersion.deleteMany({ adventureId });
    return adventure;
}

// Importación inicial no destructiva para que las aventuras que ya estaban en
// data/adventures sigan disponibles después de activar el catálogo editable.
async function syncFileAdventures(adminId) {
    const entries = listFileAdventures();
    for (const entry of entries) {
        if (await Adventure.exists({ adventureId: entry.id })) continue;
        const imported = importAdventure(loadAdventure(entry.id));
        const now = new Date();
        await Adventure.create({
            adventureId: imported.canonical.id,
            title: imported.canonical.titulo,
            description: imported.canonical.descripcion || '',
            ambientacion: imported.canonical.ambientacion || '',
            duration: imported.canonical.duracion || '',
            difficulty: imported.canonical.dificultad || '',
            status: 'published',
            currentVersion: 1,
            publishedVersion: 1,
            createdBy: adminId,
            createdAt: now,
            updatedAt: now
        });
        await AdventureVersion.create({
            adventureId: imported.canonical.id,
            version: 1,
            schemaVersion: imported.canonical.schemaVersion,
            originalJson: imported.canonical,
            normalizedJson: imported.normalized,
            createdBy: adminId,
            createdAt: now
        });
    }
}

module.exports = { summary, saveImportedAdventure, getAdventure, listAdventures, publishAdventure, unpublishAdventure, deleteAdventure, syncFileAdventures };
