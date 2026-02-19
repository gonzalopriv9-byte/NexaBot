require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Collection,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  AuditLogEvent
} = require("discord.js");

const express = require("express");
const { loadCommands } = require("./handlers/commandHandler");
const sgMail = require("@sendgrid/mail");
const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const { saveDNI, generateDNINumber, getDNI, hasDNI, deleteDNI } = require("./utils/database");
const { loadGuildConfig } = require("./utils/configManager");
const { getEntry } = require("./utils/blacklist");

// ==================== DEBUGGING ====================
console.log(
  "🔍 TOKEN detectado:",
  process.env.DISCORD_TOKEN
    ? "SÍ (primeros 10 chars: " + process.env.DISCORD_TOKEN.substring(0, 10) + ")"
    : "NO"
);

// ==================== VARIABLES BOT ====================
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ==================== SUPABASE ====================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ==================== HELPERS SUPABASE ====================

/** Guarda o actualiza un DNI en Supabase (tabla: dnis) */
async function saveDNISupabase(userId, dniData) {
  const { error } = await supabase
    .from("dnis")
    .upsert({ user_id: userId, ...dniData, updated_at: new Date().toISOString() });
  if (error) addLog("error", `Supabase saveDNI: ${error.message}`);
  return !error;
}

/** Obtiene el DNI de un usuario (tabla: dnis) */
async function getDNISupabase(userId) {
  const { data, error } = await supabase
    .from("dnis")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error && error.code !== "PGRST116") addLog("error", `Supabase getDNI: ${error.message}`);
  return data || null;
}

/** Comprueba si un usuario tiene DNI (tabla: dnis) */
async function hasDNISupabase(userId) {
  const { data } = await supabase
    .from("dnis")
    .select("user_id")
    .eq("user_id", userId)
    .single();
  return !!data;
}

/** Elimina el DNI de un usuario (tabla: dnis) */
async function deleteDNISupabase(userId) {
  const { error } = await supabase
    .from("dnis")
    .delete()
    .eq("user_id", userId);
  if (error) addLog("error", `Supabase deleteDNI: ${error.message}`);
  return !error;
}

/** Guarda un log en Supabase (tabla: bot_logs) */
async function saveLogSupabase(type, message) {
  const { error } = await supabase
    .from("bot_logs")
    .insert({ type, message, created_at: new Date().toISOString() });
  if (error) console.error(`Supabase log error: ${error.message}`);
}

/** Guarda un ticket en Supabase (tabla: tickets) */
async function saveTicketSupabase(data) {
  const { error } = await supabase
    .from("tickets")
    .upsert({ ...data, updated_at: new Date().toISOString() });
  if (error) addLog("error", `Supabase saveTicket: ${error.message}`);
  return !error;
}

/** Guarda una valoración de ticket (tabla: ticket_ratings) */
async function saveRatingSupabase(data) {
  const { error } = await supabase
    .from("ticket_ratings")
    .insert({ ...data, created_at: new Date().toISOString() });
  if (error) addLog("error", `Supabase saveRating: ${error.message}`);
  return !error;
}

/** Guarda un usuario verificado (tabla: verified_users) */
async function saveVerifiedUserSupabase(userId, email, guildId) {
  const { error } = await supabase
    .from("verified_users")
    .upsert({
      user_id: userId,
      email,
      guild_id: guildId,
      verified_at: new Date().toISOString()
    });
  if (error) addLog("error", `Supabase saveVerifiedUser: ${error.message}`);
  return !error;
}

/** Guarda el blacklist ban de un usuario (tabla: blacklist_bans) */
async function saveBlacklistBanSupabase(userId, guildId, reason) {
  const { error } = await supabase
    .from("blacklist_bans")
    .insert({
      user_id: userId,
      guild_id: guildId,
      reason,
      banned_at: new Date().toISOString()
    });
  if (error) addLog("error", `Supabase saveBlacklistBan: ${error.message}`);
}

// ==================== VARIABLES VERIFICACIÓN ====================
const verificationCodes = new Map();

// ==================== EMOJIS ANIMADOS ====================
const EMOJI = {
  MEGAFONO: "<a:Megafono:1472541640970211523>",
  TICKET: "<a:Ticket:1472541437470965942>",
  CRUZ: "<a:Cruz:1472540885102235689>",
  CHECK: "<a:Check:1472540340584972509>",
  CORREO: "<a:correo:1472550293152596000>"
};

// ==================== CONFIGURAR SENDGRID ====================
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ==================== SISTEMA DE LOGS ====================
const logs = [];
const MAX_LOGS = 100;

function addLog(type, message) {
  const timestamp = new Date().toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  logs.push({ timestamp, type, message });
  if (logs.length > MAX_LOGS) logs.shift();

  const emoji = { info: "📋", success: "✅", error: "❌", warning: "⚠️" };
  console.log(`${emoji[type] || "📝"} [${timestamp}] ${message}`);

  // Guardar log en Supabase (sin await para no bloquear)
  saveLogSupabase(type, message).catch(() => {});
}

// ==================== VALIDAR VARIABLES ====================
const missingVars = [];
if (!TOKEN) missingVars.push("DISCORD_TOKEN");
if (!CLIENT_ID) missingVars.push("CLIENT_ID");
if (!process.env.SUPABASE_URL) missingVars.push("SUPABASE_URL");
if (!process.env.SUPABASE_KEY) missingVars.push("SUPABASE_KEY");

let botEnabled = true;
if (!TOKEN || !CLIENT_ID) {
  console.warn(`⚠️ Faltan variables: ${missingVars.join(", ")} - Bot Discord desactivado`);
  botEnabled = false;
}

