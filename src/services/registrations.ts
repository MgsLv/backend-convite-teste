import { rm } from "node:fs/promises";
import path from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { GUEST_SELF_REGISTRY_PATH, type SelfRegistrationRequest } from "../contract/api-contract.js";
import { config } from "../config.js";
import type { Db } from "../db/pool.js";
import { hashDocument, newToken, sha256 } from "../security.js";
import { shouldFailRegistration } from "../test-hooks.js";
import { isObject, text } from "../validation/common.js";
import { validateSelfRegistration } from "../validation/self-registration.js";
import { insertGuest, type GuestOwner } from "./guests.js";
import { ensureInvitation } from "./invitations.js";
import { recordAcceptance, resolveAcceptance } from "./legal.js";
import { sendGoodPracticesEmail } from "./mailer.js";
import { claimPhotos, storagePath } from "./photos.js";
import { fail, ok, type ApiResult, type RequestContext } from "./result.js";
import { refuse, transactional } from "./transaction.js";

interface ExistingRegistration extends RowDataPacket {
  id: number;
  invitation_id: number;
  payload_json: unknown;
}

/**
 * Remove o que o cadastro anterior do responsável trouxe, para o novo envio ocupar o lugar: convidados cadastrados à
 * mão e todas as fotos (rosto, documento, CRECI e as dos convidados). Os convidados que usaram o link de autocadastro
 * ficam, com as próprias fotos. Devolve os arquivos a apagar depois do commit.
 */
async function releasePreviousRegistration(db: Db, registrationId: number): Promise<string[]> {
  await db.query("DELETE FROM guests WHERE registration_id = ? AND source = 'manual'", [registrationId]);

  const [photos] = await db.query<RowDataPacket[]>(
    `SELECT id, file_path FROM photos WHERE used_by = ?
       AND id NOT IN (SELECT photo_id FROM guests WHERE registration_id = ? AND photo_id IS NOT NULL)`,
    [registrationId, registrationId],
  );

  if (photos.length > 0) {
    await db.query("DELETE FROM photos WHERE id IN (?)", [photos.map((photo) => photo.id)]);
  }

  // O link antigo deixa de aceitar novos usos (os já feitos continuam contados).
  await db.query("UPDATE guest_invites SET total_uses = used_uses WHERE registration_id = ?", [registrationId]);

  return photos.map((photo) => String(photo.file_path));
}

/** O documento do cadastro existente não muda: mantém exatamente o que foi gravado na primeira vez. */
function keepStoredDocument(request: SelfRegistrationRequest, stored: unknown): SelfRegistrationRequest {
  const previous = (typeof stored === "string" ? JSON.parse(stored) : stored) as Partial<SelfRegistrationRequest> | null;
  const old = previous?.pessoa?.documento;

  if (!old) return request;

  const { cpf: _cpf, passaporte: _passport, ...rest } = request.pessoa.documento;

  return {
    ...request,
    pessoa: {
      ...request.pessoa,
      documento: {
        ...rest,
        estrangeiro: old.estrangeiro,
        ...(old.cpf !== undefined && { cpf: old.cpf }),
        ...(old.passaporte !== undefined && { passaporte: old.passaporte }),
      },
    },
  };
}

/**
 * POST /autocadastro: grava cadastro, convidados, link de autocadastro e aceite numa transação só.
 * O convite principal é de uso contínuo: continua válido depois do cadastro (até ser expirado, ver `pnpm invite:expire`)
 * e várias pessoas se cadastram pelo mesmo token. Se o documento do responsável já está cadastrado (em qualquer
 * convite), o cadastro existente é atualizado com este envio, inclusive as fotos; o documento permanece o mesmo.
 */
