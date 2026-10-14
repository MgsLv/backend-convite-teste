import type { GuestPayload } from "../contract/api-contract.js";
import { ageFromIsoDate, collectPhoto, formatPhone, isObject, isValidCpf, isValidEmail, isValidPassport, text } from "./common.js";

/** Maioridade: quem tem documento ou é maior não entra como "menor sem documento". */
const ADULT_AGE = 18;

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
  if (!isValidEmail(email)) return `${label}: e-mail inválido.`;
  if (!isObject(guest.telefone) || !text(guest.telefone.numero)) return `${label}: telefone não informado.`;
  if (formatPhone(guest.telefone).length > 40) return `${label}: telefone inválido.`;

  const hasDocument = typeof guest.documento === "string" && guest.documento.trim() !== "";
  const hasBirthDate = typeof guest.data_nascimento === "string" && guest.data_nascimento !== "";

  if (hasDocument === hasBirthDate) return `${label}: informe o documento OU a data de nascimento.`;

  if (hasDocument) {
    // Só números (11) é CPF e precisa de dígito verificador válido; o resto é passaporte (letras e números).
    const document = text(guest.documento).replace(/[.\-\s]/g, "");
    const valid = /^\d+$/.test(document) ? isValidCpf(document) : isValidPassport(document);

    if (!valid) return `${label}: documento inválido.`;
    if (guest.menor_sem_documento) return `${label}: menor sem documento não pode ter documento.`;
  }

  if (hasBirthDate) {
    const age = ageFromIsoDate(String(guest.data_nascimento));

    if (age === null) return `${label}: data de nascimento inválida.`;
    if (!guest.menor_sem_documento) return `${label}: menor sem documento precisa da confirmação.`;
    if (age >= ADULT_AGE) return `${label}: maior de idade precisa informar o documento.`;
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
