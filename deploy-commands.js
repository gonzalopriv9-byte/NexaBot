require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.DISCORD_TOKEN;
const TEST_GUILD_ID = "1353793314482028644";

async function main() {
  if (!CLIENT_ID || !TOKEN) {
    console.error("Falta CLIENT_ID o DISCORD_TOKEN en las variables de entorno");
    process.exit(0);
  }

  const commands = [];
  const commandsPath = path.join(__dirname, "commands");
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

  for (const file of files) {
    try {
      const cmd = require(path.join(commandsPath, file));
      if (cmd?.data && cmd?.execute) {
        commands.push(cmd.data.toJSON());
        console.log("Incluido: " + cmd.data.name);
      }
    } catch (e) {
      console.warn("Ignorado " + file + ": " + e.message);
    }
  }

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  // 1. Registrar en servidor de pruebas (instantaneo)
  try {
    console.log("Registrando " + commands.length + " comandos en servidor de pruebas...");
    const guildData = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, TEST_GUILD_ID),
      { body: commands }
    );
    console.log("OK guild: " + guildData.length + " comandos registrados en servidor de pruebas");
  } catch (e) {
    console.error("Error guild: " + (e?.rawError ? JSON.stringify(e.rawError) : e.message));
  }

  // 2. Registrar globalmente
  try {
    console.log("Registrando " + commands.length + " comandos globalmente...");
    const globalData = await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log("OK global: " + globalData.length + " comandos registrados globalmente");
  } catch (e) {
    console.error("Error global: " + (e?.rawError ? JSON.stringify(e.rawError) : e.message));
  }
}

main().catch((e) => {
  console.error("Error deploy-commands: " + e.message);
  process.exit(0);
});
