const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loadGuildConfig } = require('../utils/configManager');

// ==================== EMOJIS ANIMADOS ====================
const EMOJI = {
  MEGAFONO: "<a:Megafono:1472541640970211523>",
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>"
};

// ==================== SISTEMA ANTI-DUPLICADOS MEJORADO ====================
const processingAnnouncements = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anunciar')
    .setDescription('Envía un anuncio al canal actual')
    .addStringOption(option =>
      option.setName('mensaje')
        .setDescription('Texto del anuncio')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('mostrar_enviante')
        .setDescription('¿Mostrar quién envió el anuncio?')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // ✅ VERIFICACIÓN MULTI-NIVEL ANTI-DUPLICADOS
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;
    const uniqueKey = `${userId}-${channelId}`;

    // Verificar si ya respondió
    if (interaction.replied || interaction.deferred) {
      console.log(`⚠️ Interacción ya respondida - ABORTANDO`);
      return;
    }

    // Verificar si ya está procesando
    if (processingAnnouncements.has(uniqueKey)) {
      console.log(`⚠️ Usuario ${userId} ya está enviando anuncio en ${channelId} - IGNORANDO`);
      return;
    }

    // Marcar como procesando INMEDIATAMENTE
    processingAnnouncements.set(uniqueKey, {
      timestamp: Date.now(),
      interactionId: interaction.id
    });

    try {
      // Cargar configuración del servidor
      const config = await loadGuildConfig(interaction.guild.id);
      const roleId = config?.anunciar?.roleId;

      // Verificar permisos: Admin o rol configurado
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      const hasConfiguredRole = roleId && interaction.member.roles.cache.has(roleId);

      if (!isAdmin && !hasConfiguredRole) {
        processingAnnouncements.delete(uniqueKey);
        return interaction.reply({
          content: `${EMOJI.CRUZ} No tienes permiso para usar este comando.${
            roleId ? `\nNecesitas el rol <@&${roleId}> o permisos de Administrador.` : '\nSolo administradores pueden usar este comando.'
          }`,
          flags: 64
        });
      }

      const msg = interaction.options.getString('mensaje');
      const mostrarEnviante = interaction.options.getBoolean('mostrar_enviante');

      // ✅ RESPONDER INMEDIATAMENTE (sin defer)
      await interaction.reply({ 
        content: `${EMOJI.CHECK} Enviando anuncio...`,
        flags: 64
      });

      // Construir el mensaje del anuncio
      let anuncioTexto = `${EMOJI.MEGAFONO} **ANUNCIO**\n\n${msg}`;

      if (mostrarEnviante) {
        anuncioTexto += `\n\n*Enviado por: ${interaction.user}*`;
      }

      // Enviar el anuncio
      await interaction.channel.send(anuncioTexto);

      // Actualizar confirmación
      await interaction.editReply({
        content: `${EMOJI.CHECK} Anuncio enviado correctamente`
      });

      console.log(`✅ Anuncio enviado por ${interaction.user.tag} en #${interaction.channel.name}`);

    } catch (error) {
      console.error('❌ Error en anunciar:', error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `${EMOJI.CRUZ} Error al enviar el anuncio.`,
          flags: 64
        }).catch(() => {});
      } else {
        await interaction.editReply({
          content: `${EMOJI.CRUZ} Error al enviar el anuncio.`
        }).catch(() => {});
      }
    } finally {
      // Limpiar después de 5 segundos
      setTimeout(() => {
        processingAnnouncements.delete(uniqueKey);
        console.log(`🧹 Limpiado flag de anuncio para ${userId}`);
      }, 5000);
    }
  }
};
