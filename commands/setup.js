const { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
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
    .setDescription('⚙️ Configuración rápida y completa del bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // ==================== TICKETS ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('tickets')
        .setDescription('🎫 Configurar sistema completo de tickets')
        .addRoleOption(option =>
          option.setName('staff')
            .setDescription('Rol del staff')
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('valoraciones')
            .setDescription('Canal de valoraciones')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))

    // ==================== BIENVENIDAS ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('bienvenida')
        .setDescription('👋 Configurar mensajes de bienvenida')
        .addChannelOption(option =>
          option.setName('canal')
            .setDescription('Canal de bienvenidas')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
        .addStringOption(option =>
          option.setName('imagen')
            .setDescription('URL de la imagen de fondo (opcional)')
            .setRequired(false)))

    // ==================== VERIFICACIÓN ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('verificacion')
        .setDescription('✅ Configurar verificación por email')
        .addRoleOption(option =>
          option.setName('rol')
            .setDescription('Rol de verificado')
            .setRequired(true)))

    // ==================== TRABAJOS ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('trabajos')
        .setDescription('💼 Configurar sistema de trabajos')
        .addRoleOption(option =>
          option.setName('policia')
            .setDescription('Rol de Policía')
            .setRequired(false))
        .addRoleOption(option =>
          option.setName('medico')
            .setDescription('Rol de Médico')
            .setRequired(false))
        .addRoleOption(option =>
          option.setName('bombero')
            .setDescription('Rol de Bombero')
            .setRequired(false))
        .addRoleOption(option =>
          option.setName('mecanico')
            .setDescription('Rol de Mecánico')
            .setRequired(false)))

    // ==================== TODO ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('todo')
        .setDescription('🚀 Configurar TODOS los sistemas a la vez (asistente guiado)')
        .addChannelOption(option =>
          option.setName('bienvenidas')
            .setDescription('Canal de bienvenidas')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('valoraciones')
            .setDescription('Canal de valoraciones de tickets')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('staff')
            .setDescription('Rol del staff')
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('verificado')
            .setDescription('Rol de verificado')
            .setRequired(true))),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: 64 });

      const guild = interaction.guild;

      // ==================== SETUP: TICKETS ====================
      if (subcommand === 'tickets') {
        const staff = interaction.options.getRole('staff');
        const valoraciones = interaction.options.getChannel('valoraciones');

        // Crear categoría
        let categoria = guild.channels.cache.find(
          c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('ticket')
        );

        if (!categoria) {
          categoria = await guild.channels.create({
            name: '📋 TICKETS',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
              },
              {
                id: staff.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.ManageChannels
                ]
              }
            ]
          });
        }

        // Guardar config
        updateGuildConfig(guild.id, 'tickets', {
          enabled: true,
          categoryId: categoria.id,
          staffRoles: [staff.id],
          ratingsChannelId: valoraciones.id
        });

        // Crear panel
        const embed = new EmbedBuilder()
          .setColor('#00BFFF')
          .setTitle(`${EMOJI.TICKET} Sistema de Tickets`)
          .setDescription(
            '¿Necesitas ayuda? Haz clic en el botón para abrir un ticket.\n\n' +
            '**📋 ¿Qué es un ticket?**\n' +
            'Un canal privado con el staff.\n\n' +
            '**🎯 ¿Cuándo usar?**\n' +
            '• Reportar problemas\n' +
            '• Hacer preguntas\n' +
            '• Solicitar ayuda\n\n' +
            `${EMOJI.CHECK} El staff será notificado.`
          )
          .setFooter({ text: 'Sistema de soporte' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('open_ticket')
            .setLabel('📋 Abrir Ticket')
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });

        return interaction.editReply({
          content: `${EMOJI.CHECK} **Sistema de tickets configurado:**\n\n` +
                   `📁 Categoría: ${categoria}\n` +
                   `👮 Staff: ${staff}\n` +
                   `⭐ Valoraciones: ${valoraciones}\n\n` +
                   `✅ Panel creado arriba`
        });
      }

      // ==================== SETUP: BIENVENIDA ====================
      if (subcommand === 'bienvenida') {
        const canal = interaction.options.getChannel('canal');
        const imagen = interaction.options.getString('imagen') || 
          'https://raw.githubusercontent.com/gonzalopriv9-byte/EspanoletesBOT.1/main/assets/ChatGPT_Image_13_feb_2026_19_27_59.webp';

        updateGuildConfig(guild.id, 'welcome', {
          enabled: true,
          channelId: canal.id,
          imageUrl: imagen
        });

        return interaction.editReply({
          content: `${EMOJI.CHECK} **Bienvenidas configuradas:**\n\n` +
                   `👋 Canal: ${canal}\n` +
                   `🖼️ Imagen: ${imagen.substring(0, 50)}...\n\n` +
                   `✅ Los nuevos miembros recibirán un mensaje de bienvenida automático.`
        });
      }

      // ==================== SETUP: VERIFICACIÓN ====================
      if (subcommand === 'verificacion') {
        const rol = interaction.options.getRole('rol');

        updateGuildConfig(guild.id, 'verification', {
          enabled: true,
          roleId: rol.id
        });

        // Crear panel
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('✅ Verificación')
          .setDescription(
            '**Verifica tu cuenta para acceder al servidor.**\n\n' +
            '🔐 Click en el botón para iniciar la verificación por email.'
          )
          .setFooter({ text: 'Sistema de verificación' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('verify_start')
            .setLabel('✅ VERIFICARSE')
            .setStyle(ButtonStyle.Success)
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });

        return interaction.editReply({
          content: `${EMOJI.CHECK} **Verificación configurada:**\n\n` +
                   `✅ Rol: ${rol}\n\n` +
                   `Panel creado arriba`
        });
      }

      // ==================== SETUP: TRABAJOS ====================
      if (subcommand === 'trabajos') {
        const policia = interaction.options.getRole('policia');
        const medico = interaction.options.getRole('medico');
        const bombero = interaction.options.getRole('bombero');
        const mecanico = interaction.options.getRole('mecanico');

        const roles = {};
        if (policia) roles.policia = { roleId: policia.id, emoji: '👮', nombre: 'Policía' };
        if (medico) roles.medico = { roleId: medico.id, emoji: '⚕️', nombre: 'Médico' };
        if (bombero) roles.bombero = { roleId: bombero.id, emoji: '🚒', nombre: 'Bombero' };
        if (mecanico) roles.mecanico = { roleId: mecanico.id, emoji: '🔧', nombre: 'Mecánico' };

        if (Object.keys(roles).length === 0) {
          return interaction.editReply({
            content: `${EMOJI.CRUZ} Debes especificar al menos un rol de trabajo.`
          });
        }

        updateGuildConfig(guild.id, 'trabajos', {
          enabled: true,
          roles: roles
        });

        // Crear panel
        const contadores = {};
        for (const [key, trabajo] of Object.entries(roles)) {
          const role = guild.roles.cache.get(trabajo.roleId);
          contadores[key] = role ? role.members.size : 0;
        }

        const trabajosList = Object.entries(roles)
          .map(([key, trabajo]) => `${trabajo.emoji} **${trabajo.nombre}:** \`${contadores[key]}\` personas`)
          .join('\n');

        const embed = new EmbedBuilder()
          .setColor('#00BFFF')
          .setTitle('💼 CENTRO DE EMPLEO')
          .setDescription(
            'Selecciona tu trabajo haciendo clic en el botón.\n\n' +
            '**📊 Personal actual:**\n' +
            trabajosList + '\n\n' +
            '⚠️ Solo puedes tener un trabajo a la vez.'
          )
          .setFooter({ text: 'Sistema de empleos' })
          .setTimestamp();

        const rows = [];
        const trabajosArray = Object.entries(roles);

        for (let i = 0; i < trabajosArray.length; i += 2) {
          const row = new ActionRowBuilder();
          for (let j = i; j < Math.min(i + 2, trabajosArray.length); j++) {
            const [key, trabajo] = trabajosArray[j];
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`trabajo_${key}`)
                .setLabel(`${trabajo.emoji} ${trabajo.nombre}`)
                .setStyle(j % 2 === 0 ? ButtonStyle.Primary : ButtonStyle.Success)
            );
          }
          rows.push(row);
        }

        const quitRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('trabajo_quitar')
            .setLabel('🚫 Renunciar')
            .setStyle(ButtonStyle.Danger)
        );
        rows.push(quitRow);

        await interaction.channel.send({ embeds: [embed], components: rows });

        return interaction.editReply({
          content: `${EMOJI.CHECK} **Trabajos configurados:**\n\n${trabajosList}\n\nPanel creado arriba`
        });
      }

      // ==================== SETUP: TODO ====================
      if (subcommand === 'todo') {
        const canalBienvenidas = interaction.options.getChannel('bienvenidas');
        const canalValoraciones = interaction.options.getChannel('valoraciones');
        const rolStaff = interaction.options.getRole('staff');
        const rolVerificado = interaction.options.getRole('verificado');

        let errores = [];
        let exitos = [];

        // 1. Configurar bienvenidas
        try {
          updateGuildConfig(guild.id, 'welcome', {
            enabled: true,
            channelId: canalBienvenidas.id,
            imageUrl: 'https://raw.githubusercontent.com/gonzalopriv9-byte/EspanoletesBOT.1/main/assets/ChatGPT_Image_13_feb_2026_19_27_59.webp'
          });
          exitos.push(`👋 Bienvenidas → ${canalBienvenidas}`);
        } catch (e) {
          errores.push('Bienvenidas: ' + e.message);
        }

        // 2. Configurar tickets
        try {
          let categoria = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('ticket')
          );

          if (!categoria) {
            categoria = await guild.channels.create({
              name: '📋 TICKETS',
              type: ChannelType.GuildCategory,
              permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: rolStaff.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] }
              ]
            });
          }

          updateGuildConfig(guild.id, 'tickets', {
            enabled: true,
            categoryId: categoria.id,
            staffRoles: [rolStaff.id],
            ratingsChannelId: canalValoraciones.id
          });

          exitos.push(`🎫 Tickets → ${categoria}`);
        } catch (e) {
          errores.push('Tickets: ' + e.message);
        }

        // 3. Configurar verificación
        try {
          updateGuildConfig(guild.id, 'verification', {
            enabled: true,
            roleId: rolVerificado.id
          });
          exitos.push(`✅ Verificación → ${rolVerificado}`);
        } catch (e) {
          errores.push('Verificación: ' + e.message);
        }

        const resultEmbed = new EmbedBuilder()
          .setColor(errores.length > 0 ? '#FFA500' : '#00FF00')
          .setTitle(`${EMOJI.CHECK} Configuración Completa`)
          .setDescription(
            '**✅ Sistemas configurados:**\n' +
            exitos.join('\n') +
            (errores.length > 0 ? '\n\n**❌ Errores:**\n' + errores.join('\n') : '') +
            '\n\n**📋 Siguiente paso:**\n' +
            'Usa estos comandos para crear los paneles:\n' +
            '• `/setup tickets` - Panel de tickets\n' +
            '• `/setup verificacion` - Panel de verificación\n\n' +
            'O simplemente usa cada sistema, ¡ya están listos!'
          )
          .setFooter({ text: 'Bot configurado por ' + interaction.user.tag })
          .setTimestamp();

        return interaction.editReply({ embeds: [resultEmbed] });
      }

    } catch (error) {
      console.error('Error en /setup:', error);
      return interaction.editReply({
        content: `${EMOJI.CRUZ} Error: ${error.message}`
      }).catch(() => {});
    }
  }
};