export async function selfRegister(raw: unknown, ctx: RequestContext): Promise<ApiResult> {
  const token = isObject(raw) && isObject(raw.convite) ? text(raw.convite.id) : "";

  if (!token) return fail("Convite não informado.", 400);
  if (shouldFailRegistration(token)) return fail("Falha simulada no cadastro.");

  const validated = validateSelfRegistration(raw, token);
  if ("error" in validated) return fail(validated.error);

  const { category, photoIds, request } = validated;

  const acceptance = await resolveAcceptance(request.aceite);
  if (acceptance && "error" in acceptance) return fail(acceptance.error);

  // Convidados e link de autocadastro só existem para o hóspede.
  const isGuest = category === "Hospede";
  const guests = isGuest ? (request.convidados ?? []) : [];
  const selfSlots = isGuest ? (request.quantidade_autocadastros ?? 0) : 0;

  const { documento } = request.pessoa;
  const hostHash = hashDocument(documento.estrangeiro ? text(documento.passaporte) : text(documento.cpf));
  const documentHashes = [hostHash, ...guests.filter((guest) => guest.documento).map((guest) => hashDocument(String(guest.documento)))];

  if (new Set(documentHashes).size !== documentHashes.length) return fail("Este documento já está cadastrado neste convite.");

  const staleFiles: string[] = [];
  const hostEmail = text(request.contato?.email?.email);

  const result = await transactional(async (conn) => {
    const invitation = await ensureInvitation(conn, token, true);
    if (!invitation) refuse("Nenhum convite encontrado");
    if (invitation.status !== "ativo") refuse("Convite expirado");

    // Documento já cadastrado: o responsável é o dono do cadastro mais recente com este documento.
    const [found] = await conn.query<ExistingRegistration[]>(
      "SELECT id, invitation_id, payload_json FROM registrations WHERE document_hash = ? ORDER BY id DESC LIMIT 1 FOR UPDATE",
      [hostHash],
    );
    const existing = found[0] ?? null;
    let owner: GuestOwner;

    if (existing) {
      owner = { invitationId: existing.invitation_id, registrationId: existing.id };
      staleFiles.push(...(await releasePreviousRegistration(conn, owner.registrationId)));

      // No teste o payload fica em JSON; no backend real vira colunas (documento cifrado).
      await conn.query(
        "UPDATE registrations SET category = ?, payload_json = ?, last_invitation_id = ?, updated_at = NOW() WHERE id = ?",
        [category, JSON.stringify(keepStoredDocument(request, existing.payload_json)), invitation.id, existing.id],
      );
    } else {
      const [inserted] = await conn.query<ResultSetHeader>(
        "INSERT INTO registrations (invitation_id, category, document_hash, payload_json) VALUES (?, ?, ?, ?)",
        [invitation.id, category, hostHash, JSON.stringify(request)],
      );
      owner = { invitationId: invitation.id, registrationId: inserted.insertId };
    }

    // As fotos foram enviadas com o token deste convite, mas ficam com o dono do cadastro.
    const photoError = await claimPhotos(conn, photoIds, sha256(token), owner.registrationId);
    if (photoError) refuse(photoError);

    for (const guest of guests) await insertGuest(conn, owner, "manual", guest);

    let guestToken: string | null = null;

    if (selfSlots > 0) {
      guestToken = newToken();
      await conn.query("INSERT INTO guest_invites (token_hash, invitation_id, registration_id, total_uses) VALUES (?, ?, ?, ?)", [
        sha256(guestToken),
        owner.invitationId,
        owner.registrationId,
        selfSlots,
      ]);
    }

    if (acceptance) {
      await recordAcceptance(conn, acceptance, ctx, { invitationId: owner.invitationId, guestId: null, context: "autocadastro" });
    }

    return ok({
      MSG: "Cadastro realizado com sucesso.",
      ...(guestToken ? { GUEST_SELF_REGISTRY: new URL(`${GUEST_SELF_REGISTRY_PATH}${guestToken}`, config.frontOrigin).toString() } : {}),
    });
  });

  // Só depois do commit: se a transação falhasse, as fotos antigas continuariam valendo.
  if (result.body.RES === true) {
    await Promise.all(staleFiles.map((file) => rm(path.join(storagePath, file), { force: true })));
  }

  // Só quando houve link de autocadastro de convidados; sem await, para não atrasar a resposta nem depender do SMTP.
  if (result.body.RES === true && result.body.GUEST_SELF_REGISTRY && hostEmail) {
    void sendGoodPracticesEmail(hostEmail);
  }

  return result;
}
