import { createHash, randomBytes } from "node:crypto";
import { normalizeDocument } from "./validation/common.js";

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Token novo (256 bits). Só o hash vai para o banco. */
export const newToken = () => randomBytes(32).toString("hex");

/** Hash para checar documento repetido sem guardar o documento em claro. */
export const hashDocument = (document: string) => sha256(normalizeDocument(document));
