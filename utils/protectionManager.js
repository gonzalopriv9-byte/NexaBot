const { PermissionFlagsBits, AuditLogEvent } = require("discord.js");
const { loadGuildConfig, updateGuildConfig } = require("./configManager");
const { supabase } = require("./db");

// Contadores de acciones por usuario
const actionCounters = new Map();

// Limpieza de contadores cada minuto
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of actionCounters.entries()) {
    if (now - data.timestamp > 60000) {
      actionCounters.delete(key);
    }
  }
}, 60000);

function getCounterKey(guildId, userId, action) {
  return `${guildId}:${userId}:${action}`;
}

function incrementCounter(guildId, userId, action) {
  const key = getCounterKey(guildId, userId, action);
  const existing = actionCounters.get(key);
  
  if (!existing) {
    actionCounters.set(key, { count: 1, timestamp: Date.now() });
    return 1;
  }
  
  // Si han pasado más de 60 segundos, resetear
  if (Date.now() - existing.timestamp > 60000) {
    actionCounters.set(key, { count: 1, timestamp: Date.now() });
    return 1;
  }
  
  existing.count++;
  return existing.count;
}

function getCounter(guildId, userId, action) {
  const key = getCounterKey(guildId, userId, action);
  const data = actionCounters.get(key);
  
  if (!data || Date.now() - data.timestamp > 60000) {
    return 0;
  }
  
  return data.count;
}

async function checkAntiNuke(guild, userId, action, addLog) {
  try {
    const config = await loadGuildConfig(guild.id);
    
    if (!config?.protection?.antiNuke?.enabled) {
      return { shouldAct: false };
    }
    
    const limits = config.protection.antiNuke.limits || {};
    const defaultLimits = {
      roleCreate: 3,
      roleDelete: 3,
      channelCreate: 3,
      channelDelete: 3,
      ban: 3,
      kick: 3
    };
    
    const limit = limits[action] || defaultLimits[action];
    const count = incrementCounter(guild.id, userId, action);
    
    if (count >= limit) {
      if (addLog) {
        addLog("warning", `Anti-Nuke disparado: ${userId} hizo ${count} ${action} en ${guild.name}`);
      }
      
      // Guardar en base de datos
      await supabase.from("protection_logs").insert({
        guild_id: guild.id,
        user_id: userId,
        action: action,
        count: count,
        triggered_at: new Date().toISOString()
      });
      
      return { shouldAct: true, count, limit };
    }
    
    return { shouldAct: false, count, limit };
  } catch (e) {
    if (addLog) addLog("error", "Error checkAntiNuke: " + e.message);
    return { shouldAct: false };
  }
}

async function punishNuker(guild, userId, reason, addLog) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return false;
    
    // No banear al owner
    if (userId === guild.ownerId) {
      if (addLog) addLog("warning", "No se puede banear al owner del servidor");
      return false;
    }
    
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.BanMembers)) {
      if (addLog) addLog("error", "No tengo permisos para banear");
      return false;
    }
    
    // Verificar jerarquía
    if (member.roles.highest.position >= me.roles.highest.position) {
      if (addLog) addLog("warning", "No puedo banear a alguien con rol superior o igual");
      return false;
    }
    
    await guild.members.ban(userId, { reason: `[Anti-Nuke] ${reason}` });
    
    if (addLog) {
      addLog("success", `Usuario ${userId} baneado por Anti-Nuke: ${reason}`);
    }
    
    return true;
  } catch (e) {
    if (addLog) addLog("error", "Error punishNuker: " + e.message);
    return false;
  }
}

async function enableRaidMode(guildId, duration, addLog) {
  try {
    const endTime = duration ? new Date(Date.now() + duration * 60000).toISOString() : null;
    
    await updateGuildConfig(guildId, {
      protection: {
        raidMode: {
          enabled: true,
          enabledAt: new Date().toISOString(),
          endsAt: endTime,
          auto: !duration // Si no hay duración, fue automático
        }
      }
    });
    
    if (addLog) {
      addLog("warning", `Modo Raid activado en guild ${guildId}` + (duration ? ` por ${duration} minutos` : " (indefinido)"));
    }
    
    return true;
  } catch (e) {
    if (addLog) addLog("error", "Error enableRaidMode: " + e.message);
    return false;
  }
}

async function disableRaidMode(guildId, addLog) {
  try {
    const config = await loadGuildConfig(guildId);
    
    await updateGuildConfig(guildId, {
      protection: {
        ...config.protection,
        raidMode: {
          enabled: false,
          disabledAt: new Date().toISOString()
        }
      }
    });
    
    if (addLog) {
      addLog("info", `Modo Raid desactivado en guild ${guildId}`);
    }
    
    return true;
  } catch (e) {
    if (addLog) addLog("error", "Error disableRaidMode: " + e.message);
    return false;
  }
}

async function checkRaidMode(guild, addLog) {
  try {
    const config = await loadGuildConfig(guild.id);
    
    if (!config?.protection?.raidMode?.enabled) {
      return false;
    }
    
    // Verificar si el modo raid ha expirado
    if (config.protection.raidMode.endsAt) {
      const endTime = new Date(config.protection.raidMode.endsAt).getTime();
      if (Date.now() > endTime) {
        await disableRaidMode(guild.id, addLog);
        return false;
      }
    }
    
    return true;
  } catch (e) {
    if (addLog) addLog("error", "Error checkRaidMode: " + e.message);
    return false;
  }
}

module.exports = {
  checkAntiNuke,
  punishNuker,
  enableRaidMode,
  disableRaidMode,
  checkRaidMode,
  getCounter,
  incrementCounter
};
