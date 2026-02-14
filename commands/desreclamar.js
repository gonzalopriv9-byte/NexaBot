const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("desreclamar")
    .setDescription("Libera un ticket para que otro staff pueda reclamarlo"),

  async execute(interaction) {
    const channel = interaction.channel;
    const staffRoleId = '1469344936620195872';

    // Verificar que es un canal de ticket
    if (!channel.name.startsWith('ticket-')) {
      return interaction.reply({
        content: '❌ Este comando solo funciona en canales de tickets.',
        ephemeral: true
      });
    }

    // Verificar que es staff
    if (!interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.reply({
        content: '❌ Solo el staff puede desreclamar tickets.',
        ephemeral: true
      });
    }

    try {
      // Restaurar permisos del rol de staff
      await channel.permissionOverwrites.edit(staffRoleId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🔓 Ticket Liberado')
        .setDescription(`${interaction.user} ha liberado este ticket.\n\nCualquier staff puede reclamarlo ahora.`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      
      await interaction.reply({
        content: '✅ Ticket liberado correctamente.',
        ephemeral: true
      });

      console.log(`✅ Ticket ${channel.name} liberado por ${interaction.user.tag}`);
      
    } catch (error) {
      console.error('❌ Error desreclamar:', error);
      await interaction.reply({
        content: '❌ Error al liberar el ticket.',
        ephemeral: true
      });
    }
  }
};
