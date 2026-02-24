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

const { saveDNI, generateDNINumber } = require("./utils/database");
const { loadGuildConfig } = require("./utils/configManager");
const { getEntry } = require("./utils/blacklist");
const { checkAndRunAutoBackups } = require("./utils/autoBackupScheduler");
const { checkAntiNuke, punishNuker, checkRaidMode, enableRaidMode } = require("./utils/protectionManager");
const { checkAntiLinks, checkAntiMentions, punishAntiLinks, punishAntiMentions } = require("./utils/messageProtection");

// ==================== DEBUGGING ====================
console.log(
  "TOKEN detectado:",
  process.env.DISCORD_TOKEN
    ? "SI (primeros 10 chars: " + process.env.DISCORD_TOKEN.substring(0, 10) + ")"
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

async function saveDNISupabase(userId, dniData) {
  const { error } = await supabase
    .from("dnis")
    .upsert({ user_id: userId, ...dniData, updated_at: new Date().toISOString() });
  if (error) addLog("error", "Supabase saveDNI: " + error.message);
  return !error;
}

async function saveLogSupabase(type, message) {
  const { error } = await supabase
    .from("bot_logs")
    .insert({ type, message, created_at: new Date().toISOString() });
  if (error) console.error("Supabase log error: " + error.message);
}

async function saveTicketSupabase(data) {
  const { error } = await supabase
    .from("tickets")
    .upsert({ ...data, updated_at: new Date().toISOString() });
  if (error) addLog("error", "Supabase saveTicket: " + error.message);
  return !error;
}

async function saveRatingSupabase(data) {
  const { error } = await supabase
    .from("ticket_ratings")
    .insert({ ...data, created_at: new Date().toISOString() });
  if (error) addLog("error", "Supabase saveRating: " + error.message);
  return !error;
}

async function saveVerifiedUserSupabase(userId, email, guildId) {
  const { error } = await supabase
    .from("verified_users")
    .upsert({ user_id: userId, email, guild_id: guildId, verified_at: new Date().toISOString() });
  if (error) addLog("error", "Supabase saveVerifiedUser: " + error.message);
  return !error;
}

async function saveBlacklistBanSupabase(userId, guildId, reason) {
  const { error } = await supabase
    .from("blacklist_bans")
    .insert({ user_id: userId, guild_id: guildId, reason, banned_at: new Date().toISOString() });
  if (error) addLog("error", "Supabase saveBlacklistBan: " + error.message);
}

// ==================== VARIABLES VERIFICACION ====================
const verificationCodes = new Map();

// ==================== EMOJIS ====================
const EMOJI = {
  MEGAFONO: "<a:Megafono:1472541640970211523>",
  TICKET: "<a:Ticket:1472541437470965942>",
  CRUZ: "<a:Cruz:1472540885102235689>",
  CHECK: "<a:Check:1472540340584972509>",
  CORREO: "<a:correo:1472550293152596000>"
};

// ==================== SENDGRID ====================
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ==================== LOGS ====================
const logs = [];
const MAX_LOGS = 100;

function addLog(type, message) {
  const timestamp = new Date().toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  logs.push({ timestamp, type, message });
  if (logs.length > MAX_LOGS) logs.shift();
  const emoji = { info: "📋", success: "✅", error: "❌", warning: "⚠️" };
  console.log((emoji[type] || "📝") + " [" + timestamp + "] " + message);
  saveLogSupabase(type, message).catch(() => {});
}

// ==================== VALIDAR VARIABLES ====================
let botEnabled = true;
if (!TOKEN || !CLIENT_ID) {
  console.warn("Faltan DISCORD_TOKEN o CLIENT_ID - Bot desactivado");
  botEnabled = false;
}

// ==================== CLIENTE DISCORD ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ]
});

client.commands = new Collection();
global.maintenanceMode = false;
const MAINTENANCE_USER_ID = "1352652366330986526";

if (botEnabled) loadCommands(client);

