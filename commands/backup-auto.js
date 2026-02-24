const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const { loadGuildConfig, updateGuildConfig } = require("../utils/configManager");

const EMOJI = {
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>"
};

// Límites recomendados
const MIN_INTERVAL_MINUTES = 30;
const MAX_INTERVAL_MINUTES = 1440; // 24 horas
const DEFAULT_INTERVAL_MINUTES = 360; // 6 horas
const DEFAULT_MAX_BACKUPS = 20;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("backup-auto")
    .setDescription("Configurar el sistema de backups automáticos")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName("habilitar")
        .setDescription("Activa los backups automáticos")
        .addIntegerOption(opt =>
          opt.setName("intervalo")
            .setDescription(`Minutos entre backups (${MIN_INTERVAL_MINUTES}-${MAX_INTERVAL_MINUTES})`)
            .setRequired(true)
            .setMinValue(MIN_INTERVAL_MINUTES)
            .setMaxValue(MAX_INTERVAL_MINUTES))
        .addIntegerOption(opt =>
          opt.setName("max_backups")
            .setDescription("Máximo de backups a conservar (rotativo)")
            .setRequired(false)
            .setMinValue(5)
            .setMaxValue(50)))
    .addSubcommand(sub =>
      sub.setName("deshabilitar")
        .setDescription("Desactiva los backups automáticos"))
    .addSubcommand(sub =>
      sub.setName("estado")
        .setDescription("Ver configuración actual de backups automáticos")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guild.id;

    // ==================== HABILITAR ====================
    if (sub === "habilitar") {
      const intervalo = interaction.options.getInteger("intervalo");
      const maxBackups = interaction.options.getInteger("max_backups") || DEFAULT_MAX_BACKUPS;

      try {
        await updateGuildConfig(guildId, {
          autoBackup: {
            enabled: true,
            intervalMinutes: intervalo,
            maxBackups: maxBackups,
            lastBackupAt: null
          }
        });

        const embed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle(EMOJI.CHECK + " Backup Automático Habilitado")
          .setDescription(
            "El sistema creará backups automáticos del servidor cada **" + intervalo + " minutos** (" + (intervalo / 60).toFixed(1) + " horas).\n\n" +
            "Se conservarán los últimos **" + maxBackups + " backups**, eliminando automáticamente los más antiguos."
          )
          .addFields(
            { name: "📅 Próximo backup", value: "En aproximadamente " + intervalo + " minutos", inline: true },
            { name: "💾 Backups máximos", value: "" + maxBackups, inline: true }
          )
          .setFooter({ text: "Usa /backup-auto estado para ver el estado" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: EMOJI.CRUZ + " Error configurando backup automático: " + e.message });
      }
    }

    // ==================== DESHABILITAR ====================
    if (sub === "deshabilitar") {
      try {
        const config = await loadGuildConfig(guildId);

        if (!config.autoBackup?.enabled) {
          return interaction.editReply({ content: EMOJI.CRUZ + " El backup automático ya está deshabilitado." });
        }

        await updateGuildConfig(guildId, {
          autoBackup: {
            ...config.autoBackup,
            enabled: false
          }
        });

        const embed = new EmbedBuilder()
          .setColor("#FF6B6B")
          .setTitle("Backup Automático Deshabilitado")
          .setDescription("Los backups automáticos se han desactivado. Los backups existentes se mantienen intactos.")
          .setFooter({ text: "Usa /backup-auto habilitar para reactivar" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: EMOJI.CRUZ + " Error: " + e.message });
      }
    }

    // ==================== ESTADO ====================
    if (sub === "estado") {
      try {
        const config = await loadGuildConfig(guildId);
        const autoBackup = config.autoBackup;

        if (!autoBackup || !autoBackup.enabled) {
          const embed = new EmbedBuilder()
            .setColor("#95A5A6")
            .setTitle("Backup Automático: Deshabilitado")
            .setDescription("El sistema de backups automáticos no está activo.\n\nUsa `/backup-auto habilitar` para activarlo.")
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }

        const lastBackup = autoBackup.lastBackupAt ? new Date(autoBackup.lastBackupAt) : null;
        const nextBackup = lastBackup
          ? new Date(lastBackup.getTime() + autoBackup.intervalMinutes * 60 * 1000)
          : new Date(Date.now() + autoBackup.intervalMinutes * 60 * 1000);

        const embed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle(EMOJI.CHECK + " Backup Automático: Activo")
          .addFields(
            { name: "⏱️ Intervalo", value: autoBackup.intervalMinutes + " minutos (" + (autoBackup.intervalMinutes / 60).toFixed(1) + " horas)", inline: true },
            { name: "💾 Backups máximos", value: "" + autoBackup.maxBackups, inline: true },
            { name: "📅 Último backup", value: lastBackup ? "<t:" + Math.floor(lastBackup.getTime() / 1000) + ":R>" : "Aún no ejecutado", inline: false },
            { name: "🔄 Próximo backup", value: "<t:" + Math.floor(nextBackup.getTime() / 1000) + ":R>", inline: false }
          )
          .setFooter({ text: "Servidor: " + interaction.guild.name })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: EMOJI.CRUZ + " Error obteniendo estado: " + e.message });
      }
    }
  }
};
