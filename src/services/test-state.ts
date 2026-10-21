import { rm } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { pool, withTransaction } from "../db/pool.js";
import { resetHooks } from "../test-hooks.js";
import { storagePath } from "./photos.js";

/** Estado do banco de teste. Tokens aparecem só como prefixo do hash e documentos não aparecem. */
export async function getState() {
  const [photos] = await pool.query<RowDataPacket[]>(
    "SELECT id, repository AS repositoryId, LEFT(invite_hash, 8) AS invitation, bytes, used_by AS usedBy FROM photos ORDER BY created_at",
  );
  const [registrations] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, LEFT(i.token_hash, 8) AS invitation, r.category, r.created_at AS at, r.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM guests g WHERE g.registration_id = r.id AND g.source = 'manual') AS manualGuests
       FROM registrations r JOIN invitations i ON i.id = r.invitation_id ORDER BY r.created_at`,
  );
  const [guestInvites] = await pool.query<RowDataPacket[]>(
    `SELECT LEFT(token_hash, 8) AS token, registration_id AS host, total_uses AS total, used_uses AS used,
            total_uses - used_uses AS remaining FROM guest_invites ORDER BY id`,
  );
  const [guestRegistrations] = await pool.query<RowDataPacket[]>(
    `SELECT registration_id AS host, CONCAT(name, ' ', last_name) AS name, photo_id AS photoId, created_at AS at
       FROM guests WHERE source = 'autocadastro' ORDER BY id`,
  );

  return {
    photos,
    // foto nunca referenciada por um cadastro
    orphans: photos.filter((photo) => photo.usedBy === null).map((photo) => photo.id as string),
    registrations,
    guestInvites,
    guestRegistrations,
  };
}

/** Zera os dados de teste (mantém os documentos legais) e apaga os arquivos de foto. */
export async function resetState() {
  const [photos] = await pool.query<RowDataPacket[]>("SELECT file_path FROM photos");

  await withTransaction(async (conn) => {
    // ordem das chaves estrangeiras: dependentes primeiro
    for (const table of ["guests", "photos", "guest_invites", "registrations", "invitations"]) {
      await conn.query(`DELETE FROM ${table}`);
    }
  });

  await Promise.all(photos.map((photo) => rm(path.join(storagePath, String(photo.file_path)), { force: true })));
  resetHooks();
}
