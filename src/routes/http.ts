import type { Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { ApiResult } from "../services/result.js";
import { isObject, text } from "../validation/common.js";

/** Limite mais baixo nas consultas por token, contra enumeração de tokens. */
export const lookupLimiter = () => rateLimit({ windowMs: 60_000, limit: 30 });

export const queryText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Token do convite no corpo (`convite.id`), só para os hooks de teste. */
export const bodyToken = (body: unknown) => (isObject(body) && isObject(body.convite) ? text(body.convite.id) : "");

export const send = (res: Response, result: ApiResult) => res.status(result.status).json(result.body);
