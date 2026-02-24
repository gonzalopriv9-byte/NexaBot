const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { loadGuildConfig, updateGuildConfig } = require("../utils/configManager");
const { DEFAULT_PROTECTION, enableRaidMode, disableRaidMode, isRaidModeActive } = require("../utils/protectionManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("proteccion")
    .setDescription("🔒 Configurar sistema de protección anti-raid")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName("estado")
        .setDescription("📊 Ver estado del sistema de protección")
    )
    .addSubcommand(sub =>
      sub.setName("activar")
        .setDescription("✅ Activar sistema de protección")
    )
    .addSubcommand(sub =>
      sub.setName("desactivar")
        .setDescription("❌ Desactivar sistema de protección")
    )
    .addSubcommand(sub =>
      sub.setName("anti-nuke")
        .setDescription("🚨 Configurar anti-nuke (roles, canales, bans, kicks)")
        .addIntegerOption(opt => opt.setName("max_roles_crear").setDescription("Máx roles creados/min").setMinValue(1).setMaxValue(10))
        .addIntegerOption(opt => opt.setName("max_roles_borrar").setDescription("Máx roles borrados/min").setMinValue(1).setMaxValue(10))
        .addIntegerOption(opt => opt.setName("max_canales_crear").setDescription("Máx canales creados/min").setMinValue(1).setMaxValue(20))
        .addIntegerOption(opt => opt.setName("max_canales_borrar").setDescription("Máx canales borrados/min").setMinValue(1).setMaxValue(20))
        .addIntegerOption(opt => opt.setName("max_bans").setDescription("Máx bans/min").setMinValue(1).setMaxValue(10))
        .addIntegerOption(opt => opt.setName("max_kicks").setDescription("Máx kicks/min").setMinValue(1).setMaxValue(10))
        .addStringOption(opt => opt.setName("accion").setDescription("Acción al detectar").addChoices(
          { name: "Ban", value: "ban" },
          { name: "Kick", value: "kick" },
          { name: "Cuarentena", value: "quarantine" }
        ))
    )
    .addSubcommand(sub =>
      sub.setName("raid-mode")
        .setDescription("🚨 Gestionar modo raid")
        .addStringOption(opt => opt.setName("estado").setDescription("Activar/desactivar").setRequired(true).addChoices(
          { name: "Activar", value: "on" },
          { name: "Desactivar", value: "off" }
        ))
        .addIntegerOption(opt => opt.setName("duracion").setDescription("Duración en minutos (solo si activas)").setMinValue(1).setMaxValue(1440))
    )
    .addSubcommand(sub =>
      sub.setName("anti-links")
        .setDescription("🔗 Configurar anti-links")
        .addBooleanOption(opt => opt.setName("activar").setDescription("Activar/desactivar").setRequired(true))
        .addStringOption(opt => opt.setName("accion").setDescription("Acción al detectar").addChoices(
          { name: "Borrar mensaje", value: "delete" },
          { name: "Warn", value: "warn" },
          { name: "Timeout", value: "timeout" }
        ))
    )
    .addSubcommand(sub =>
      sub.setName("anti-menciones")
        .setDescription("🔔 Configurar anti-menciones masivas")
        .addBooleanOption(opt => opt.setName("activar").setDescription("Activar/desactivar").setRequired(true))
        .addIntegerOption(opt => opt.setName("max_menciones").setDescription("Máx menciones por mensaje").setMinValue(1).setMaxValue(20))
        .addBooleanOption(opt => opt.setName("bloquear_everyone").setDescription("Bloquear @everyone/@here"))
        .addStringOption(opt => opt.setName("accion").setDescription("Acción al detectar").addChoices(
          { name: "Borrar mensaje", value: "delete" },
          { name: "Warn", value: "warn" },
          { name: "Timeout", value: "timeout" },
          { name: "Kick", value: "kick" }
        ))
    )
    .addSubcommand(sub =>
      sub.setName("anti-alts")
        .setDescription("🚫 Configurar anti-alts (cuentas nuevas)")
        .addBooleanOption(opt => opt.setName("activar").setDescription("Activar/desactivar").setRequired(true))
        .addIntegerOption(opt => opt.setName("dias_minimos").setDescription("Días mínimos de cuenta").setMinValue(1).setMaxValue(365))
        .addStringOption(opt => opt.setName("modo").setDescription("Acción al detectar").addChoices(
          { name: "Permitir (solo log)", value: "allow" },
          { name: "Timeout", value: "timeout" },
          { name: "Kick", value: "kick" },
          { name: "Ban", value: "ban" },
          { name: "Cuarentena", value: "quarantine" }
        ))
    )
    .addSubcommand(sub =>
      sub.setName("cuarentena")
        .setDescription("🔒 Configurar rol de cuarentena")
        .addRoleOption(opt => opt.setName("rol").setDescription("Rol de cuarentena").setRequired(true))
        .addChannelOption(opt => opt.setName("canal").setDescription("Canal donde pueden leer/apelar"))
    )
    .addSubcommand(sub =>
      sub.setName("auto-punish")
        .setDescription("⚠️ Configurar sanciones automáticas por warns")
        .addBooleanOption(opt => opt.setName("activar").setDescription("Activar/desactivar").setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const config = await loadGuildConfig(interaction.guild.id);

    // Inicializar protección si no existe
    if (!config.protection) {
      await updateGuildConfig(interaction.guild.id, {
        protection: DEFAULT_PROTECTION
      });
    }

    switch (subcommand) {
      case "estado":
        await showStatus(interaction, config);
        break;
      case "activar":
        await enableProtection(interaction);
        break;
      case "desactivar":
        await disableProtection(interaction);
        break;
      case "anti-nuke":
        await configureAntiNuke(interaction, config);
        break;
      case "raid-mode":
        await configureRaidMode(interaction);
        break;
      case "anti-links":
        await configureAntiLinks(interaction, config);
        break;
      case "anti-menciones":
        await configureAntiMentions(interaction, config);
        break;
      case "anti-alts":
        await configureAntiAlts(interaction, config);
        break;
      case "cuarentena":
        await configureQuarantine(interaction, config);
        break;
      case "auto-punish":
        await configureAutoPunish(interaction, config);
        break;
    }
  }
};

