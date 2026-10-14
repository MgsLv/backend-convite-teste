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

/** E-mail com usuário, domínio e extensão (rejeita "a@", "a@b", espaços). Tamanho máximo como no banco. */
export const isValidEmail = (value: string) =>
  value.length <= 160 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/.test(value);

/** CPF com 11 dígitos, sem sequência repetida e com os dois dígitos verificadores corretos. */
export function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;

  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(value[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}

/** Passaporte: letras e números, de 5 a 20 caracteres (já sem pontuação e espaços). */
export const isValidPassport = (value: string) => /^[A-Za-z0-9]{5,20}$/.test(value);

/** Data AAAA-MM-DD existente no calendário (rejeita 2023-02-31), como { y, m, d }, ou null. */
export function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;

  return { y, m, d };
}

/** Idade completa em anos na data de hoje (relógio do servidor), ou null se a data for inválida ou futura. */
export function ageFromIsoDate(value: string, now = new Date()): number | null {
  const birth = parseIsoDate(value);
  if (!birth) return null;

  const [y, m, d] = [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  if (birth.y > y || (birth.y === y && (birth.m > m || (birth.m === m && birth.d > d)))) return null;

  return y - birth.y - (m < birth.m || (m === birth.m && d < birth.d) ? 1 : 0);
}
