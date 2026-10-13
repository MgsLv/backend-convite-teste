import mysql, { type Pool, type PoolConnection } from "mysql2/promise";
import { config } from "../config.js";

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  connectionLimit: 10,
  waitForConnections: true,
  timezone: "Z",
  dateStrings: true,
});

/** Aceita o pool ou uma conexão de transação: as funções de consulta funcionam nos dois casos. */
export type Db = Pick<Pool, "query">;

/** Executa `fn` numa transação: commit se terminar, rollback se lançar. */
export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();

    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
