const { pool } = require("./db");

async function loadGuildConfig(guildId) {
  const { rows } = await pool.query(
    "select config from guild_config where guild_id = $1",
    [guildId]
  );
  return rows[0]?.config || null;
}

async function saveGuildConfig(guildId, config) {
  await pool.query(
    `insert into guild_config (guild_id, config, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (guild_id)
     do update set config = excluded.config, updated_at = now()`,
    [guildId, JSON.stringify(config)]
  );
  return true;
}

module.exports = { loadGuildConfig, saveGuildConfig };
