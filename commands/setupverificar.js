const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

// ==================== EMOJIS ANIMADOS ====================
const EMOJI = {
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>",
  CORREO: "<a:correo:1472550293152596000>"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setupverificar")
    .setDescription("Crea el panel de verificación por email")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      // Verificar roles permitidos
      const allowedRoles = ["1469344936620195872"];
      const hasPermission = allowedRoles.some(roleId => 
        interaction.member.roles.cache.has(roleId)
      );

      if (!hasPermission) {
        return interaction.reply({
          content: `${EMOJI.CRUZ} No tienes permiso para usar este comando.`,
          flags: 64 // ephemeral
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle(`${EMOJI.CHECK} Verificación de Usuario`)
        .setDescription(
          "Para acceder al servidor completo, necesitas verificar tu correo electrónico.\n\n" +
          "**¿Cómo funciona?**\n" +
          "1️⃣ Haz clic en el botón **VERIFICARSE**\n" +
          "2️⃣ Ingresa tu correo electrónico\n" +
          "3️⃣ Recibirás un código de verificación\n" +
          "4️⃣ Ingresa el código para completar la verificación\n\n" +
          "⚠️ **Importante:** Usa un correo electrónico válido."
        )
        .setThumbnail("https://cdn.discordapp.com/emojis/1472550293152596000.gif?size=128&quality=lossless")
        .setFooter({ text: "Sistema de verificación" })
        .setTimestamp();

      const button = new ButtonBuilder()
        .setCustomId("verify_start")
        .setLabel("✅ VERIFICARSE")
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(button);

      await interaction.reply({
        embeds: [embed],
        components: [row]
      });
    } catch (error) {
      console.error('Error en setupverificar:', error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `${EMOJI.CRUZ} Error al crear el panel de verificación.`,
          flags: 64 // ephemeral
        }).catch(() => {});
      }
    }
  }
};
