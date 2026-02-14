const { SlashCommandBuilder } = require("discord.js");
const { deleteDNI, hasDNI } = require("../utils/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("eliminardni")
    .setDescription("Elimina tu DNI de la base de datos"),

  async execute(interaction) {
    if (!hasDNI(interaction.user.id)) {
      return interaction.reply({
        content: "❌ No tienes ningún DNI creado.",
        ephemeral: true
      });
    }

    const success = deleteDNI(interaction.user.id);

    if (success) {
      await interaction.reply({
        content: "✅ Tu DNI ha sido eliminado correctamente de la base de datos.",
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: "❌ Hubo un error al eliminar tu DNI. Intenta de nuevo.",
        ephemeral: true
      });
    }
  }
};
