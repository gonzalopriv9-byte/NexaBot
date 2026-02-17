const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.DISCORD_TOKEN;

async function loadCommands(client) {
  const commands = [];
  const commandsPath = path.join(__dirname, "..", "commands");

  if (!fs.existsSync(commandsPath)) {
    console.warn("⚠️ Carpeta 'commands' no encontrada");
    return;
  }

  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

  for (const file of commandFiles) {
    try {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);

      if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`✅ Comando cargado: ${command.data.name}`);
      } else {
        console.warn(`⚠️ ${file} no tiene 'data' o 'execute'`);
      }
    } catch (error) {
      console.error(`❌ Error cargando ${file}:`, error.message);
    }
  }

  // ==================== REGISTRAR COMANDOS GLOBALMENTE ====================
  if (!CLIENT_ID || !TOKEN) {
    console.warn("⚠️ Falta CLIENT_ID o TOKEN - Comandos no registrados");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log(`🌍 Registrando ${commands.length} comandos globalmente...`);

    const data = await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log(`✅ ${data.length} comandos registrados globalmente`);
    console.log(`ℹ️ Los comandos pueden tardar hasta 1 hora en aparecer`);
    console.log(`ℹ️ Para verlos inmediatamente: sal y vuelve a entrar al servidor`);

  } catch (error) {
    console.error("❌ Error registrando comandos:", error);
  }
}

module.exports = { loadCommands };
