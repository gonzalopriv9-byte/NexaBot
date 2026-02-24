const { PermissionFlagsBits, AuditLogEvent } = require("discord.js");
const { loadGuildConfig } = require("./configManager");

// Almacena las acciones recientes por guild y usuario
const actionTracking = new Map();

/**
 * Registra una acción y verifica si excede los umbrales
 */
function trackAction(guildId, userId, actionType) {
  const key = `${guildId}:${userId}:${actionType}`;
  const now = Date.now();
  
  if (!actionTracking.has(key)) {
    actionTracking.set(key, []);
  }
  
  const actions = actionTracking.get(key);
  actions.push(now);
  
  // Limpiar acciones antiguas (más de 10 segundos)
  const filtered = actions.filter(timestamp => now - timestamp <= 10000);
  actionTracking.set(key, filtered);
  
  return filtered.length;
}

/**
 * Limpia el tracking periódicamente para evitar memory leaks
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, actions] of actionTracking.entries()) {
    const filtered = actions.filter(timestamp => now - timestamp <= 10000);
    if (filtered.length === 0) {
      actionTracking.delete(key);
    } else {
      actionTracking.set(key, filtered);
    }
  }
}, 30000); // Limpia cada 30 segundos

/**
 * Verifica si un usuario está en la whitelist
 */
function isWhitelisted(config, userId, guildOwnerId) {
  if (userId === guildOwnerId) return true;
  const whitelist = config.antiNuke?.whitelist || [];
  return whitelist.includes(userId);
}

/**
 * Banea al atacante y notifica
 */
async function punishAttacker(guild, userId, reason, addLog) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    
    if (!member) {
      if (addLog) addLog("warning", `Anti-Nuke: No se pudo fetchear al usuario ${userId}`);
      return false;
    }

    // Verificar que el bot tiene permisos
    const me = guild.members.me;
    if (!me.permissions.has(PermissionFlagsBits.BanMembers)) {
      if (addLog) addLog("error", "Anti-Nuke: Bot sin permisos de ban");
      return false;
    }

    // Verificar que el bot puede banear al usuario (jerarquía de roles)
    if (member.roles.highest.position >= me.roles.highest.position) {
      if (addLog) addLog("warning", `Anti-Nuke: No se puede banear a ${member.user.tag} (rol superior)`);
      return false;
    }

    await guild.members.ban(userId, { reason: `🛡️ Anti-Nuke: ${reason}` });
    if (addLog) addLog("warning", `🛡️ Anti-Nuke: ${member.user.tag} baneado - ${reason}`);
    
    return true;
  } catch (e) {
    if (addLog) addLog("error", "Anti-Nuke error al banear: " + e.message);
    return false;
  }
}

/**
 * Maneja la creación de roles
 */
async function handleRoleCreate(role, addLog) {
  try {
    const guild = role.guild;
    const config = await loadGuildConfig(guild.id);
    
    if (!config.antiNuke?.enabled || !config.antiNuke.actions?.roleCreate) return;

    // Buscar quién creó el rol
    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 });
    const entry = auditLogs.entries.first();
    
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    
    const executor = entry.executor;
    if (!executor || executor.bot) return;
    
    // Verificar whitelist
    if (isWhitelisted(config, executor.id, guild.ownerId)) return;

    // Trackear acción
    const count = trackAction(guild.id, executor.id, "roleCreate");
    const threshold = config.antiNuke.thresholds.roleCreateDelete;

    if (count >= threshold) {
      if (addLog) addLog("warning", `⚠️ Anti-Nuke: ${executor.tag} ha creado ${count} roles en 10 segundos`);
      
      // Eliminar el rol creado
      await role.delete("🛡️ Anti-Nuke: Creación masiva detectada").catch(() => {});
      
      // Banear al atacante
      await punishAttacker(guild, executor.id, `Creación masiva de roles (${count} en 10s)`, addLog);
    }
  } catch (e) {
    if (addLog) addLog("error", "Anti-Nuke roleCreate error: " + e.message);
  }
}

/**
 * Maneja la eliminación de roles
 */
async function handleRoleDelete(role, addLog) {
  try {
    const guild = role.guild;
    const config = await loadGuildConfig(guild.id);
    
    if (!config.antiNuke?.enabled || !config.antiNuke.actions?.roleDelete) return;

    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 });
    const entry = auditLogs.entries.first();
    
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    
    const executor = entry.executor;
    if (!executor || executor.bot) return;
    
    if (isWhitelisted(config, executor.id, guild.ownerId)) return;

    const count = trackAction(guild.id, executor.id, "roleDelete");
    const threshold = config.antiNuke.thresholds.roleCreateDelete;

    if (count >= threshold) {
      if (addLog) addLog("warning", `⚠️ Anti-Nuke: ${executor.tag} ha eliminado ${count} roles en 10 segundos`);
      await punishAttacker(guild, executor.id, `Eliminación masiva de roles (${count} en 10s)`, addLog);
    }
  } catch (e) {
    if (addLog) addLog("error", "Anti-Nuke roleDelete error: " + e.message);
  }
}

