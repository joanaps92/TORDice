const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'data', 'culturas.json');
const cultures = JSON.parse(fs.readFileSync(file, 'utf8'));
const skills = ['impresionar', 'atletismo', 'alerta', 'cazar', 'cantar', 'oficio', 'alentar', 'viajar', 'perspicacia', 'curar', 'cortesia', 'guerrear', 'persuadir', 'sigilo', 'inspeccionar', 'explorar', 'acertijos', 'saber'];
const ids = new Set();
const errors = [];

if (cultures.length !== 9) errors.push(`Se esperaban 9 culturas y hay ${cultures.length}.`);
for (const culture of cultures) {
    if (!culture.id || ids.has(culture.id)) errors.push(`ID ausente o duplicado: ${culture.id || '(vacío)'}`);
    ids.add(culture.id);
    if (!culture.name || !culture.blessing || !culture.shadowRule || !culture.standardOfLiving) errors.push(`Estructura incompleta: ${culture.id}`);
    if (!Array.isArray(culture.attributesTable) || culture.attributesTable.length !== 6) errors.push(`Tabla de atributos inválida: ${culture.id}`);
    if (!culture.derivedStats || !['enduranceBonus', 'hopeBonus', 'parryBonus'].every(key => Number.isInteger(culture.derivedStats[key]))) errors.push(`Bonificadores derivados inválidos: ${culture.id}`);
    if (!culture.skills || skills.some(skill => !Number.isInteger(culture.skills[skill]))) errors.push(`Habilidades incompletas: ${culture.id}`);
    if (!Array.isArray(culture.favoredSkillsChoices) || !Array.isArray(culture.combatProficiencies) || culture.combatProficiencies.some(choice => !Number.isInteger(choice.rank) || !Array.isArray(choice.options))) errors.push(`Elecciones inválidas: ${culture.id}`);
    if (!Array.isArray(culture.distinctiveFeatures) || culture.distinctiveFeatures.length < 2) errors.push(`Rasgos distintivos incompletos: ${culture.id}`);
}

if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
}
console.log(`Catálogo válido: ${cultures.length} culturas, ${skills.length} habilidades por cultura.`);
