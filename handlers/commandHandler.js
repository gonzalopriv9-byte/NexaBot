
const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

async function loadCommands(client) {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.warn("⚠️ Faltan variables de entorno - Comandos no registrados");
    return;
  }

  const commandsPath = path.join(__dirname, "..", "commands");
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

  const commandsJSON = [];

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (!command.data || !command.execute) {
      console.warn(`⚠️ El comando ${file} no tiene data o execute`);
      continue;
    }
    client.commands.set(command.data.name, command);
    commandsJSON.push(command.data.toJSON());
  }

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commandsJSON }
    );
    console.log("✅ Comandos cargados y registrados");
  } catch (err) {
    console.error("❌ Error registrando comandos:", err);
  }
}

module.exports = { loadCommands };
