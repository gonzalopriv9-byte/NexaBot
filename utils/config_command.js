const { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const { loadGuildConfig, updateGuildConfig } = require('../utils/configManager');

// ==================== EMOJIS ====================
const EMOJI = {
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>",
  TICKET: "<a:Ticket:1472541437470965942>"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurar el bot para este servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // ==================== SUBCOMANDO: TICKETS ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('tickets')
        .setDescription('Configurar sistema de tickets')
        .addChannelOption(option =>
          option.setName('categoria')
            .setDescription('Categoría donde se crearán los tickets')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true))
        .addRoleOption(option =>
          option.setName('rol_staff')
            .setDescription('Rol del staff que gestiona tickets')
            .setRequired(true))
        .addChannelOption(option =>
          option.setName('canal_valoraciones')
            .setDescription('Canal para enviar valoraciones de tickets')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))

    // ==================== SUBCOMANDO: VERIFICACIÓN ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('verificacion')
        .setDescription('Configurar sistema de verificación por email')
        .addRoleOption(option =>
          option.setName('rol')
            .setDescription('Rol que se dará al verificarse')
            .setRequired(true)))

    // ==================== SUBCOMANDO: BIENVENIDA ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('bienvenida')
        .setDescription('Configurar mensajes de bienvenida')
        .addChannelOption(option =>
          option.setName('canal')
            .setDescription('Canal para mensajes de bienvenida')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
        .addBooleanOption(option =>
          option.setName('activar')
            .setDescription('Activar o desactivar bienvenidas')
            .setRequired(true)))

    // ==================== SUBCOMANDO: TRABAJOS ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('trabajos')
        .setDescription('Configurar sistema de trabajos')
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

    // ==================== SUBCOMANDO: VER CONFIG ====================
    .addSubcommand(subcommand =>
      subcommand
        .setName('ver')
        .setDescription('Ver configuración actual del servidor')),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;
      const config = loadGuildConfig(guildId);

      // ==================== VER CONFIGURACIÓN ====================
      if (subcommand === 'ver') {
        const embed = new EmbedBuilder()
          .setColor('#00BFFF')
          .setTitle('⚙️ Configuración del Servidor')
          .setDescription(`Configuración actual para **${interaction.guild.name}**`)
          .addFields(
            {
              name: '🎫 Tickets',
              value: config.tickets.enabled 
                ? `✅ Activado\n` +
                  `Categoría: <#${config.tickets.categoryId}>\n` +
                  `Staff: ${config.tickets.staffRoles.map(r => `<@&${r}>`).join(', ')}\n` +
                  `Valoraciones: <#${config.tickets.ratingsChannelId}>`
                : '❌ Desactivado',
              inline: false
            },
            {
              name: '✅ Verificación',
              value: config.verification.enabled
                ? `✅ Activado\nRol: <@&${config.verification.roleId}>`
                : '❌ Desactivado',
              inline: false
            },
            {
              name: '👋 Bienvenida',
              value: config.welcome.enabled
                ? `✅ Activado\nCanal: <#${config.welcome.channelId}>`
                : '❌ Desactivado',
              inline: false
            },
            {
              name: '💼 Trabajos',
              value: config.trabajos.enabled
                ? `✅ Activado\nRoles configurados: ${Object.keys(config.trabajos.roles).length}`
                : '❌ Desactivado',
              inline: false
            }
          )
          .setFooter({ text: 'Usa /config [sistema] para configurar' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], flags: 64 });
      }

      // ==================== CONFIGURAR TICKETS ====================
      if (subcommand === 'tickets') {
        const categoria = interaction.options.getChannel('categoria');
        const rolStaff = interaction.options.getRole('rol_staff');
        const canalValoraciones = interaction.options.getChannel('canal_valoraciones');

        const success = updateGuildConfig(guildId, 'tickets', {
          enabled: true,
          categoryId: categoria.id,
          staffRoles: [rolStaff.id],
          ratingsChannelId: canalValoraciones.id
        });

        if (success) {
          return interaction.reply({
            content: `${EMOJI.CHECK} **Sistema de tickets configurado:**\n` +
                     `${EMOJI.TICKET} Categoría: ${categoria}\n` +
                     `👮 Staff: ${rolStaff}\n` +
                     `⭐ Valoraciones: ${canalValoraciones}\n\n` +
                     `Usa \`/setupticket\` para crear el panel.`,
            flags: 64
          });
        } else {
          return interaction.reply({
            content: `${EMOJI.CRUZ} Error al guardar la configuración.`,
            flags: 64
          });
        }
      }

      // ==================== CONFIGURAR VERIFICACIÓN ====================
      if (subcommand === 'verificacion') {
        const rol = interaction.options.getRole('rol');

        const success = updateGuildConfig(guildId, 'verification', {
          enabled: true,
          roleId: rol.id
        });

        if (success) {
          return interaction.reply({
            content: `${EMOJI.CHECK} **Sistema de verificación configurado:**\n` +
                     `✅ Rol verificado: ${rol}\n\n` +
                     `Usa \`/setupverificar\` para crear el panel.`,
            flags: 64
          });
        } else {
          return interaction.reply({
            content: `${EMOJI.CRUZ} Error al guardar la configuración.`,
            flags: 64
          });
        }
      }

      // ==================== CONFIGURAR BIENVENIDA ====================
      if (subcommand === 'bienvenida') {
        const canal = interaction.options.getChannel('canal');
        const activar = interaction.options.getBoolean('activar');

        const success = updateGuildConfig(guildId, 'welcome', {
          enabled: activar,
          channelId: canal.id
        });

        if (success) {
          return interaction.reply({
            content: `${EMOJI.CHECK} **Bienvenidas ${activar ? 'activadas' : 'desactivadas'}:**\n` +
                     `👋 Canal: ${canal}`,
            flags: 64
          });
        } else {
          return interaction.reply({
            content: `${EMOJI.CRUZ} Error al guardar la configuración.`,
            flags: 64
          });
        }
      }

      // ==================== CONFIGURAR TRABAJOS ====================
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
          return interaction.reply({
            content: `${EMOJI.CRUZ} Debes especificar al menos un rol de trabajo.`,
            flags: 64
          });
        }

        const success = updateGuildConfig(guildId, 'trabajos', {
          enabled: true,
          roles: roles
        });

        if (success) {
          const rolesList = Object.entries(roles)
            .map(([key, data]) => `${data.emoji} ${data.nombre}: <@&${data.roleId}>`)
            .join('\n');

          return interaction.reply({
            content: `${EMOJI.CHECK} **Sistema de trabajos configurado:**\n${rolesList}\n\n` +
                     `Usa \`/setuptrabajos\` para crear el panel.`,
            flags: 64
          });
        } else {
          return interaction.reply({
            content: `${EMOJI.CRUZ} Error al guardar la configuración.`,
            flags: 64
          });
        }
      }

    } catch (error) {
      console.error('Error en comando config:', error);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: `${EMOJI.CRUZ} Error al ejecutar el comando.`,
          flags: 64
        }).catch(() => {});
      }
    }
  }
};
