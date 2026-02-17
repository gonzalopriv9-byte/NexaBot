const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { loadGuildConfig } = require('../utils/configManager');

const EMOJI = {
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setuptrabajos')
    .setDescription('Crear panel de selección de trabajos')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: 64 });

      const guildConfig = loadGuildConfig(interaction.guild.id);

      // Verificar si el sistema está configurado
      if (!guildConfig || !guildConfig.trabajos.enabled) {
        return interaction.editReply({
          content: `${EMOJI.CRUZ} El sistema de trabajos no está configurado.\n` +
                   `Usa \`/config trabajos\` primero para configurar los roles.`
        });
      }

      const TRABAJOS = guildConfig.trabajos.roles;
      const guild = interaction.guild;

      // Contar miembros por trabajo
      const contadores = {};
      for (const [key, trabajo] of Object.entries(TRABAJOS)) {
        const role = guild.roles.cache.get(trabajo.roleId);
        contadores[key] = role ? role.members.size : 0;
      }

      // Crear embed
      const trabajosList = Object.entries(TRABAJOS)
        .map(([key, trabajo]) => `${trabajo.emoji} **${trabajo.nombre}:** \`${contadores[key]}\` personas`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor("#00BFFF")
        .setTitle("💼 CENTRO DE EMPLEO")
        .setDescription(
          "Selecciona tu trabajo haciendo clic en el botón correspondiente.\n\n" +
          "**📊 Personal actual por departamento:**\n" +
          trabajosList + "\n\n" +
          "⚠️ **Importante:**\n" +
          "• Solo puedes tener un trabajo a la vez\n" +
          "• Al seleccionar un trabajo nuevo, perderás el anterior\n" +
          "• El panel se actualiza automáticamente"
        )
        .setFooter({ text: "Sistema de empleos" })
        .setTimestamp();

      // Crear botones dinámicamente
      const rows = [];
      const trabajosArray = Object.entries(TRABAJOS);

      for (let i = 0; i < trabajosArray.length; i += 2) {
        const row = new ActionRowBuilder();

        for (let j = i; j < Math.min(i + 2, trabajosArray.length); j++) {
          const [key, trabajo] = trabajosArray[j];
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`trabajo_${key}`)
              .setLabel(`${trabajo.emoji} ${trabajo.nombre} (${contadores[key]})`)
              .setStyle(j % 4 === 0 ? ButtonStyle.Primary : 
                       j % 4 === 1 ? ButtonStyle.Danger : 
                       j % 4 === 2 ? ButtonStyle.Secondary : ButtonStyle.Success)
          );
        }

        rows.push(row);
      }

      // Botón de renunciar
      const quitRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("trabajo_quitar")
          .setLabel("🚫 Renunciar a mi trabajo")
          .setStyle(ButtonStyle.Danger)
      );
      rows.push(quitRow);

      // Enviar panel al canal
      await interaction.channel.send({
        embeds: [embed],
        components: rows
      });

      await interaction.editReply({
        content: `${EMOJI.CHECK} Panel de trabajos creado exitosamente en este canal.`
      });

    } catch (error) {
      console.error('Error en setuptrabajos:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `${EMOJI.CRUZ} Error al crear el panel de trabajos.`,
          flags: 64
        }).catch(() => {});
      } else {
        await interaction.editReply({
          content: `${EMOJI.CRUZ} Error al crear el panel de trabajos.`
        }).catch(() => {});
      }
    }
  }
};
