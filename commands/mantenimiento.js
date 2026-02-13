
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mantenimiento")
    .setDescription("Activa o desactiva el modo mantenimiento para el bot"),

  async execute(interaction) {
    // Solo la persona autorizada puede usarlo
    if (interaction.user.id !== "1352652366330986526") {
      return interaction.reply({
        content: "❌ No tienes permiso para usar este comando.",
        ephemeral: true,
      });
    }

    // Alternar mantenimiento
    global.maintenanceMode = !global.maintenanceMode;

    await interaction.reply({
      content: `✅ Modo mantenimiento ${global.maintenanceMode ? "activado" : "desactivado"}. Solo tú puedes usar comandos ahora.`,
      ephemeral: true,
    });
  },
};
