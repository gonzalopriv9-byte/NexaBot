const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const { supabase } = require("../utils/db");
const { loadGuildConfig } = require("../utils/configManager");

const EMOJI = {
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>",
  WARNING: "⚠️"
};

async function getWarns(userId, guildId) {
  const { data, error } = await supabase
    .from("warns")
    .select("*")
    .eq("user_id", userId)
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error obteniendo warns:", error.message);
    return [];
  }

  return data || [];
}

async function addWarn(userId, guildId, modId, reason) {
  const { error } = await supabase
    .from("warns")
    .insert({
      user_id: userId,
      guild_id: guildId,
      mod_id: modId,
      reason: reason,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error("Error añadiendo warn:", error.message);
    return false;
  }

  return true;
}

async function clearWarns(userId, guildId) {
  const { error } = await supabase
    .from("warns")
    .delete()
    .eq("user_id", userId)
    .eq("guild_id", guildId);

  if (error) {
    console.error("Error limpiando warns:", error.message);
    return false;
  }

  return true;
}

async function applyAutoPunish(member, warnCount, config) {
  if (!config?.protection?.autoPunish?.enabled) {
    return null;
  }

  const thresholds = config.protection.autoPunish.thresholds || {
    3: { action: "timeout", duration: 60 },
    5: { action: "kick" },
    7: { action: "ban" }
  };

  const punishment = thresholds[warnCount];
  if (!punishment) return null;

  try {
    if (punishment.action === "timeout") {
      const duration = punishment.duration || 60;
      await member.timeout(duration * 60 * 1000, `[Auto-Punish] ${warnCount} advertencias`);
      return `Timeout de ${duration} minutos`;
    }

    if (punishment.action === "kick") {
      await member.kick(`[Auto-Punish] ${warnCount} advertencias`);
      return "Expulsado del servidor";
    }

    if (punishment.action === "ban") {
      await member.ban({ reason: `[Auto-Punish] ${warnCount} advertencias` });
      return "Baneado del servidor";
    }
  } catch (e) {
    console.error("Error aplicando auto-punish:", e.message);
    return null;
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Sistema de advertencias")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("Añadir advertencia a un usuario")
        .addUserOption(opt =>
          opt.setName("usuario")
            .setDescription("Usuario a advertir")
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName("razon")
            .setDescription("Razón de la advertencia")
            .setRequired(true)
            .setMaxLength(500)))
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("Ver advertencias de un usuario")
        .addUserOption(opt =>
          opt.setName("usuario")
            .setDescription("Usuario a consultar")
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName("clear")
        .setDescription("Limpiar todas las advertencias de un usuario")
        .addUserOption(opt =>
          opt.setName("usuario")
            .setDescription("Usuario a limpiar")
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Eliminar una advertencia específica")
        .addIntegerOption(opt =>
          opt.setName("id")
            .setDescription("ID de la advertencia a eliminar")
            .setRequired(true)
            .setMinValue(1))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    const guildId = interaction.guild.id;
    const config = await loadGuildConfig(guildId);

    // ==================== ADD WARN ====================
    if (sub === "add") {
      const user = interaction.options.getUser("usuario");
      const reason = interaction.options.getString("razon");

      if (user.bot) {
        return interaction.editReply({
          content: `${EMOJI.CRUZ} No puedes advertir a bots.`,
          flags: 64
        });
      }

      if (user.id === interaction.user.id) {
        return interaction.editReply({
          content: `${EMOJI.CRUZ} No puedes advertirte a ti mismo.`,
          flags: 64
        });
      }

      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        return interaction.editReply({
          content: `${EMOJI.CRUZ} El usuario no está en el servidor.`,
          flags: 64
        });
      }

      // Añadir warn
      const success = await addWarn(user.id, guildId, interaction.user.id, reason);
      if (!success) {
        return interaction.editReply({
          content: `${EMOJI.CRUZ} Error al añadir la advertencia.`,
          flags: 64
        });
      }

      // Obtener total de warns
      const warns = await getWarns(user.id, guildId);
      const warnCount = warns.length;

      // Aplicar auto-punish si está configurado
      const punishment = await applyAutoPunish(member, warnCount, config);

      const embed = new EmbedBuilder()
        .setColor("#FFA500")
        .setTitle(`${EMOJI.WARNING} Advertencia Añadida`)
        .setDescription(`**Usuario:** ${user}\n**Razón:** ${reason}\n**Total de advertencias:** ${warnCount}`)
        .setFooter({ text: `Por ${interaction.user.tag}` })
        .setTimestamp();

      if (punishment) {
        embed.addFields({
          name: "⚡ Auto-Punish Aplicado",
          value: punishment,
          inline: false
        });
      }

      // Enviar DM al usuario
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor("#FFA500")
          .setTitle(`${EMOJI.WARNING} Has recibido una advertencia`)
          .setDescription(`**Servidor:** ${interaction.guild.name}\n**Razón:** ${reason}\n**Total de advertencias:** ${warnCount}`)
          .setTimestamp();

        if (punishment) {
          dmEmbed.addFields({
            name: "⚡ Sanción Aplicada",
            value: punishment,
            inline: false
          });
        }

        await user.send({ embeds: [dmEmbed] });
      } catch {
        embed.setFooter({ text: `Por ${interaction.user.tag} • No se pudo enviar DM al usuario` });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ==================== LIST WARNS ====================
    if (sub === "list") {
      const user = interaction.options.getUser("usuario");
      const warns = await getWarns(user.id, guildId);

      if (warns.length === 0) {
        return interaction.editReply({
          content: `${EMOJI.CHECK} ${user} no tiene advertencias.`,
          flags: 64
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#FFA500")
        .setTitle(`${EMOJI.WARNING} Advertencias de ${user.username}`)
        .setDescription(`Total: **${warns.length}** advertencias`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 128 }))
        .setTimestamp();

      // Mostrar solo las últimas 10 warns
      const displayWarns = warns.slice(0, 10);
      for (const warn of displayWarns) {
        const mod = await interaction.client.users.fetch(warn.mod_id).catch(() => null);
        const date = new Date(warn.created_at);

        embed.addFields({
          name: `ID: ${warn.id} • <t:${Math.floor(date.getTime() / 1000)}:R>`,
          value: `**Razón:** ${warn.reason}\n**Por:** ${mod ? mod.tag : "Usuario desconocido"}`,
          inline: false
        });
      }

      if (warns.length > 10) {
        embed.setFooter({ text: `Mostrando 10 de ${warns.length} advertencias` });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ==================== CLEAR WARNS ====================
    if (sub === "clear") {
      const user = interaction.options.getUser("usuario");
      const warns = await getWarns(user.id, guildId);

      if (warns.length === 0) {
        return interaction.editReply({
          content: `${EMOJI.CRUZ} ${user} no tiene advertencias.`,
          flags: 64
        });
      }

      const success = await clearWarns(user.id, guildId);
      if (!success) {
        return interaction.editReply({
          content: `${EMOJI.CRUZ} Error al limpiar las advertencias.`,
          flags: 64
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle(`${EMOJI.CHECK} Advertencias Eliminadas`)
        .setDescription(`Se eliminaron **${warns.length}** advertencias de ${user}`)
        .setFooter({ text: `Por ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ==================== REMOVE WARN ====================
    if (sub === "remove") {
      const warnId = interaction.options.getInteger("id");

      const { error } = await supabase
        .from("warns")
        .delete()
        .eq("id", warnId)
        .eq("guild_id", guildId);

      if (error) {
        return interaction.editReply({
          content: `${EMOJI.CRUZ} Error al eliminar la advertencia. Verifica que el ID sea correcto.`,
          flags: 64
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle(`${EMOJI.CHECK} Advertencia Eliminada`)
        .setDescription(`Se eliminó la advertencia con ID **${warnId}**`)
        .setFooter({ text: `Por ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
