import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { API_REQUESTS, type GuestPayload } from "../contract/api-contract.js";
import { pool, type Db } from "../db/pool.js";
import { hashDocument, sha256 } from "../security.js";
import { seedGuestInviteUses, shouldFailRegistration } from "../test-hooks.js";
import { formatPhone, isObject, text } from "../validation/common.js";
import { validateGuestSelfRegistration } from "../validation/guests.js";
import { claimPhotos } from "./photos.js";
import { fail, ok, type ApiResult } from "./result.js";
import { refuse, transactional } from "./transaction.js";

interface GuestInviteRow extends RowDataPacket {
  id: number;
  invitation_id: number;
  registration_id: number | null;
  total_uses: number;
  used_uses: number;
}

/** De quem é o convidado: o convite pelo qual o responsável entrou e o cadastro dele. */
export interface GuestOwner {
  invitationId: number;
  registrationId: number;
}

/** Grava um convidado vinculado ao responsável (cadastrado à mão por ele ou pelo próprio link). */
export async function insertGuest(db: Db, owner: GuestOwner, source: "manual" | "autocadastro", guest: GuestPayload): Promise<number> {
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO guests (invitation_id, registration_id, source, name, last_name, email, phone, document_hash, birth_date, is_minor, photo_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      owner.invitationId,
      owner.registrationId,
      source,
      text(guest.nome),
      text(guest.sobrenome),
      text(guest.email),
      formatPhone(guest.telefone),
      guest.documento ? hashDocument(guest.documento) : null,
      guest.data_nascimento || null,
      Boolean(guest.menor_sem_documento),
      guest.foto ? text(guest.foto.id) : null,
    ],
  );

  return result.insertId;
}

/** Em teste, link de convidado desconhecido ganha um responsável fictício próprio (documentos não colidem entre tokens). */
async function seedMockHost(db: Db, token: string): Promise<GuestOwner> {
  const hash = sha256(`mock-host:${token}`);

  await db.query(
    "INSERT INTO invitations (token_hash, status) VALUES (?, 'usado') ON DUPLICATE KEY UPDATE id = id",
    [hash],
  );

  const [invitations] = await db.query<RowDataPacket[]>("SELECT id FROM invitations WHERE token_hash = ?", [hash]);
  const invitation = invitations[0];
  if (!invitation) throw new Error("Responsável fictício não encontrado.");

  const invitationId = invitation.id as number;
  const [registrations] = await db.query<RowDataPacket[]>("SELECT id FROM registrations WHERE invitation_id = ? LIMIT 1", [invitationId]);
  const existing = registrations[0];

  if (existing) return { invitationId, registrationId: existing.id as number };

  const [inserted] = await db.query<ResultSetHeader>(
    "INSERT INTO registrations (invitation_id, category, payload_json) VALUES (?, 'Hospede', '{}')",
    [invitationId],
  );

  return { invitationId, registrationId: inserted.insertId };
}

async function findGuestInvite(db: Db, token: string, lock = false): Promise<GuestInviteRow | null> {
  const select = () =>
    db.query<GuestInviteRow[]>(
      `SELECT id, invitation_id, registration_id, total_uses, used_uses FROM guest_invites WHERE token_hash = ?${lock ? " FOR UPDATE" : ""}`,
      [sha256(token)],
    );

  const [found] = await select();
  if (found[0]) return found[0];

  const uses = seedGuestInviteUses(token);
  if (uses === null) return null;

  const host = await seedMockHost(db, token);
  await db.query(
    "INSERT INTO guest_invites (token_hash, invitation_id, registration_id, total_uses) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id",
    [sha256(token), host.invitationId, host.registrationId, uses],
  );

  const [seeded] = await select();

  return seeded[0] ?? null;
}

/** GET /convidado */
export async function checkGuestInvitation(token: string, request: string): Promise<ApiResult> {
  if (request !== API_REQUESTS.checkGuestInvitation) return fail("Requisição inválida.");

  const invite = token ? await findGuestInvite(pool, token) : null;
  if (!invite) return fail("Nenhum convite encontrado");

  return ok({ TOKEN: token, USOS_DISPONIVEIS: Math.max(invite.total_uses - invite.used_uses, 0) });
}

/** POST /convidado: grava o convidado e desconta um uso, na mesma transação. */
export async function registerGuest(raw: unknown): Promise<ApiResult> {
  if (!isObject(raw)) return fail("Corpo inválido.", 400);

  const token = isObject(raw.convite) ? text(raw.convite.id) : "";

  if (raw.request !== API_REQUESTS.guestRegistration) return fail("Requisição inválida.");
  if (!token) return fail("Convite não informado.", 400);

  return transactional(async (conn) => {
    // A trava na linha do link faz dois convidados disputando o último uso serem atendidos um de cada vez.
    const invite = await findGuestInvite(conn, token, true);
    if (!invite || invite.registration_id === null) refuse("Nenhum convite encontrado");
    if (invite.used_uses >= invite.total_uses) refuse("Convite expirado");
    if (shouldFailRegistration(token)) refuse("Falha simulada no cadastro.");

    const validated = validateGuestSelfRegistration(raw.convidado);
    if ("error" in validated) refuse(validated.error);

    const { guest, photoIds } = validated;
    const owner: GuestOwner = { invitationId: invite.invitation_id, registrationId: invite.registration_id };

    const photoError = await claimPhotos(conn, photoIds, sha256(token), owner.registrationId);
    if (photoError) refuse(photoError);

    if (guest.documento) {
      const hash = hashDocument(guest.documento);
      const [duplicates] = await conn.query<RowDataPacket[]>(
        `SELECT 1 FROM registrations WHERE id = ? AND document_hash = ?
         UNION ALL
         SELECT 1 FROM guests WHERE registration_id = ? AND document_hash = ?`,
        [owner.registrationId, hash, owner.registrationId, hash],
      );
      if (duplicates.length > 0) refuse("Este documento já está cadastrado neste convite.");
    }

    await insertGuest(conn, owner, "autocadastro", guest);
    await conn.query("UPDATE guest_invites SET used_uses = used_uses + 1 WHERE id = ?", [invite.id]);

    return ok({ MSG: "Cadastro realizado com sucesso." });
  });
}
