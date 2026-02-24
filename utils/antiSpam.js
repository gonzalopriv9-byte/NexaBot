const { PermissionFlagsBits } = require("discord.js");
const { loadGuildConfig } = require("./configManager");

// ==================== ANTI-LINKS ====================
const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|io|gg|xyz|tv|me|co|uk|es|de|fr|it|br|ru|jp|cn|in|au|ca)[^\s]*)/gi;

async function checkAntiLinks(message, config, addLog) {
  if (!config?.protection?.antiLinks?.enabled) return false;
  
  const urls = message.content.match(URL_REGEX);
  if (!urls) return false;
  
  const allowList = config.protection.antiLinks.allowList || [
    "discord.gg", "discord.com", "discordapp.com",
    "youtube.com", "youtu.be", "twitch.tv",
    "twitter.com", "x.com", "github.com"
  ];
  
  // Verificar si algún link NO está en la allowlist
  const blocked = urls.some(url => {
    const urlLower = url.toLowerCase();
    return !allowList.some(domain => urlLower.includes(domain));
  });
  
  if (!blocked) return false;
  
  // El mensaje contiene links no permitidos
  try {
    await message.delete();
    
    const action = config.protection.antiLinks.action || "delete";
    const member = message.member;
    
    if (action === "timeout" && member) {
      const duration = config.protection.antiLinks.timeoutDuration || 5; // minutos
      await member.timeout(duration * 60 * 1000, "Anti-Links: link no permitido");
      if (addLog) addLog("warning", `Anti-Links: ${message.author.tag} timeouteado por ${duration}min`);
    } else if (action === "kick" && member) {
      await member.kick("Anti-Links: link no permitido");
      if (addLog) addLog("warning", `Anti-Links: ${message.author.tag} kickeado`);
    } else if (action === "warn") {
      // Sistema de warns (lo implementaremos después)
      if (addLog) addLog("warning", `Anti-Links: ${message.author.tag} advertido`);
    }
    
    // Enviar notificación al usuario
    try {
      await message.channel.send({
        content: `${message.author}, los links externos no están permitidos aquí. ❌`,
        allowedMentions: { users: [message.author.id] }
      }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
    } catch {}
    
    if (addLog) addLog("info", `Anti-Links bloqueó mensaje de ${message.author.tag}`);
    return true;
    
  } catch (e) {
    if (addLog) addLog("error", "Error en anti-links: " + e.message);
    return false;
  }
}

// ==================== ANTI-MENCIONES MASIVAS ====================
async function checkAntiMentions(message, config, addLog) {
  if (!config?.protection?.antiMentions?.enabled) return false;
  
  const maxMentionsUser = config.protection.antiMentions.maxMentionsUser || 5;
  const blockEveryone = config.protection.antiMentions.blockEveryone ?? true;
  
  // Verificar @everyone/@here
  if (blockEveryone && (message.content.includes("@everyone") || message.content.includes("@here"))) {
    // Permitir si tiene permisos de staff
    const staffRoles = config.tickets?.staffRoles || [];
    const hasStaffRole = staffRoles.some(roleId => message.member?.roles.cache.has(roleId));
    
    if (!hasStaffRole && !message.member?.permissions.has(PermissionFlagsBits.MentionEveryone)) {
      try {
        await message.delete();
        
        const action = config.protection.antiMentions.action || "delete";
        const member = message.member;
        
        if (action === "timeout" && member) {
          await member.timeout(10 * 60 * 1000, "Anti-Menciones: @everyone/@here no autorizado");
          if (addLog) addLog("warning", `Anti-Menciones: ${message.author.tag} timeouteado por @everyone`);
        } else if (action === "kick" && member) {
          await member.kick("Anti-Menciones: @everyone/@here no autorizado");
          if (addLog) addLog("warning", `Anti-Menciones: ${message.author.tag} kickeado`);
        }
        
        try {
          await message.channel.send({
            content: `${message.author}, no puedes usar @everyone o @here. ❌`,
            allowedMentions: { users: [message.author.id] }
          }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
        } catch {}
        
        if (addLog) addLog("info", `Anti-Menciones bloqueó @everyone de ${message.author.tag}`);
        return true;
        
      } catch (e) {
        if (addLog) addLog("error", "Error en anti-mentions @everyone: " + e.message);
      }
    }
  }
  
  // Verificar número de menciones de usuarios
  const userMentions = message.mentions.users.size;
  if (userMentions > maxMentionsUser) {
    try {
      await message.delete();
      
      const action = config.protection.antiMentions.action || "delete";
      const member = message.member;
      
      if (action === "timeout" && member) {
        await member.timeout(5 * 60 * 1000, `Anti-Menciones: ${userMentions} menciones (max: ${maxMentionsUser})`);
        if (addLog) addLog("warning", `Anti-Menciones: ${message.author.tag} timeouteado por menciones masivas`);
      } else if (action === "kick" && member) {
        await member.kick(`Anti-Menciones: ${userMentions} menciones`);
        if (addLog) addLog("warning", `Anti-Menciones: ${message.author.tag} kickeado`);
      }
      
      try {
        await message.channel.send({
          content: `${message.author}, no puedes mencionar a tantos usuarios (máximo: ${maxMentionsUser}). ❌`,
          allowedMentions: { users: [message.author.id] }
        }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
      } catch {}
      
      if (addLog) addLog("info", `Anti-Menciones bloqueó ${userMentions} menciones de ${message.author.tag}`);
      return true;
      
    } catch (e) {
      if (addLog) addLog("error", "Error en anti-mentions masivas: " + e.message);
    }
  }
  
  return false;
}

module.exports = {
  checkAntiLinks,
  checkAntiMentions
};
