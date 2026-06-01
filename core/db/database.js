const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

class SqlJsDatabase {
  constructor(databasePath, sqliteDatabase) {
    this.databasePath = databasePath;
    this.sqliteDatabase = sqliteDatabase;
    this.inTransaction = false;
  }

  exec(sql) {
    return this.sqliteDatabase.exec(sql);
  }

  run(sql, params = []) {
    this.sqliteDatabase.run(sql, params);
    if (!this.inTransaction) {
      this.persist();
    }
  }

  get(sql, params = []) {
    return this.all(sql, params)[0];
  }

  all(sql, params = []) {
    const statement = this.sqliteDatabase.prepare(sql);
    const rows = [];

    try {
      statement.bind(params);
      while (statement.step()) {
        rows.push(statement.getAsObject());
      }
    } finally {
      statement.free();
    }

    return rows;
  }

  transaction(callback) {
    return (...args) => {
      this.inTransaction = true;
      this.exec('BEGIN');
      try {
        const result = callback(...args);
        this.exec('COMMIT');
        this.inTransaction = false;
        this.persist();
        return result;
      } catch (error) {
        this.exec('ROLLBACK');
        this.inTransaction = false;
        throw error;
      }
    };
  }

  persist() {
    fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
    const data = this.sqliteDatabase.export();
    fs.writeFileSync(this.databasePath, Buffer.from(data));
  }
}

async function initializeDatabase(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const SQL = await initSqlJs({
    locateFile: (fileName) => path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', fileName)
  });
  const existingDatabase = fs.existsSync(databasePath) ? fs.readFileSync(databasePath) : undefined;
  const sqliteDatabase = new SQL.Database(existingDatabase);
  const database = new SqlJsDatabase(databasePath, sqliteDatabase);

  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      channel_name TEXT,
      channel_user_id TEXT,
      chatter_user_id TEXT NOT NULL,
      chatter_user_login TEXT NOT NULL,
      chatter_user_name TEXT NOT NULL,
      raw_message TEXT NOT NULL,
      trigger_word TEXT NOT NULL,
      requested_text TEXT NOT NULL,
      normalized_requested_text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      channel_name TEXT,
      channel_user_id TEXT,
      chatter_user_id TEXT NOT NULL,
      chatter_user_login TEXT NOT NULL,
      chatter_user_name TEXT NOT NULL,
      raw_message TEXT NOT NULL,
      trigger_word TEXT NOT NULL,
      ordered_text TEXT NOT NULL,
      normalized_ordered_text TEXT NOT NULL,
      price_amount REAL NOT NULL,
      stream_started_at TEXT,
      stream_elapsed_seconds INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_requests_created_at
      ON requests (created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_requests_normalized_item
      ON requests (normalized_requested_text);

    CREATE INDEX IF NOT EXISTS idx_requests_chatter_user_id
      ON requests (chatter_user_id);

    CREATE INDEX IF NOT EXISTS idx_orders_created_at
      ON orders (created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_orders_normalized_item
      ON orders (normalized_ordered_text);

    CREATE INDEX IF NOT EXISTS idx_orders_chatter_user_id
      ON orders (chatter_user_id);
  `);
  database.persist();

  return database;
}

module.exports = {
  initializeDatabase
};
