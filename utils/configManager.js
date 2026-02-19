const { supabase } = require("./db");

const GLOBAL_GUILD_ID = "global";

async function loadGuildConfig(guildId) {
  // 1. Cargar config global
  const { data: globalData } = await supabase
    .from("guild_config")
    .select("config")
    .eq("guild_id", GLOBAL_GUILD_ID)
    .single();

  const globalConfig = globalData?.config || {};

  // 2. Cargar config local del servidor
  const { data: localData, error } = await supabase
    .from("guild_config")
    .select("config")
    .eq("guild_id", guildId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error loadGuildConfig: " + error.message);
  }

  const localConfig = localData?.config || {};

  // 3. Merge: local sobreescribe global seccion a seccion
  return mergeConfigs(globalConfig, localConfig);
}

function mergeConfigs(global, local) {
  const result = { ...global };
  for (const key of Object.keys(local)) {
    if (typeof local[key] === "object" && !Array.isArray(local[key]) && local[key] !== null) {
      result[key] = { ...(global[key] || {}), ...local[key] };
    } else {
      result[key] = local[key];
    }
  }
  return result;
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

async function updateGuildConfig(guildId, updates) {
  // Carga solo la config LOCAL (sin merge con global) para no duplicar
  const { data } = await supabase
    .from("guild_config")
    .select("config")
    .eq("guild_id", guildId)
    .single();

  const current = data?.config || {};
  const merged = { ...current, ...updates };
  return saveGuildConfig(guildId, merged);
}

async function updateGlobalConfig(updates) {
  return updateGuildConfig(GLOBAL_GUILD_ID, updates);
}

module.exports = {
  loadGuildConfig,
  saveGuildConfig,
  updateGuildConfig,
  updateGlobalConfig,
  GLOBAL_GUILD_ID
};
