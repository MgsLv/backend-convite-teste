/*
 * Invalida um convite principal (hóspede, corretor ou fornecedor) pelo token. O convite passa a responder
 * "Convite expirado" no GET /convite e recusa novos cadastros.
 *
 * Uso:  pnpm invite:expire <token>
 */
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "./pool.js";
import { sha256 } from "../security.js";

const token = process.argv[2]?.trim();

if (!token) {
  console.error("Informe o token do convite. Uso: pnpm invite:expire <token>");
  process.exit(1);
}

try {
  const hash = sha256(token);
  const [rows] = await pool.query<RowDataPacket[]>("SELECT status FROM invitations WHERE token_hash = ?", [hash]);
  const invitation = rows[0];

  if (!invitation) {
    console.error(`Nenhum convite encontrado para esse token (hash ${hash.slice(0, 8)}).`);
    process.exitCode = 1;
  } else if (invitation.status === "expirado") {
    console.log(`O convite ${hash.slice(0, 8)} já estava expirado.`);
  } else {
    await pool.query("UPDATE invitations SET status = 'expirado' WHERE token_hash = ?", [hash]);
    console.log(`Convite ${hash.slice(0, 8)} expirado (estava "${invitation.status}").`);
  }
} catch (error) {
  console.error("Falha ao expirar o convite:", (error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
