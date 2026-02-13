const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const CATEGORY_ID = "1458444248008626201";
const MOD_ROLES = ["1469344936620195872"];

const ticketsPath = path.join(__dirname, "..", "data", "tickets.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setupticket")
    .setDescription("Crea el panel permanente de tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const button = new ButtonBuilder()
      .setCustomId("open_ticket")
      .setLabel("🎫 Abrir ticket")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.reply({
      content: "🎟️ **Sistema de Tickets**\nPulsa el botón para abrir un ticket.",
      components: [row]
    });
  }
};
