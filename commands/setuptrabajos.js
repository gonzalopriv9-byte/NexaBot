const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const TRABAJOS = {
  policia: {
    roleId: "1472275390977282101",
    emoji: "👮",
    nombre: "Policía",
    color: "#0066FF"
  },
  medico: {
    roleId: "1472275537308286976",
    emoji: "⚕️",
    nombre: "Médico",
    color: "#FF0000"
  },
  bombero: {
    roleId: "1472275475895419073",
    emoji: "🚒",
    nombre: "Bombero",
    color: "#FF6600"
  },
  mecanico: {
    roleId: "1472275662470385794",
    emoji: "🔧",
    nombre: "Mecánico (ADAC)",
    color: "#FFD700"
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setuptrabajos")
    .setDescription("Crea el panel de selección de trabajos")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;

      // Contar miembros por trabajo
      function contarMiembros() {
        const contadores = {};
        for (const [key, trabajo] of Object.entries(TRABAJOS)) {
          const role = guild.roles.cache.get(trabajo.roleId);
          contadores[key] = role ? role.members.size : 0;
        }
        return contadores;
      }

      const contadores = contarMiembros();

      // Crear embed
      const embed = new EmbedBuilder()
        .setColor("#00BFFF")
        .setTitle("💼 CENTRO DE EMPLEO")
        .setDescription(
          "Selecciona tu trabajo haciendo clic en el botón correspondiente.\n\n" +
          "**📊 Personal actual por departamento:**\n" +
          `${TRABAJOS.policia.emoji} **Policía:** \`${contadores.policia}\` oficiales\n` +
          `${TRABAJOS.medico.emoji} **Médico:** \`${contadores.medico}\` doctores\n` +
          `${TRABAJOS.bombero.emoji} **Bombero:** \`${contadores.bombero}\` bomberos\n` +
          `${TRABAJOS.mecanico.emoji} **Mecánico:** \`${contadores.mecanico}\` mecánicos\n\n` +
          "⚠️ **Importante:**\n" +
          "• Solo puedes tener un trabajo a la vez\n" +
          "• Al seleccionar un trabajo nuevo, perderás el anterior\n" +
          "• El panel se actualiza automáticamente"
        )
        .setFooter({ text: "Sistema de empleos" })
        .setTimestamp();

      // Crear botones
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("trabajo_policia")
          .setLabel(`${TRABAJOS.policia.emoji} Policía (${contadores.policia})`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("trabajo_medico")
          .setLabel(`${TRABAJOS.medico.emoji} Médico (${contadores.medico})`)
          .setStyle(ButtonStyle.Danger)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("trabajo_bombero")
          .setLabel(`${TRABAJOS.bombero.emoji} Bombero (${contadores.bombero})`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("trabajo_mecanico")
          .setLabel(`${TRABAJOS.mecanico.emoji} Mecánico (${contadores.mecanico})`)
          .setStyle(ButtonStyle.Success)
      );

      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("trabajo_quitar")
          .setLabel("🚫 Renunciar a mi trabajo")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.channel.send({
        embeds: [embed],
        components: [row1, row2, row3]
      });

      await interaction.editReply({
        content: "✅ Panel de trabajos creado exitosamente."
      });

    } catch (error) {
      console.error("Error setuptrabajos:", error);
      await interaction.editReply({
        content: "❌ Error al crear el panel de trabajos."
      });
    }
  }
};
