const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DNI_FILE = path.join(DATA_DIR, 'dnis.json');

// Crear carpeta data si no existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Crear archivo de DNIs si no existe
if (!fs.existsSync(DNI_FILE)) {
  fs.writeFileSync(DNI_FILE, JSON.stringify({}, null, 2));
}

// Leer todos los DNIs
function getAllDNIs() {
  try {
    const data = fs.readFileSync(DNI_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error leyendo DNIs:', error);
    return {};
  }
}

// Obtener DNI de un usuario
function getDNI(userId) {
  const dnis = getAllDNIs();
  return dnis[userId] || null;
}

// Guardar/Actualizar DNI de un usuario
function saveDNI(userId, dniData) {
  try {
    const dnis = getAllDNIs();
    dnis[userId] = {
      ...dniData,
      createdAt: dnis[userId]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(DNI_FILE, JSON.stringify(dnis, null, 2));
    return true;
  } catch (error) {
    console.error('Error guardando DNI:', error);
    return false;
  }
}

// Eliminar DNI de un usuario
function deleteDNI(userId) {
  try {
    const dnis = getAllDNIs();
    delete dnis[userId];
    fs.writeFileSync(DNI_FILE, JSON.stringify(dnis, null, 2));
    return true;
  } catch (error) {
    console.error('Error eliminando DNI:', error);
    return false;
  }
}

// Verificar si un usuario tiene DNI
function hasDNI(userId) {
  return getDNI(userId) !== null;
}

// Generar número de DNI único
function generateDNINumber() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = Math.floor(10000000 + Math.random() * 90000000);
  const letter = letters.charAt(Math.floor(Math.random() * letters.length));
  return `${numbers}${letter}`;
}

module.exports = {
  getAllDNIs,
  getDNI,
  saveDNI,
  deleteDNI,
  hasDNI,
  generateDNINumber
};
