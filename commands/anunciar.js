
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anunciar')
    .setDescription('Envía un anuncio al canal actual')
    .addStringOption(option =>
      option.setName('mensaje')
        .setDescription('Texto del anuncio')
        .setRequired(true)
    ),

  async execute(interaction) {
    const msg = interaction.options.getString('mensaje');
    await interaction.channel.send(`📢 **Anuncio:** ${msg}`);
    await interaction.reply({ content: '✅ Anuncio enviado', ephemeral: true });
  }
};