async function showStatus(interaction, config) {
  const protection = config.protection || DEFAULT_PROTECTION;
  const raidActive = await isRaidModeActive(interaction.guild.id);

  const embed = new EmbedBuilder()
    .setColor(protection.enabled ? "#00FF00" : "#FF0000")
    .setTitle("🔒 Estado del Sistema de Protección")
    .setDescription(`**Estado general:** ${protection.enabled ? "✅ Activado" : "❌ Desactivado"}`)
    .addFields(
      {
        name: "🚨 Anti-Nuke",
        value: `${protection.antiNuke?.enabled ? "✅" : "❌"} Roles: ${protection.antiNuke?.maxRoleCreate}/${protection.antiNuke?.maxRoleDelete} | Canales: ${protection.antiNuke?.maxChannelCreate}/${protection.antiNuke?.maxChannelDelete}\nBans: ${protection.antiNuke?.maxBan} | Kicks: ${protection.antiNuke?.maxKick}\nAcción: **${protection.antiNuke?.action || "ban"}**`,
        inline: false
      },
      {
        name: "🚨 Modo Raid",
        value: raidActive ? `✅ **ACTIVO**\nAuto-enable: ${protection.raidMode?.autoEnable ? "Sí" : "No"}` : `❌ Inactivo\nAuto-enable: ${protection.raidMode?.autoEnable ? "Sí" : "No"}`,
        inline: true
      },
      {
        name: "🔗 Anti-Links",
        value: protection.antiLinks?.enabled ? `✅ Activado\nAcción: **${protection.antiLinks?.action}**` : "❌ Desactivado",
        inline: true
      },
      {
        name: "🔔 Anti-Menciones",
        value: protection.antiMentions?.enabled ? `✅ Activado\nMáx: ${protection.antiMentions?.maxMentionsUser}\n@everyone: ${protection.antiMentions?.blockEveryone ? "Bloqueado" : "Permitido"}` : "❌ Desactivado",
        inline: true
      },
      {
        name: "🚫 Anti-Alts",
        value: protection.antiAlts?.enabled ? `✅ Activado\nMínimo: ${protection.antiAlts?.minAccountAgeDays} días\nModo: **${protection.antiAlts?.mode}**` : "❌ Desactivado",
        inline: true
      },
      {
        name: "🔒 Cuarentena",
        value: protection.quarantine?.roleId ? `Rol: <@&${protection.quarantine.roleId}>` : "❌ No configurado",
        inline: true
      },
      {
        name: "⚠️ Auto-Punish",
        value: protection.autoPunish?.enabled ? "✅ Activado" : "❌ Desactivado",
        inline: true
      }
    )
    .setFooter({ text: `Servidor: ${interaction.guild.name}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function enableProtection(interaction) {
  const config = await loadGuildConfig(interaction.guild.id);
  
  await updateGuildConfig(interaction.guild.id, {
    protection: {
      ...config.protection,
      enabled: true
    }
  });

  await interaction.reply({ 
    content: "✅ **Sistema de protección ACTIVADO**\n\n💡 Configura cada módulo con `/proteccion anti-nuke`, `/proteccion anti-links`, etc.", 
    ephemeral: true 
  });
}

async function disableProtection(interaction) {
  const config = await loadGuildConfig(interaction.guild.id);
  
  await updateGuildConfig(interaction.guild.id, {
    protection: {
      ...config.protection,
      enabled: false
    }
  });

  await interaction.reply({ 
    content: "❌ **Sistema de protección DESACTIVADO**\n\n⚠️ Tu servidor está desprotegido.", 
    ephemeral: true 
  });
}

async function configureAntiNuke(interaction, config) {
  const maxRoleCreate = interaction.options.getInteger("max_roles_crear");
  const maxRoleDelete = interaction.options.getInteger("max_roles_borrar");
  const maxChannelCreate = interaction.options.getInteger("max_canales_crear");
  const maxChannelDelete = interaction.options.getInteger("max_canales_borrar");
  const maxBan = interaction.options.getInteger("max_bans");
  const maxKick = interaction.options.getInteger("max_kicks");
  const action = interaction.options.getString("accion");

  const currentAntiNuke = config.protection?.antiNuke || DEFAULT_PROTECTION.antiNuke;

  await updateGuildConfig(interaction.guild.id, {
    protection: {
      ...config.protection,
      antiNuke: {
        ...currentAntiNuke,
        enabled: true,
        maxRoleCreate: maxRoleCreate ?? currentAntiNuke.maxRoleCreate,
        maxRoleDelete: maxRoleDelete ?? currentAntiNuke.maxRoleDelete,
        maxChannelCreate: maxChannelCreate ?? currentAntiNuke.maxChannelCreate,
        maxChannelDelete: maxChannelDelete ?? currentAntiNuke.maxChannelDelete,
        maxBan: maxBan ?? currentAntiNuke.maxBan,
        maxKick: maxKick ?? currentAntiNuke.maxKick,
        action: action ?? currentAntiNuke.action
      }
    }
  });

  await interaction.reply({ 
    content: `✅ **Anti-Nuke configurado**\n\n🚨 Límites por minuto:\n• Roles crear: **${maxRoleCreate ?? currentAntiNuke.maxRoleCreate}**\n• Roles borrar: **${maxRoleDelete ?? currentAntiNuke.maxRoleDelete}**\n• Canales crear: **${maxChannelCreate ?? currentAntiNuke.maxChannelCreate}**\n• Canales borrar: **${maxChannelDelete ?? currentAntiNuke.maxChannelDelete}**\n• Bans: **${maxBan ?? currentAntiNuke.maxBan}**\n• Kicks: **${maxKick ?? currentAntiNuke.maxKick}**\n\n⚠️ Acción: **${action ?? currentAntiNuke.action}**`, 
    ephemeral: true 
  });
}

async function configureRaidMode(interaction) {
  const estado = interaction.options.getString("estado");
  const duracion = interaction.options.getInteger("duracion") || 10;

  if (estado === "on") {
    await enableRaidMode(interaction.guild.id, null, duracion * 60000);
    await interaction.reply({ 
      content: `🚨 **MODO RAID ACTIVADO**\n\n⏰ Duración: **${duracion} minutos**\n\n🔒 Bloqueados: invitaciones, creación de canales/roles`, 
      ephemeral: false 
    });
  } else {
    await disableRaidMode(interaction.guild.id);
    await interaction.reply({ 
      content: "✅ **Modo raid desactivado**\n\nEl servidor ha vuelto a la normalidad.", 
      ephemeral: false 
    });
  }
}

async function configureAntiLinks(interaction, config) {
  const activar = interaction.options.getBoolean("activar");
  const accion = interaction.options.getString("accion");

  const currentAntiLinks = config.protection?.antiLinks || DEFAULT_PROTECTION.antiLinks;

  await updateGuildConfig(interaction.guild.id, {
    protection: {
      ...config.protection,
      antiLinks: {
        ...currentAntiLinks,
        enabled: activar,
        action: accion ?? currentAntiLinks.action
      }
    }
  });

  await interaction.reply({ 
    content: activar 
      ? `✅ **Anti-Links ACTIVADO**\n\n🔗 Links permitidos: discord.gg, youtube.com, twitch.tv\nAcción: **${accion ?? currentAntiLinks.action}**`
      : "❌ **Anti-Links DESACTIVADO**", 
    ephemeral: true 
  });
}

async function configureAntiMentions(interaction, config) {
  const activar = interaction.options.getBoolean("activar");
  const maxMenciones = interaction.options.getInteger("max_menciones");
  const bloquearEveryone = interaction.options.getBoolean("bloquear_everyone");
  const accion = interaction.options.getString("accion");

  const currentAntiMentions = config.protection?.antiMentions || DEFAULT_PROTECTION.antiMentions;

  await updateGuildConfig(interaction.guild.id, {
    protection: {
      ...config.protection,
      antiMentions: {
        ...currentAntiMentions,
        enabled: activar,
        maxMentionsUser: maxMenciones ?? currentAntiMentions.maxMentionsUser,
        blockEveryone: bloquearEveryone ?? currentAntiMentions.blockEveryone,
        action: accion ?? currentAntiMentions.action
      }
    }
  });

  await interaction.reply({ 
    content: activar 
      ? `✅ **Anti-Menciones ACTIVADO**\n\n🔔 Máximo menciones: **${maxMenciones ?? currentAntiMentions.maxMentionsUser}**\n@everyone/@here: ${bloquearEveryone ?? currentAntiMentions.blockEveryone ? "🚫 Bloqueado" : "✅ Permitido"}\nAcción: **${accion ?? currentAntiMentions.action}**`
      : "❌ **Anti-Menciones DESACTIVADO**", 
    ephemeral: true 
  });
}

async function configureAntiAlts(interaction, config) {
  const activar = interaction.options.getBoolean("activar");
  const diasMinimos = interaction.options.getInteger("dias_minimos");
  const modo = interaction.options.getString("modo");

  const currentAntiAlts = config.protection?.antiAlts || DEFAULT_PROTECTION.antiAlts;

  await updateGuildConfig(interaction.guild.id, {
    protection: {
      ...config.protection,
      antiAlts: {
        ...currentAntiAlts,
        enabled: activar,
        minAccountAgeDays: diasMinimos ?? currentAntiAlts.minAccountAgeDays,
        mode: modo ?? currentAntiAlts.mode
      }
    }
  });

  await interaction.reply({ 
    content: activar 
      ? `✅ **Anti-Alts ACTIVADO**\n\n🚫 Mínimo edad cuenta: **${diasMinimos ?? currentAntiAlts.minAccountAgeDays} días**\nModo: **${modo ?? currentAntiAlts.mode}**`
      : "❌ **Anti-Alts DESACTIVADO**", 
    ephemeral: true 
  });
}

async function configureQuarantine(interaction, config) {
  const rol = interaction.options.getRole("rol");
  const canal = interaction.options.getChannel("canal");

  await updateGuildConfig(interaction.guild.id, {
    protection: {
      ...config.protection,
      quarantine: {
        roleId: rol.id,
        channelId: canal?.id || null
      }
    }
  });

  await interaction.reply({ 
    content: `✅ **Cuarentena configurada**\n\n🔒 Rol: ${rol}\n${canal ? `💬 Canal: ${canal}` : ""}`, 
    ephemeral: true 
  });
}

async function configureAutoPunish(interaction, config) {
  const activar = interaction.options.getBoolean("activar");

  await updateGuildConfig(interaction.guild.id, {
    protection: {
      ...config.protection,
      autoPunish: {
        ...config.protection?.autoPunish || DEFAULT_PROTECTION.autoPunish,
        enabled: activar
      }
    }
  });

  await interaction.reply({ 
    content: activar 
      ? `✅ **Auto-Punish ACTIVADO**\n\n⚠️ Umbrales por defecto:\n• 3 warns → Timeout 1h\n• 5 warns → Kick\n• 7 warns → Ban`
      : "❌ **Auto-Punish DESACTIVADO**", 
    ephemeral: true 
  });
}
