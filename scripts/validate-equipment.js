const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'data', 'equipo-guerra.json');
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
const skills = new Set(['', 'hachas', 'arcos', 'lanzas', 'espadas', 'pelea']);
const errors = [];

if (!Array.isArray(catalog.weapons) || !catalog.weapons.length) errors.push('No hay armas.');
for (const weapon of catalog.weapons || []) {
    if (!weapon.id || !weapon.name || !Number.isInteger(weapon.damage) || weapon.injury === undefined || !Number.isInteger(weapon.load) || !skills.has(weapon.competence)) errors.push(`Arma inválida: ${weapon.id || '(vacía)'}`);
}
for (const [category, required] of [['armor', ['protection']], ['helmets', ['protection']], ['shields', ['parryModifier']]]) {
    if (!Array.isArray(catalog[category]) || !catalog[category].length) errors.push(`Categoría vacía: ${category}`);
    for (const item of catalog[category] || []) {
        if (!item.id || !item.name || !Number.isInteger(item.load) || required.some(key => item[key] === undefined)) errors.push(`Equipo inválido en ${category}: ${item.id || '(vacío)'}`);
    }
}
if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
}
console.log(`Catálogo válido: ${catalog.weapons.length} armas, ${catalog.armor.length} armaduras, ${catalog.shields.length} escudos y ${catalog.helmets.length} yelmo.`);
