import mysql from "mysql2/promise";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

const conn = await mysql.createConnection({
  host: config.db.host,
  port: config.db.port,
  user: config.db.migrateUser,
  password: config.db.migratePassword,
  database: config.db.name,
  multipleStatements: true,
});

try {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(100) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

  const [rows] = await conn.query("SELECT name FROM schema_migrations");
  const applied = new Set((rows as { name: string }[]).map((r) => r.name));

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`já aplicada: ${file}`);
      continue;
    }
    const sql = await readFile(path.join(dir, file), "utf8");
    await conn.query(sql);
    await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
    console.log(`aplicada: ${file}`);
  }
} catch (e) {
  console.error("Falha na migração:", (e as Error).message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
