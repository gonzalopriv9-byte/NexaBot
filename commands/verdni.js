const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getDNI, hasDNI } = require("../utils/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verdni")
    .setDescription("Ver el DNI de un usuario")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuario del que quieres ver el DNI (deja vacío para ver el tuyo)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser("usuario") || interaction.user;
    
    if (!hasDNI(targetUser.id)) {
      return interaction.reply({
        content: `❌ ${targetUser.id === interaction.user.id ? 'No tienes' : `${targetUser.username} no tiene`} DNI. Usa \`/creardni\` para crear uno.`,
        ephemeral: true
      });
    }

    const dniData = getDNI(targetUser.id);

    const embed = new EmbedBuilder()
      .setColor("#0066CC")
      .setTitle("🪪 DOCUMENTO NACIONAL DE IDENTIDAD")
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: "📝 Número DNI", value: `\`${dniData.numeroDNI}\``, inline: true },
        { name: "👤 Nombre", value: dniData.nombreCompleto, inline: true },
        { name: "🎂 Fecha de Nacimiento", value: dniData.fechaNacimiento, inline: true },
        { name: "🌍 Nacionalidad", value: dniData.nacionalidad, inline: true },
        { name: "📞 Teléfono", value: dniData.telefono, inline: true },
        { name: "📍 Dirección", value: dniData.direccion, inline: false }
      )
      .setFooter({ 
        text: `Creado: ${new Date(dniData.createdAt).toLocaleDateString('es-ES')} | Actualizado: ${new Date(dniData.updatedAt).toLocaleDateString('es-ES')}` 
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: interaction.options.getUser("usuario") ? false : true
    });
  }
};
