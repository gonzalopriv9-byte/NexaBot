const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anunciar')
    .setDescription('Envía un anuncio al canal actual')
    .addStringOption(option =>
      option.setName('mensaje')
        .setDescription('Texto del anuncio')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Verificar roles permitidos (además del permiso de admin)
    const allowedRoles = ["1469344936620195872"];
    const hasPermission = allowedRoles.some(roleId => 
      interaction.member.roles.cache.has(roleId)
    );
    
    if (!hasPermission) {
      return interaction.reply({
        content: "❌ No tienes permiso para usar este comando.",
        ephemeral: true
      });
    }

    const msg = interaction.options.getString('mensaje');
    
    // Enviar el anuncio
    await interaction.channel.send(`📢 **ANUNCIO**\n\n${msg}`);
    
    // Confirmar al usuario
    await interaction.reply({ 
      content: '✅ Anuncio enviado correctamente', 
      ephemeral: true 
    });
  }
};
