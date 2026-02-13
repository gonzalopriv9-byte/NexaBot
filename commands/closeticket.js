
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("closeticket")
    .setDescription("Cierra un ticket por número")
    .addIntegerOption(opt =>
      opt.setName("numero")
        .setDescription("Número del ticket")
        .setRequired(true)
    ),

  async execute(interaction) {
    const num = interaction.options.getInteger("numero");
    const channel = interaction.guild.channels.cache.find(
      c => c.name === `ticket-${num}`
    );

    if (!channel) {
      return interaction.reply({
        content: "❌ Ticket no encontrado",
        ephemeral: true
      });
    }

    await channel.delete();
    await interaction.reply({
      content: `🗑️ Ticket #${num} cerrado`,
      ephemeral: true
    });
  }
};