// ==================== CREAR CLIENTE DISCORD ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();
global.maintenanceMode = false;
const MAINTENANCE_USER_ID = "1352652366330986526";

if (botEnabled) loadCommands(client);

// ==================== SISTEMA ANTI-DUPLICADOS ====================
const processedMessages = new Set();
const activeAIProcessing = new Map();
const processedWelcomes = new Set();

// ==================== PROTECCIÓN: ANTI-FLOOD BOTS ====================
const FLOOD_WINDOW_MS = 4000;
const FLOOD_COUNT = 8;
const FLOOD_COOLDOWN_MS = 5 * 60 * 1000;

const TRUSTED_IDS = new Set([]);

const floodBuckets = new Map();

function floodKey(gid, uid) {
  return `${gid}:${uid}`;
}

async function handleBotFlood(message) {
  const guild = message.guild;
  const author = message.author;
  if (!guild || !author) return;

  if (TRUSTED_IDS.has(author.id)) return;

  const me = guild.members.me;
  if (!me) return;

  try {
    if (me.permissions.has(PermissionFlagsBits.BanMembers)) {
      await guild.members.ban(author.id, { reason: "Nexa Protection: bot flooding" });
      addLog("warning", `🛑 Bot flooder baneado: ${author.tag} (${author.id}) en ${guild.name}`);
    } else if (me.permissions.has(PermissionFlagsBits.KickMembers)) {
      await guild.members.kick(author.id, "Nexa Protection: bot flooding");
      addLog("warning", `🛑 Bot flooder kickeado: ${author.tag} (${author.id}) en ${guild.name}`);
    } else {
      addLog("error", `❌ Sin permisos para expulsar/banear bot flooder en ${guild.name}`);
      return;
    }
  } catch (e) {
    addLog("error", `❌ Error sancionando bot flooder: ${e.message}`);
    return;
  }

  if (!me.permissions.has(PermissionFlagsBits.ViewAuditLog)) return;
  if (!me.permissions.has(PermissionFlagsBits.BanMembers)) return;

  try {
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.BotAdd,
      limit: 6
    });

    const entry = auditLogs.entries.find((e) => {
      const fresh = Date.now() - e.createdTimestamp < 90_000;
      const targetOk = e.target?.id === author.id;
      return fresh && targetOk;
    });

    if (!entry?.executor) return;

    const executorId = entry.executor.id;

    if (executorId === guild.ownerId) return;
    if (TRUSTED_IDS.has(executorId)) return;

    await guild.members.ban(executorId, {
      reason: `Nexa Protection: añadió bot flooder (${author.id})`
    });

    addLog(
      "warning",
      `🔨 Executor baneado por añadir bot flooder: ${entry.executor.tag} (${executorId}) en ${guild.name}`
    );
  } catch (e) {
    addLog("error", `❌ Error audit-log atribución BotAdd: ${e.message}`);
  }
}

// ==================== BLACKLIST: DM + BAN AL ENTRAR ====================
async function dmBanNotice(member, reason, until) {
  const untilText = until ? new Date(until).toLocaleString("es-ES") : "nunca";
  const msg = `Has sido baneado por el sistema de proteccion Nexa.\n\nMotivo ${reason || "Sin especificar"}\nEl ban se levanta en ${untilText}`;

  try {
    await member.send({ content: msg });
  } catch {
    // DMs cerrados: ignorar
  }
}

// ==================== EVENTO READY ====================
client.once("ready", () => {
  addLog("success", `🎉 Bot conectado: ${client.user.tag}`);
  addLog("info", `🌍 Bot presente en ${client.guilds.cache.size} servidores`);
  console.log("🔍 Intents configurados:", client.options.intents);

  TRUSTED_IDS.add(client.user.id);

  client.user.setPresence({
    status: "online",
    activities: [{ name: "EN PRUEBAS", type: 0 }]
  });
});

// ==================== ERRORES DISCORD ====================
client.on("error", (error) => addLog("error", `Discord error: ${error.message}`));
client.on("warn", (info) => addLog("warning", `Discord warning: ${info}`));

// ==================== EVENTO GUILD JOIN/LEAVE ====================
client.on("guildCreate", (guild) => {
  addLog("success", `➕ Bot añadido a: ${guild.name} (${guild.id})`);
  addLog("info", `👥 Total servidores: ${client.guilds.cache.size}`);
});

client.on("guildDelete", (guild) => {
  addLog("warning", `➖ Bot removido de: ${guild.name} (${guild.id})`);
  addLog("info", `👥 Total servidores: ${client.guilds.cache.size}`);
});

