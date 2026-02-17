const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const EMOJI = {
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modroleid')
    .setDescription('Obtener el ID de un rol')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addRoleOption(option =>
      option.setName('rol')
        .setDescription('Rol del que quieres obtener el ID')
        .setRequired(true)),

  async execute(interaction) {
    try {
      const rol = interaction.options.getRole('rol');

      await interaction.reply({
        content: `${EMOJI.CHECK} **Información del rol:**\n\n` +
                 `📝 **Nombre:** ${rol.name}\n` +
                 `🆔 **ID:** \`${rol.id}\`\n` +
                 `🎨 **Color:** ${rol.hexColor}\n` +
                 `👥 **Miembros:** ${rol.members.size}\n` +
                 `📊 **Posición:** ${rol.position}`,
        flags: 64
      });

    } catch (error) {
      console.error('Error en modroleid:', error);
      await interaction.reply({
        content: `${EMOJI.CRUZ} Error al obtener información del rol.`,
        flags: 64
      }).catch(() => {});
    }
  }
};
