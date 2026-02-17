const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.DISCORD_TOKEN;
const TEST_GUILD_ID = "1353793314482028644"; // Servidor de pruebas para comandos instantáneos

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

  // ==================== REGISTRAR COMANDOS ====================
  if (!CLIENT_ID || !TOKEN) {
    console.warn("⚠️ Falta CLIENT_ID o TOKEN - Comandos no registrados");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    // ==================== 1. COMANDOS EN SERVIDOR DE PRUEBAS (INSTANTÁNEOS) ====================
    console.log(`🚀 Registrando ${commands.length} comandos en servidor de pruebas (instantáneo)...`);

    const testGuildData = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, TEST_GUILD_ID),
      { body: commands }
    );

    console.log(`✅ ${testGuildData.length} comandos registrados en servidor de pruebas`);
    console.log(`   ID del servidor: ${TEST_GUILD_ID}`);

    // ==================== 2. COMANDOS GLOBALES (TODOS LOS SERVIDORES) ====================
    console.log(`🌍 Registrando ${commands.length} comandos globalmente...`);

    const globalData = await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log(`✅ ${globalData.length} comandos registrados globalmente`);
    console.log(`ℹ️ Los comandos globales pueden tardar hasta 1 hora en aparecer en otros servidores`);

  } catch (error) {
    console.error("❌ Error registrando comandos:", error);
  }
}

module.exports = { loadCommands };
