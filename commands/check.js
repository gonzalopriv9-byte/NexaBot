const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const { supabase } = require("../utils/db");

const EMOJI = {
  SHIELD: "🛡️",
  WARNING: "⚠️",
  CHECK: "<a:Check:1472540340584972509>",
  INFO: "ℹ️"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("check")
    .setDescription("Inspeccionar información de seguridad de un usuario")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt.setName("usuario")
        .setDescription("Usuario a inspeccionar")
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    const user = interaction.options.getUser("usuario");
    const guildId = interaction.guild.id;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    // ==================== INFORMACIÓN BÁSICA ====================
    const accountAge = Date.now() - user.createdTimestamp;
    const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
    const joinAge = member ? Date.now() - member.joinedTimestamp : null;
    const joinAgeDays = joinAge ? Math.floor(joinAge / (1000 * 60 * 60 * 24)) : null;

    const isNewAccount = accountAgeDays < 30;
    const isRecentJoin = joinAgeDays !== null && joinAgeDays < 7;

    // ==================== WARNS ====================
    const { data: warns } = await supabase
      .from("warns")
      .select("*")
      .eq("user_id", user.id)
      .eq("guild_id", guildId);

    const warnCount = warns?.length || 0;

    // ==================== BANS GLOBALES ====================
    const { data: globalBan } = await supabase
      .from("global_bans")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // ==================== PROTECCIÓN LOGS ====================
    const { data: protectionLogs } = await supabase
      .from("protection_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("guild_id", guildId)
      .order("triggered_at", { ascending: false })
      .limit(5);

    const hasProtectionIncidents = protectionLogs && protectionLogs.length > 0;

    // ==================== NIVEL DE RIESGO ====================
    let riskLevel = 0;
    const risks = [];

    if (isNewAccount) {
      riskLevel += 2;
      risks.push("⚠️ Cuenta nueva (menos de 30 días)");
    }

    if (isRecentJoin) {
      riskLevel += 1;
      risks.push("🔹 Se unió recientemente (menos de 7 días)");
    }

    if (warnCount > 0) {
      riskLevel += Math.min(warnCount, 3);
      risks.push(`⚠️ Tiene ${warnCount} advertencia${warnCount > 1 ? 's' : ''}`);
    }

    if (globalBan) {
      riskLevel += 5;
      risks.push("🛑 Está en la lista de bans globales");
    }

    if (hasProtectionIncidents) {
      riskLevel += 3;
      risks.push(`🚨 Ha disparado protección anti-nuke (${protectionLogs.length} veces)`);
    }

    if (user.bot) {
      risks.push("🤖 Es un bot");
    }

    // ==================== COLOR Y ESTADO ====================
    let color = "#00FF00"; // Verde (seguro)
    let statusText = "Seguro";
    let statusEmoji = "✅";

    if (riskLevel >= 5) {
      color = "#FF0000"; // Rojo (peligroso)
      statusText = "Alto Riesgo";
      statusEmoji = "🛑";
    } else if (riskLevel >= 3) {
      color = "#FFA500"; // Naranja (moderado)
      statusText = "Riesgo Moderado";
      statusEmoji = "⚠️";
    } else if (riskLevel >= 1) {
      color = "#FFFF00"; // Amarillo (bajo)
      statusText = "Riesgo Bajo";
      statusEmoji = "🔶";
    }

    // ==================== EMBED ====================
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${EMOJI.SHIELD} Inspección de Usuario`)
      .setDescription(`**Usuario:** ${user}\n**Estado:** ${statusEmoji} ${statusText}${riskLevel > 0 ? ` (${riskLevel} puntos)` : ''}`);

    // Información básica
    embed.addFields(
      {
        name: "🆔 ID de Usuario",
        value: `\`${user.id}\``,
        inline: true
      },
      {
        name: "📅 Cuenta Creada",
        value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>\n(${accountAgeDays} días)`,
        inline: true
      }
    );

    if (member) {
      embed.addFields({
        name: "📍 Se Unió al Servidor",
        value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>\n(${joinAgeDays} días)`,
        inline: true
      });
    }

    // Factores de riesgo
    if (risks.length > 0) {
      embed.addFields({
        name: "🚨 Factores de Riesgo",
        value: risks.join("\n"),
        inline: false
      });
    } else {
      embed.addFields({
        name: "✅ Sin Factores de Riesgo",
        value: "Este usuario no presenta indicadores de riesgo.",
        inline: false
      });
    }

    // Advertencias recientes
    if (warnCount > 0) {
      const recentWarns = warns.slice(0, 3);
      const warnsText = recentWarns.map(w => {
        const date = new Date(w.created_at);
        return `• <t:${Math.floor(date.getTime() / 1000)}:R>: ${w.reason.substring(0, 50)}${w.reason.length > 50 ? '...' : ''}`;
      }).join("\n");

      embed.addFields({
        name: `${EMOJI.WARNING} Últimas Advertencias (${warnCount} total)`,
        value: warnsText + (warnCount > 3 ? `\n*... y ${warnCount - 3} más*` : ''),
        inline: false
      });
    }

    // Ban global
    if (globalBan) {
      embed.addFields({
        name: "🛑 Ban Global Activo",
        value: `**Razón:** ${globalBan.reason}\n**Fecha:** <t:${Math.floor(new Date(globalBan.banned_at).getTime() / 1000)}:R>`,
        inline: false
      });
    }

    // Incidentes de protección
    if (hasProtectionIncidents) {
      const incidentsText = protectionLogs.slice(0, 3).map(log => {
        const date = new Date(log.triggered_at);
        return `• <t:${Math.floor(date.getTime() / 1000)}:R>: ${log.action} (${log.count}x)`;
      }).join("\n");

      embed.addFields({
        name: "🚨 Incidentes de Protección",
        value: incidentsText,
        inline: false
      });
    }

    // Roles (si es miembro)
    if (member && member.roles.cache.size > 1) {
      const roles = member.roles.cache
        .filter(r => r.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => r)
        .slice(0, 10);

      if (roles.length > 0) {
        embed.addFields({
          name: `🎭 Roles (${member.roles.cache.size - 1})`,
          value: roles.join(", ") + (member.roles.cache.size > 11 ? " ..." : ""),
          inline: false
        });
      }
    }

    embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));
    embed.setFooter({ text: `Inspección solicitada por ${interaction.user.tag}` });
    embed.setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
