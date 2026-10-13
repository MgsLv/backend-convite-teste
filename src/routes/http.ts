import type { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { ApiResult, RequestContext } from "../services/result.js";
import { isObject, text } from "../validation/common.js";

/** Limite mais baixo nas consultas por token, contra enumeração de tokens. */
export const lookupLimiter = () => rateLimit({ windowMs: 60_000, limit: 30 });

export const queryText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Token do convite no corpo (`convite.id`), só para os hooks de teste. */
export const bodyToken = (body: unknown) => (isObject(body) && isObject(body.convite) ? text(body.convite.id) : "");

export const requestContext = (req: Request): RequestContext => ({
  ip: req.ip ?? "desconhecido",
  userAgent: req.get("user-agent")?.slice(0, 255) ?? null,
});

export const send = (res: Response, result: ApiResult) => res.status(result.status).json(result.body);
