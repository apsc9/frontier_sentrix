import { Database } from "bun:sqlite";

let db: Database;

export function getDb(): Database {
  if (!db) {
    db = new Database("sentrix.db");
    db.exec("PRAGMA journal_mode = WAL");
    initTables(db);
  }
  return db;
}

function initTables(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      pubkey TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      config TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_agent_ts ON events(agent_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

    CREATE TABLE IF NOT EXISTS transactions (
      signature TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      program_ids TEXT NOT NULL DEFAULT '[]',
      estimated_sol REAL NOT NULL DEFAULT 0,
      decoded_data TEXT NOT NULL DEFAULT '{}',
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tx_agent_ts ON transactions(agent_id, timestamp DESC);

    CREATE TABLE IF NOT EXISTS anomalies (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      details TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE INDEX IF NOT EXISTS idx_anomalies_agent ON anomalies(agent_id, timestamp DESC);
  `);
}
