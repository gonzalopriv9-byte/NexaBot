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
    // Verificar permisos
    if (!globalAdmins.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ No tienes permisos para usar este comando.", ephemeral: true });
    }

    // Defer inmediatamente para evitar timeout
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("usuario");
    const reason = interaction.options.getString("razon") || "No especificado";

    try {
      // Guardar en Supabase (upsert)
      const { error } = await supabase
        .from("global_bans")
        .upsert({ user_id: target.id, reason, banned_by: interaction.user.id, date: new Date().toISOString() });

      if (error) {
        console.error("Error Supabase global ban:", error);
        return interaction.editReply({ content: "❌ Error al guardar en la base de datos: " + error.message });
      }

      // Banear de todos los servidores
      let baneado = 0;
      let fallido = 0;
      const totalServers = interaction.client.guilds.cache.size;

      await interaction.editReply({ 
        content: `⏳ Procesando ban global de **${target.tag}**...\n📊 0/${totalServers} servidores procesados` 
      });

      for (const guild of interaction.client.guilds.cache.values()) {
        try {
          await guild.bans.create(target.id, { reason: `[GlobalBan] ${reason}` });
          baneado++;
        } catch (err) {
          fallido++;
          console.log(`No se pudo banear en ${guild.name}: ${err.message}`);
        }

        // Actualizar progreso cada 5 servidores
        if ((baneado + fallido) % 5 === 0) {
          await interaction.editReply({ 
            content: `⏳ Procesando ban global de **${target.tag}**...\n📊 ${baneado + fallido}/${totalServers} servidores procesados` 
          }).catch(() => {});
        }
      }

      return interaction.editReply({
        content: `✅ **${target.tag}** (ID: ${target.id}) baneado globalmente.\n\n` +
          `🔨 **Resultado:**\n` +
          `✅ Baneado: ${baneado} servidores\n` +
          `❌ Fallidos: ${fallido} servidores\n` +
          `📊 Total: ${totalServers} servidores\n\n` +
          `📝 **Razón:** ${reason}`
      });
    } catch (error) {
      console.error("Error en banglobal:", error);
      return interaction.editReply({ content: "❌ Error ejecutando el ban global: " + error.message });
    }
  }
};
