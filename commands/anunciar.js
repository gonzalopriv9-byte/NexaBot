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
    .addBooleanOption(option =>
      option.setName('mostrar_enviante')
        .setDescription('¿Mostrar quién envió el anuncio?')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Verificar roles permitidos
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

    // Responder PRIMERO (esto previene duplicados)
    await interaction.deferReply({ ephemeral: true });

    const msg = interaction.options.getString('mensaje');
    const mostrarEnviante = interaction.options.getBoolean('mostrar_enviante');
    
    // Construir el mensaje del anuncio
    let anuncioTexto = `📢 **ANUNCIO**\n\n${msg}`;
    
    if (mostrarEnviante) {
      anuncioTexto += `\n\n*Enviado por: ${interaction.user}*`;
    }
    
    // Enviar el anuncio
    await interaction.channel.send(anuncioTexto);
    
    // Confirmar al usuario
    await interaction.editReply({ 
      content: '✅ Anuncio enviado correctamente'
    });
  }
};
