const { supabase } = require("./db");

async function loadGuildConfig(guildId) {
  const { data, error } = await supabase
    .from("guild_config")
    .select("config")
    .eq("guild_id", guildId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error loadGuildConfig: " + error.message);
    return null;
  }
  return data?.config || null;
}

async function saveGuildConfig(guildId, config) {
  const { error } = await supabase
    .from("guild_config")
    .upsert({
      guild_id: guildId,
      config: config,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error("Error saveGuildConfig: " + error.message);
    return false;
  }
  return true;
}

// updateGuildConfig: carga config actual, aplica cambios parciales y guarda
async function updateGuildConfig(guildId, updates) {
  const current = await loadGuildConfig(guildId) || {};
  const merged = { ...current, ...updates };
  return saveGuildConfig(guildId, merged);
}

module.exports = { loadGuildConfig, saveGuildConfig, updateGuildConfig };
