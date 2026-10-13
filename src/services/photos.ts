import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { config } from "../config.js";
import { pool, type Db } from "../db/pool.js";
import { sha256 } from "../security.js";
import { shouldFailPhoto } from "../test-hooks.js";
import { validatePhotoUpload } from "../validation/photo.js";
import { ensureInvitation } from "./invitations.js";
import { fail, ok, type ApiResult } from "./result.js";

/** Fora de qualquer pasta pública: as fotos nunca são servidas como arquivo estático. */
export const storagePath = path.resolve(config.storageDir);

interface PhotoRow extends RowDataPacket {
  id: string;
  invite_hash: string;
  used_by: number | null;
}

/** O token é de um link de convidado ou de um convite (em teste, um convite novo é criado na hora). */
async function isKnownToken(token: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT 1 FROM guest_invites WHERE token_hash = ?", [sha256(token)]);

  return rows.length > 0 || (await ensureInvitation(pool, token)) !== null;
}

/** POST /foto */
export async function uploadPhoto(raw: unknown): Promise<ApiResult> {
  const parsed = validatePhotoUpload(raw);
  if ("error" in parsed) return fail(parsed.error, 400);

  const { invitation, repositoryId, mime, ext, buffer } = parsed;

  if (shouldFailPhoto(invitation, repositoryId)) return fail("Falha simulada no envio da foto.", 500);
  if (!(await isKnownToken(invitation))) return fail("Convite não encontrado.", 404);

  const id = randomUUID();
  const fileName = `${id}.${ext}`;
  const filePath = path.join(storagePath, fileName);

  await mkdir(storagePath, { recursive: true });
  await writeFile(filePath, buffer, { flag: "wx" });

  try {
    await pool.query(
      "INSERT INTO photos (id, repository, invite_hash, file_path, mime, bytes) VALUES (?, ?, ?, ?, ?, ?)",
      [id, repositoryId, sha256(invitation), fileName, mime, buffer.length],
    );
  } catch (error) {
    await unlink(filePath).catch(() => undefined);
    throw error;
  }

  return ok({ KEY_FOTO: id });
}

/**
 * Dentro da transação: confere (com trava) que as fotos existem, foram enviadas com este token e ainda não têm dono,
 * e as marca como usadas pelo convite do responsável. Devolve a mensagem de erro, ou null se deu certo.
 */
export async function claimPhotos(db: Db, photoIds: string[], tokenHash: string, ownerInvitationId: number): Promise<string | null> {
  const ids = [...new Set(photoIds)];
  if (ids.length === 0) return null;

  const [rows] = await db.query<PhotoRow[]>("SELECT id, invite_hash, used_by FROM photos WHERE id IN (?) FOR UPDATE", [ids]);

  if (rows.length !== ids.length) return "Foto desconhecida.";
  if (rows.some((row) => row.invite_hash !== tokenHash)) return "Foto de outro convite.";
  if (rows.some((row) => row.used_by !== null)) return "Foto já utilizada.";

  await db.query("UPDATE photos SET used_by = ? WHERE id IN (?)", [ownerInvitationId, ids]);

  return null;
}
