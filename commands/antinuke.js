const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const { loadGuildConfig, updateGuildConfig } = require("../utils/configManager");

const EMOJI = {
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>",
  SHIELD: "🛡️"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("antinuke")
    .setDescription("Configurar el sistema Anti-Nuke de protección avanzada")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName("habilitar")
        .setDescription("Activa el sistema Anti-Nuke completo"))
    .addSubcommand(sub =>
      sub.setName("deshabilitar")
        .setDescription("Desactiva el sistema Anti-Nuke"))
    .addSubcommand(sub =>
      sub.setName("configurar")
        .setDescription("Configura los umbrales de detección")
        .addIntegerOption(opt =>
          opt.setName("roles")
            .setDescription("Máximo roles creados/eliminados en 10 segundos (default: 3)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10))
        .addIntegerOption(opt =>
          opt.setName("canales")
            .setDescription("Máximo canales creados/eliminados en 10 segundos (default: 3)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10))
        .addIntegerOption(opt =>
          opt.setName("bans")
            .setDescription("Máximo bans en 10 segundos (default: 3)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10))
        .addIntegerOption(opt =>
          opt.setName("kicks")
            .setDescription("Máximo kicks en 10 segundos (default: 3)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)))
    .addSubcommand(sub =>
      sub.setName("whitelist")
        .setDescription("Añade un usuario a la whitelist de Anti-Nuke")
        .addUserOption(opt =>
          opt.setName("usuario")
            .setDescription("Usuario a añadir a la whitelist")
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName("unwhitelist")
        .setDescription("Elimina un usuario de la whitelist")
        .addUserOption(opt =>
          opt.setName("usuario")
            .setDescription("Usuario a eliminar de la whitelist")
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName("estado")
        .setDescription("Ver configuración actual del Anti-Nuke")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guild.id;

    // ==================== HABILITAR ====================
    if (sub === "habilitar") {
      try {
        const config = await loadGuildConfig(guildId);
        
        await updateGuildConfig(guildId, {
          antiNuke: {
            enabled: true,
            thresholds: config.antiNuke?.thresholds || {
              roleCreateDelete: 3,
              channelCreateDelete: 3,
              bans: 3,
              kicks: 3,
              timeWindow: 10000 // 10 segundos
            },
            whitelist: config.antiNuke?.whitelist || [interaction.guild.ownerId],
            actions: {
              roleCreate: true,
              roleDelete: true,
              channelCreate: true,
              channelDelete: true,
              memberBan: true,
              memberKick: true
            }
          }
        });

        const embed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle(EMOJI.SHIELD + " Anti-Nuke Habilitado")
          .setDescription(
            "El sistema Anti-Nuke está ahora **ACTIVO** y protegiendo tu servidor contra:\n\n" +
            "🔴 **Creación/Eliminación Masiva de Roles**\n" +
            "🔴 **Creación/Eliminación Masiva de Canales**\n" +
            "🔴 **Bans Masivos**\n" +
            "🔴 **Kicks Masivos**\n\n" +
            "**Umbrales por defecto:** 3 acciones en 10 segundos\n" +
            "**Acción:** Ban automático + Reversión cuando es posible"
          )
          .addFields(
            { name: "⚙️ Configurar", value: "Usa `/antinuke configurar` para ajustar los umbrales", inline: false },
            { name: "👥 Whitelist", value: "Usa `/antinuke whitelist` para añadir usuarios de confianza", inline: false }
          )
          .setFooter({ text: "El dueño del servidor está automáticamente en la whitelist" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: EMOJI.CRUZ + " Error habilitando Anti-Nuke: " + e.message });
      }
    }

    // ==================== DESHABILITAR ====================
    if (sub === "deshabilitar") {
      try {
        const config = await loadGuildConfig(guildId);

        if (!config.antiNuke?.enabled) {
          return interaction.editReply({ content: EMOJI.CRUZ + " El Anti-Nuke ya está deshabilitado." });
        }

        await updateGuildConfig(guildId, {
          antiNuke: {
            ...config.antiNuke,
            enabled: false
          }
        });

        const embed = new EmbedBuilder()
          .setColor("#FF6B6B")
          .setTitle("Anti-Nuke Deshabilitado")
          .setDescription("⚠️ El sistema Anti-Nuke se ha desactivado. Tu servidor es vulnerable a ataques.")
          .setFooter({ text: "Usa /antinuke habilitar para reactivar" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: EMOJI.CRUZ + " Error: " + e.message });
      }
    }

    // ==================== CONFIGURAR ====================
    if (sub === "configurar") {
      try {
        const config = await loadGuildConfig(guildId);
        
        if (!config.antiNuke?.enabled) {
          return interaction.editReply({ content: EMOJI.CRUZ + " Primero debes habilitar el Anti-Nuke con `/antinuke habilitar`" });
        }

        const roles = interaction.options.getInteger("roles");
        const canales = interaction.options.getInteger("canales");
        const bans = interaction.options.getInteger("bans");
        const kicks = interaction.options.getInteger("kicks");

        const currentThresholds = config.antiNuke.thresholds;
        const newThresholds = {
          roleCreateDelete: roles || currentThresholds.roleCreateDelete,
          channelCreateDelete: canales || currentThresholds.channelCreateDelete,
          bans: bans || currentThresholds.bans,
          kicks: kicks || currentThresholds.kicks,
          timeWindow: 10000
        };

        await updateGuildConfig(guildId, {
          antiNuke: {
            ...config.antiNuke,
            thresholds: newThresholds
          }
        });

        const embed = new EmbedBuilder()
          .setColor("#FFA500")
          .setTitle(EMOJI.SHIELD + " Anti-Nuke Configurado")
          .setDescription("Los umbrales de detección han sido actualizados:")
          .addFields(
            { name: "🎭 Roles", value: `${newThresholds.roleCreateDelete} en 10 segundos`, inline: true },
            { name: "📁 Canales", value: `${newThresholds.channelCreateDelete} en 10 segundos`, inline: true },
            { name: "🔨 Bans", value: `${newThresholds.bans} en 10 segundos`, inline: true },
            { name: "👢 Kicks", value: `${newThresholds.kicks} en 10 segundos`, inline: true }
          )
          .setFooter({ text: "Ajusta según las necesidades de tu servidor" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: EMOJI.CRUZ + " Error configurando: " + e.message });
      }
    }

    // ==================== WHITELIST ====================
    if (sub === "whitelist") {
      try {
        const config = await loadGuildConfig(guildId);
        
        if (!config.antiNuke?.enabled) {
          return interaction.editReply({ content: EMOJI.CRUZ + " Primero debes habilitar el Anti-Nuke." });
        }

        const usuario = interaction.options.getUser("usuario");
        const whitelist = config.antiNuke.whitelist || [];

        if (whitelist.includes(usuario.id)) {
          return interaction.editReply({ content: EMOJI.CRUZ + " Este usuario ya está en la whitelist." });
        }

        whitelist.push(usuario.id);

        await updateGuildConfig(guildId, {
          antiNuke: {
            ...config.antiNuke,
            whitelist
          }
        });

        const embed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle(EMOJI.CHECK + " Usuario Añadido a Whitelist")
          .setDescription(`**${usuario.tag}** ha sido añadido a la whitelist de Anti-Nuke.\n\nEste usuario podrá realizar acciones masivas sin ser sancionado.`)
          .setThumbnail(usuario.displayAvatarURL({ dynamic: true }))
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: EMOJI.CRUZ + " Error: " + e.message });
      }
    }

    // ==================== UNWHITELIST ====================
    if (sub === "unwhitelist") {
      try {
        const config = await loadGuildConfig(guildId);
        
        if (!config.antiNuke?.enabled) {
          return interaction.editReply({ content: EMOJI.CRUZ + " El Anti-Nuke no está habilitado." });
        }

        const usuario = interaction.options.getUser("usuario");
        
        if (usuario.id === interaction.guild.ownerId) {
          return interaction.editReply({ content: EMOJI.CRUZ + " No puedes eliminar al dueño del servidor de la whitelist." });
        }

        let whitelist = config.antiNuke.whitelist || [];

        if (!whitelist.includes(usuario.id)) {
          return interaction.editReply({ content: EMOJI.CRUZ + " Este usuario no está en la whitelist." });
        }

        whitelist = whitelist.filter(id => id !== usuario.id);

        await updateGuildConfig(guildId, {
          antiNuke: {
            ...config.antiNuke,
            whitelist
          }
        });

        const embed = new EmbedBuilder()
          .setColor("#FF6B6B")
          .setTitle("Usuario Eliminado de Whitelist")
          .setDescription(`**${usuario.tag}** ha sido eliminado de la whitelist de Anti-Nuke.`)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: EMOJI.CRUZ + " Error: " + e.message });
      }
    }

    // ==================== ESTADO ====================
    if (sub === "estado") {
      try {
        const config = await loadGuildConfig(guildId);
        const antiNuke = config.antiNuke;

        if (!antiNuke || !antiNuke.enabled) {
          const embed = new EmbedBuilder()
            .setColor("#95A5A6")
            .setTitle("Anti-Nuke: Deshabilitado")
            .setDescription("El sistema Anti-Nuke no está activo.\n\nUsa `/antinuke habilitar` para activarlo.")
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }

        const thresholds = antiNuke.thresholds;
        const whitelist = antiNuke.whitelist || [];
        const whitelistUsers = await Promise.all(
          whitelist.slice(0, 10).map(async (id) => {
            try {
              const user = await interaction.client.users.fetch(id);
              return user.tag;
            } catch {
              return id;
            }
          })
        );

        const embed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle(EMOJI.SHIELD + " Anti-Nuke: Activo")
          .setDescription("Tu servidor está protegido contra ataques de nuke.")
          .addFields(
            { name: "🎭 Roles (Create/Delete)", value: `${thresholds.roleCreateDelete} en 10s`, inline: true },
            { name: "📁 Canales (Create/Delete)", value: `${thresholds.channelCreateDelete} en 10s`, inline: true },
            { name: "🔨 Bans", value: `${thresholds.bans} en 10s`, inline: true },
            { name: "👢 Kicks", value: `${thresholds.kicks} en 10s`, inline: true },
            { 
              name: "👥 Whitelist (" + whitelist.length + " usuarios)", 
              value: whitelistUsers.length > 0 
                ? whitelistUsers.join("\n") + (whitelist.length > 10 ? "\n..." : "")
                : "Ninguno",
              inline: false 
            }
          )
          .setFooter({ text: "Servidor: " + interaction.guild.name })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: EMOJI.CRUZ + " Error obteniendo estado: " + e.message });
      }
    }
  }
};