/**
 * Maneja la creación de canales
 */
async function handleChannelCreate(channel, addLog) {
  try {
    const guild = channel.guild;
    if (!guild) return;
    
    const config = await loadGuildConfig(guild.id);
    
    if (!config.antiNuke?.enabled || !config.antiNuke.actions?.channelCreate) return;

    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 });
    const entry = auditLogs.entries.first();
    
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    
    const executor = entry.executor;
    if (!executor || executor.bot) return;
    
    if (isWhitelisted(config, executor.id, guild.ownerId)) return;

    const count = trackAction(guild.id, executor.id, "channelCreate");
    const threshold = config.antiNuke.thresholds.channelCreateDelete;

    if (count >= threshold) {
      if (addLog) addLog("warning", `⚠️ Anti-Nuke: ${executor.tag} ha creado ${count} canales en 10 segundos`);
      
      // Eliminar el canal creado
      await channel.delete("🛡️ Anti-Nuke: Creación masiva detectada").catch(() => {});
      
      await punishAttacker(guild, executor.id, `Creación masiva de canales (${count} en 10s)`, addLog);
    }
  } catch (e) {
    if (addLog) addLog("error", "Anti-Nuke channelCreate error: " + e.message);
  }
}

/**
 * Maneja la eliminación de canales
 */
async function handleChannelDelete(channel, addLog) {
  try {
    const guild = channel.guild;
    if (!guild) return;
    
    const config = await loadGuildConfig(guild.id);
    
    if (!config.antiNuke?.enabled || !config.antiNuke.actions?.channelDelete) return;

    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
    const entry = auditLogs.entries.first();
    
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    
    const executor = entry.executor;
    if (!executor || executor.bot) return;
    
    if (isWhitelisted(config, executor.id, guild.ownerId)) return;

    const count = trackAction(guild.id, executor.id, "channelDelete");
    const threshold = config.antiNuke.thresholds.channelCreateDelete;

    if (count >= threshold) {
      if (addLog) addLog("warning", `⚠️ Anti-Nuke: ${executor.tag} ha eliminado ${count} canales en 10 segundos`);
      await punishAttacker(guild, executor.id, `Eliminación masiva de canales (${count} en 10s)`, addLog);
    }
  } catch (e) {
    if (addLog) addLog("error", "Anti-Nuke channelDelete error: " + e.message);
  }
}

/**
 * Maneja los bans masivos
 */
async function handleGuildBanAdd(ban, addLog) {
  try {
    const guild = ban.guild;
    const config = await loadGuildConfig(guild.id);
    
    if (!config.antiNuke?.enabled || !config.antiNuke.actions?.memberBan) return;

    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
    const entry = auditLogs.entries.first();
    
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    
    const executor = entry.executor;
    if (!executor || executor.bot) return;
    
    if (isWhitelisted(config, executor.id, guild.ownerId)) return;

    const count = trackAction(guild.id, executor.id, "memberBan");
    const threshold = config.antiNuke.thresholds.bans;

    if (count >= threshold) {
      if (addLog) addLog("warning", `⚠️ Anti-Nuke: ${executor.tag} ha baneado ${count} usuarios en 10 segundos`);
      
      // Intentar desbanear a la víctima
      await guild.members.unban(ban.user.id, "🛡️ Anti-Nuke: Ban masivo detectado").catch(() => {});
      
      await punishAttacker(guild, executor.id, `Bans masivos (${count} en 10s)`, addLog);
    }
  } catch (e) {
    if (addLog) addLog("error", "Anti-Nuke banAdd error: " + e.message);
  }
}

/**
 * Maneja los kicks masivos
 */
async function handleGuildMemberRemove(member, addLog) {
  try {
    const guild = member.guild;
    const config = await loadGuildConfig(guild.id);
    
    if (!config.antiNuke?.enabled || !config.antiNuke.actions?.memberKick) return;

    // Esperar un poco para que el audit log se actualice
    await new Promise(resolve => setTimeout(resolve, 1000));

    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 });
    const entry = auditLogs.entries.first();
    
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    if (entry.target.id !== member.id) return;
    
    const executor = entry.executor;
    if (!executor || executor.bot) return;
    
    if (isWhitelisted(config, executor.id, guild.ownerId)) return;

    const count = trackAction(guild.id, executor.id, "memberKick");
    const threshold = config.antiNuke.thresholds.kicks;

    if (count >= threshold) {
      if (addLog) addLog("warning", `⚠️ Anti-Nuke: ${executor.tag} ha kickeado ${count} usuarios en 10 segundos`);
      await punishAttacker(guild, executor.id, `Kicks masivos (${count} en 10s)`, addLog);
    }
  } catch (e) {
    if (addLog) addLog("error", "Anti-Nuke memberRemove error: " + e.message);
  }
}

module.exports = {
  handleRoleCreate,
  handleRoleDelete,
  handleChannelCreate,
  handleChannelDelete,
  handleGuildBanAdd,
  handleGuildMemberRemove
};