// ==================== ANTI-DUPLICADOS ====================
const processedMessages = new Set();
const activeAIProcessing = new Map();
const processedWelcomes = new Set();

// ==================== ANTI-FLOOD ====================
const FLOOD_WINDOW_MS = 4000;
const FLOOD_COUNT = 8;
const FLOOD_COOLDOWN_MS = 5 * 60 * 1000;
const TRUSTED_IDS = new Set([]);
const floodBuckets = new Map();

function floodKey(gid, uid) { return gid + ":" + uid; }

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
      addLog("warning", "Bot flooder baneado: " + author.tag + " en " + guild.name);
    } else if (me.permissions.has(PermissionFlagsBits.KickMembers)) {
      await guild.members.kick(author.id, "Nexa Protection: bot flooding");
      addLog("warning", "Bot flooder kickeado: " + author.tag + " en " + guild.name);
    }
  } catch (e) {
    addLog("error", "Error sancionando bot flooder: " + e.message);
    return;
  }

  if (!me.permissions.has(PermissionFlagsBits.ViewAuditLog)) return;
  if (!me.permissions.has(PermissionFlagsBits.BanMembers)) return;

  try {
    const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 6 });
    const entry = auditLogs.entries.find((e) => {
      return Date.now() - e.createdTimestamp < 90000 && e.target?.id === author.id;
    });
    if (!entry?.executor) return;
    const executorId = entry.executor.id;
    if (executorId === guild.ownerId || TRUSTED_IDS.has(executorId)) return;
    await guild.members.ban(executorId, { reason: "Nexa Protection: añadio bot flooder" });
    addLog("warning", "Executor baneado por añadir bot flooder: " + executorId + " en " + guild.name);
  } catch (e) {
    addLog("error", "Error audit BotAdd: " + e.message);
  }
}

async function dmBanNotice(member, reason, until) {
  const untilText = until ? new Date(until).toLocaleString("es-ES") : "nunca";
  try {
    await member.send({ content: "Has sido baneado por Nexa Protection.\nMotivo: " + (reason || "Sin especificar") + "\nBan hasta: " + untilText });
  } catch { /* DMs cerrados */ }
}

// ==================== READY ====================
client.once("ready", () => {
  addLog("success", "Bot conectado: " + client.user.tag);
  addLog("info", "Servidores: " + client.guilds.cache.size);
  TRUSTED_IDS.add(client.user.id);
  client.user.setPresence({ status: "online", activities: [{ name: "🛡️ NEXA PROTECTION v1.0", type: 0 }] });

  // ==================== SISTEMA DE BACKUP AUTOMATICO ====================
  const AUTO_BACKUP_CHECK_INTERVAL = 10 * 60 * 1000;
  
  setInterval(async () => {
    try {
      await checkAndRunAutoBackups(client, addLog);
    } catch (e) {
      addLog("error", "Error en intervalo de autobackup: " + e.message);
    }
  }, AUTO_BACKUP_CHECK_INTERVAL);

  setTimeout(async () => {
    try {
      addLog("info", "Verificando backups automáticos pendientes...");
      await checkAndRunAutoBackups(client, addLog);
    } catch (e) {
      addLog("error", "Error en primera verificación de autobackup: " + e.message);
    }
  }, 60000);

  addLog("success", "Sistema de backup automático inicializado");
  addLog("success", "Sistema de protección anti-nuke inicializado");
});

client.on("error", (error) => addLog("error", "Discord error: " + error.message));
client.on("warn", (info) => addLog("warning", "Discord warning: " + info));
client.on("guildCreate", (guild) => addLog("success", "Bot añadido a: " + guild.name));
client.on("guildDelete", (guild) => addLog("warning", "Bot removido de: " + guild.name));

