
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } = require('discord.js');

// Función auxiliar: genera una carta aleatoria
function drawCard() {
  const cards = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  return cards[Math.floor(Math.random() * cards.length)];
}

// Función auxiliar: calcula el valor de una mano
function handValue(hand) {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card === 'A') {
      value += 11;
      aces += 1;
    } else if (['J','Q','K'].includes(card)) {
      value += 10;
    } else {
      value += Number(card);
    }
  }

  // Ajustar ases si pasa de 21
  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  return value;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Juega una partida de blackjack con botones interactivos'),

  async execute(interaction) {
    // Manos iniciales
    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('stand').setLabel('Stand').setStyle(ButtonStyle.Danger)
      );

    // Embed inicial
    const embed = new EmbedBuilder()
      .setTitle('Blackjack')
      .setColor('Random')
      .setDescription(`Tu mano: ${playerHand.join(' , ')} (Valor: ${handValue(playerHand)})\nCarta visible de la banca: ${dealerHand[0]}`);

    await interaction.reply({ embeds: [embed], components: [row] });

    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 120000 });

    collector.on('collect', async i => {
      if (i.customId === 'hit') {
        playerHand.push(drawCard());
        const playerTotal = handValue(playerHand);

        if (playerTotal > 21) {
          // Jugador se pasa
          await i.update({ 
            embeds: [new EmbedBuilder()
              .setTitle('Blackjack')
              .setColor('Red')
              .setDescription(`Tu mano: ${playerHand.join(' , ')} (Valor: ${playerTotal})\n¡Te pasaste! La banca gana.\nMano de la banca: ${dealerHand.join(' , ')} (Valor: ${handValue(dealerHand)})`)], 
            components: [] 
          });
          collector.stop();
        } else {
          // Mostrar mano actual
          await i.update({ 
            embeds: [new EmbedBuilder()
              .setTitle('Blackjack')
              .setColor('Random')
              .setDescription(`Tu mano: ${playerHand.join(' , ')} (Valor: ${playerTotal})\nCarta visible de la banca: ${dealerHand[0]}`)], 
            components: [row] 
          });
        }
      }

      if (i.customId === 'stand') {
        // Turno de la banca
        let dealerTotal = handValue(dealerHand);
        while (dealerTotal < 17) {
          dealerHand.push(drawCard());
          dealerTotal = handValue(dealerHand);
        }

        const playerTotal = handValue(playerHand);

        // Determinar ganador
        let result = '';
        if (dealerTotal > 21 || playerTotal > dealerTotal) result = '¡Ganaste! 🎉';
        else if (playerTotal < dealerTotal) result = 'La banca gana 😢';
        else result = 'Empate 🤝';

        await i.update({
          embeds: [new EmbedBuilder()
            .setTitle('Blackjack')
            .setColor('Random')
            .setDescription(`Tu mano: ${playerHand.join(' , ')} (Valor: ${playerTotal})\nMano de la banca: ${dealerHand.join(' , ')} (Valor: ${dealerTotal})\n**Resultado:** ${result}`)],
          components: []
        });

        collector.stop();
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({ content: 'Tiempo expirado. La partida terminó.', components: [] });
      }
    });
  }
};