// ==================== EVENTO GUILD MEMBER ADD (BLACKLIST + BIENVENIDA) ====================
client.on("guildMemberAdd", async (member) => {
  try {
    const entry = getEntry(member.user);
    if (entry) {
      const me = member.guild.members.me;
      if (me?.permissions.has(PermissionFlagsBits.BanMembers)) {
        await dmBanNotice(member, entry.reason, entry.until);
        await member.guild.members.ban(member.id, {
          reason: `Nexa Protection blacklist: ${entry.reason || "Sin motivo"}`
        });
        addLog(
          "warning",
          `⛔ Blacklist autoban: ${member.user.tag} (${member.id}) en ${member.guild.name} | ${entry.reason || "Sin motivo"}`
        );
        // Guardar ban en Supabase
        await saveBlacklistBanSupabase(member.id, member.guild.id, entry.reason || "Sin motivo");
      } else {
        addLog("error", `❌ No tengo permiso para banear (Blacklist) en ${member.guild.name}`);
      }
      return;
    }
  } catch (e) {
    addLog("error", `❌ Blacklist autoban error: ${e.message}`);
  }

  if (processedWelcomes.has(member.id)) {
    console.log(`⚠️ Bienvenida para ${member.user.tag} ya procesada - IGNORANDO`);
    return;
  }

  processedWelcomes.add(member.id);
  setTimeout(() => {
    processedWelcomes.delete(member.id);
    console.log(`🧹 Limpiado flag de bienvenida para ${member.user.tag}`);
  }, 30000);

  try {
    const guildConfig = loadGuildConfig(member.guild.id);

    if (!guildConfig || !guildConfig.welcome.enabled) {
      console.log(`ℹ️ Bienvenidas desactivadas en ${member.guild.name}`);
      return;
    }

    const WELCOME_CHANNEL_ID = guildConfig.welcome.channelId;
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);

    if (!channel) {
      addLog("warning", `Canal de bienvenida no encontrado en ${member.guild.name}`);
      return;
    }

    const imageUrl =
      guildConfig.welcome.imageUrl ||
      "https://raw.githubusercontent.com/gonzalopriv9-byte/EspanoletesBOT.1/main/assets/ChatGPT_Image_13_feb_2026_19_27_59.webp";

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle(`${EMOJI.MEGAFONO} ¡BIENVENIDO!`)
      .setDescription(`**${member.user.username}** se unió al servidor`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: "👤 Usuario", value: `${member}`, inline: true },
        { name: "📊 Miembro", value: `#${member.guild.memberCount}`, inline: true },
        {
          name: "📅 Creado",
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          inline: true
        }
      )
      .setFooter({ text: "Bienvenido al servidor" })
      .setTimestamp();

    await channel.send({
      content: `${EMOJI.MEGAFONO} **¡Bienvenido ${member}!** ${EMOJI.MEGAFONO}`,
      embeds: [embed],
      files: [
        {
          attachment: imageUrl,
          name: "bienvenida.webp"
        }
      ]
    });

    addLog("success", `Bienvenida enviada: ${member.user.tag} en ${member.guild.name}`);
  } catch (error) {
    addLog("error", `Error bienvenida: ${error.message}`);
    processedWelcomes.delete(member.id);
  }
});

