const { PermissionFlagsBits } = require("discord.js");
const { loadGuildConfig } = require("./configManager");

// Lista de dominios permitidos por defecto
const DEFAULT_ALLOWED_DOMAINS = [
  "discord.gg",
  "discord.com",
  "discordapp.com",
  "youtube.com",
  "youtu.be",
  "twitch.tv",
  "twitter.com",
  "x.com",
  "github.com",
  "imgur.com"
];

// Regex para detectar URLs
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

/**
 * Verifica si un mensaje contiene links no permitidos
 */
async function checkAntiLinks(message, addLog) {
  try {
    const config = await loadGuildConfig(message.guild.id);
    
    if (!config?.protection?.antiLinks?.enabled) {
      return { shouldAct: false };
    }
    
    // Verificar si el usuario tiene permisos de moderador (exentos)
    if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return { shouldAct: false };
    }
    
    const urls = message.content.match(URL_REGEX);
    if (!urls || urls.length === 0) {
      return { shouldAct: false };
    }
    
    const allowList = config.protection.antiLinks.allowList || DEFAULT_ALLOWED_DOMAINS;
    
    // Verificar cada URL
    for (const url of urls) {
      let isAllowed = false;
      for (const domain of allowList) {
        if (url.toLowerCase().includes(domain.toLowerCase())) {
          isAllowed = true;
          break;
        }
      }
      
      if (!isAllowed) {
        if (addLog) {
          addLog("warning", `Anti-Links: ${message.author.tag} envió link no permitido: ${url}`);
        }
        return { shouldAct: true, url };
      }
    }
    
    return { shouldAct: false };
  } catch (e) {
    if (addLog) addLog("error", "Error checkAntiLinks: " + e.message);
    return { shouldAct: false };
  }
}

/**
 * Verifica si un mensaje contiene menciones masivas
 */
async function checkAntiMentions(message, addLog) {
  try {
    const config = await loadGuildConfig(message.guild.id);
    
    if (!config?.protection?.antiMentions?.enabled) {
      return { shouldAct: false };
    }
    
    // Verificar si el usuario tiene permisos de moderador (exentos)
    if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return { shouldAct: false };
    }
    
    const blockEveryone = config.protection.antiMentions.blockEveryone ?? true;
    const maxMentions = config.protection.antiMentions.maxMentionsUser || 5;
    
    // Verificar @everyone o @here
    if (blockEveryone && (message.content.includes("@everyone") || message.content.includes("@here"))) {
      if (addLog) {
        addLog("warning", `Anti-Mentions: ${message.author.tag} usó @everyone/@here`);
      }
      return { shouldAct: true, reason: "@everyone/@here" };
    }
    
    // Verificar cantidad de menciones
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    if (mentionCount > maxMentions) {
      if (addLog) {
        addLog("warning", `Anti-Mentions: ${message.author.tag} mencionó ${mentionCount} usuarios/roles`);
      }
      return { shouldAct: true, reason: `${mentionCount} menciones`, count: mentionCount };
    }
    
    return { shouldAct: false };
  } catch (e) {
    if (addLog) addLog("error", "Error checkAntiMentions: " + e.message);
    return { shouldAct: false };
  }
}

/**
 * Aplica la acción configurada para anti-links
 */
async function punishAntiLinks(message, config, addLog) {
  try {
    const action = config?.protection?.antiLinks?.action || "delete";
    
    // Borrar mensaje
    if (action === "delete" || action === "warn" || action === "timeout") {
      await message.delete().catch(() => {});
    }
    
    // Timeout (mute temporal)
    if (action === "timeout" && message.member) {
      const duration = config.protection.antiLinks.timeoutDuration || 5; // minutos
      await message.member.timeout(duration * 60 * 1000, "Anti-Links: envió link no permitido").catch(() => {});
      
      if (addLog) {
        addLog("info", `${message.author.tag} recibió timeout de ${duration} min por anti-links`);
      }
    }
    
    // Enviar advertencia
    if (action === "warn") {
      await message.channel.send({
        content: `${message.author}, los links externos no están permitidos en este servidor.`,
        allowedMentions: { users: [message.author.id] }
      }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    }
    
    return true;
  } catch (e) {
    if (addLog) addLog("error", "Error punishAntiLinks: " + e.message);
    return false;
  }
}

/**
 * Aplica la acción configurada para anti-menciones
 */
async function punishAntiMentions(message, config, addLog) {
  try {
    const action = config?.protection?.antiMentions?.action || "delete";
    
    // Borrar mensaje
    if (action === "delete" || action === "warn" || action === "timeout" || action === "kick") {
      await message.delete().catch(() => {});
    }
    
    // Timeout
    if (action === "timeout" && message.member) {
      const duration = config.protection.antiMentions.timeoutDuration || 10; // minutos
      await message.member.timeout(duration * 60 * 1000, "Anti-Mentions: menciones masivas").catch(() => {});
      
      if (addLog) {
        addLog("info", `${message.author.tag} recibió timeout de ${duration} min por menciones masivas`);
      }
    }
    
    // Kick
    if (action === "kick" && message.member) {
      await message.member.kick("Anti-Mentions: menciones masivas").catch(() => {});
      
      if (addLog) {
        addLog("warning", `${message.author.tag} fue kickeado por menciones masivas`);
      }
    }
    
    // Advertencia
    if (action === "warn") {
      await message.channel.send({
        content: `${message.author}, no uses menciones masivas.`,
        allowedMentions: { users: [message.author.id] }
      }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    }
    
    return true;
  } catch (e) {
    if (addLog) addLog("error", "Error punishAntiMentions: " + e.message);
    return false;
  }
}

module.exports = {
  checkAntiLinks,
  checkAntiMentions,
  punishAntiLinks,
  punishAntiMentions,
  DEFAULT_ALLOWED_DOMAINS
};
