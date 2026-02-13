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
  EmbedBuilder
} = require("discord.js");
const express = require("express");
const { loadCommands } = require("./handlers/commandHandler");
const sgMail = require("@sendgrid/mail");

// ----------------- VARIABLES BOT -----------------
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;

// ----------------- VARIABLES TICKETS -----------------
const TICKET_CATEGORY_ID = "1471929885512695972";
const STAFF_ROLES = ["1469344936620195872"];

// ----------------- VARIABLES VERIFICACIÓN -----------------
const VERIFIED_ROLE_ID = "1471930183509475388";
const verificationCodes = new Map();

// Configurar SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// ----------------- SISTEMA DE LOGS -----------------
const logs = [];
const MAX_LOGS = 100;

function addLog(type, message) {
  const timestamp = new Date().toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const logEntry = { timestamp, type, message };
  
  logs.push(logEntry);
  if (logs.length > MAX_LOGS) logs.shift();
  
  const emoji = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  };
  console.log(`${emoji[type] || '📝'} [${timestamp}] ${message}`);
}

// Validar variables de entorno
const missingVars = [];
if (!TOKEN) missingVars.push("DISCORD_TOKEN");
if (!CLIENT_ID) missingVars.push("CLIENT_ID");
if (!GUILD_ID) missingVars.push("GUILD_ID");

if (missingVars.length > 0) {
  console.error(`❌ Faltan variables: ${missingVars.join(", ")}`);
  process.exit(1);
}

// ----------------- CREAR CLIENTE DISCORD -----------------
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

// Cargar comandos
loadCommands(client);

// ==================== EVENTOS DISCORD ====================

// ---------- READY ----------
client.once("ready", () => {
  addLog('success', `🎉 Bot conectado: ${client.user.tag}`);
  
  client.user.setPresence({
    status: "online",
    activities: [{ name: "RUFIAN", type: 0 }]
  });
});

// ---------- ERRORES DISCORD ----------
client.on("error", error => {
  addLog('error', `Discord error: ${error.message}`);
});

client.on("warn", info => {
  addLog('warning', `Discord warning: ${info}`);
});

