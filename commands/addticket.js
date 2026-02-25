const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const { loadGuildConfig, updateGuildConfig } = require('../utils/configManager');

const EMOJI = {
  CHECK: "<a:Check:1472540340584972509>",
  CRUZ: "<a:Cruz:1472540885102235689>"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addticket')
    .setDescription('Añadir categoría personalizada de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('id')
        .setDescription('ID único de la categoría (sin espacios)')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('nombre')
        .setDescription('Nombre visible de la categoría')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('descripcion')
        .setDescription('Descripción de la categoría')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('emoji')
        .setDescription('Emoji para la categoría (opcional)')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('pregunta1')
        .setDescription('Primera pregunta del modal (opcional)')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('pregunta2')
        .setDescription('Segunda pregunta del modal (opcional)')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('pregunta3')
        .setDescription('Tercera pregunta del modal (opcional)')
        .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const config = await loadGuildConfig(interaction.guild.id);

      if (!config?.tickets?.enabled) {
        return interaction.editReply({
          content: EMOJI.CRUZ + ' El sistema de tickets no está configurado. Usa `/setup tickets` primero.'
        });
      }

      const id = interaction.options.getString('id').toLowerCase().replace(/\s/g, '_');
      const nombre = interaction.options.getString('nombre');
      const descripcion = interaction.options.getString('descripcion');
      const emoji = interaction.options.getString('emoji') || '🎫';
      
      const preguntas = [];
      for (let i = 1; i <= 3; i++) {
        const pregunta = interaction.options.getString('pregunta' + i);
        if (pregunta) {
          preguntas.push({
            id: 'field_' + i,
            label: pregunta,
            placeholder: 'Escribe tu respuesta aquí...',
            required: i === 1
          });
        }
      }

      // Si no hay preguntas personalizadas, usar defaults
      if (preguntas.length === 0) {
        preguntas.push(
          { id: 'field_1', label: 'Usuario de Roblox', placeholder: 'Tu usuario de Roblox', required: true },
          { id: 'field_2', label: 'Motivo del ticket', placeholder: 'Describe tu problema', required: true }
        );
      }

      const categories = config.tickets.categories || [];

      // Verificar si ya existe
      if (categories.find(c => c.id === id)) {
        return interaction.editReply({
          content: EMOJI.CRUZ + ' Ya existe una categoría con ese ID. Usa otro ID único.'
        });
      }

      categories.push({
        id,
        nombre,
        descripcion,
        emoji,
        preguntas
      });

      await updateGuildConfig(interaction.guild.id, {
        tickets: {
          ...config.tickets,
          categories
        }
      });

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(EMOJI.CHECK + ' Categoría de Ticket Añadida')
        .setDescription(
          `**ID:** \`${id}\`\n` +
          `**Nombre:** ${emoji} ${nombre}\n` +
          `**Descripción:** ${descripcion}\n\n` +
          `**Preguntas del modal:**\n` +
          preguntas.map((p, i) => `${i + 1}. ${p.label}${p.required ? ' (requerida)' : ''}`).join('\n') +
          `\n\n**Total de categorías:** ${categories.length}\n\n` +
          `Recrea el panel con \`/setup tickets\` para ver los cambios.`
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error en /addticket:', error);
      return interaction.editReply({
        content: EMOJI.CRUZ + ' Error: ' + error.message
      });
    }
  }
};
