/** Resultado de um service: o que a rota devolve ao front. Sem dependência de Express. */
export interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export const ok = (extra: Record<string, unknown> = {}): ApiResult => ({ status: 200, body: { RES: true, ...extra } });

export const fail = (MSG: string, status = 200): ApiResult => ({ status, body: { RES: false, MSG } });
