/** Resultado de um service: o que a rota devolve ao front. Sem dependência de Express. */
export interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

/** Quem está fazendo a requisição. IP e user agent vêm sempre do servidor, nunca do corpo. */
export interface RequestContext {
  ip: string;
  userAgent: string | null;
}

export const ok = (extra: Record<string, unknown> = {}): ApiResult => ({ status: 200, body: { RES: true, ...extra } });

export const fail = (MSG: string, status = 200): ApiResult => ({ status, body: { RES: false, MSG } });
