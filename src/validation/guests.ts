import type { GuestPayload } from "../contract/api-contract.js";
import { collectPhoto, formatPhone, isObject, text } from "./common.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Primeira inconsistência de um convidado (mensagem em português), ou null. As fotos referenciadas vão para `photoIds`.
 * Foto: opcional no cadastro do responsável, obrigatória no autocadastro.
 */
export function validateGuestPayload(guest: GuestPayload, label: string, photoRequired: boolean, photoIds: string[]): string | null {
  if (!isObject(guest)) return `${label}: dados inválidos.`;

  const name = text(guest.nome);
  const lastName = text(guest.sobrenome);
  const email = text(guest.email);

  if (!name || !lastName) return `${label}: nome incompleto.`;
  if (name.length > 80 || lastName.length > 80) return `${label}: nome muito longo.`;
  if (!email.includes("@") || email.length > 160) return `${label}: e-mail inválido.`;
  if (!isObject(guest.telefone) || !text(guest.telefone.numero)) return `${label}: telefone não informado.`;
  if (formatPhone(guest.telefone).length > 40) return `${label}: telefone inválido.`;

  const hasDocument = typeof guest.documento === "string" && guest.documento.trim() !== "";
  const hasBirthDate = typeof guest.data_nascimento === "string" && guest.data_nascimento !== "";

  if (hasDocument === hasBirthDate) return `${label}: informe o documento OU a data de nascimento.`;
  if (hasDocument && text(guest.documento).length > 40) return `${label}: documento inválido.`;

  if (hasBirthDate) {
    if (!ISO_DATE.test(String(guest.data_nascimento)) || Number.isNaN(Date.parse(String(guest.data_nascimento)))) {
      return `${label}: data de nascimento inválida.`;
    }
    if (!guest.menor_sem_documento) return `${label}: menor sem documento precisa da confirmação.`;
  }

  if (guest.foto || photoRequired) return collectPhoto(guest.foto, `foto do ${label.toLowerCase()}`, photoIds);

  return null;
}

/** Convidado do link /convidado: mesmas regras, com foto obrigatória. */
export function validateGuestSelfRegistration(raw: unknown): { error: string } | { guest: GuestPayload; photoIds: string[] } {
  if (!isObject(raw)) return { error: "Dados do convidado não informados." };

  const guest = raw as unknown as GuestPayload;
  const photoIds: string[] = [];
  const error = validateGuestPayload(guest, "Convidado", true, photoIds);

  return error ? { error } : { guest, photoIds };
}
