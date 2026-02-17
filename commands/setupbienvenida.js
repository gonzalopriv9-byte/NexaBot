const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { loadGuildConfig, updateGuildConfig } = require('../utils/configManager');

const EMOJI = {
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>",
  MEGAFONO: "<a:Megafono:1472541640970211523>"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupbienvenida')
    .setDescription('Crear panel de bienvenidas automáticas')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('canal')
        .setDescription('Canal donde se enviarán las bienvenidas')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: 64 });

      const canal = interaction.options.getChannel('canal');
      const guildConfig = loadGuildConfig(interaction.guild.id);

      // Configurar sistema de bienvenidas
      const success = updateGuildConfig(interaction.guild.id, 'welcome', {
        enabled: true,
        channelId: canal.id
      });

      if (!success) {
        return interaction.editReply({
          content: `${EMOJI.CRUZ} Error al configurar el sistema de bienvenidas.`
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`${EMOJI.MEGAFONO} Sistema de Bienvenidas Configurado`)
        .setDescription(
          `✅ **Las bienvenidas están activadas**\n\n` +
          `📍 **Canal configurado:** ${canal}\n\n` +
          `Cuando un usuario se una al servidor, recibirá un mensaje de bienvenida automático en ese canal.\n\n` +
          `**Para desactivar:** Usa \`/config bienvenida canal:${canal} activar:False\``
        )
        .setFooter({ text: 'Sistema de bienvenidas' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error en setupbienvenida:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `${EMOJI.CRUZ} Error al configurar las bienvenidas.`,
          flags: 64
        }).catch(() => {});
      } else {
        await interaction.editReply({
          content: `${EMOJI.CRUZ} Error al configurar las bienvenidas.`
        }).catch(() => {});
      }
    }
  }
};
