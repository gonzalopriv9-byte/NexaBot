const { PermissionFlagsBits, AuditLogEvent } = require("discord.js");
const { loadGuildConfig, updateGuildConfig } = require("./configManager");
const { supabase } = require("./db");

// ==================== CONFIGURACIÓN POR DEFECTO ====================
const DEFAULT_PROTECTION = {
  enabled: false,
  antiNuke: {
    enabled: true,
    maxRoleCreate: 3,      // roles creados por minuto
    maxRoleDelete: 3,      // roles eliminados por minuto
    maxChannelCreate: 5,   // canales creados por minuto
    maxChannelDelete: 5,   // canales eliminados por minuto
    maxBan: 3,             // bans por minuto
    maxKick: 3,            // kicks por minuto
    action: "ban",         // ban | kick | quarantine
    whitelistRoles: []     // roles inmunes (ej: owner, admin)
  },
  raidMode: {
    enabled: false,
    autoEnable: true,      // activar automáticamente si se detecta raid
    duration: 600000,      // 10 minutos en ms
    until: null,
    blockedActions: ["invite", "channelCreate", "roleCreate"]
  },
  antiLinks: {
    enabled: false,
    allowList: ["discord.gg", "discord.com", "youtube.com", "youtu.be", "twitch.tv"],
    action: "delete",      // delete | warn | timeout
    timeoutDuration: 300,  // 5 minutos
    whitelistRoles: []
  },
  antiMentions: {
    enabled: false,
    maxMentionsUser: 5,
    blockEveryone: true,   // bloquear @everyone/@here salvo staff
    action: "delete",      // delete | warn | timeout | kick
    whitelistRoles: []
  },
  antiAlts: {
    enabled: false,
    minAccountAgeDays: 7,
    mode: "quarantine",    // allow | timeout | kick | ban | quarantine
    timeoutDuration: 3600, // 1 hora
    whitelistRoles: []
  },
  quarantine: {
    roleId: null,
    channelId: null        // canal donde pueden leer reglas/apelar
  },
  autoPunish: {
    enabled: false,
    thresholds: [
      { warns: 3, action: "timeout", duration: 3600 },   // 1h
      { warns: 5, action: "kick" },
      { warns: 7, action: "ban" }
    ]
  }
};

// ==================== CONTADORES ANTI-NUKE ====================
// Estructura: Map<guildId, Map<userId, { roleCreate: [], roleDelete: [], ... }>>
const antiNukeCounters = new Map();

function getCounter(guildId, userId) {
  if (!antiNukeCounters.has(guildId)) {
    antiNukeCounters.set(guildId, new Map());
  }
  const guildCounters = antiNukeCounters.get(guildId);
  if (!guildCounters.has(userId)) {
    guildCounters.set(userId, {
      roleCreate: [],
      roleDelete: [],
      channelCreate: [],
      channelDelete: [],
      ban: [],
      kick: []
    });
  }
  return guildCounters.get(userId);
}

function addAction(guildId, userId, action) {
  const counter = getCounter(guildId, userId);
  const now = Date.now();
  counter[action].push(now);
  // Limpiar acciones más antiguas de 1 minuto
  counter[action] = counter[action].filter(t => now - t < 60000);
  return counter[action].length;
}

function clearCounter(guildId, userId) {
  if (antiNukeCounters.has(guildId)) {
    antiNukeCounters.get(guildId).delete(userId);
  }
}

// ==================== VERIFICAR LÍMITES ANTI-NUKE ====================
async function checkAntiNuke(guild, userId, action, addLog) {
  try {
    const config = await loadGuildConfig(guild.id);
    if (!config?.protection?.enabled || !config?.protection?.antiNuke?.enabled) return false;

    const antiNuke = config.protection.antiNuke;
    const member = await guild.members.fetch(userId).catch(() => null);
    
    // Verificar whitelist (roles inmunes)
    if (member && antiNuke.whitelistRoles?.some(roleId => member.roles.cache.has(roleId))) {
      return false;
    }

    // Owner siempre inmune
    if (userId === guild.ownerId) return false;

    const count = addAction(guild.id, userId, action);
    const limits = {
      roleCreate: antiNuke.maxRoleCreate,
      roleDelete: antiNuke.maxRoleDelete,
      channelCreate: antiNuke.maxChannelCreate,
      channelDelete: antiNuke.maxChannelDelete,
      ban: antiNuke.maxBan,
      kick: antiNuke.maxKick
    };

    if (count >= limits[action]) {
      if (addLog) {
        addLog("warning", `🚨 ANTI-NUKE: ${member?.user?.tag || userId} superó límite de ${action}: ${count}/${limits[action]}`);
      }

      // Aplicar sanción
      await applyAntiNukeSanction(guild, userId, action, antiNuke.action, addLog);
      
      // Activar modo raid si está configurado
      if (config.protection?.raidMode?.autoEnable) {
        await enableRaidMode(guild.id, addLog);
      }

      // Guardar en base de datos
      await supabase.from("protection_logs").insert({
        guild_id: guild.id,
        user_id: userId,
        action: action,
        count: count,
        limit: limits[action],
        timestamp: new Date().toISOString()
      });

      clearCounter(guild.id, userId);
      return true;
    }

    return false;
  } catch (e) {
    if (addLog) addLog("error", "Error checkAntiNuke: " + e.message);
    return false;
  }
}