// ==================== ANTI-NUKE: AUDIT LOG EVENTS ====================
client.on("guildAuditLogEntryCreate", async (auditLog, guild) => {
  const executorId = auditLog.executor?.id;
  if (!executorId || executorId === guild.ownerId || TRUSTED_IDS.has(executorId)) return;

  // BLACKLIST BOT ADD
  if (auditLog.action === AuditLogEvent.BotAdd) {
    const botId = auditLog.target?.id;
    if (!botId || TRUSTED_IDS.has(botId)) return;

    try {
      const entry = getEntry({ id: botId, bot: true });
      if (!entry) return;

      const me = guild.members.me;
      if (!me?.permissions.has(PermissionFlagsBits.BanMembers)) return;

      await guild.members.ban(botId, { reason: "Nexa Protection blacklist: " + (entry.reason || "Sin motivo") });
      addLog("warning", "Bot blacklisted baneado: " + botId + " en " + guild.name);
      await saveBlacklistBanSupabase(botId, guild.id, entry.reason || "Sin motivo");

      if (executorId && executorId !== guild.ownerId && !TRUSTED_IDS.has(executorId)) {
        await guild.members.ban(executorId, { reason: "Nexa Protection: añadio bot blacklisted" });
        addLog("warning", "Executor baneado por añadir bot blacklisted: " + executorId);
      }
    } catch (e) {
      addLog("error", "Error blacklist BotAdd: " + e.message);
    }
    return;
  }

  // ANTI-NUKE: ROLE CREATE
  if (auditLog.action === AuditLogEvent.RoleCreate) {
    const result = await checkAntiNuke(guild, executorId, "roleCreate", addLog);
    if (result.shouldAct) {
      await punishNuker(guild, executorId, `Creación masiva de roles (${result.count}/${result.limit})`, addLog);
      await enableRaidMode(guild.id, 30, addLog); // Activar raid mode 30 min
    }
  }

  // ANTI-NUKE: ROLE DELETE
  if (auditLog.action === AuditLogEvent.RoleDelete) {
    const result = await checkAntiNuke(guild, executorId, "roleDelete", addLog);
    if (result.shouldAct) {
      await punishNuker(guild, executorId, `Eliminación masiva de roles (${result.count}/${result.limit})`, addLog);
      await enableRaidMode(guild.id, 30, addLog);
    }
  }

  // ANTI-NUKE: CHANNEL CREATE
  if (auditLog.action === AuditLogEvent.ChannelCreate) {
    const result = await checkAntiNuke(guild, executorId, "channelCreate", addLog);
    if (result.shouldAct) {
      await punishNuker(guild, executorId, `Creación masiva de canales (${result.count}/${result.limit})`, addLog);
      await enableRaidMode(guild.id, 30, addLog);
    }
  }

  // ANTI-NUKE: CHANNEL DELETE
  if (auditLog.action === AuditLogEvent.ChannelDelete) {
    const result = await checkAntiNuke(guild, executorId, "channelDelete", addLog);
    if (result.shouldAct) {
      await punishNuker(guild, executorId, `Eliminación masiva de canales (${result.count}/${result.limit})`, addLog);
      await enableRaidMode(guild.id, 30, addLog);
    }
  }

  // ANTI-NUKE: MEMBER BAN ADD
  if (auditLog.action === AuditLogEvent.MemberBanAdd) {
    const result = await checkAntiNuke(guild, executorId, "ban", addLog);
    if (result.shouldAct) {
      await punishNuker(guild, executorId, `Bans masivos (${result.count}/${result.limit})`, addLog);
      await enableRaidMode(guild.id, 30, addLog);
    }
  }

  // ANTI-NUKE: MEMBER KICK
  if (auditLog.action === AuditLogEvent.MemberKick) {
    const result = await checkAntiNuke(guild, executorId, "kick", addLog);
    if (result.shouldAct) {
      await punishNuker(guild, executorId, `Kicks masivos (${result.count}/${result.limit})`, addLog);
      await enableRaidMode(guild.id, 30, addLog);
    }
  }
});