// ---------- INTERACTIONS ----------
client.on("interactionCreate", async interaction => {
  try {
    // COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
      if (global.maintenanceMode && interaction.user.id !== MAINTENANCE_USER_ID) {
        return interaction.reply({
          content: "⚠️ El bot está en mantenimiento.",
          ephemeral: true
        });
      }

      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
        addLog('info', `/${interaction.commandName} por ${interaction.user.tag}`);
      } catch (err) {
        addLog('error', `Error /${interaction.commandName}: ${err.message}`);
        if (!interaction.replied && !interaction.deferred) {
          interaction.reply({ 
            content: "❌ Error ejecutando el comando", 
            ephemeral: true 
          }).catch(() => {});
        }
      }
      return;
    }

    // BOTÓN: ABRIR TICKET
    if (interaction.isButton() && interaction.customId === "open_ticket") {
      const modal = new ModalBuilder()
        .setCustomId("ticket_modal")
        .setTitle("📋 Crear Ticket");

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

      modal.addComponents(
        new ActionRowBuilder().addComponents(robloxInput),
        new ActionRowBuilder().addComponents(reasonInput)
      );

      await interaction.showModal(modal);
      return;
    }

    // MODAL: CREAR TICKET
    if (interaction.isModalSubmit() && interaction.customId === "ticket_modal") {
      await interaction.deferReply({ ephemeral: true });

      const robloxUser = interaction.fields.getTextInputValue("roblox_user");
      const reason = interaction.fields.getTextInputValue("ticket_reason");

      try {
        const guild = interaction.guild;

        const ticketChannel = await guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            },
            ...STAFF_ROLES.map(roleId => ({
              id: roleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            }))
          ]
        });

        const embed = new EmbedBuilder()
          .setColor("#00BFFF")
          .setTitle("🎫 Nuevo Ticket")
          .setDescription(`**Roblox:** ${robloxUser}\n\n**Motivo:**\n${reason}`)
          .setFooter({ text: `Por ${interaction.user.tag}` })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("claim_ticket")
            .setLabel("✋ Reclamar")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("close_ticket")
            .setLabel("🔒 Cerrar")
            .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({
          content: `${interaction.user} | ${STAFF_ROLES.map(r => `<@&${r}>`).join(" ")}`,
          embeds: [embed],
          components: [row]
        });

        await interaction.editReply({
          content: `✅ Ticket creado: ${ticketChannel}`
        });

        addLog('success', `Ticket creado por ${interaction.user.tag}`);
      } catch (error) {
        addLog('error', `Error ticket: ${error.message}`);
        await interaction.editReply({
          content: "❌ Error al crear el ticket."
        });
      }
      return;
    }

    // BOTÓN: RECLAMAR TICKET
    if (interaction.isButton() && interaction.customId === "claim_ticket") {
      const hasStaffRole = STAFF_ROLES.some(roleId => 
        interaction.member.roles.cache.has(roleId)
      );

      if (!hasStaffRole) {
        return interaction.reply({
          content: "❌ Solo el staff puede reclamar tickets.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content: `✅ ${interaction.user} ha reclamado este ticket.`
      });

      try {
        const channel = interaction.channel;
        const ticketOwner = channel.permissionOverwrites.cache.find(
          perm => perm.type === 1 && 
                  perm.id !== interaction.user.id && 
                  !STAFF_ROLES.includes(perm.id)
        );

        const newPerms = [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
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
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          });
        }

        STAFF_ROLES.forEach(roleId => {
          newPerms.push({
            id: roleId,
            deny: [PermissionFlagsBits.ViewChannel]
          });
        });

        await channel.edit({ permissionOverwrites: newPerms });

        const newRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("close_ticket")
            .setLabel("🔒 Cerrar")
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.message.edit({ components: [newRow] });
        addLog('info', `Ticket reclamado por ${interaction.user.tag}`);

      } catch (error) {
        addLog('error', `Error reclamando: ${error.message}`);
      }
      return;
    }

    // BOTÓN: CERRAR TICKET
    if (interaction.isButton() && interaction.customId === "close_ticket") {
      const hasStaffRole = STAFF_ROLES.some(roleId => 
        interaction.member.roles.cache.has(roleId)
      );

      if (!hasStaffRole) {
        return interaction.reply({
          content: "❌ Solo el staff puede cerrar tickets.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content: "🔒 Cerrando ticket en 5 segundos..."
      });

      addLog('info', `Ticket cerrado por ${interaction.user.tag}`);

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (error) {
          addLog('error', `Error cerrando: ${error.message}`);
        }
      }, 5000);
      return;
    }

    // BOTÓN: INICIAR VERIFICACIÓN
    if (interaction.isButton() && interaction.customId === "verify_start") {
      if (interaction.member.roles.cache.has(VERIFIED_ROLE_ID)) {
        return interaction.reply({
          content: "✅ Ya estás verificado.",
          ephemeral: true
        });
      }

      try {
        await interaction.reply({
          content: "✅ Te he enviado un MD.",
          ephemeral: true
        });

        const dmEmbed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle("📧 Verificación de Email")
          .setDescription(
            "**Paso 1:** Envía tu correo electrónico aquí.\n\n" +
            "Ejemplo: `micorreo@gmail.com`\n\n" +
            "⚠️ Tienes 5 minutos."
          )
          .setTimestamp();

        await interaction.user.send({ embeds: [dmEmbed] });

        verificationCodes.set(interaction.user.id, {
          step: "waiting_email",
          guildId: interaction.guild.id,
          timestamp: Date.now()
        });

        addLog('info', `Verificación iniciada: ${interaction.user.tag}`);

      } catch (error) {
        addLog('error', `Error MD: ${error.message}`);
        return interaction.editReply({
          content: "❌ No puedo enviarte mensajes directos."
        }).catch(() => {});
      }
      return;
    }

  } catch (error) {
    if (error.code === 10062) {
      addLog('warning', `Interacción expirada: ${interaction.user?.tag}`);
      return;
    }
    addLog('error', `Error interacción: ${error.message}`);
  }
});