async function applyAntiNukeSanction(guild, userId, trigger, action, addLog) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const reason = `Nexa Protection: Anti-Nuke activado (${trigger})`;

    switch (action) {
      case "ban":
        await guild.members.ban(userId, { reason });
        if (addLog) addLog("warning", `Anti-Nuke BAN: ${member.user.tag} por ${trigger}`);
        break;
      case "kick":
        await member.kick(reason);
        if (addLog) addLog("warning", `Anti-Nuke KICK: ${member.user.tag} por ${trigger}`);
        break;
      case "quarantine":
        await quarantineMember(guild, member, reason, addLog);
        break;
    }
  } catch (e) {
    if (addLog) addLog("error", "Error aplicando sanción anti-nuke: " + e.message);
  }
}

// ==================== MODO RAID ====================
async function enableRaidMode(guildId, addLog, duration = 600000) {
  try {
    const config = await loadGuildConfig(guildId);
    const until = Date.now() + duration;

    await updateGuildConfig(guildId, {
      protection: {
        ...config.protection,
        raidMode: {
          ...config.protection?.raidMode,
          enabled: true,
          until: until
        }
      }
    });

    if (addLog) {
      addLog("warning", `🚨 MODO RAID ACTIVADO en guild ${guildId} por ${duration / 60000} minutos`);
    }

    // Auto-desactivar después del tiempo
    setTimeout(async () => {
      await disableRaidMode(guildId, addLog);
    }, duration);

    return true;
  } catch (e) {
    if (addLog) addLog("error", "Error activando modo raid: " + e.message);
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
          ...config.protection?.raidMode,
          enabled: false,
          until: null
        }
      }
    });

    if (addLog) {
      addLog("info", `✅ Modo raid desactivado en guild ${guildId}`);
    }
  } catch (e) {
    if (addLog) addLog("error", "Error desactivando modo raid: " + e.message);
  }
}

