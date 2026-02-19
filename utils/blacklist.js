const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "blacklist.json");

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ users: {}, bots: {} }, null, 2));
}

function loadBlacklist() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { users: {}, bots: {} };
  }
}

function getEntry(user) {
  const bl = loadBlacklist();
  const table = user.bot ? bl.bots : bl.users;
  const entry = table[user.id];
  if (!entry) return null;

  // si tiene fecha y ya pasó, no aplicar (y opcionalmente podrías limpiarlo)
  if (entry.until) {
    const untilMs = Date.parse(entry.until);
    if (!Number.isNaN(untilMs) && Date.now() > untilMs) return null;
  }

  return entry;
}

module.exports = { loadBlacklist, getEntry };
