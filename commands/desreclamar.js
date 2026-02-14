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
        flags: 64 // ephemeral
      });
    }

    // Verificar que el usuario tiene rol de staff
    const staffRoleId = 'ID_DEL_ROL_STAFF'; // Cambia esto por el ID real
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

      // Eliminar tag de reclamado si existe
      const tags = channel.appliedTags || [];
      const claimedTagId = 'ID_DEL_TAG_CLAIMED'; // Ajusta según tu servidor
      const newTags = tags.filter(tag => tag !== claimedTagId);
      
      if (channel.parent?.type === 15) { // Si es un foro
        await channel.setAppliedTags(newTags);
      }

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
