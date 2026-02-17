// ==================== SCRIPT PARA LIMPIAR COMANDOS ====================
// Ejecuta esto UNA VEZ para eliminar todos los comandos registrados
// Luego comenta o elimina este código y haz deploy normal

require("dotenv").config();
const { REST, Routes } = require("discord.js");

const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.DISCORD_TOKEN;

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function limpiarComandos() {
  try {
    console.log("🧹 Eliminando TODOS los comandos globales...");

    // Eliminar comandos globales
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });

    console.log("✅ Todos los comandos globales eliminados");
    console.log("ℹ️ Ahora puedes hacer deploy normal del bot");

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

limpiarComandos();

// ==================== INSTRUCCIONES ====================
// 1. Guarda este archivo como limpiar-comandos.js en la raíz
// 2. Ejecuta: node limpiar-comandos.js
// 3. Espera a que termine
// 4. Elimina este archivo
// 5. Haz deploy normal
