import { API_REQUESTS, PHOTO_REPOSITORY_IDS, type PhotoUploadRequest } from "../contract/api-contract.js";
import { isObject, text } from "./common.js";

export const MAX_PHOTO_BYTES = 7 * 1024 * 1024;

const DATA_URL = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/]+={0,2})$/i;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** O tipo vem dos primeiros bytes do arquivo, nunca do que o cliente declarou. */
function detectImage(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return { mime: "image/png", ext: "png" };
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }

  return null;
}

export type PhotoUploadValidation =
  | { error: string }
  | { invitation: string; repositoryId: string; mime: string; ext: string; buffer: Buffer };

export function validatePhotoUpload(raw: unknown): PhotoUploadValidation {
  if (!isObject(raw)) return { error: "Corpo inválido." };

  const body = raw as Partial<PhotoUploadRequest> & Record<string, unknown>;
  const invitation = text(body.convite?.id);
  const repositoryId = text(body.repositorio_arquivo?.id);
  const base64 = typeof body.base64 === "string" ? body.base64 : "";

  if (body.request !== API_REQUESTS.uploadPhoto) return { error: "Requisição inválida." };
  if (!invitation) return { error: "Convite não informado." };
  if (!Object.values(PHOTO_REPOSITORY_IDS).includes(repositoryId as never)) return { error: "Repositório de arquivo inválido." };

  // O front envia a data URL completa.
  const payload = DATA_URL.exec(base64)?.[1];
  if (!payload) return { error: "Imagem inválida (esperado data URL base64)." };

  const buffer = Buffer.from(payload, "base64");
  if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES) return { error: "Imagem vazia ou grande demais." };

  const image = detectImage(buffer);
  if (!image) return { error: "Formato de imagem não aceito (use JPEG, PNG ou WebP)." };

  return { invitation, repositoryId, ...image, buffer };
}
