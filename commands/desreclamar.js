const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('desreclamar')
    .setDescription('Libera un ticket para que otro staff pueda reclamarlo'),
  
  async execute(interaction) {
    // El código del handler ya lo maneja en index.js
    // O simplemente crea una función y llámala desde aquí
  }
};