async function isRaidModeActive(guildId) {
  try {
    const config = await loadGuildConfig(guildId);
    const raidMode = config?.protection?.raidMode;
    
    if (!raidMode?.enabled) return false;
    
    // Verificar si expiró
    if (raidMode.until && Date.now() > raidMode.until) {
      await disableRaidMode(guildId);
      return false;
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

// ==================== ANTI-LINKS ====================
async function checkAntiLinks(message, addLog) {
  try {
    const guild = message.guild;
    if (!guild) return false;

    const config = await loadGuildConfig(guild.id);
    if (!config?.protection?.enabled || !config?.protection?.antiLinks?.enabled) return false;

    const antiLinks = config.protection.antiLinks;
    
    // Verificar whitelist de roles
    if (antiLinks.whitelistRoles?.some(roleId => message.member.roles.cache.has(roleId))) {
      return false;
    }

    // Detectar URLs
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = message.content.match(urlRegex);
    
    if (!urls) return false;

    // Verificar si alguna URL no está en allowList
    const blockedUrls = urls.filter(url => {
      return !antiLinks.allowList.some(domain => url.includes(domain));
    });

    if (blockedUrls.length > 0) {
      // Borrar mensaje
      await message.delete().catch(() => {});
      
      if (addLog) {
        addLog("info", `Anti-Links: Mensaje borrado de ${message.author.tag} (${blockedUrls.length} links)`);
      }

      // Aplicar acción
      if (antiLinks.action === "warn") {
        await addWarn(guild.id, message.author.id, "bot", "Envío de links no permitidos", addLog);
      } else if (antiLinks.action === "timeout") {
        await message.member.timeout(antiLinks.timeoutDuration * 1000, "Anti-Links: links no permitidos");
      }

      // Notificar al usuario
      try {
        await message.author.send(`⚠️ Tu mensaje en **${guild.name}** fue eliminado por contener links no permitidos.`);
      } catch {}

      return true;
    }

    return false;
  } catch (e) {
    if (addLog) addLog("error", "Error checkAntiLinks: " + e.message);
    return false;
  }
}

// ==================== ANTI-MENCIONES MASIVAS ====================
async function checkAntiMentions(message, addLog) {
  try {
    const guild = message.guild;
    if (!guild) return false;

    const config = await loadGuildConfig(guild.id);
    if (!config?.protection?.enabled || !config?.protection?.antiMentions?.enabled) return false;

    const antiMentions = config.protection.antiMentions;
    
    // Verificar whitelist de roles
    if (antiMentions.whitelistRoles?.some(roleId => message.member.roles.cache.has(roleId))) {
      return false;
    }

    // Verificar @everyone/@here
    if (antiMentions.blockEveryone && (message.content.includes("@everyone") || message.content.includes("@here"))) {
      await message.delete().catch(() => {});
      
      if (addLog) {
        addLog("info", `Anti-Mentions: @everyone/@here bloqueado de ${message.author.tag}`);
      }

      if (antiMentions.action === "timeout") {
        await message.member.timeout(300000, "Anti-Mentions: @everyone/@here no permitido");
      } else if (antiMentions.action === "kick") {
        await message.member.kick("Anti-Mentions: spam de @everyone/@here");
      }

      return true;
    }

    // Verificar menciones de usuarios
    const mentions = message.mentions.users.size;
    if (mentions > antiMentions.maxMentionsUser) {
      await message.delete().catch(() => {});
      
      if (addLog) {
        addLog("info", `Anti-Mentions: ${message.author.tag} mencionó a ${mentions} usuarios`);
      }

      if (antiMentions.action === "warn") {
        await addWarn(guild.id, message.author.id, "bot", "Menciones masivas", addLog);
      } else if (antiMentions.action === "timeout") {
        await message.member.timeout(300000, "Anti-Mentions: menciones masivas");
      } else if (antiMentions.action === "kick") {
        await message.member.kick("Anti-Mentions: spam de menciones");
      }

      return true;
    }

    return false;
  } catch (e) {
    if (addLog) addLog("error", "Error checkAntiMentions: " + e.message);
    return false;
  }
}

// ==================== ANTI-ALTS ====================
async function checkAntiAlts(member, addLog) {
  try {
    const config = await loadGuildConfig(member.guild.id);
    if (!config?.protection?.enabled || !config?.protection?.antiAlts?.enabled) return false;

    const antiAlts = config.protection.antiAlts;
    
    // Verificar whitelist de roles (por si ya tiene algún rol)
    if (antiAlts.whitelistRoles?.some(roleId => member.roles.cache.has(roleId))) {
      return false;
    }

    // Calcular edad de la cuenta
    const accountAge = Date.now() - member.user.createdTimestamp;
    const accountAgeDays = accountAge / (1000 * 60 * 60 * 24);

    if (accountAgeDays < antiAlts.minAccountAgeDays) {
      if (addLog) {
        addLog("warning", `Anti-Alts: ${member.user.tag} cuenta de ${accountAgeDays.toFixed(1)} días (mínimo: ${antiAlts.minAccountAgeDays})`);
      }

      // Guardar en suspicious_accounts
      await supabase.from("suspicious_accounts").insert({
        guild_id: member.guild.id,
        user_id: member.id,
        username: member.user.tag,
        account_age_days: accountAgeDays,
        reason: "account_too_new",
        timestamp: new Date().toISOString()
      });

      // Aplicar acción
      const reason = `Anti-Alts: Cuenta muy nueva (${accountAgeDays.toFixed(1)} días, mínimo ${antiAlts.minAccountAgeDays})`;
      
      switch (antiAlts.mode) {
        case "ban":
          await member.ban({ reason });
          break;
        case "kick":
          await member.kick(reason);
          break;
        case "timeout":
          await member.timeout(antiAlts.timeoutDuration * 1000, reason);
          break;
        case "quarantine":
          await quarantineMember(member.guild, member, reason, addLog);
          break;
        case "allow":
          // Solo registrar, no hacer nada
          break;
      }

      return true;
    }

    return false;
  } catch (e) {
    if (addLog) addLog("error", "Error checkAntiAlts: " + e.message);
    return false;
  }
}

// ==================== CUARENTENA ====================
async function quarantineMember(guild, member, reason, addLog) {
  try {
    const config = await loadGuildConfig(guild.id);
    const quarantineRoleId = config?.protection?.quarantine?.roleId;

    if (!quarantineRoleId) {
      if (addLog) addLog("warning", "Cuarentena no configurada (falta roleId)");
      return false;
    }

    // Guardar roles actuales
    const currentRoles = member.roles.cache.filter(r => r.id !== guild.id).map(r => r.id);
    
    await supabase.from("quarantined_members").insert({
      guild_id: guild.id,
      user_id: member.id,
      previous_roles: currentRoles,
      reason: reason,
      quarantined_at: new Date().toISOString()
    });

    // Quitar todos los roles
    await member.roles.remove(currentRoles).catch(() => {});
    
    // Añadir rol de cuarentena
    await member.roles.add(quarantineRoleId).catch(() => {});

    if (addLog) {
      addLog("warning", `Cuarentena aplicada a ${member.user.tag}: ${reason}`);
    }

    // Notificar al usuario
    try {
      await member.send(`🔒 Has sido puesto en cuarentena en **${guild.name}**.\n\n**Razón:** ${reason}\n\nContacta con el staff para apelar.`);
    } catch {}

    return true;
  } catch (e) {
    if (addLog) addLog("error", "Error aplicando cuarentena: " + e.message);
    return false;
  }
}

async function unquarantineMember(guild, member, addLog) {
  try {
    const config = await loadGuildConfig(guild.id);
    const quarantineRoleId = config?.protection?.quarantine?.roleId;

    // Obtener roles anteriores
    const { data } = await supabase
      .from("quarantined_members")
      .select("previous_roles")
      .eq("guild_id", guild.id)
      .eq("user_id", member.id)
      .order("quarantined_at", { ascending: false })
      .limit(1)
      .single();

    if (quarantineRoleId) {
      await member.roles.remove(quarantineRoleId).catch(() => {});
    }

    if (data?.previous_roles) {
      await member.roles.add(data.previous_roles).catch(() => {});
    }

    // Eliminar de la base de datos
    await supabase
      .from("quarantined_members")
      .delete()
      .eq("guild_id", guild.id)
      .eq("user_id", member.id);

    if (addLog) {
      addLog("info", `Cuarentena removida de ${member.user.tag}`);
    }

    return true;
  } catch (e) {
    if (addLog) addLog("error", "Error removiendo cuarentena: " + e.message);
    return false;
  }
}

// ==================== SISTEMA DE WARNS ====================
async function addWarn(guildId, userId, modId, reason, addLog) {
  try {
    await supabase.from("warns").insert({
      guild_id: guildId,
      user_id: userId,
      mod_id: modId,
      reason: reason,
      created_at: new Date().toISOString()
    });

    // Verificar sanciones automáticas
    const config = await loadGuildConfig(guildId);
    if (config?.protection?.autoPunish?.enabled) {
      await checkAutoPunish(guildId, userId, addLog);
    }

    return true;
  } catch (e) {
    if (addLog) addLog("error", "Error añadiendo warn: " + e.message);
    return false;
  }
}

async function getWarns(guildId, userId) {
  try {
    const { data, error } = await supabase
      .from("warns")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (e) {
    return [];
  }
}

async function clearWarns(guildId, userId) {
  try {
    await supabase
      .from("warns")
      .delete()
      .eq("guild_id", guildId)
      .eq("user_id", userId);
    return true;
  } catch (e) {
    return false;
  }
}

async function checkAutoPunish(guildId, userId, addLog) {
  try {
    const warns = await getWarns(guildId, userId);
    const warnCount = warns.length;

    const config = await loadGuildConfig(guildId);
    const thresholds = config?.protection?.autoPunish?.thresholds || [];

    // Encontrar threshold aplicable (el más alto que alcance)
    const applicable = thresholds
      .filter(t => warnCount >= t.warns)
      .sort((a, b) => b.warns - a.warns)[0];

    if (!applicable) return;

    // Aplicar sanción
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const reason = `Auto-Punish: ${warnCount} warns`;

    switch (applicable.action) {
      case "timeout":
        await member.timeout(applicable.duration * 1000, reason);
        if (addLog) addLog("warning", `Auto-Punish TIMEOUT: ${member.user.tag} (${warnCount} warns)`);
        break;
      case "kick":
        await member.kick(reason);
        if (addLog) addLog("warning", `Auto-Punish KICK: ${member.user.tag} (${warnCount} warns)`);
        break;
      case "ban":
        await guild.members.ban(userId, { reason });
        if (addLog) addLog("warning", `Auto-Punish BAN: ${member.user.tag} (${warnCount} warns)`);
        break;
    }
  } catch (e) {
    if (addLog) addLog("error", "Error checkAutoPunish: " + e.message);
  }
}

module.exports = {
  DEFAULT_PROTECTION,
  checkAntiNuke,
  checkAntiLinks,
  checkAntiMentions,
  checkAntiAlts,
  enableRaidMode,
  disableRaidMode,
  isRaidModeActive,
  quarantineMember,
  unquarantineMember,
  addWarn,
  getWarns,
  clearWarns
};
