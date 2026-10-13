/*
 * COMPORTAMENTOS DE TESTE — o token do convite controla a resposta, como no mock do front. Tudo isto só vale com
 * TEST_HOOKS=true (e NODE_ENV diferente de production); desligado, nenhum token "mágico" é aceito.
 *
 * Convite do hóspede/corretor/fornecedor (pode combinar, ex.: "teste-falha-foto-lento"):
 *   contém "expirado"      → o convite nasce expirado: GET /convite responde "Convite expirado"
 *   contém "invalido"      → GET /convite responde "Nenhum convite encontrado"
 *   contém "-falha-foto"   → o 1º envio de cada tipo de foto (perfil/documento) por convite falha (HTTP 500)
 *   contém "-falha"        → POST /autocadastro recusa (RES false) a cada tentativa
 *   contém "-lento"        → toda resposta demora 1,5 s
 *   (qualquer outro)       → o convite é criado no primeiro acesso e é de uso contínuo: continua válido depois dos
 *                            cadastros, até ser expirado com `pnpm invite:expire <token>`
 *
 * Link do convidado (/convidado/<token>): qualquer token desconhecido abre um link com 3 usos, e estes simulam situações:
 *   contém "invalido"               → "Nenhum convite encontrado"
 *   contém "esgotado" ou "expirado" → USOS_DISPONIVEIS 0
 *   contém "-falha"                 → POST /convidado recusa (RES false)
 *   contém "-lento"                 → toda resposta demora 1,5 s
 *   contém "-falha-foto"            → o 1º envio de foto do token falha (HTTP 500)
 *
 * Estado: GET /state lista fotos, cadastros e órfãs; DELETE /state zera o banco de teste.
 */
import { config } from "./config.js";

const enabled = config.testHooks;
const failedPhotoOnce = new Set<string>();

/** Espera 1,5 s quando o token pede resposta lenta. */
export async function delay(token: string) {
  if (enabled && token.includes("-lento")) await new Promise((resolve) => setTimeout(resolve, 1500));
}

/** Status com que um convite desconhecido nasce em teste, ou null para continuar "inexistente". */
export function seedInvitationStatus(token: string): "ativo" | "expirado" | null {
  if (!enabled || !token) return null;
  if (token.includes("expirado")) return "expirado";
  if (token.includes("invalido")) return null;

  return "ativo";
}

/** Usos de um link de convidado desconhecido em teste, ou null para continuar "inexistente". */
export function seedGuestInviteUses(token: string): number | null {
  if (!enabled || !token || token.includes("invalido")) return null;

  return token.includes("esgotado") || token.includes("expirado") ? 0 : 3;
}

export const shouldFailRegistration = (token: string) =>
  enabled && token.includes("-falha") && !token.includes("-falha-foto");

/** Falha só o primeiro envio de cada tipo de foto por token. */
export function shouldFailPhoto(token: string, repositoryId: string) {
  if (!enabled || !token.includes("-falha-foto")) return false;

  const key = `${token}|${repositoryId}`;
  if (failedPhotoOnce.has(key)) return false;

  failedPhotoOnce.add(key);

  return true;
}

export const resetHooks = () => failedPhotoOnce.clear();
