const { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const { updateGuildConfig } = require('../utils/configManager');

const EMOJI = {
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>",
  TICKET: "<a:Ticket:1472541437470965942>",
  MEGAFONO: "<a:Megafono:1472541640970211523>"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configuracion rapida y completa del bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(subcommand =>
      subcommand
        .setName('tickets')
        .setDescription('Configurar sistema completo de tickets')
        .addRoleOption(option =>
          option.setName('staff').setDescription('Rol del staff').setRequired(true))
        .addChannelOption(option =>
          option.setName('valoraciones').setDescription('Canal de valoraciones')
            .addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption(option =>
          option.setName('modo').setDescription('Tipo de panel')
            .addChoices(
              { name: 'Boton Simple', value: 'button' },
              { name: 'Menu Desplegable', value: 'select' }
            ).setRequired(false))
        .addStringOption(option =>
          option.setName('titulo').setDescription('Titulo del embed del panel').setRequired(false))
        .addStringOption(option =>
          option.setName('descripcion').setDescription('Descripcion del embed del panel').setRequired(false)))

    .addSubcommand(subcommand =>
      subcommand
        .setName('bienvenida')
        .setDescription('Configurar mensajes de bienvenida')
        .addChannelOption(option =>
          option.setName('canal').setDescription('Canal de bienvenidas')
            .addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption(option =>
          option.setName('imagen').setDescription('URL imagen de fondo (opcional)').setRequired(false)))

    .addSubcommand(subcommand =>
      subcommand
        .setName('verificacion')
        .setDescription('Configurar verificacion por email')
        .addRoleOption(option =>
          option.setName('rol').setDescription('Rol de verificado').setRequired(true)))

    .addSubcommand(subcommand =>
      subcommand
        .setName('trabajos')
        .setDescription('Configurar sistema de trabajos')
        .addRoleOption(option => option.setName('policia').setDescription('Rol de Policia').setRequired(false))
        .addRoleOption(option => option.setName('medico').setDescription('Rol de Medico').setRequired(false))
        .addRoleOption(option => option.setName('bombero').setDescription('Rol de Bombero').setRequired(false))
        .addRoleOption(option => option.setName('mecanico').setDescription('Rol de Mecanico').setRequired(false)))

    .addSubcommand(subcommand =>
      subcommand
        .setName('todo')
        .setDescription('Configurar TODOS los sistemas a la vez')
        .addChannelOption(option =>
          option.setName('bienvenidas').setDescription('Canal de bienvenidas')
            .addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addChannelOption(option =>
          option.setName('valoraciones').setDescription('Canal de valoraciones de tickets')
            .addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addRoleOption(option => option.setName('staff').setDescription('Rol del staff').setRequired(true))
        .addRoleOption(option => option.setName('verificado').setDescription('Rol de verificado').setRequired(true))),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: 64 });
      const guild = interaction.guild;

      // ==================== TICKETS ====================
      if (subcommand === 'tickets') {
        const staff = interaction.options.getRole('staff');
        const valoraciones = interaction.options.getChannel('valoraciones');
        const modo = interaction.options.getString('modo') || 'button';
        const titulo = interaction.options.getString('titulo') || EMOJI.TICKET + ' Sistema de Tickets';
        const descripcion = interaction.options.getString('descripcion') || 
          '¿Necesitas ayuda? Haz clic en el botón para abrir un ticket.\n\n' +
          '**¿Qué es un ticket?**\nUn canal privado con el staff.\n\n' +
          '**¿Cuándo usar?**\n• Reportar problemas\n• Hacer preguntas\n• Solicitar ayuda\n\n' +
          EMOJI.CHECK + ' El staff será notificado.';

        let categoria = guild.channels.cache.find(
          c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('ticket')
        );
        if (!categoria) {
          categoria = await guild.channels.create({
            name: '📂 TICKETS',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: staff.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] }
            ]
          });
        }

        await updateGuildConfig(guild.id, {
          tickets: {
            enabled: true,
            categoryId: categoria.id,
            staffRoles: [staff.id],
            ratingsChannelId: valoraciones.id,
            mode: modo,
            panelTitle: titulo,
            panelDescription: descripcion,
            categories: [] // Se llenarán con /addticket
          }
        });

        const embed = new EmbedBuilder()
          .setColor('#00BFFF')
          .setTitle(titulo)
          .setDescription(descripcion)
          .setFooter({ text: 'Sistema de soporte' }).setTimestamp();

        if (modo === 'button') {
          await interaction.channel.send({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('open_ticket').setLabel('Abrir Ticket').setStyle(ButtonStyle.Primary)
            )]
          });
        } else {
          // Modo select: por ahora sin opciones, se añadirán con /addticket
          await interaction.channel.send({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('open_ticket_select')
                .setPlaceholder('Selecciona el tipo de ticket')
                .addOptions({ label: 'General', value: 'general', description: 'Ticket general' })
            )]
          });
        }

        return interaction.editReply({
          content: EMOJI.CHECK + ' **Tickets configurado:**\n\nCategoría: <#' + categoria.id + '>\nStaff: <@&' + staff.id + '>\nValoraciones: <#' + valoraciones.id + '>\nModo: ' + (modo === 'button' ? 'Botón Simple' : 'Menú Desplegable') + '\n\n**Panel creado arriba**\nUsa `/addticket` para añadir categorías personalizadas.'
        });
      }

      // ==================== BIENVENIDA ====================
      if (subcommand === 'bienvenida') {
        const canal = interaction.options.getChannel('canal');
        const imagen = interaction.options.getString('imagen') ||
          'https://raw.githubusercontent.com/gonzalopriv9-byte/EspanoletesBOT.1/main/assets/ChatGPT_Image_13_feb_2026_19_27_59.webp';

        await updateGuildConfig(guild.id, {
          welcome: {
            enabled: true,
            channelId: canal.id,
            imageUrl: imagen
          }
        });

        return interaction.editReply({
          content: EMOJI.CHECK + ' **Bienvenidas configuradas:**\n\nCanal: <#' + canal.id + '>\nImagen: ' + imagen.substring(0, 50) + '...'
        });
      }

      // ==================== VERIFICACION ====================
      if (subcommand === 'verificacion') {
        const rol = interaction.options.getRole('rol');

        await updateGuildConfig(guild.id, {
          verification: {
            enabled: true,
            roleId: rol.id
          }
        });

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('✅ Verificación')
          .setDescription('**Verifica tu cuenta para acceder al servidor.**\n\nClick en el botón para verificarte por email.')
          .setFooter({ text: 'Sistema de verificación' }).setTimestamp();

        await interaction.channel.send({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('verify_start').setLabel('VERIFICARSE').setStyle(ButtonStyle.Success)
          )]
        });

        return interaction.editReply({
          content: EMOJI.CHECK + ' **Verificación configurada:**\n\nRol: <@&' + rol.id + '>\n\n**Panel creado arriba**'
        });
      }

      // ==================== TRABAJOS ====================
      if (subcommand === 'trabajos') {
        const policia = interaction.options.getRole('policia');
        const medico = interaction.options.getRole('medico');
        const bombero = interaction.options.getRole('bombero');
        const mecanico = interaction.options.getRole('mecanico');

        const roles = {};
        if (policia) roles.policia = { roleId: policia.id, emoji: '👮', nombre: 'Policia' };
        if (medico) roles.medico = { roleId: medico.id, emoji: '⚕️', nombre: 'Medico' };
        if (bombero) roles.bombero = { roleId: bombero.id, emoji: '🚒', nombre: 'Bombero' };
        if (mecanico) roles.mecanico = { roleId: mecanico.id, emoji: '🔧', nombre: 'Mecanico' };

        if (Object.keys(roles).length === 0) {
          return interaction.editReply({ content: EMOJI.CRUZ + ' Debes especificar al menos un rol.' });
        }

        await updateGuildConfig(guild.id, {
          trabajos: {
            enabled: true,
            roles
          }
        });

        const contadores = {};
        for (const [key, t] of Object.entries(roles)) {
          const role = guild.roles.cache.get(t.roleId);
          contadores[key] = role ? role.members.size : 0;
        }

        const trabajosList = Object.entries(roles)
          .map(([k, t]) => t.emoji + ' **' + t.nombre + ':** `' + contadores[k] + '` personas')
          .join('\n');

        const embed = new EmbedBuilder()
          .setColor('#00BFFF').setTitle('💼 CENTRO DE EMPLEO')
          .setDescription('Selecciona tu trabajo:\n\n**Personal actual:**\n' + trabajosList + '\n\n• Solo puedes tener un trabajo a la vez.')
          .setFooter({ text: 'Sistema de empleos' }).setTimestamp();

        const rows = [];
        const arr = Object.entries(roles);
        for (let i = 0; i < arr.length; i += 2) {
          const row = new ActionRowBuilder();
          for (let j = i; j < Math.min(i + 2, arr.length); j++) {
            const [key, t] = arr[j];
            row.addComponents(new ButtonBuilder().setCustomId('trabajo_' + key).setLabel(t.emoji + ' ' + t.nombre).setStyle(j % 2 === 0 ? ButtonStyle.Primary : ButtonStyle.Success));
          }
          rows.push(row);
        }
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('trabajo_quitar').setLabel('❌ Renunciar').setStyle(ButtonStyle.Danger)
        ));

        await interaction.channel.send({ embeds: [embed], components: rows });

        return interaction.editReply({
          content: EMOJI.CHECK + ' **Trabajos configurados:**\n\n' + trabajosList + '\n\n**Panel creado arriba**'
        });
      }

      // ==================== TODO ====================
      if (subcommand === 'todo') {
        const canalBienvenidas = interaction.options.getChannel('bienvenidas');
        const canalValoraciones = interaction.options.getChannel('valoraciones');
        const rolStaff = interaction.options.getRole('staff');
        const rolVerificado = interaction.options.getRole('verificado');

        const errores = [];
        const exitos = [];

        try {
          await updateGuildConfig(guild.id, {
            welcome: {
              enabled: true,
              channelId: canalBienvenidas.id,
              imageUrl: 'https://raw.githubusercontent.com/gonzalopriv9-byte/EspanoletesBOT.1/main/assets/ChatGPT_Image_13_feb_2026_19_27_59.webp'
            }
          });
          exitos.push('👋 Bienvenidas → <#' + canalBienvenidas.id + '>');
        } catch (e) { errores.push('Bienvenidas: ' + e.message); }

        try {
          let categoria = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('ticket')
          );
          if (!categoria) {
            categoria = await guild.channels.create({
              name: '📂 TICKETS',
              type: ChannelType.GuildCategory,
              permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: rolStaff.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] }
              ]
            });
          }
          await updateGuildConfig(guild.id, {
            tickets: {
              enabled: true,
              categoryId: categoria.id,
              staffRoles: [rolStaff.id],
              ratingsChannelId: canalValoraciones.id,
              mode: 'button',
              categories: []
            }
          });
          exitos.push('🎫 Tickets → <#' + categoria.id + '>');
        } catch (e) { errores.push('Tickets: ' + e.message); }

        try {
          await updateGuildConfig(guild.id, {
            verification: {
              enabled: true,
              roleId: rolVerificado.id
            }
          });
          exitos.push('✅ Verificación → <@&' + rolVerificado.id + '>');
        } catch (e) { errores.push('Verificación: ' + e.message); }

        const resultEmbed = new EmbedBuilder()
          .setColor(errores.length > 0 ? '#FFA500' : '#00FF00')
          .setTitle(EMOJI.CHECK + ' Configuración Completa')
          .setDescription(
            '**Sistemas configurados:**\n' + exitos.join('\n') +
            (errores.length > 0 ? '\n\n**Errores:**\n' + errores.join('\n') : '') +
            '\n\n**Siguiente paso:**\n• `/setup tickets` - Panel de tickets\n• `/setup verificacion` - Panel de verificación'
          )
          .setFooter({ text: 'Configurado por ' + interaction.user.tag }).setTimestamp();

        return interaction.editReply({ embeds: [resultEmbed] });
      }

    } catch (error) {
      console.error('Error en /setup:', error);
      return interaction.editReply({ content: EMOJI.CRUZ + ' Error: ' + error.message }).catch(() => {});
    }
  }
};
