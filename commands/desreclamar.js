// ==================== COMANDO DESRECLAMAR ====================
{
  data: new SlashCommandBuilder()
    .setName('desreclamar')
    .setDescription('Libera un ticket para que otro staff pueda reclamarlo'),
  
  async execute(interaction) {
    const channel = interaction.channel;
    
    // Verificar que es un canal de ticket
    if (!channel.name.startsWith('ticket-')) {
      return interaction.reply({
        content: '❌ Este comando solo funciona en canales de tickets.',
        flags: 64
      });
    }

    // Verificar que el usuario tiene rol de staff
    const staffRoleId = '1469344936620195872';
    if (!interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.reply({
        content: '❌ Solo el staff puede desreclamar tickets.',
        flags: 64
      });
    }

    try {
      // Hacer el canal visible para todos los staff de nuevo
      await channel.permissionOverwrites.edit(staffRoleId, {
        ViewChannel: true,
        SendMessages: true
      });

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🔓 Ticket Liberado')
        .setDescription(`${interaction.user} ha liberado este ticket.\n\nCualquier staff puede reclamarlo ahora.`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      
      await interaction.reply({
        content: '✅ Ticket liberado correctamente.',
        flags: 64
      });

      addLog('info', `Ticket ${channel.name} liberado por ${interaction.user.tag}`);
      
    } catch (error) {
      console.error('Error al desreclamar ticket:', error);
      await interaction.reply({
        content: '❌ Error al liberar el ticket.',
        flags: 64
      });
    }
  }
}
