const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const CATEGORY_ID = "1458444248008626201";
const MOD_ROLES = ["1469344936620195872"];

const ticketsPath = path.join(__dirname, "..", "data", "tickets.json");

// ==================== EMOJIS ANIMADOS ====================
const EMOJI = {
  TICKET: "<a:Ticket:1472541437470965942>"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setupticket")
    .setDescription("Crea el panel permanente de tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor("#00BFFF")
      .setTitle(`${EMOJI.TICKET} Sistema de Tickets`)
      .setDescription(
        "¿Necesitas ayuda o soporte?\n\n" +
        "Pulsa el botón de abajo para **crear un ticket privado** donde podremos atenderte.\n\n" +
        "**¿Qué son los tickets?**\n" +
        "• Canal privado solo para ti y el staff\n" +
        "• Respuesta garantizada del equipo\n" +
        "• Historial guardado de la conversación\n\n" +
        "⚠️ **Importante:** Solo abre tickets para temas importantes."
      )
      .setFooter({ text: "Soporte del servidor" })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId("open_ticket")
      .setLabel("🎫 Abrir Ticket")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }
};
