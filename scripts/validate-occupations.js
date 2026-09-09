const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'data', 'ocupaciones.json');
const occupations = JSON.parse(fs.readFileSync(file, 'utf8'));
const skills = new Set(['impresionar', 'atletismo', 'alerta', 'cazar', 'cantar', 'oficio', 'alentar', 'viajar', 'perspicacia', 'curar', 'cortesia', 'guerrear', 'persuadir', 'sigilo', 'inspeccionar', 'explorar', 'acertijos', 'saber']);
const ids = new Set();
const errors = [];

for (const occupation of occupations) {
    if (!occupation.id || ids.has(occupation.id)) errors.push(`ID ausente o duplicado: ${occupation.id || '(vacío)'}`);
    ids.add(occupation.id);
    if (!occupation.name || !occupation.shadowPath || !occupation.distinctiveFeature?.name) errors.push(`Estructura incompleta: ${occupation.id}`);
    if (!Array.isArray(occupation.favoredSkillsChoices) || occupation.favoredSkillsChoices.length !== 3 || occupation.favoredSkillsChoices.some(skill => !skills.has(skill))) errors.push(`Habilidades favorecidas inválidas: ${occupation.id}`);
    if (occupation.distinctiveFeature?.options && !Array.isArray(occupation.distinctiveFeature.options)) errors.push(`Opciones de rasgo inválidas: ${occupation.id}`);
}

if (occupations.length !== 6) errors.push(`Se esperaban 6 ocupaciones y hay ${occupations.length}.`);
if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
}
console.log(`Catálogo válido: ${occupations.length} ocupaciones.`);
