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
    .setDescription('Configurar y crear panel de tickets (todo-en-uno)')
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

      // ==================== PASO 1: CREAR CATEGORÍA AUTOMÁTICAMENTE ====================
      console.log('📋 [TICKETS] Buscando o creando categoría...');

      let categoriaTickets = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('ticket')
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
        console.log(`ℹ️ Usando categoría existente: ${categoriaTickets.name}`);
      }

      // ==================== PASO 2: CONFIGURAR SISTEMA EN DATABASE ====================
      console.log('💾 Guardando configuración en base de datos...');

      const success = updateGuildConfig(guild.id, 'tickets', {
        enabled: true,
        categoryId: categoriaTickets.id,
        staffRoles: [rolStaff.id],
        ratingsChannelId: canalValoraciones.id
      });

      if (!success) {
        return interaction.editReply({
          content: `${EMOJI.CRUZ} Error al guardar la configuración. Verifica que exista la carpeta data/.`
        });
      }

      console.log('✅ Configuración guardada correctamente');

      // ==================== PASO 3: CREAR PANEL DE TICKETS ====================
      console.log('🎨 Creando panel visual...');

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
          .setEmoji('🎫')
      );

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      console.log('✅ Panel creado en el canal');

      // ==================== PASO 4: RESPONDER AL ADMIN ====================
      const configEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`${EMOJI.CHECK} Sistema de Tickets Configurado`)
        .setDescription(
          `✅ **¡Todo listo! El sistema de tickets está funcionando.**\n\n` +
          `**Configuración aplicada:**\n` +
          `📁 **Categoría:** ${categoriaTickets}\n` +
          `👮 **Staff:** ${rolStaff}\n` +
          `⭐ **Valoraciones:** ${canalValoraciones}\n\n` +
          `**¿Cómo funciona?**\n` +
          `1. Los usuarios hacen clic en "📋 Abrir Ticket"\n` +
          `2. Se crea un canal privado en ${categoriaTickets}\n` +
          `3. El staff recibe notificación\n` +
          `4. Al cerrar, se pide una valoración\n\n` +
          `${EMOJI.TICKET} Panel creado arriba en este canal`
        )
        .addFields(
          { 
            name: '🎛️ Gestión del sistema', 
            value: 'Para cambiar la configuración, usa `/config tickets`',
            inline: false
          }
        )
        .setFooter({ text: 'Sistema configurado correctamente' })
        .setTimestamp();

      await interaction.editReply({ embeds: [configEmbed] });

      console.log('✅ Configuración completa - setupticket finalizado');

    } catch (error) {
      console.error('❌ Error en setupticket:', error);

      const errorMsg = error.code === 50013 
        ? 'No tengo permisos suficientes. Necesito permisos de Administrador o "Gestionar Canales".'
        : `Error: ${error.message}`;

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `${EMOJI.CRUZ} ${errorMsg}`,
          flags: 64
        }).catch(() => {});
      } else {
        await interaction.editReply({
          content: `${EMOJI.CRUZ} ${errorMsg}`
        }).catch(() => {});
      }
    }
  }
};