// ==================== INTERACTION CREATE ====================
client.on("interactionCreate", async (interaction) => {
  console.log(
    `📨 Interacción recibida: ${interaction.customId || interaction.commandName} en ${
      interaction.guild?.name || "DM"
    }`
  );

  try {
    // ==================== COMANDOS SLASH ====================
    if (interaction.isChatInputCommand()) {
      if (global.maintenanceMode && interaction.user.id !== MAINTENANCE_USER_ID) {
        return interaction.reply({
          content: "⚠️ El bot está en mantenimiento.",
          flags: 64
        });
      }

      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
        addLog("info", `/${interaction.commandName} por ${interaction.user.tag} en ${interaction.guild?.name || "DM"}`);
      } catch (err) {
        addLog("error", `Error /${interaction.commandName}: ${err.message}`);
        if (!interaction.replied && !interaction.deferred) {
          interaction
            .reply({
              content: `${EMOJI.CRUZ} Error ejecutando el comando`,
              flags: 64
            })
            .catch(() => {});
        }
      }
      return;
    }

    // ==================== BOTÓN: ABRIR TICKET ====================
    if (interaction.isButton() && interaction.customId === "open_ticket") {
      const modal = new ModalBuilder().setCustomId("ticket_modal").setTitle("📋 Crear Ticket");

      const robloxInput = new TextInputBuilder()
        .setCustomId("roblox_user")
        .setLabel("Usuario de Roblox")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Tu usuario de Roblox")
        .setRequired(true);

      const reasonInput = new TextInputBuilder()
        .setCustomId("ticket_reason")
        .setLabel("Motivo del ticket")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe tu problema")
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(robloxInput), new ActionRowBuilder().addComponents(reasonInput));

      await interaction.showModal(modal);
      return;
    }

    // ==================== MODAL: CREAR TICKET ====================
    if (interaction.isModalSubmit() && interaction.customId === "ticket_modal") {
      await interaction.deferReply({ flags: 64 });

      const robloxUser = interaction.fields.getTextInputValue("roblox_user");
      const reason = interaction.fields.getTextInputValue("ticket_reason");

      try {
        const guild = interaction.guild;
        const guildConfig = loadGuildConfig(guild.id);

        if (!guildConfig || !guildConfig.tickets.enabled) {
          return interaction.editReply({
            content:
              `${EMOJI.CRUZ} El sistema de tickets no está configurado en este servidor.\n` +
              `Un administrador debe usar \`/config tickets\` primero.`
          });
        }

        const TICKET_CATEGORY_ID = guildConfig.tickets.categoryId;
        const STAFF_ROLES = guildConfig.tickets.staffRoles;

        const ticketChannel = await guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          topic: interaction.user.id,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: interaction.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            },
            ...STAFF_ROLES.map((roleId) => ({
              id: roleId,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            }))
          ]
        });

        // Guardar ticket en Supabase
        await saveTicketSupabase({
          channel_id: ticketChannel.id,
          guild_id: guild.id,
          user_id: interaction.user.id,
          username: interaction.user.tag,
          roblox_user: robloxUser,
          reason,
          status: "open",
          created_at: new Date().toISOString()
        });

        const embed = new EmbedBuilder()
          .setColor("#00BFFF")
          .setTitle(`${EMOJI.TICKET} Nuevo Ticket`)
          .setDescription(`**Roblox:** ${robloxUser}\n\n**Motivo:**\n${reason}`)
          .setFooter({ text: `Por ${interaction.user.tag}` })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("claim_ticket").setLabel("✋ Reclamar").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("close_ticket").setLabel("🔒 Cerrar").setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({
          content: `${interaction.user} | ${STAFF_ROLES.map((r) => `<@&${r}>`).join(" ")}`,
          embeds: [embed],
          components: [row]
        });

        await interaction.editReply({ content: `${EMOJI.CHECK} Ticket creado: ${ticketChannel}` });
        addLog("success", `Ticket creado por ${interaction.user.tag} en ${guild.name}`);
      } catch (error) {
        addLog("error", `Error ticket: ${error.message}`);
        await interaction.editReply({ content: `${EMOJI.CRUZ} Error al crear el ticket.` });
      }
      return;
    }

    // ==================== MODAL: CREAR DNI ====================
    if (interaction.isModalSubmit() && interaction.customId === "dni_modal") {
      await interaction.deferReply({ flags: 64 });

      try {
        const nombreCompleto = interaction.fields.getTextInputValue("nombre_completo");
        const fechaNacimiento = interaction.fields.getTextInputValue("fecha_nacimiento");
        const nacionalidad = interaction.fields.getTextInputValue("nacionalidad");
        const direccion = interaction.fields.getTextInputValue("direccion");
        const telefono = interaction.fields.getTextInputValue("telefono");

        const fechaRegex = /^\d{2}\/\d{2}\/\d{4}$/;
        if (!fechaRegex.test(fechaNacimiento)) {
          return interaction.editReply({
            content: `${EMOJI.CRUZ} Formato de fecha inválido. Usa DD/MM/AAAA (ejemplo: 15/03/1995)`
          });
        }

        const telefonoRegex = /^\d{9,15}$/;
        if (!telefonoRegex.test(telefono.replace(/\s/g, ""))) {
          return interaction.editReply({
            content: `${EMOJI.CRUZ} Formato de teléfono inválido. Debe contener solo números (9-15 dígitos).`
          });
        }

        const numeroDNI = generateDNINumber();

        const dniData = {
          numero_dni: numeroDNI,
          nombre_completo: nombreCompleto,
          fecha_nacimiento: fechaNacimiento,
          nacionalidad,
          direccion,
          telefono,
          username: interaction.user.username
        };

        // Guardar DNI en Supabase (además del sistema local)
        const successLocal = saveDNI(interaction.user.id, {
          numeroDNI, nombreCompleto, fechaNacimiento,
          nacionalidad, direccion, telefono,
          userId: interaction.user.id,
          username: interaction.user.username
        });
        const successSupabase = await saveDNISupabase(interaction.user.id, dniData);
        const success = successLocal || successSupabase;

        if (success) {
          const embed = new EmbedBuilder()
            .setColor("#00FF00")
            .setTitle(`${EMOJI.CHECK} DNI Creado Exitosamente`)
            .setDescription("Tu DNI ha sido registrado en la base de datos.")
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 128 }))
            .addFields(
              { name: "📝 Número DNI", value: `\`${numeroDNI}\``, inline: true },
              { name: "👤 Nombre", value: nombreCompleto, inline: true },
              { name: "🎂 Fecha de Nacimiento", value: fechaNacimiento, inline: true },
              { name: "🌍 Nacionalidad", value: nacionalidad, inline: true },
              { name: "📞 Teléfono", value: telefono, inline: true }
            )
            .setFooter({ text: "Usa /verdni para ver tu DNI completo en cualquier momento" })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          addLog("success", `DNI creado para ${interaction.user.tag}: ${numeroDNI}`);
        } else {
          await interaction.editReply({ content: `${EMOJI.CRUZ} Error al guardar el DNI. Intenta de nuevo.` });
        }
      } catch (error) {
        addLog("error", `Error creando DNI: ${error.message}`);
        await interaction.editReply({
          content: `${EMOJI.CRUZ} Hubo un error procesando tu DNI. Verifica que los datos sean correctos.`
        });
      }
      return;
    }

    // ==================== BOTÓN: RECLAMAR TICKET ====================
    if (interaction.isButton() && interaction.customId === "claim_ticket") {
      const guildConfig = loadGuildConfig(interaction.guild.id);
      if (!guildConfig || !guildConfig.tickets.enabled) {
        return interaction.reply({ content: `${EMOJI.CRUZ} Sistema de tickets no configurado.`, flags: 64 });
      }

      const STAFF_ROLES = guildConfig.tickets.staffRoles;
      const hasStaffRole = STAFF_ROLES.some((roleId) => interaction.member.roles.cache.has(roleId));

      if (!hasStaffRole) {
        return interaction.reply({ content: `${EMOJI.CRUZ} Solo el staff puede reclamar tickets.`, flags: 64 });
      }

      await interaction.reply({ content: `${EMOJI.CHECK} ${interaction.user} ha reclamado este ticket.` });

      // Actualizar estado del ticket en Supabase
      await supabase
        .from("tickets")
        .update({ status: "claimed", claimed_by: interaction.user.id, updated_at: new Date().toISOString() })
        .eq("channel_id", interaction.channel.id);

      try {
        const channel = interaction.channel;
        const ticketOwner = channel.permissionOverwrites.cache.find(
          (perm) => perm.type === 1 && perm.id !== interaction.user.id && !STAFF_ROLES.includes(perm.id)
        );

        const newPerms = [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels
            ]
          }
        ];

        if (ticketOwner) {
          newPerms.push({
            id: ticketOwner.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          });
        }

        STAFF_ROLES.forEach((roleId) => newPerms.push({ id: roleId, deny: [PermissionFlagsBits.ViewChannel] }));

        await channel.edit({ permissionOverwrites: newPerms });

        const newRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("close_ticket").setLabel("🔒 Cerrar").setStyle(ButtonStyle.Danger)
        );

        await interaction.message.edit({ components: [newRow] });
        addLog("info", `Ticket reclamado por ${interaction.user.tag}`);
      } catch (error) {
        addLog("error", `Error reclamando: ${error.message}`);
      }
      return;
    }

    // ==================== BOTÓN: CERRAR TICKET ====================
    if (interaction.isButton() && interaction.customId === "close_ticket") {
      const guildConfig = loadGuildConfig(interaction.guild.id);
      if (!guildConfig || !guildConfig.tickets.enabled) {
        return interaction.reply({ content: `${EMOJI.CRUZ} Sistema de tickets no configurado.`, flags: 64 });
      }

      const STAFF_ROLES = guildConfig.tickets.staffRoles;
      const channel = interaction.channel;
      const ticketOwnerId = channel.topic;

      const hasStaffRole = STAFF_ROLES.some((roleId) => interaction.member.roles.cache.has(roleId));

      if (interaction.user.id !== ticketOwnerId && !hasStaffRole) {
        return interaction.reply({
          content: `${EMOJI.CRUZ} Solo el creador del ticket o el staff puede cerrarlo.`,
          flags: 64
        });
      }

      const modal = new ModalBuilder().setCustomId("ticket_rating_modal").setTitle("⭐ Valoración del Ticket");

      const starsInput = new TextInputBuilder()
        .setCustomId("rating_stars")
        .setLabel("¿Cuántas estrellas darías? (1-5)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Escribe un número del 1 al 5")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(1);

      const reasonInput = new TextInputBuilder()
        .setCustomId("rating_reason")
        .setLabel("¿Cómo te trataron? ¿Algún comentario?")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Escribe tu experiencia...")
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1000);

      modal.addComponents(new ActionRowBuilder().addComponents(starsInput), new ActionRowBuilder().addComponents(reasonInput));
      await interaction.showModal(modal);
      return;
    }

    // ==================== MODAL: VALORACIÓN ====================
    if (interaction.isModalSubmit() && interaction.customId === "ticket_rating_modal") {
      const stars = interaction.fields.getTextInputValue("rating_stars");
      const reason = interaction.fields.getTextInputValue("rating_reason");

      if (!/^[1-5]$/.test(stars)) {
        return interaction.reply({ content: `${EMOJI.CRUZ} Las estrellas deben ser un número entre 1 y 5.`, flags: 64 });
      }

      const channel = interaction.channel;
      const guildConfig = loadGuildConfig(interaction.guild.id);
      const STAFF_ROLES = guildConfig.tickets.staffRoles;
      const RATINGS_CHANNEL_ID = guildConfig.tickets.ratingsChannelId;

      try {
        const messages = await channel.messages.fetch({ limit: 100 });

        let staffMember = null;
        for (const msg of messages.values()) {
          if (msg.author.bot) continue;
          if (msg.member && STAFF_ROLES.some((roleId) => msg.member.roles.cache.has(roleId))) {
            staffMember = msg.author;
            break;
          }
        }

        const staffName = staffMember ? staffMember.tag : "No asignado";

        // Guardar valoración en Supabase
        await saveRatingSupabase({
          channel_id: channel.id,
          guild_id: interaction.guild.id,
          user_id: interaction.user.id,
          username: interaction.user.tag,
          staff_name: staffName,
          staff_id: staffMember?.id || null,
          stars: parseInt(stars),
          comment: reason,
          ticket_name: channel.name
        });

        // Actualizar estado ticket a cerrado
        await supabase
          .from("tickets")
          .update({ status: "closed", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("channel_id", channel.id);

        const ratingEmbed = new EmbedBuilder()
          .setColor(stars >= 4 ? "#00FF00" : stars >= 3 ? "#FFA500" : "#FF0000")
          .setTitle("⭐ Valoración del Ticket")
          .addFields(
            { name: "👤 Usuario", value: `${interaction.user}`, inline: true },
            { name: "🛡️ Staff", value: staffName, inline: true },
            { name: "⭐ Estrellas", value: "⭐".repeat(parseInt(stars)), inline: false },
            { name: "💬 Comentario", value: reason, inline: false },
            { name: "🎫 Ticket", value: channel.name, inline: true },
            { name: "📅 Fecha", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          )
          .setTimestamp();

        if (RATINGS_CHANNEL_ID) {
          const ratingsChannel = interaction.guild.channels.cache.get(RATINGS_CHANNEL_ID);
          if (ratingsChannel) await ratingsChannel.send({ embeds: [ratingEmbed] });
        }

        await interaction.reply({
          content: `${EMOJI.CHECK} ¡Gracias por tu valoración! El ticket se cerrará en 5 segundos...`,
          embeds: [ratingEmbed]
        });

        addLog("info", `Ticket ${channel.name} valorado: ${stars}⭐ por ${interaction.user.tag}`);

        setTimeout(async () => {
          try {
            const allMessages = await channel.messages.fetch({ limit: 100 });
            const transcript = allMessages
              .reverse()
              .map((m) => `[${m.createdAt.toLocaleString("es-ES")}] ${m.author.tag}: ${m.content}`)
              .join("\n");

            // Guardar transcript en Supabase (tabla: ticket_transcripts)
            await supabase.from("ticket_transcripts").insert({
              channel_id: channel.id,
              guild_id: interaction.guild.id,
              transcript,
              saved_at: new Date().toISOString()
            });

            try {
              await interaction.user.send({
                content: `📋 **Transcript del ticket ${channel.name}**`,
                files: [
                  {
                    attachment: Buffer.from(transcript, "utf-8"),
                    name: `ticket-${channel.name}-${Date.now()}.txt`
                  }
                ]
              });
            } catch {
              addLog("warning", "No se pudo enviar transcript por DM");
            }

            await channel.delete(`Ticket cerrado por ${interaction.user.tag} - ${stars}⭐`);
          } catch (error) {
            addLog("error", `Error al cerrar ticket: ${error.message}`);
          }
        }, 5000);
      } catch (error) {
        addLog("error", `Error al procesar valoración: ${error.message}`);
        await interaction.reply({ content: `${EMOJI.CRUZ} Error al procesar la valoración.`, flags: 64 });
      }
      return;
    }

    // ==================== SISTEMA DE TRABAJOS ====================
    if (interaction.isButton() && interaction.customId.startsWith("trabajo_")) {
      const trabajoSeleccionado = interaction.customId.replace("trabajo_", "");
      const guildConfig = loadGuildConfig(interaction.guild.id);

      if (!guildConfig || !guildConfig.trabajos.enabled) {
        return interaction.reply({
          content:
            `${EMOJI.CRUZ} El sistema de trabajos no está configurado en este servidor.\n` +
            `Un administrador debe usar \`/config trabajos\` primero.`,
          flags: 64
        });
      }

      const TRABAJOS = guildConfig.trabajos.roles;

      if (trabajoSeleccionado === "quitar") {
        let trabajoActual = null;

        for (const [key, trabajo] of Object.entries(TRABAJOS)) {
          if (interaction.member.roles.cache.has(trabajo.roleId)) {
            trabajoActual = trabajo;
            await interaction.member.roles.remove(trabajo.roleId);
            break;
          }
        }

        if (trabajoActual) {
          await interaction.reply({ content: `${EMOJI.CHECK} Has renunciado a tu trabajo de **${trabajoActual.nombre}**.`, flags: 64 });
        } else {
          await interaction.reply({ content: `${EMOJI.CRUZ} No tienes ningún trabajo actualmente.`, flags: 64 });
        }

        await actualizarPanelTrabajos(interaction, guildConfig);
        return;
      }

      const trabajo = TRABAJOS[trabajoSeleccionado];
      if (!trabajo) return;

      try {
        for (const [key, t] of Object.entries(TRABAJOS)) {
          if (key !== trabajoSeleccionado && interaction.member.roles.cache.has(t.roleId)) {
            await interaction.member.roles.remove(t.roleId);
          }
        }

        if (interaction.member.roles.cache.has(trabajo.roleId)) {
          return interaction.reply({ content: `ℹ️ Ya eres **${trabajo.nombre}**.`, flags: 64 });
        }

        await interaction.member.roles.add(trabajo.roleId);
        await interaction.reply({
          content: `${EMOJI.CHECK} ${trabajo.emoji} ¡Felicidades! Ahora eres **${trabajo.nombre}**.`,
          flags: 64
        });

        addLog("info", `${interaction.user.tag} ahora es ${trabajo.nombre}`);
        await actualizarPanelTrabajos(interaction, guildConfig);
      } catch (error) {
        console.error("Error asignando trabajo:", error);
        await interaction.reply({ content: `${EMOJI.CRUZ} Error al asignar el trabajo.`, flags: 64 });
      }
      return;
    }

    // ==================== BOTÓN: INICIAR VERIFICACIÓN ====================
    if (interaction.isButton() && interaction.customId === "verify_start") {
      const guildConfig = loadGuildConfig(interaction.guild.id);

      if (!guildConfig || !guildConfig.verification.enabled) {
        return interaction.reply({
          content:
            `${EMOJI.CRUZ} El sistema de verificación no está configurado en este servidor.\n` +
            `Un administrador debe usar \`/config verificacion\` primero.`,
          flags: 64
        });
      }

      const VERIFIED_ROLE_ID = guildConfig.verification.roleId;

      if (interaction.member.roles.cache.has(VERIFIED_ROLE_ID)) {
        return interaction.reply({ content: `${EMOJI.CHECK} Ya estás verificado.`, flags: 64 });
      }

      try {
        await interaction.reply({ content: `${EMOJI.CHECK} Te he enviado un MD.`, flags: 64 });

        const dmEmbed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle("📧 Verificación de Email")
          .setDescription("**Paso 1:** Envía tu correo electrónico aquí.\n\nEjemplo: `micorreo@gmail.com`\n\n⚠️ Tienes 5 minutos.")
          .setTimestamp();

        await interaction.user.send({ embeds: [dmEmbed] });

        verificationCodes.set(interaction.user.id, {
          step: "waiting_email",
          guildId: interaction.guild.id,
          timestamp: Date.now()
        });

        addLog("info", `Verificación iniciada: ${interaction.user.tag} en ${interaction.guild.name}`);
      } catch (error) {
        addLog("error", `Error MD: ${error.message}`);
        return interaction.editReply({ content: `${EMOJI.CRUZ} No puedo enviarte mensajes directos.` }).catch(() => {});
      }
      return;
    }
  } catch (error) {
    if (error.code === 10062) {
      addLog("warning", "Interacción expirada");
      return;
    }
    addLog("error", `Error interacción: ${error.message}`);
  }
});

