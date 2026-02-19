const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("closeticket")
    .setDescription("Cierra un ticket por usuario (quien lo abrió)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) // opcional, pero recomendable
    .addUserOption(opt =>
      opt
        .setName("usuario")
        .setDescription("Usuario que abrió el ticket")
        .setRequired(true)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("usuario");

    // Normalizamos el nombre como sueles crear el canal: ticket-<nombre>
    // Si tus tickets usan otro formato, dímelo y lo adapto.
    const username = user.username
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, ""); // limpia caracteres raros para que coincida con nombres de canal

    const possibleNames = [
      `ticket-${username}`,
      `ticket-${user.id}` // fallback útil si en algún punto cambiaste a ID
    ];

    const channel = interaction.guild.channels.cache.find(
      c => possibleNames.includes(c.name)
    );

    if (!channel) {
      return interaction.reply({
        content: `❌ No encontré un ticket para **${user.tag}**.\nProbé: \`${possibleNames.join("`, `")}\``,
        ephemeral: true
      });
    }

    try {
      await channel.delete(`Ticket cerrado por ${interaction.user.tag} (objetivo: ${user.tag})`);
      await interaction.reply({
        content: `🗑️ Ticket de **${user.tag}** cerrado (${channel.name})`,
        ephemeral: true
      });
    } catch (err) {
      await interaction.reply({
        content: `❌ No pude borrar el canal. ¿Tengo permisos de **Gestionar Canales**?\nError: \`${err.message}\``,
        ephemeral: true
      });
    }
  }
};
