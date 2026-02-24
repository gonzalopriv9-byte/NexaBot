const { PermissionFlagsBits } = require("discord.js");
const { loadGuildConfig } = require("./configManager");
const { supabase } = require("./db");

// Regex para detectar URLs
const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;

async function checkAntiLinks(message, config, addLog) {
  if (!config?.protection?.antiLinks?.enabled) {
    return { shouldDelete: false };
  }

  // Permitir a moderadores y administradores
  if (message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return { shouldDelete: false };
  }

  // Detectar URLs
  const urls = message.content.match(URL_REGEX);
  if (!urls || urls.length === 0) {
    return { shouldDelete: false };
  }

  // Lista blanca de dominios permitidos
  const allowList = config.protection.antiLinks.allowList || [
    "discord.gg",
    "discord.com",
    "youtube.com",
    "youtu.be",
    "twitch.tv",
    "twitter.com",
    "x.com"
  ];

  // Verificar si alguna URL NO está en la lista blanca
  const blockedUrls = urls.filter(url => {
    return !allowList.some(domain => url.toLowerCase().includes(domain));
  });

  if (blockedUrls.length === 0) {
    return { shouldDelete: false };
  }

  // Guardar log
  if (addLog) {
    addLog("warning", `Anti-Link: ${message.author.tag} envió link bloqueado en ${message.guild.name}`);
  }

  await supabase.from("filter_logs").insert({
    guild_id: message.guild.id,
    user_id: message.author.id,
    filter_type: "antilinks",
    content: message.content.substring(0, 500),
    created_at: new Date().toISOString()
  });

  const action = config.protection.antiLinks.action || "delete";

  return {
    shouldDelete: true,
    action: action,
    blockedUrls: blockedUrls
  };
}

async function checkAntiMentions(message, config, addLog) {
  if (!config?.protection?.antiMentions?.enabled) {
    return { shouldDelete: false };
  }

  // Permitir a moderadores y administradores
  if (message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return { shouldDelete: false };
  }

  const blockEveryone = config.protection.antiMentions.blockEveryone !== false; // Por defecto true
  const maxMentions = config.protection.antiMentions.maxMentionsUser || 5;

  let shouldBlock = false;
  let reason = "";

  // Verificar @everyone y @here
  if (blockEveryone && (message.content.includes("@everyone") || message.content.includes("@here"))) {
    shouldBlock = true;
    reason = "Uso de @everyone/@here";
  }

  // Verificar menciones masivas de usuarios
  if (message.mentions.users.size > maxMentions) {
    shouldBlock = true;
    reason = `Demasiadas menciones (${message.mentions.users.size}/${maxMentions})`;
  }

  if (!shouldBlock) {
    return { shouldDelete: false };
  }

  // Guardar log
  if (addLog) {
    addLog("warning", `Anti-Menciones: ${message.author.tag} - ${reason} en ${message.guild.name}`);
  }

  await supabase.from("filter_logs").insert({
    guild_id: message.guild.id,
    user_id: message.author.id,
    filter_type: "antimentions",
    content: message.content.substring(0, 500),
    created_at: new Date().toISOString()
  });

  const action = config.protection.antiMentions.action || "delete";

  return {
    shouldDelete: true,
    action: action,
    reason: reason
  };
}

async function applyFilterAction(message, action, filterType, addLog) {
  try {
    // Borrar mensaje
    if (message.deletable) {
      await message.delete();
    }

    if (action === "delete") {
      // Solo borrar, ya está hecho arriba
      return;
    }

    const member = message.member;
    if (!member) return;

    if (action === "warn") {
      // Añadir warn automático
      const { supabase } = require("./db");
      await supabase.from("warns").insert({
        user_id: member.id,
        guild_id: message.guild.id,
        mod_id: message.client.user.id,
        reason: `[Auto] Violación de filtro: ${filterType}`,
        created_at: new Date().toISOString()
      });

      if (addLog) {
        addLog("info", `Warn automático a ${member.user.tag} por ${filterType}`);
      }
    }

    if (action === "timeout") {
      // Timeout de 5 minutos
      await member.timeout(5 * 60 * 1000, `[Auto] Violación de filtro: ${filterType}`);

      if (addLog) {
        addLog("info", `Timeout automático a ${member.user.tag} por ${filterType}`);
      }
    }

    if (action === "kick") {
      // Kick del servidor
      await member.kick(`[Auto] Violación de filtro: ${filterType}`);

      if (addLog) {
        addLog("warning", `Kick automático a ${member.user.tag} por ${filterType}`);
      }
    }
  } catch (e) {
    if (addLog) {
      addLog("error", `Error aplicando acción de filtro: ${e.message}`);
    }
  }
}

module.exports = {
  checkAntiLinks,
  checkAntiMentions,
  applyFilterAction
};