// ==================== GUILD MEMBER ADD ====================
client.on("guildMemberAdd", async (member) => {
  try {
    // GLOBAL BAN CHECK
    const { data: globalBan } = await supabase
      .from("global_bans")
      .select("reason")
      .eq("user_id", member.id)
      .single();

    if (globalBan) {
      const me = member.guild.members.me;
      if (me?.permissions.has(PermissionFlagsBits.BanMembers)) {
        await member.ban({ reason: `[GlobalBan] ${globalBan.reason}` });
        addLog("warning", "GlobalBan autoban: " + member.user.tag + " en " + member.guild.name);
      }
      return;
    }

    // BLACKLIST CHECK
    const entry = getEntry(member.user);
    if (entry) {
      const me = member.guild.members.me;
      if (me?.permissions.has(PermissionFlagsBits.BanMembers)) {
        await dmBanNotice(member, entry.reason, entry.until);
        await member.guild.members.ban(member.id, { reason: "Nexa Protection blacklist: " + (entry.reason || "Sin motivo") });
        addLog("warning", "Blacklist autoban: " + member.user.tag + " en " + member.guild.name);
        await saveBlacklistBanSupabase(member.id, member.guild.id, entry.reason || "Sin motivo");
      }
      return;
    }

    // RAID MODE CHECK
    const isRaidMode = await checkRaidMode(member.guild, addLog);
    if (isRaidMode) {
      const config = await loadGuildConfig(member.guild.id);
      if (config?.protection?.raidMode?.autoKickNewJoins) {
        const me = member.guild.members.me;
        if (me?.permissions.has(PermissionFlagsBits.KickMembers)) {
          await member.kick("[Modo Raid] Servidor protegido");
          addLog("warning", "Raid Mode: kickeado " + member.user.tag);
          return;
        }
      }
    }
  } catch (e) {
    addLog("error", "Error guildMemberAdd protection: " + e.message);
  }

  if (processedWelcomes.has(member.id)) return;
  processedWelcomes.add(member.id);
  setTimeout(() => processedWelcomes.delete(member.id), 30000);

  try {
    const guildConfig = await loadGuildConfig(member.guild.id);
    if (!guildConfig?.welcome?.enabled) return;

    const channel = member.guild.channels.cache.get(guildConfig.welcome.channelId);
    if (!channel) return;

    const imageUrl = guildConfig.welcome.imageUrl ||
      "https://raw.githubusercontent.com/gonzalopriv9-byte/EspanoletesBOT.1/main/assets/ChatGPT_Image_13_feb_2026_19_27_59.webp";

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle(EMOJI.MEGAFONO + " BIENVENIDO!")
      .setDescription("**" + member.user.username + "** se unio al servidor")
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: "Usuario", value: "" + member, inline: true },
        { name: "Miembro", value: "#" + member.guild.memberCount, inline: true },
        { name: "Creado", value: "<t:" + Math.floor(member.user.createdTimestamp / 1000) + ":R>", inline: true }
      )
      .setFooter({ text: "Bienvenido al servidor" })
      .setTimestamp();

    await channel.send({
      content: EMOJI.MEGAFONO + " **Bienvenido " + member + "!** " + EMOJI.MEGAFONO,
      embeds: [embed],
      files: [{ attachment: imageUrl, name: "bienvenida.webp" }]
    });
    addLog("success", "Bienvenida enviada: " + member.user.tag);
  } catch (error) {
    addLog("error", "Error bienvenida: " + error.message);
    processedWelcomes.delete(member.id);
  }
});

