import type { RowDataPacket } from "mysql2/promise";
import { API_REQUESTS } from "../contract/api-contract.js";
import { pool, type Db } from "../db/pool.js";
import { sha256 } from "../security.js";
import { seedInvitationStatus } from "../test-hooks.js";
import { fail, ok, type ApiResult } from "./result.js";

export interface InvitationRow extends RowDataPacket {
  id: number;
  status: "ativo" | "usado" | "expirado";
}

export async function findInvitation(db: Db, token: string, lock = false): Promise<InvitationRow | null> {
  const [rows] = await db.query<InvitationRow[]>(
    `SELECT id, status FROM invitations WHERE token_hash = ?${lock ? " FOR UPDATE" : ""}`,
    [sha256(token)],
  );

  return rows[0] ?? null;
}

/** Em teste, um token novo vira convite na hora (como no mock). Sem os hooks, só existe o que o sistema real criou. */
export async function ensureInvitation(db: Db, token: string, lock = false): Promise<InvitationRow | null> {
  const found = await findInvitation(db, token, lock);
  if (found) return found;

  const status = seedInvitationStatus(token);
  if (!status) return null;

  await db.query("INSERT INTO invitations (token_hash, status) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = id", [sha256(token), status]);

  return findInvitation(db, token, lock);
}

/** GET /convite */
export async function checkInvitation(token: string, request: string): Promise<ApiResult> {
  if (request !== API_REQUESTS.checkInvitation) return fail("Requisição inválida.");
  if (!token) return fail("Nenhum convite encontrado");

  const invitation = await ensureInvitation(pool, token);
  if (!invitation) return fail("Nenhum convite encontrado");
  if (invitation.status !== "ativo") return fail("Convite expirado");

  return ok();
}
