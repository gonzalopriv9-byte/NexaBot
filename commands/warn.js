const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const { createClient } = require("@supabase/supabase-js");
const { loadGuildConfig } = require("../utils/configManager");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const EMOJI = {
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>",
  WARNING: "⚠️"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Sistema de advertencias")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("Añadir una advertencia a un usuario")
        .addUserOption(opt =>
          opt.setName("usuario")
            .setDescription("Usuario a advertir")
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName("motivo")
            .setDescription("Motivo de la advertencia")
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("Ver advertencias de un usuario")
        .addUserOption(opt =>
          opt.setName("usuario")
            .setDescription("Usuario a consultar")
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Eliminar una advertencia específica")
        .addIntegerOption(opt =>
          opt.setName("id")
            .setDescription("ID de la advertencia a eliminar")
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName("clear")
        .setDescription("Limpiar todas las advertencias de un usuario")
        .addUserOption(opt =>
          opt.setName("usuario")
            .setDescription("Usuario a limpiar")
            .setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    const guildId = interaction.guild.id;

    // ==================== ADD WARN ====================
    if (sub === "add") {
      const user = interaction.options.getUser("usuario");
      const motivo = interaction.options.getString("motivo");

      // Insertar warn en base de datos
      const { error } = await supabase.from("warns").insert({
        guild_id: guildId,
        user_id: user.id,
        username: user.tag,
        mod_id: interaction.user.id,
        mod_username: interaction.user.tag,
        reason: motivo,
        created_at: new Date().toISOString()
      });

      if (error) {
        return interaction.editReply({
          content: EMOJI.CRUZ + " Error al guardar la advertencia: " + error.message
        });
      }

      // Contar warns totales del usuario
      const { data: warns, error: countError } = await supabase
        .from("warns")
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", user.id);

      const totalWarns = warns ? warns.length : 0;

      const embed = new EmbedBuilder()
        .setColor("#FFA500")
        .setTitle(EMOJI.WARNING + " Advertencia Añadida")
        .setDescription(`**Usuario:** ${user}\n**Moderador:** ${interaction.user}\n**Motivo:** ${motivo}\n\n**Total de advertencias:** ${totalWarns}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Enviar DM al usuario
      try {
        await user.send({
          embeds: [new EmbedBuilder()
            .setColor("#FFA500")
            .setTitle(EMOJI.WARNING + " Has recibido una advertencia")
            .setDescription(`**Servidor:** ${interaction.guild.name}\n**Motivo:** ${motivo}\n**Total de advertencias:** ${totalWarns}`)
            .setFooter({ text: "Acumular muchas advertencias puede resultar en sanciones" })
            .setTimestamp()]
        });
      } catch {}

      // Sistema de sanciones progresivas
      const config = await loadGuildConfig(guildId);
      if (config?.protection?.autoPunish?.enabled) {
        const thresholds = config.protection.autoPunish.thresholds || {
          3: { action: "timeout", duration: 60 },
          5: { action: "kick" },
          7: { action: "ban" }
        };

        const threshold = thresholds[totalWarns];
        if (threshold) {
          const member = await interaction.guild.members.fetch(user.id).catch(() => null);
          if (member) {
            try {
              if (threshold.action === "timeout") {
                const duration = threshold.duration || 60;
                await member.timeout(duration * 60 * 1000, `Auto-Punish: ${totalWarns} advertencias`);
                await interaction.followUp({
                  content: `🚨 **Auto-Punish:** ${user} ha sido **timeouteado** por ${duration} minutos (${totalWarns} advertencias).`,
                  ephemeral: false
                });
              } else if (threshold.action === "kick") {
                await member.kick(`Auto-Punish: ${totalWarns} advertencias`);
                await interaction.followUp({
                  content: `🚨 **Auto-Punish:** ${user} ha sido **expulsado** del servidor (${totalWarns} advertencias).`,
                  ephemeral: false
                });
              } else if (threshold.action === "ban") {
                await member.ban({ reason: `Auto-Punish: ${totalWarns} advertencias` });
                await interaction.followUp({
                  content: `🚨 **Auto-Punish:** ${user} ha sido **baneado** del servidor (${totalWarns} advertencias).`,
                  ephemeral: false
                });
              }
            } catch (e) {
              await interaction.followUp({
                content: EMOJI.CRUZ + " Error aplicando auto-punish: " + e.message,
                ephemeral: true
              });
            }
          }
        }
      }
    }

    // ==================== LIST WARNS ====================
    if (sub === "list") {
      const user = interaction.options.getUser("usuario");

      const { data: warns, error } = await supabase
        .from("warns")
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        return interaction.editReply({
          content: EMOJI.CRUZ + " Error al obtener advertencias: " + error.message
        });
      }

      if (!warns || warns.length === 0) {
        return interaction.editReply({
          content: `${user} no tiene advertencias. 🎉`
        });
      }

      const warnsList = warns.map((w, i) => {
        const date = new Date(w.created_at);
        return `**${i + 1}.** [ID: ${w.id}] ${w.reason}\n   • Moderador: <@${w.mod_id}>\n   • Fecha: <t:${Math.floor(date.getTime() / 1000)}:R>`;
      }).join("\n\n");

      const embed = new EmbedBuilder()
        .setColor("#FFA500")
        .setTitle(EMOJI.WARNING + " Advertencias de " + user.tag)
        .setDescription(warnsList)
        .setFooter({ text: `Total: ${warns.length} advertencia${warns.length === 1 ? '' : 's'}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

    // ==================== REMOVE WARN ====================
    if (sub === "remove") {
      const warnId = interaction.options.getInteger("id");

      const { data: warn, error: fetchError } = await supabase
        .from("warns")
        .select("*")
        .eq("id", warnId)
        .eq("guild_id", guildId)
        .single();

      if (fetchError || !warn) {
        return interaction.editReply({
          content: EMOJI.CRUZ + " Advertencia no encontrada."
        });
      }

      const { error } = await supabase
        .from("warns")
        .delete()
        .eq("id", warnId);

      if (error) {
        return interaction.editReply({
          content: EMOJI.CRUZ + " Error al eliminar advertencia: " + error.message
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle(EMOJI.CHECK + " Advertencia Eliminada")
        .setDescription(`Se ha eliminado la advertencia **#${warnId}** de <@${warn.user_id}>`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

    // ==================== CLEAR WARNS ====================
    if (sub === "clear") {
      const user = interaction.options.getUser("usuario");

      const { data: warns } = await supabase
        .from("warns")
        .select("id")
        .eq("guild_id", guildId)
        .eq("user_id", user.id);

      const count = warns ? warns.length : 0;

      if (count === 0) {
        return interaction.editReply({
          content: `${user} no tiene advertencias para limpiar.`
        });
      }

      const { error } = await supabase
        .from("warns")
        .delete()
        .eq("guild_id", guildId)
        .eq("user_id", user.id);

      if (error) {
        return interaction.editReply({
          content: EMOJI.CRUZ + " Error al limpiar advertencias: " + error.message
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle(EMOJI.CHECK + " Advertencias Limpiadas")
        .setDescription(`Se han eliminado **${count}** advertencia${count === 1 ? '' : 's'} de ${user}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }
};