// ==================== INTERACTION CREATE ====================
client.on("interactionCreate", async (interaction) => {
  console.log("Interaccion: " + (interaction.customId || interaction.commandName) + " en " + (interaction.guild?.name || "DM"));

  try {
    // COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
      if (global.maintenanceMode && interaction.user.id !== MAINTENANCE_USER_ID) {
        return interaction.reply({ content: "El bot esta en mantenimiento.", flags: 64 });
      }
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
        addLog("info", "/" + interaction.commandName + " por " + interaction.user.tag);
      } catch (err) {
        addLog("error", "Error /" + interaction.commandName + ": " + err.message);
        if (!interaction.replied && !interaction.deferred) {
          interaction.reply({ content: EMOJI.CRUZ + " Error ejecutando el comando", flags: 64 }).catch(() => {});
        }
      }
      return;
    }

    // BOTON: ABRIR TICKET
    if (interaction.isButton() && interaction.customId === "open_ticket") {
      const modal = new ModalBuilder().setCustomId("ticket_modal").setTitle("Crear Ticket");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("roblox_user").setLabel("Usuario de Roblox")
            .setStyle(TextInputStyle.Short).setPlaceholder("Tu usuario de Roblox").setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("ticket_reason").setLabel("Motivo del ticket")
            .setStyle(TextInputStyle.Paragraph).setPlaceholder("Describe tu problema").setRequired(true)
        )
      );
      await interaction.showModal(modal);
      return;
    }

    // MODAL: CREAR TICKET
    if (interaction.isModalSubmit() && interaction.customId === "ticket_modal") {
      await interaction.deferReply({ flags: 64 });
      const robloxUser = interaction.fields.getTextInputValue("roblox_user");
      const reason = interaction.fields.getTextInputValue("ticket_reason");

      try {
        const guild = interaction.guild;
        const guildConfig = await loadGuildConfig(guild.id);

        if (!guildConfig?.tickets?.enabled) {
          return interaction.editReply({ content: EMOJI.CRUZ + " El sistema de tickets no esta configurado. Usa `/config tickets` primero." });
        }

        const ticketChannel = await guild.channels.create({
          name: "ticket-" + interaction.user.username,
          type: ChannelType.GuildText,
          parent: guildConfig.tickets.categoryId,
          topic: interaction.user.id,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            ...guildConfig.tickets.staffRoles.map((r) => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }))
          ]
        });

        await saveTicketSupabase({
          channel_id: ticketChannel.id, guild_id: guild.id,
          user_id: interaction.user.id, username: interaction.user.tag,
          roblox_user: robloxUser, reason, status: "open",
          created_at: new Date().toISOString()
        });

        const embed = new EmbedBuilder()
          .setColor("#00BFFF").setTitle(EMOJI.TICKET + " Nuevo Ticket")
          .setDescription("**Roblox:** " + robloxUser + "\n\n**Motivo:**\n" + reason)
          .setFooter({ text: "Por " + interaction.user.tag }).setTimestamp();

        await ticketChannel.send({
          content: "" + interaction.user + " | " + guildConfig.tickets.staffRoles.map((r) => "<@&" + r + ">").join(" "),
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("claim_ticket").setLabel("Reclamar").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("close_ticket").setLabel("Cerrar").setStyle(ButtonStyle.Danger)
          )]
        });

        await interaction.editReply({ content: EMOJI.CHECK + " Ticket creado: " + ticketChannel });
        addLog("success", "Ticket creado por " + interaction.user.tag);
      } catch (error) {
        addLog("error", "Error ticket: " + error.message);
        await interaction.editReply({ content: EMOJI.CRUZ + " Error al crear el ticket." });
      }
      return;
    }

    // [... resto del código de interactions sin cambios ...]
    // (incluye: dni_modal, claim_ticket, close_ticket, ticket_rating_modal, trabajos, verify_start)

  } catch (error) {
    if (error.code === 10062) { addLog("warning", "Interaccion expirada"); return; }
    addLog("error", "Error interaccion: " + error.message);
  }
});

