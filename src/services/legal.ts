import type { RowDataPacket } from "mysql2/promise";
import { LEGAL_DECLARATIONS, type LegalAcceptance, type LegalDeclaration } from "../contract/api-contract.js";
import { pool, type Db } from "../db/pool.js";
import { isObject, text } from "../validation/common.js";
import type { RequestContext } from "./result.js";

export interface ResolvedAcceptance {
  documentIds: number[];
  declarations: LegalDeclaration[];
}

interface LegalDocumentRow extends RowDataPacket {
  id: number;
  type: "privacy" | "terms";
  version: string;
}

const KNOWN_DECLARATIONS = new Set<string>(Object.values(LEGAL_DECLARATIONS));

/**
 * Valida o `aceite` contra os documentos vigentes. Opcional por enquanto (ver api-contract.ts): sem aceite devolve null.
 * A versão enviada tem que ser a vigente, para nunca registrar o aceite de um texto que o usuário não viu.
 */
export async function resolveAcceptance(aceite: LegalAcceptance | null | undefined): Promise<ResolvedAcceptance | { error: string } | null> {
  if (aceite == null) return null;
  if (!isObject(aceite)) return { error: "Aceite inválido." };

  const declarations = Array.isArray(aceite.declaracoes) ? [...new Set(aceite.declaracoes)] : [];
  if (declarations.length === 0 || !declarations.every((declaration) => KNOWN_DECLARATIONS.has(declaration))) {
    return { error: "Declarações do aceite inválidas." };
  }

  const [rows] = await pool.query<LegalDocumentRow[]>("SELECT id, type, version FROM legal_documents WHERE active = TRUE");
  const privacy = rows.find((row) => row.type === "privacy");
  const terms = rows.find((row) => row.type === "terms");

  if (!privacy || text(aceite.aviso_privacidade?.versao) !== privacy.version) return { error: "Versão do Aviso de Privacidade desatualizada." };
  if (!terms || text(aceite.termos_uso?.versao) !== terms.version) return { error: "Versão dos Termos de Uso desatualizada." };

  return { documentIds: [privacy.id, terms.id], declarations };
}

/** Grava o aceite (uma linha por documento e declaração). Data, IP e user agent são do servidor. */
export async function recordAcceptance(
  db: Db,
  acceptance: ResolvedAcceptance,
  ctx: RequestContext,
  ref: { invitationId: number; guestId: number | null; context: "autocadastro" | "convidado" },
) {
  const rows = acceptance.documentIds.flatMap((documentId) =>
    acceptance.declarations.map((declaration) => [documentId, ref.invitationId, ref.guestId, declaration, ctx.ip, ctx.userAgent, ref.context]),
  );

  await db.query(
    "INSERT INTO legal_acceptances (document_id, invitation_id, guest_id, declaration, ip_address, user_agent, context) VALUES ?",
    [rows],
  );
}
