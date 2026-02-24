const { SlashCommandBuilder } = require("discord.js");
const { createClient } = require("@supabase/supabase-js");
const globalAdmins = require("../config/globalAdmins");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("banglobal")
    .setDescription("Banea a un usuario/bot de todos los servidores con Nexa")
    .addUserOption(opt =>
      opt.setName("usuario").setDescription("Usuario o bot a banear").setRequired(true))
    .addStringOption(opt =>
      opt.setName("razon").setDescription("Razón del ban").setRequired(false)),

  async execute(interaction) {
    if (!globalAdmins.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ No tienes permisos para usar este comando.", ephemeral: true });
    }

    const target = interaction.options.getUser("usuario");
    const reason = interaction.options.getString("razon") || "No especificado";

    // Guardar en Supabase (upsert)
    const { error } = await supabase
      .from("global_bans")
      .upsert({ user_id: target.id, reason, banned_by: interaction.user.id, date: new Date().toISOString() });

    if (error) {
      console.error(error);
      return interaction.reply({ content: "❌ Error al guardar en la base de datos.", ephemeral: true });
    }

    // Banear de todos los servidores
    let baneado = 0;
    let fallido = 0;

    for (const guild of interaction.client.guilds.cache.values()) {
      try {
        await guild.bans.create(target.id, { reason: `[GlobalBan] ${reason}` });
        baneado++;
      } catch {
        fallido++;
      }
    }

    return interaction.reply({
      content: `✅ **${target.tag}** baneado globalmente.\n🔨 Servidores: ${baneado} OK, ${fallido} fallidos.\n📝 Razón: ${reason}`,
      ephemeral: true
    });
  }
};
