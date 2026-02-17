const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { loadGuildConfig, updateGuildConfig } = require('../utils/configManager');

const EMOJI = {
  TICKET: "<a:Ticket:1472541437470965942>",
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupticket')
    .setDescription('Configurar y crear panel de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option =>
      option.setName('rol_staff')
        .setDescription('Rol del staff que gestionará los tickets')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('canal_valoraciones')
        .setDescription('Canal donde se enviarán las valoraciones')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: 64 });

      const rolStaff = interaction.options.getRole('rol_staff');
      const canalValoraciones = interaction.options.getChannel('canal_valoraciones');
      const guild = interaction.guild;

      // ==================== CREAR CATEGORÍA AUTOMÁTICAMENTE ====================
      let categoriaTickets = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'tickets'
      );

      if (!categoriaTickets) {
        console.log('📁 Creando categoría de Tickets...');

        categoriaTickets = await guild.channels.create({
          name: '📋 TICKETS',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: rolStaff.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages
              ]
            }
          ]
        });

        console.log(`✅ Categoría creada: ${categoriaTickets.name} (${categoriaTickets.id})`);
      } else {
        console.log(`ℹ️ Categoría de tickets ya existe: ${categoriaTickets.name}`);
      }

      // ==================== CONFIGURAR SISTEMA DE TICKETS ====================
      const success = updateGuildConfig(guild.id, 'tickets', {
        enabled: true,
        categoryId: categoriaTickets.id,
        staffRoles: [rolStaff.id],
        ratingsChannelId: canalValoraciones.id
      });

      if (!success) {
        return interaction.editReply({
          content: `${EMOJI.CRUZ} Error al guardar la configuración.`
        });
      }

      // ==================== CREAR PANEL DE TICKETS ====================
      const embed = new EmbedBuilder()
        .setColor('#00BFFF')
        .setTitle(`${EMOJI.TICKET} Sistema de Tickets`)
        .setDescription(
          '¿Necesitas ayuda? Haz clic en el botón de abajo para abrir un ticket.\n\n' +
          '**¿Qué es un ticket?**\n' +
          'Un ticket es un canal privado donde puedes hablar directamente con el staff.\n\n' +
          '**¿Cuándo abrir un ticket?**\n' +
          '• Reportar problemas\n' +
          '• Hacer preguntas al staff\n' +
          '• Solicitar ayuda personalizada\n' +
          '• Reportar usuarios\n\n' +
          `${EMOJI.CHECK} El staff recibirá una notificación inmediata.`
        )
        .setFooter({ text: 'Sistema de soporte' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket')
          .setLabel('📋 Abrir Ticket')
          .setStyle(ButtonStyle.Primary)
      );

      // Enviar panel al canal
      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      // Responder al admin
      const configEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`${EMOJI.CHECK} Sistema de Tickets Configurado`)
        .setDescription(
          `✅ **Panel de tickets creado en este canal**\n\n` +
          `📁 **Categoría:** ${categoriaTickets}\n` +
          `👮 **Staff:** ${rolStaff}\n` +
          `⭐ **Valoraciones:** ${canalValoraciones}\n\n` +
          `Los tickets se crearán automáticamente en la categoría cuando los usuarios hagan clic en el botón.`
        )
        .setFooter({ text: 'Sistema configurado correctamente' })
        .setTimestamp();

      await interaction.editReply({ embeds: [configEmbed] });

    } catch (error) {
      console.error('Error en setupticket:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `${EMOJI.CRUZ} Error al configurar los tickets.`,
          flags: 64
        }).catch(() => {});
      } else {
        await interaction.editReply({
          content: `${EMOJI.CRUZ} Error al configurar los tickets: ${error.message}`
        }).catch(() => {});
      }
    }
  }
};
