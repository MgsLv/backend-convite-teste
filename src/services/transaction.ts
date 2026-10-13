import type { PoolConnection } from "mysql2/promise";
import { withTransaction } from "../db/pool.js";
import { fail, type ApiResult } from "./result.js";

/** Recusa de negócio lançada dentro de uma transação: desfaz tudo e vira uma resposta RES false. */
class Refusal extends Error {
  constructor(readonly result: ApiResult) {
    super(String(result.body.MSG));
  }
}

export function refuse(message: string, status = 200): never {
  throw new Refusal(fail(message, status));
}

/** Transação que devolve ApiResult: recusas e documento duplicado (índice único) viram resposta, o resto é erro. */
export async function transactional(fn: (conn: PoolConnection) => Promise<ApiResult>): Promise<ApiResult> {
  try {
    return await withTransaction(fn);
  } catch (error) {
    if (error instanceof Refusal) return error.result;
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return fail("Este documento já está cadastrado neste convite.");

    throw error;
  }
}
