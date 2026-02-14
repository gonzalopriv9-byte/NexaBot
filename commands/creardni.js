const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("creardni")
    .setDescription("Crea o actualiza tu DNI personal"),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId("dni_modal")
      .setTitle("📋 Crear DNI");

    const nombreInput = new TextInputBuilder()
      .setCustomId("nombre_completo")
      .setLabel("Nombre completo")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Juan García López")
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(50);

    const fechaNacimientoInput = new TextInputBuilder()
      .setCustomId("fecha_nacimiento")
      .setLabel("Fecha de nacimiento (DD/MM/AAAA)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("15/03/1995")
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(10);

    const nacionalidadInput = new TextInputBuilder()
      .setCustomId("nacionalidad")
      .setLabel("Nacionalidad")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Española")
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(30);

    const direccionInput = new TextInputBuilder()
      .setCustomId("direccion")
      .setLabel("Dirección")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Calle Mayor 123, Madrid")
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(100);

    const telefonoInput = new TextInputBuilder()
      .setCustomId("telefono")
      .setLabel("Teléfono")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("612345678")
      .setRequired(true)
      .setMinLength(9)
      .setMaxLength(15);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nombreInput),
      new ActionRowBuilder().addComponents(fechaNacimientoInput),
      new ActionRowBuilder().addComponents(nacionalidadInput),
      new ActionRowBuilder().addComponents(direccionInput),
      new ActionRowBuilder().addComponents(telefonoInput)
    );

    await interaction.showModal(modal);
  }
};
