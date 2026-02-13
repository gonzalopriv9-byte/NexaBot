
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("canvas");

const WELCOME_CHANNEL_ID = "1471571608635179184";

module.exports = {
  name: "guildMemberAdd",
  async execute(member) {
    try {
      const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
      if (!channel) return;

      const canvas = createCanvas(1024, 500);
      const ctx = canvas.getContext("2d");

      const background = await loadImage(
        "https://raw.githubusercontent.com/gonzalopriv9-byte/EspanoletesBOT.1/main/assets/bienvenida.png"
      );
      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

      const avatar = await loadImage(
        member.user.displayAvatarURL({ extension: "png", size: 256 })
      );
      const avatarSize = 180;
      const avatarX = canvas.width / 2 - avatarSize / 2;
      const avatarY = 110;

      ctx.save();
      ctx.beginPath();
      ctx.arc(canvas.width / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      ctx.fillStyle = "#000000";
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${member.user.username} se ha hecho español!!!!!!`, canvas.width / 2, 360);

      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: "bienvenida.png" });
      await channel.send({ files: [attachment] });

    } catch (err) {
      console.error("Error generando bienvenida:", err);
    }
  },
};
