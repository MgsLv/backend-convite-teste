import type { GuestPayload, PhotoRef } from "../contract/api-contract.js";

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const normalizeDocument = (value: string) => value.replace(/\W/g, "").toUpperCase();

/** "+55 11 912345678". */
export const formatPhone = (phone: GuestPayload["telefone"]) => {
  const country = text(phone.codigo_pais).replace(/\D/g, "");

  return [country ? `+${country}` : "", text(phone.ddd), text(phone.numero)].filter(Boolean).join(" ");
};

/**
 * Guarda o id da foto em `photoIds` ou devolve a mensagem de erro. Só confere o formato (UUID): se a foto existe e
 * pertence a este convite é conferido no service, dentro da transação.
 */
export function collectPhoto(ref: PhotoRef | null | undefined, label: string, photoIds: string[]): string | null {
  const id = text(ref?.id);

  if (!id) return `Foto não informada: ${label}.`;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return `Foto desconhecida (${label}).`;

  photoIds.push(id);

  return null;
}