// ==================== FUNCIÓN ACTUALIZAR PANEL TRABAJOS ====================
async function actualizarPanelTrabajos(interaction, guildConfig) {
  try {
    const guild = interaction.guild;
    const TRABAJOS = guildConfig.trabajos.roles;
    const contadores = {};

    for (const [key, trabajo] of Object.entries(TRABAJOS)) {
      const role = guild.roles.cache.get(trabajo.roleId);
      contadores[key] = role ? role.members.size : 0;
    }

    const trabajosList = Object.entries(TRABAJOS)
      .map(([key, trabajo]) => `${trabajo.emoji} **${trabajo.nombre}:** \`${contadores[key]}\` personas`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor("#00BFFF")
      .setTitle("💼 CENTRO DE EMPLEO")
      .setDescription(
        "Selecciona tu trabajo haciendo clic en el botón correspondiente.\n\n" +
          "**📊 Personal actual por departamento:**\n" +
          trabajosList +
          "\n\n" +
          "⚠️ **Importante:**\n" +
          "• Solo puedes tener un trabajo a la vez\n" +
          "• Al seleccionar un trabajo nuevo, perderás el anterior\n" +
          "• El panel se actualiza automáticamente"
      )
      .setFooter({ text: "Sistema de empleos" })
      .setTimestamp();

    const rows = [];
    const trabajosArray = Object.entries(TRABAJOS);

    for (let i = 0; i < trabajosArray.length; i += 2) {
      const row = new ActionRowBuilder();
      for (let j = i; j < Math.min(i + 2, trabajosArray.length); j++) {
        const [key, trabajo] = trabajosArray[j];
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`trabajo_${key}`)
            .setLabel(`${trabajo.emoji} ${trabajo.nombre} (${contadores[key]})`)
            .setStyle(
              j % 4 === 0 ? ButtonStyle.Primary : j % 4 === 1 ? ButtonStyle.Danger : j % 4 === 2 ? ButtonStyle.Secondary : ButtonStyle.Success
            )
        );
      }
      rows.push(row);
    }

    const quitRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("trabajo_quitar").setLabel("🚫 Renunciar a mi trabajo").setStyle(ButtonStyle.Danger)
    );
    rows.push(quitRow);

    await interaction.message.edit({ embeds: [embed], components: rows });
  } catch (error) {
    console.error("Error actualizando panel:", error);
  }
}

