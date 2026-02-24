const { PermissionFlagsBits } = require("discord.js");
const { loadGuildConfig } = require("./configManager");
const { supabase } = require("./db");

async function checkAntiAlts(member, config, addLog) {
  if (!config?.protection?.antiAlts?.enabled) return false;
  
  const minAccountAgeDays = config.protection.antiAlts.minAccountAgeDays || 7;
  const accountAgeMs = Date.now() - member.user.createdTimestamp;
  const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
  
  if (accountAgeDays >= minAccountAgeDays) return false;
  
  // La cuenta es sospechosamente nueva
  const mode = config.protection.antiAlts.mode || "quarantine";
  
  try {
    // Guardar en base de datos
    await supabase.from("suspicious_accounts").insert({
      user_id: member.id,
      guild_id: member.guild.id,
      username: member.user.tag,
      account_age_days: Math.floor(accountAgeDays),
      detected_at: new Date().toISOString(),
      action: mode
    });
    
    if (mode === "ban") {
      await member.ban({ reason: `Anti-Alts: cuenta muy nueva (${Math.floor(accountAgeDays)} días, mínimo: ${minAccountAgeDays})` });
      if (addLog) addLog("warning", `Anti-Alts: ${member.user.tag} baneado (cuenta de ${Math.floor(accountAgeDays)} días)`);
      return true;
      
    } else if (mode === "kick") {
      await member.kick(`Anti-Alts: cuenta muy nueva (${Math.floor(accountAgeDays)} días)`);
      if (addLog) addLog("warning", `Anti-Alts: ${member.user.tag} kickeado (cuenta de ${Math.floor(accountAgeDays)} días)`);
      return true;
      
    } else if (mode === "timeout") {
      const duration = config.protection.antiAlts.timeoutDuration || 60; // minutos
      await member.timeout(duration * 60 * 1000, `Anti-Alts: cuenta muy nueva`);
      if (addLog) addLog("warning", `Anti-Alts: ${member.user.tag} timeouteado por ${duration}min (cuenta de ${Math.floor(accountAgeDays)} días)`);
      return true;
      
    } else if (mode === "quarantine") {
      const quarantineRoleId = config.protection.quarantine?.roleId;
      
      if (quarantineRoleId) {
        // Quitar todos los roles y poner solo quarantine
        const rolesToRemove = member.roles.cache.filter(r => r.id !== member.guild.id && r.id !== quarantineRoleId);
        for (const role of rolesToRemove.values()) {
          await member.roles.remove(role).catch(() => {});
        }
        
        await member.roles.add(quarantineRoleId);
        
        // Enviar DM al usuario
        try {
          await member.send({
            content: `🚨 **Cuenta en Cuarentena**\n\nTu cuenta ha sido puesta en cuarentena en **${member.guild.name}** porque es muy nueva (${Math.floor(accountAgeDays)} días).\n\nContacta con el staff para ser verificado manualmente.`
          });
        } catch {}
        
        if (addLog) addLog("warning", `Anti-Alts: ${member.user.tag} en cuarentena (cuenta de ${Math.floor(accountAgeDays)} días)`);
        return true;
      }
    } else if (mode === "flag") {
      // Solo registrar, no hacer nada
      if (addLog) addLog("info", `Anti-Alts: ${member.user.tag} marcado como sospechoso (${Math.floor(accountAgeDays)} días)`);
      
      // Notificar a canal de logs si existe
      const logsChannelId = config.protection.logsChannelId;
      if (logsChannelId) {
        const logsChannel = member.guild.channels.cache.get(logsChannelId);
        if (logsChannel) {
          await logsChannel.send({
            content: `⚠️ **Cuenta nueva detectada**\n👤 Usuario: ${member}\n📅 Edad de cuenta: **${Math.floor(accountAgeDays)} días**\n📆 Creada: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`
          });
        }
      }
      
      return false; // No bloquear al usuario
    }
    
  } catch (e) {
    if (addLog) addLog("error", "Error en anti-alts: " + e.message);
  }
  
  return false;
}

module.exports = {
  checkAntiAlts
};
