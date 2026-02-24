const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const { loadGuildConfig, updateGuildConfig } = require("../utils/configManager");
const { enableRaidMode, disableRaidMode, checkRaidMode } = require("../utils/protectionManager");

const EMOJI = {
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>",
  SHIELD: "🛡️"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("proteccion")
    .setDescription("Sistema de protección anti-nuke y anti-raid")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName("anti-nuke")
        .setDescription("Configurar límites anti-nuke")
        .addStringOption(opt =>
          opt.setName("accion")
            .setDescription("¿Qué acción configurar?")
            .setRequired(true)
            .addChoices(
              { name: "Habilitar/Deshabilitar", value: "toggle" },
              { name: "Configurar límites", value: "limits" },
              { name: "Ver estado", value: "status" }
            )))
    .addSubcommand(sub =>
      sub.setName("raid-mode")
        .setDescription("Activar/desactivar modo raid")
        .addStringOption(opt =>
          opt.setName("estado")
            .setDescription("Activar o desactivar")
            .setRequired(true)
            .addChoices(
              { name: "Activar", value: "on" },
              { name: "Desactivar", value: "off" }
            ))
        .addIntegerOption(opt =>
          opt.setName("duracion")
            .setDescription("Duración en minutos (dejar vacío = indefinido)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(1440)))
    .addSubcommand(sub =>
      sub.setName("limites")
        .setDescription("Configurar límites de acciones anti-nuke")
        .addIntegerOption(opt =>
          opt.setName("roles_crear")
            .setDescription("Máximo de roles creados por minuto")
            .setMinValue(1)
            .setMaxValue(20))
        .addIntegerOption(opt =>
          opt.setName("roles_borrar")
            .setDescription("Máximo de roles borrados por minuto")
            .setMinValue(1)
            .setMaxValue(20))
        .addIntegerOption(opt =>
          opt.setName("canales_crear")
            .setDescription("Máximo de canales creados por minuto")
            .setMinValue(1)
            .setMaxValue(20))
        .addIntegerOption(opt =>
          opt.setName("canales_borrar")
            .setDescription("Máximo de canales borrados por minuto")
            .setMinValue(1)
            .setMaxValue(20))
        .addIntegerOption(opt =>
          opt.setName("bans")
            .setDescription("Máximo de bans por minuto")
            .setMinValue(1)
            .setMaxValue(20))
        .addIntegerOption(opt =>
          opt.setName("kicks")
            .setDescription("Máximo de kicks por minuto")
            .setMinValue(1)
            .setMaxValue(20)))
    .addSubcommand(sub =>
      sub.setName("estado")
        .setDescription("Ver estado actual de la protección")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guild.id;

    // ==================== ANTI-NUKE ====================
    if (sub === "anti-nuke") {
      const accion = interaction.options.getString("accion");
      const config = await loadGuildConfig(guildId);

      if (accion === "toggle") {
        const currentState = config?.protection?.antiNuke?.enabled || false;
        const newState = !currentState;

        await updateGuildConfig(guildId, {
          protection: {
            ...(config.protection || {}),
            antiNuke: {
              ...(config.protection?.antiNuke || {}),
              enabled: newState
            }
          }
        });

        const embed = new EmbedBuilder()
          .setColor(newState ? "#00FF00" : "#FF6B6B")
          .setTitle(EMOJI.SHIELD + " Anti-Nuke " + (newState ? "Activado" : "Desactivado"))
          .setDescription(
            newState
              ? "El sistema anti-nuke está ahora **activo**. Se detectarán acciones masivas sospechosas."
              : "El sistema anti-nuke está ahora **desactivado**."
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (accion === "status") {
        const antiNuke = config?.protection?.antiNuke;
        const enabled = antiNuke?.enabled || false;
        const limits = antiNuke?.limits || {};

        const embed = new EmbedBuilder()
          .setColor(enabled ? "#00FF00" : "#95A5A6")
          .setTitle(EMOJI.SHIELD + " Estado Anti-Nuke")
          .setDescription("Estado: **" + (enabled ? "Activo" : "Desactivado") + "**")
          .addFields(
            { name: "🛡️ Roles Crear", value: "" + (limits.roleCreate || 3), inline: true },
            { name: "🛡️ Roles Borrar", value: "" + (limits.roleDelete || 3), inline: true },
            { name: "🛡️ Canales Crear", value: "" + (limits.channelCreate || 3), inline: true },
            { name: "🛡️ Canales Borrar", value: "" + (limits.channelDelete || 3), inline: true },
            { name: "🛡️ Bans", value: "" + (limits.ban || 3), inline: true },
            { name: "🛡️ Kicks", value: "" + (limits.kick || 3), inline: true }
          )
          .setFooter({ text: "Usa /proteccion limites para cambiar" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    // ==================== RAID MODE ====================
    if (sub === "raid-mode") {
      const estado = interaction.options.getString("estado");
      const duracion = interaction.options.getInteger("duracion");

      if (estado === "on") {
        await enableRaidMode(guildId, duracion, null);

        const embed = new EmbedBuilder()
          .setColor("#FF0000")
          .setTitle("🚨 Modo Raid Activado")
          .setDescription(
            "El servidor está ahora en **Modo Raid**.\n\n" +
            "• Protección máxima contra ataques\n" +
            "• Acciones sospechosas serán bloqueadas automáticamente\n" +
            (duracion ? `• Se desactivará automáticamente en **${duracion} minutos**` : "• Permanecerá activo hasta que lo desactives manualmente")
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (estado === "off") {
        await disableRaidMode(guildId, null);

        const embed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle(EMOJI.CHECK + " Modo Raid Desactivado")
          .setDescription("El servidor ha vuelto a la normalidad.")
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    // ==================== LIMITES ====================
    if (sub === "limites") {
      const config = await loadGuildConfig(guildId);
      const currentLimits = config?.protection?.antiNuke?.limits || {};

      const newLimits = {
        roleCreate: interaction.options.getInteger("roles_crear") || currentLimits.roleCreate || 3,
        roleDelete: interaction.options.getInteger("roles_borrar") || currentLimits.roleDelete || 3,
        channelCreate: interaction.options.getInteger("canales_crear") || currentLimits.channelCreate || 3,
        channelDelete: interaction.options.getInteger("canales_borrar") || currentLimits.channelDelete || 3,
        ban: interaction.options.getInteger("bans") || currentLimits.ban || 3,
        kick: interaction.options.getInteger("kicks") || currentLimits.kick || 3
      };

      await updateGuildConfig(guildId, {
        protection: {
          ...(config.protection || {}),
          antiNuke: {
            ...(config.protection?.antiNuke || {}),
            limits: newLimits
          }
        }
      });

      const embed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle(EMOJI.CHECK + " Límites Anti-Nuke Actualizados")
        .setDescription("Los nuevos límites se han guardado correctamente.")
        .addFields(
          { name: "Roles Crear", value: "" + newLimits.roleCreate, inline: true },
          { name: "Roles Borrar", value: "" + newLimits.roleDelete, inline: true },
          { name: "Canales Crear", value: "" + newLimits.channelCreate, inline: true },
          { name: "Canales Borrar", value: "" + newLimits.channelDelete, inline: true },
          { name: "Bans", value: "" + newLimits.ban, inline: true },
          { name: "Kicks", value: "" + newLimits.kick, inline: true }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ==================== ESTADO ====================
    if (sub === "estado") {
      const config = await loadGuildConfig(guildId);
      const antiNuke = config?.protection?.antiNuke;
      const raidMode = config?.protection?.raidMode;

      const embed = new EmbedBuilder()
        .setColor("#00BFFF")
        .setTitle(EMOJI.SHIELD + " Estado de Protección")
        .addFields(
          {
            name: "🛡️ Anti-Nuke",
            value: antiNuke?.enabled ? "✅ **Activo**" : "❌ **Inactivo**",
            inline: true
          },
          {
            name: "🚨 Modo Raid",
            value: raidMode?.enabled
              ? "✅ **Activo**" + (raidMode.endsAt ? " (temporal)" : " (indefinido)")
              : "❌ **Inactivo**",
            inline: true
          }
        )
        .setFooter({ text: "Servidor: " + interaction.guild.name })
        .setTimestamp();

      if (raidMode?.enabled && raidMode.endsAt) {
        embed.addFields({
          name: "⏱️ Finaliza",
          value: "<t:" + Math.floor(new Date(raidMode.endsAt).getTime() / 1000) + ":R>",
          inline: true
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
