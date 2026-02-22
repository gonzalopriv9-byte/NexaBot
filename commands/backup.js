const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType
} = require("discord.js");
const { saveBackup, loadBackup, listBackups, captureBackup, restoreBackup } = require("../utils/backupManager");

const EMOJI = {
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("backup")
    .setDescription("Sistema de backups del servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName("crear")
        .setDescription("Guarda un backup completo del servidor (roles, canales, permisos, miembros)"))
    .addSubcommand(sub =>
      sub.setName("listar")
        .setDescription("Muestra los backups guardados de este servidor"))
    .addSubcommand(sub =>
      sub.setName("restaurar")
        .setDescription("Restaura un backup en este servidor")
        .addStringOption(opt =>
          opt.setName("id")
            .setDescription("ID del backup a restaurar")
            .setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: 64 });

    // ==================== CREAR ====================
    if (sub === "crear") {
      try {
        await interaction.editReply({ content: "Capturando datos del servidor... esto puede tardar unos segundos." });

        const data = await captureBackup(interaction.guild);
        const backupId = await saveBackup(interaction.guild.id, interaction.user.id, data);

        if (!backupId) {
          return interaction.editReply({ content: EMOJI.CRUZ + " Error al guardar el backup en la base de datos." });
        }

        const embed = new EmbedBuilder()
          .setColor("#00FF00")
          .setTitle(EMOJI.CHECK + " Backup Creado")
          .setDescription("El backup se ha guardado correctamente.")
          .addFields(
            { name: "ID del Backup", value: "`" + backupId + "`", inline: false },
            { name: "Roles", value: "" + data.roles.length, inline: true },
            { name: "Categorias", value: "" + data.categories.length, inline: true },
            { name: "Canales", value: "" + data.channels.length, inline: true },
            { name: "Miembros guardados", value: "" + data.members.length, inline: true },
            { name: "Servidor", value: data.guildName, inline: true }
          )
          .setFooter({ text: "Guarda el ID para restaurar el backup" })
          .setTimestamp();

        return interaction.editReply({ content: "", embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: EMOJI.CRUZ + " Error creando backup: " + e.message });
      }
    }

    // ==================== LISTAR ====================
    if (sub === "listar") {
      try {
        const backups = await listBackups(interaction.guild.id);

        if (backups.length === 0) {
          return interaction.editReply({ content: "No hay backups guardados para este servidor." });
        }

        const embed = new EmbedBuilder()
          .setColor("#00BFFF")
          .setTitle("Backups de " + interaction.guild.name)
          .setDescription(
            backups.map((b, i) =>
              "**" + (i + 1) + ".** `" + b.id + "`\n" +
              "Creado por: <@" + b.created_by + "> | " +
              "<t:" + Math.floor(new Date(b.created_at).getTime() / 1000) + ":R>"
            ).join("\n\n")
          )
          .setFooter({ text: "Usa /backup restaurar <id> para restaurar" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: EMOJI.CRUZ + " Error listando backups: " + e.message });
      }
    }

    // ==================== RESTAURAR ====================
    if (sub === "restaurar") {
      const backupId = interaction.options.getString("id");

      try {
        const backup = await loadBackup(backupId);

        if (!backup) {
          return interaction.editReply({ content: EMOJI.CRUZ + " Backup no encontrado con ese ID." });
        }

        await interaction.editReply({ content: "Restaurando backup... esto puede tardar varios minutos." });

        const log = await restoreBackup(interaction.guild, backup.data);

        // Crear invitacion
        let invite = null;
        try {
          const channel = interaction.guild.channels.cache.find(
            c => c.type === ChannelType.GuildText &&
            c.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.CreateInstantInvite)
          );
          if (channel) invite = await channel.createInvite({ maxAge: 0, maxUses: 0 });
        } catch (e) { console.error("Error invitacion: " + e.message); }

        // Enviar DMs a miembros guardados
        let dmEnviados = 0;
        let dmFallidos = 0;
        if (invite && backup.data.members?.length > 0) {
          for (const member of backup.data.members) {
            try {
              const user = await interaction.client.users.fetch(member.userId);
              await user.send(
                "Hola **" + member.tag + "**!\n\n" +
                "Debido a un raid reciente en **" + backup.data.guildName + "**, el servidor ha sido restaurado.\n\n" +
                "Unete al nuevo servidor aqui: " + invite.url
              );
              dmEnviados++;
              await new Promise(r => setTimeout(r, 500));
            } catch { dmFallidos++; }
          }
        }

        const errores = log.filter(l => l.startsWith("Error"));
        const exitos = log.filter(l => !l.startsWith("Error"));

        const embed = new EmbedBuilder()
          .setColor(errores.length > 0 ? "#FFA500" : "#00FF00")
          .setTitle(EMOJI.CHECK + " Backup Restaurado")
          .addFields(
            { name: "Creados", value: "" + exitos.length, inline: true },
            { name: "Errores", value: "" + errores.length, inline: true },
            { name: "DMs enviados", value: "" + dmEnviados, inline: true },
            { name: "DMs fallidos", value: "" + dmFallidos, inline: true }
          )
          .setFooter({ text: "Backup ID: " + backupId })
          .setTimestamp();

        if (errores.length > 0) {
          embed.addFields({ name: "Errores detallados", value: errores.slice(0, 5).join("\n").substring(0, 1024) });
        }

        return interaction.editReply({ content: "", embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: EMOJI.CRUZ + " Error restaurando: " + e.message });
      }
    }
  }
};
