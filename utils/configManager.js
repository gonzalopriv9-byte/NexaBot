const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'data', 'guilds.json');

// ==================== FUNCIONES DE CONFIGURACIÓN ====================

/**
 * Cargar configuración de un servidor
 * @param {string} guildId - ID del servidor
 * @returns {object} Configuración del servidor
 */
function loadGuildConfig(guildId) {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
    }

    const data = fs.readFileSync(configPath, 'utf-8');
    const configs = JSON.parse(data);

    // Si no existe config para este servidor, crear una por defecto
    if (!configs[guildId]) {
      configs[guildId] = {
        tickets: {
          enabled: false,
          categoryId: null,
          staffRoles: [],
          ratingsChannelId: null
        },
        verification: {
          enabled: false,
          roleId: null
        },
        welcome: {
          enabled: false,
          channelId: null
        },
        trabajos: {
          enabled: false,
          roles: {}
        }
      };
      fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
    }

    return configs[guildId];
  } catch (error) {
    console.error(`Error cargando config para ${guildId}:`, error);
    return null;
  }
}

/**
 * Guardar configuración de un servidor
 * @param {string} guildId - ID del servidor
 * @param {object} config - Nueva configuración
 */
function saveGuildConfig(guildId, config) {
  try {
    const data = fs.readFileSync(configPath, 'utf-8');
    const configs = JSON.parse(data);

    configs[guildId] = config;

    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
    return true;
  } catch (error) {
    console.error(`Error guardando config para ${guildId}:`, error);
    return false;
  }
}

/**
 * Actualizar una sección específica de la configuración
 * @param {string} guildId - ID del servidor
 * @param {string} section - Sección a actualizar (tickets, verification, etc.)
 * @param {object} updates - Cambios a aplicar
 */
function updateGuildConfig(guildId, section, updates) {
  const config = loadGuildConfig(guildId);
  if (!config) return false;

  config[section] = { ...config[section], ...updates };

  return saveGuildConfig(guildId, config);
}

/**
 * Verificar si un sistema está configurado y habilitado
 * @param {string} guildId - ID del servidor
 * @param {string} system - Sistema a verificar
 * @returns {boolean}
 */
function isSystemEnabled(guildId, system) {
  const config = loadGuildConfig(guildId);
  if (!config || !config[system]) return false;

  return config[system].enabled === true;
}

module.exports = {
  loadGuildConfig,
  saveGuildConfig,
  updateGuildConfig,
  isSystemEnabled
};