// ---------- MENSAJES DIRECTOS (VERIFICACIÓN) ----------
client.on("messageCreate", async message => {
  if (message.author.bot || message.guild) return;

  const userData = verificationCodes.get(message.author.id);
  if (!userData) return;

  const timeElapsed = Date.now() - userData.timestamp;
  if (timeElapsed > 5 * 60 * 1000) {
    verificationCodes.delete(message.author.id);
    addLog('warning', `Timeout verificación: ${message.author.tag}`);
    return message.reply("❌ Tiempo expirado. Intenta de nuevo.");
  }

  try {
    // PASO 1: ESPERANDO EMAIL
    if (userData.step === "waiting_email") {
      const email = message.content.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email)) {
        return message.reply("❌ Email inválido. Ejemplo: `correo@gmail.com`");
      }

      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      try {
        await sgMail.send({
          to: email,
          from: process.env.SENDGRID_FROM_EMAIL,
          subject: "Código de Verificación - Discord",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #5865F2;">🔐 Verificación Discord</h2>
              <p>Hola <strong>${message.author.username}</strong>,</p>
              <p>Tu código de verificación es:</p>
              <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                ${verificationCode}
              </div>
              <p>Expira en <strong>5 minutos</strong>.</p>
            </div>
          `
        });

        verificationCodes.set(message.author.id, {
          step: "waiting_code",
          code: verificationCode,
          email: email,
          guildId: userData.guildId,
          timestamp: Date.now()
        });

        const embed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle("✅ Código Enviado")
          .setDescription(
            `He enviado un código a **${email}**.\n\n` +
            "Revisa tu email y envía el código de 6 dígitos aquí.\n\n" +
            "Ejemplo: `123456`"
          )
          .setTimestamp();

        await message.reply({ embeds: [embed] });
        addLog('success', `Código enviado a ${email}`);

      } catch (error) {
        addLog('error', `Error SendGrid: ${error.message}`);
        verificationCodes.delete(message.author.id);
        return message.reply("❌ Error enviando email. Verifica que sea correcto.");
      }
    }

    // PASO 2: ESPERANDO CÓDIGO
    else if (userData.step === "waiting_code") {
      const inputCode = message.content.trim();

      if (!/^\d{6}$/.test(inputCode)) {
        return message.reply("❌ Código inválido. Debe ser 6 dígitos: `123456`");
      }

      if (inputCode === userData.code) {
        try {
          const guild = client.guilds.cache.get(userData.guildId);
          if (!guild) {
            verificationCodes.delete(message.author.id);
            return message.reply("❌ Servidor no encontrado.");
          }

          const member = await guild.members.fetch(message.author.id);
          const role = guild.roles.cache.get(VERIFIED_ROLE_ID);

          if (!role) {
            verificationCodes.delete(message.author.id);
            return message.reply("❌ Rol de verificado no encontrado.");
          }

          await member.roles.add(role);
          verificationCodes.delete(message.author.id);

          const embed = new EmbedBuilder()
            .setColor("#00FF00")
            .setTitle("✅ Verificación Completada")
            .setDescription(
              `¡Felicidades **${message.author.username}**!\n\n` +
              "Has sido verificado exitosamente.\n\n" +
              "Puedes cerrar este chat y regresar al servidor."
            )
            .setFooter({ text: guild.name })
            .setTimestamp();

          await message.reply({ embeds: [embed] });
          addLog('success', `Usuario verificado: ${message.author.tag}`);

        } catch (error) {
          addLog('error', `Error asignando rol: ${error.message}`);
          verificationCodes.delete(message.author.id);
          return message.reply("❌ Error asignando rol. Contacta un admin.");
        }
      } else {
        addLog('warning', `Código incorrecto: ${message.author.tag}`);
        await message.reply("❌ Código incorrecto. Intenta de nuevo.");
      }
    }

  } catch (error) {
    addLog('error', `Error messageCreate: ${error.message}`);
    verificationCodes.delete(message.author.id);
    await message.reply("❌ Error. Intenta de nuevo desde el servidor.").catch(() => {});
  }
});

// ---------- BIENVENIDA ----------
client.on("guildMemberAdd", async member => {
  try {
    if (!WELCOME_CHANNEL_ID) return;

    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) {
      addLog('warning', 'Canal de bienvenida no encontrado');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🎉 ¡BIENVENIDO!")
      .setDescription(`**${member.user.username}** se unió al servidor`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: "👤 Usuario", value: `${member}`, inline: true },
        { name: "📊 Miembro", value: `#${member.guild.memberCount}`, inline: true },
        { name: "📅 Creado", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setImage("https://raw.githubusercontent.com/gonzalopriv9-byte/EspanoletesBOT.1/main/assets/bienvenida.png")
      .setTimestamp();

    await channel.send({
      content: `🎉 **¡Bienvenido ${member}!** 🎉`,
      embeds: [embed]
    });

    addLog('success', `Bienvenida: ${member.user.tag}`);
  } catch (error) {
    addLog('error', `Error bienvenida: ${error.message}`);
  }
});

// ==================== DEBUGGING ====================
console.log('🔍 TOKEN detectado:', TOKEN ? 'SÍ (primeros 10 chars: ' + TOKEN.substring(0, 10) + ')' : 'NO');
console.log('🔍 Intents configurados:', client.options.intents);

// ==================== LOGIN DISCORD ====================
console.log('🔍 Ejecutando client.login()...');

client.login(TOKEN)
  .then(() => {
    console.log('✅✅✅ PROMISE DE LOGIN RESUELTA - Bot autenticado correctamente');
  })
  .catch(err => {
    console.error('❌❌❌ ERROR EN LOGIN:');
    console.error('Tipo:', err.name);
    console.error('Código:', err.code);
    console.error('Mensaje:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  });

// ==================== WEB SERVER ====================
const app = express();

app.get("/", (req, res) => {
  res.send(`<h1>Bot funcionando - ${new Date().toLocaleString()}</h1>`);
});

app.listen(process.env.PORT || 10000, () => {
  console.log(`✅ Servidor web en puerto ${process.env.PORT || 10000}`);
});