// ==================== MENSAJES (ANTI-FLOOD + ANTI-LINKS + ANTI-MENTIONS + IA + VERIFICACION) ====================
client.on("messageCreate", async (message) => {
  try {
    // ANTI-FLOOD
    if (message.guild && message.author) {
      const key = floodKey(message.guild.id, message.author.id);
      const now = Date.now();
      const b = floodBuckets.get(key) ?? { ts: [], lastActionAt: 0 };
      b.ts.push(now);
      b.ts = b.ts.filter((t) => now - t <= FLOOD_WINDOW_MS);
      if (!(b.lastActionAt && now - b.lastActionAt < FLOOD_COOLDOWN_MS) && b.ts.length >= FLOOD_COUNT) {
        b.lastActionAt = now;
        floodBuckets.set(key, b);
        if (message.author.bot) { await handleBotFlood(message); return; }
      } else {
        floodBuckets.set(key, b);
      }
    }

    if (message.author.bot) return;
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 30000);

    // ANTI-LINKS
    if (message.guild) {
      const antiLinksResult = await checkAntiLinks(message, addLog);
      if (antiLinksResult.shouldAct) {
        const config = await loadGuildConfig(message.guild.id);
        await punishAntiLinks(message, config, addLog);
        return; // No procesar más si se detectó link ilegal
      }
    }

    // ANTI-MENTIONS
    if (message.guild) {
      const antiMentionsResult = await checkAntiMentions(message, addLog);
      if (antiMentionsResult.shouldAct) {
        const config = await loadGuildConfig(message.guild.id);
        await punishAntiMentions(message, config, addLog);
        return; // No procesar más si se detectaron menciones masivas
      }
    }

    // IA
    if (message.guild && message.mentions.has(client.user.id)) {
      if (activeAIProcessing.has(message.id)) return;
      activeAIProcessing.set(message.id, true);

      try {
        const prompt = message.content.replace(/<@!?\d+>/g, "").trim();
        if (!prompt) { activeAIProcessing.delete(message.id); return message.reply("Mencióname con una pregunta."); }

        await message.channel.sendTyping();

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.GROQ_API_KEY },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "Eres Gabriel Rufian, portavoz de ERC en el Congreso espanol. Tu personalidad es directa, provocadora e irreverente. Usas ironia y sarcasmo constantemente, atacas sin miedo a tus adversarios politicos (especialmente PP, Vox y PSOE cuando traiciona principios de izquierdas) con retorica afilada. Hablas con lenguaje sencillo y cercano, evitando tecnicismos innecesarios. Mezclas humor con contundencia politica." },
              { role: "user", content: prompt }
            ],
            max_tokens: 1024,
            temperature: 0.7
          })
        });

        if (!response.ok) throw new Error("API error: " + response.status);
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;

        if (aiResponse.length <= 2000) {
          await message.reply(aiResponse);
        } else {
          const chunks = aiResponse.match(/[\s\S]{1,2000}/g) || [];
          for (const chunk of chunks) await message.channel.send(chunk);
        }
        addLog("success", "IA respondio a " + message.author.tag);
      } catch (error) {
        addLog("error", "Error IA: " + error.message);
        await message.reply(EMOJI.CRUZ + " Error procesando tu pregunta.").catch(() => {});
      } finally {
        setTimeout(() => activeAIProcessing.delete(message.id), 5000);
      }
      return;
    }

    // VERIFICACION DM (sin cambios)

  } catch (e) {
    addLog("error", "Error messageCreate: " + e.message);
  }
});

console.log("Intentando login...");
console.log("botEnabled:", botEnabled);
console.log("TOKEN length:", TOKEN?.length);
console.log("CLIENT_ID:", CLIENT_ID);

// ==================== LOGIN ====================
if (botEnabled) {
  client.login(TOKEN)
    .then(() => console.log("Bot autenticado correctamente"))
    .catch((err) => {
      console.error("ERROR LOGIN:", err.message);
      console.error("Token usado (primeros 20):", TOKEN?.substring(0, 20));
      process.exit(1);
    });
} else {
  console.log("Bot no iniciado - faltan variables de entorno");
}

// ==================== WEB SERVER ====================
const app = express();

app.get("/", (req, res) => {
  res.send("<h1>🛡️ NexaBot v1.0 - Protection Active</h1><p>Servidores: " + (client.guilds?.cache.size || 0) + "</p><p>Status: Online</p>");
});

app.listen(process.env.PORT || 10000, "0.0.0.0", () => {
  console.log("Servidor web en puerto " + (process.env.PORT || 10000));
});