// ==================== MANEJADOR DE MENSAJES (ANTI-FLOOD + IA + VERIFICACIÓN) ====================
client.on("messageCreate", async (message) => {
  try {
    if (message.guild && message.author) {
      const guild = message.guild;
      const author = message.author;

      const key = floodKey(guild.id, author.id);
      const now = Date.now();
      const b = floodBuckets.get(key) ?? { ts: [], lastActionAt: 0 };

      b.ts.push(now);
      b.ts = b.ts.filter((t) => now - t <= FLOOD_WINDOW_MS);

      if (!(b.lastActionAt && now - b.lastActionAt < FLOOD_COOLDOWN_MS) && b.ts.length >= FLOOD_COUNT) {
        b.lastActionAt = now;
        floodBuckets.set(key, b);

        if (author.bot) {
          await handleBotFlood(message);
          return;
        }
      } else {
        floodBuckets.set(key, b);
      }
    }

    if (message.author.bot) return;

    if (processedMessages.has(message.id)) {
      console.log(`⚠️ Mensaje ${message.id} ya fue procesado - IGNORANDO`);
      return;
    }

    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 30000);

    if (message.guild && message.mentions.has(client.user.id)) {
      if (activeAIProcessing.has(message.id)) {
        console.log(`⚠️ Mensaje ${message.id} ya está siendo procesado por IA - IGNORANDO`);
        return;
      }

      activeAIProcessing.set(message.id, true);

      try {
        const prompt = message.content.replace(/<@!?\d+>/g, "").trim();

        if (!prompt) {
          activeAIProcessing.delete(message.id);
          return message.reply(`${EMOJI.MEGAFONO} Mencióname con una pregunta.`);
        }

        await message.channel.sendTyping();

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content:
                  "Eres Gabriel Rufián, portavoz de ERC en el Congreso español. Tu personalidad es directa, provocadora e irreverente. Usas ironía y sarcasmo constantemente, atacas sin miedo a tus adversarios políticos (especialmente PP, Vox y PSOE cuando traiciona principios de izquierdas) con retórica afilada. Hablas con lenguaje sencillo y cercano, evitando tecnicismos innecesarios. Mezclas humor con contundencia política. Eres ambicioso y tienes alta autoestima, muy sensible a críticas sobre tu imagen. Defiendes el independentismo catalán pero también proyectos de izquierdas a nivel español. Críticas duramente la corrupción, el poder digital de los algoritmos y las redes sociales. Tu estilo es informal, alejado del protocolo tradicional. Tienes muy claro tu público (izquierda e independentismo) y poco te importa la opinión del resto. Usas frases cortas, directas, y no tienes miedo a la confrontación verbal. Prefieres decir lo que piensas aunque te critique todo el aparato político."
              },
              { role: "user", content: prompt }
            ],
            max_tokens: 1024,
            temperature: 0.7
          })
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;

        if (aiResponse.length <= 2000) {
          await message.reply(aiResponse);
        } else {
          const chunks = aiResponse.match(/[\s\S]{1,2000}/g) || [];
          for (const chunk of chunks) await message.channel.send(chunk);
        }

        addLog("success", `IA respondió a ${message.author.tag} en ${message.guild.name}`);
      } catch (error) {
        addLog("error", `Error IA: ${error.message}`);
        await message.reply(`${EMOJI.CRUZ} Error procesando tu pregunta.`).catch(() => {});
      } finally {
        setTimeout(() => activeAIProcessing.delete(message.id), 5000);
      }

      return;
    }

    // --- VERIFICACIÓN POR EMAIL (solo en DM) ---
    if (!message.guild) {
      const userData = verificationCodes.get(message.author.id);
      if (!userData) return;

      const timeElapsed = Date.now() - userData.timestamp;
      if (timeElapsed > 5 * 60 * 1000) {
        verificationCodes.delete(message.author.id);
        return message.reply(`${EMOJI.CRUZ} Tiempo expirado. Intenta de nuevo.`);
      }

      try {
        if (userData.step === "waiting_email") {
          const email = message.content.trim();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) return message.reply(`${EMOJI.CRUZ} Email inválido.`);

          const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

          await sgMail.send({
            to: email,
            from: process.env.SENDGRID_FROM_EMAIL,
            subject: "Código de Verificación - Discord",
            html: `
              <div style="font-family: Arial, sans-serif;">
                <h2>🔐 Verificación Discord</h2>
                <p>Hola <strong>${message.author.username}</strong>,</p>
                <p>Tu código:</p>
                <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold;">
                  ${verificationCode}
                </div>
                <p>Expira en 5 minutos.</p>
              </div>
            `
          });

          verificationCodes.set(message.author.id, {
            step: "waiting_code",
            code: verificationCode,
            email,
            guildId: userData.guildId,
            timestamp: Date.now()
          });

          const embed = new EmbedBuilder()
            .setColor("#00FF00")
            .setTitle(`${EMOJI.CHECK} Código Enviado`)
            .setDescription(`Código enviado a **${email}**. Revisa spam.\n\nEnvía el código de 6 dígitos.`)
            .setThumbnail("https://cdn.discordapp.com/emojis/1472550293152596000.gif?size=128&quality=lossless")
            .setTimestamp();

          await message.reply({ embeds: [embed] });
          addLog("success", `Código enviado a ${email}`);
        } else if (userData.step === "waiting_code") {
          const inputCode = message.content.trim();
          if (!/^\d{6}$/.test(inputCode)) return message.reply(`${EMOJI.CRUZ} Código inválido. 6 dígitos.`);

          if (inputCode === userData.code) {
            const guild = client.guilds.cache.get(userData.guildId);
            if (!guild) {
              verificationCodes.delete(message.author.id);
              return message.reply(`${EMOJI.CRUZ} Servidor no encontrado.`);
            }

            const guildConfig = loadGuildConfig(guild.id);
            if (!guildConfig || !guildConfig.verification.enabled) {
              verificationCodes.delete(message.author.id);
              return message.reply(`${EMOJI.CRUZ} Sistema de verificación no configurado en el servidor.`);
            }

            const member = await guild.members.fetch(message.author.id);
            const role = guild.roles.cache.get(guildConfig.verification.roleId);

            if (!role) {
              verificationCodes.delete(message.author.id);
              return message.reply(`${EMOJI.CRUZ} Rol no encontrado.`);
            }

            await member.roles.add(role);

            // Guardar usuario verificado en Supabase
            await saveVerifiedUserSupabase(message.author.id, userData.email, guild.id);

            verificationCodes.delete(message.author.id);

            const embed = new EmbedBuilder()
              .setColor("#00FF00")
              .setTitle(`${EMOJI.CHECK} Verificación Completada`)
              .setDescription(`¡Felicidades **${message.author.username}**!\n\nVerificado exitosamente.`)
              .setFooter({ text: guild.name })
              .setTimestamp();

            await message.reply({ embeds: [embed] });
            addLog("success", `Usuario verificado: ${message.author.tag} en ${guild.name}`);
          } else {
            await message.reply(`${EMOJI.CRUZ} Código incorrecto.`);
          }
        }
      } catch (error) {
        addLog("error", `Error verificación: ${error.message}`);
        verificationCodes.delete(message.author.id);
        await message.reply(`${EMOJI.CRUZ} Error. Intenta de nuevo.`).catch(() => {});
      }
    }
  } catch (e) {
    addLog("error", `Error messageCreate: ${e.message}`);
  }
});

// ==================== LOGIN DISCORD ====================
if (botEnabled) {
  console.log("🔍 Ejecutando client.login()...");
  client
    .login(TOKEN)
    .then(() => console.log("✅✅✅ PROMISE DE LOGIN RESUELTA - Bot autenticado correctamente"))
    .catch((err) => {
      console.error("❌❌❌ ERROR EN LOGIN:");
      console.error("Tipo:", err.name);
      console.error("Código:", err.code);
      console.error("Mensaje:", err.message);
    });
} else {
  console.log("⚠️ Bot Discord no iniciado (faltan variables de entorno)");
}

// ==================== WEB SERVER ====================
const app = express();

app.get("/", (req, res) => {
  res.send(
    `<h1>Bot funcionando - ${new Date().toLocaleString("es-ES")}</h1>` +
      `<p>Discord: ${botEnabled ? "Conectado" : "Desactivado"}</p>` +
      `<p>Servidores: ${client.guilds?.cache.size || 0}</p>`
  );
});

app.listen(process.env.PORT || 10000, "0.0.0.0", () => {
  console.log(`✅ Servidor web en puerto ${process.env.PORT || 10000}`);
});
