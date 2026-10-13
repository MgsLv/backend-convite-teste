/*
 * CONTRATO COM O BACKEND — fonte única do que o front envia e espera receber. Use este arquivo como especificação
 * ao implementar o backend (o de teste em /api/mock já segue exatamente isto: src/lib/mock-backend.ts).
 *
 * Base: NEXT_PUBLIC_API_URL (.env). Todas as respostas são JSON com `RES` (boolean) e, em erro, `MSG` (texto em
 * português exibido ao usuário). Header enviado: `Content-Type: application/json` e `Ambiente` (NEXT_PUBLIC_API_ENVIRONMENT).
 *
 * Fluxo do cadastro (feito pelo navegador):
 *   1. GET  /convite?convite=<token>&request=consultar_convite_ativo   → valida o link (feito no servidor Next, em [token]/page.tsx)
 *   2. POST /foto  (uma vez por imagem)                                → devolve KEY_FOTO
 *   3. POST /autocadastro                                              → referencia as fotos pelos KEY_FOTO e devolve o link dos convidados
 *
 * ── Fotos e "fotos órfãs" ────────────────────────────────────────────────────────────────────────────────────────
 * As fotos sobem ANTES do cadastro (passo 2), então qualquer falha no passo 3 deixa fotos sem dono no servidor.
 * O front reduz isso (uploadImages.ts): a mesma imagem nunca é enviada duas vezes por convite (mesmo hash +
 * repositório) e, numa nova tentativa depois de uma falha, reaproveita os KEY_FOTO já recebidos. Mesmo assim sobram
 * órfãs quando o usuário TROCA uma foto depois de uma tentativa que falhou, ou abandona a página. Recomendação ao
 * backend: tratar como órfã toda foto que, após um prazo (ex.: 24 h), não foi referenciada por nenhum /autocadastro, e
 * descartá-la. O front não tem como apagar fotos (não existe endpoint para isso).
 *
 * ── Link de autocadastro dos convidados ──────────────────────────────────────────────────────────────────────────
 * Quando `quantidade_autocadastros` > 0, o backend DEVE devolver `GUEST_SELF_REGISTRY` com o link que o responsável
 * compartilha com os convidados (utilizável `quantidade_autocadastros` vezes). Pode ser URL absoluta
 * (https://site/convidado/<token>) ou só o caminho (/convidado/<token>) ou só o token.
 * Veja getGuestSelfRegistryLink. Sem `quantidade_autocadastros`, o campo é ignorado.
 *
 * ── Autocadastro do convidado (link /convidado/<token>) ──────────────────────────────────────────────────────────
 *   1. GET  /convidado?convite=<token>&request=consultar_convite_convidado → { RES, TOKEN, USOS_DISPONIVEIS }
 *        token inexistente → RES false, MSG "Nenhum convite encontrado"  → /convite-invalido
 *        USOS_DISPONIVEIS = 0                                           → /convite-expirado
 *   2. POST /foto (convite.id = token do link do convidado)             → KEY_FOTO da foto do convidado
 *   3. POST /convidado { request: cadastrar_convidado_convite, convite: { id }, convidado: GuestPayload }
 *        O backend localiza o responsável pelo token, grava o hóspede vinculado a ele e faz USOS_DISPONIVEIS - 1
 *        (as três coisas na mesma transação). Sem usos restantes: RES false, MSG "Convite expirado".
 *   O convidado preenche os mesmos campos do convidado cadastrado à mão pelo responsável (GuestPayload).
 *
 * ── Aceite do Aviso de Privacidade e dos Termos de Uso (campo `aceite`, ver LegalAcceptance) ──────────────────────
 * Vai no corpo do POST /autocadastro e do POST /convidado. Definição provisória, a fechar com o jurídico:
 *   - Opcional por enquanto (o front ainda não coleta o aceite). Quando coletar, o backend de produção deve recusar
 *     (RES false + MSG) o cadastro sem `aceite`.
 *   - A versão enviada é a que a tela mostrou ao usuário. O backend compara com a vigente e recusa se divergir,
 *     para nunca registrar o aceite de um texto que o usuário não viu.
 *   - Data/hora, IP e user-agent são registrados PELO SERVIDOR (nada disso vem do cliente, que pode mentir).
 *   - O aceite é gravado na mesma transação do cadastro (e do uso do link, no /convidado): ou grava tudo ou nada.
 *   - `declaracoes` diz quem está declarando o quê: "titular" (a própria pessoa), "responsavel_terceiro" (o responsável
 *     cadastrou convidados à mão e declara ter autorização) e "responsavel_legal" (há menor no cadastro).
 */

/* ------------------------------------------------------------------ */
/* Endpoints e nomes de requisição                                     */
/* ------------------------------------------------------------------ */

export const API_ENDPOINTS = {
  invitation: "/convite",
  photo: "/foto",
  selfRegistration: "/autocadastro",
  /** GET valida o link do convidado; POST envia o cadastro dele. */
  guest: "/convidado",
} as const;

export const API_REQUESTS = {
  checkInvitation: "consultar_convite_ativo",
  uploadPhoto: "cadastrar_foto_convite",
  selfRegistration: "cadastrar_autocadastro_convite",
  checkGuestInvitation: "consultar_convite_convidado",
  guestRegistration: "cadastrar_convidado_convite",
} as const;

/** Caminho do front para o autocadastro de convidados: <domínio>/convidado/<token> (src/app/convidado/[token]). */
export const GUEST_SELF_REGISTRY_PATH = "/convidado/";

/* ------------------------------------------------------------------ */
/* Ids fixos do backend                                                */
/* ------------------------------------------------------------------ */

/** `categoria_autocadastro.id` de cada categoria. */
export const CATEGORY_IDS = {
  Hospede: "3ccd4eb3595b2aca0aadc84a713462a1d3eae0d8cb9bb84e09fcb016387629e7",
  Corretor: "ea2eb8f1507bdc7cac4311624333eaa7bb9df51ae12c2d7b033293a89c3fa608",
  Fornecedor: "1b65348d9cb11b51663f2745886e980c13aad6807990dce0886587f64348ef76",
} as const;

export type ApiCategory = keyof typeof CATEGORY_IDS;

/** `repositorio_arquivo.id` do POST /foto: foto de perfil (rosto) x documentos (RG/CNH/CRECI). */
export const PHOTO_REPOSITORY_IDS = {
  user: "f1ff998ddf901427ba8c0d4bf9ca0bbf8875cfb33164e83e8e635f07054e8b9a",
  document: "6361489080404fe9416eed3d427cc7efe5fecb0a5bcb7850d65fbf476ec6fe3d",
} as const;

/* ------------------------------------------------------------------ */
/* Resposta base                                                       */
/* ------------------------------------------------------------------ */

export interface ApiResponse {
  RES: boolean;
  /** Mensagem para o usuário quando RES = false. */
  MSG?: string;
  INFO?: string;
}

/* ------------------------------------------------------------------ */
/* Aceite dos documentos legais                                        */
/* ------------------------------------------------------------------ */

/** Quem faz cada declaração do aceite. Uma pessoa pode fazer mais de uma (ex.: responsável que cadastra um menor). */
export const LEGAL_DECLARATIONS = {
  /** A própria pessoa que se cadastra (responsável, convidado, corretor ou fornecedor). */
  holder: "titular",
  /** O responsável cadastrou convidados à mão e declara ter autorização para informar os dados deles. */
  guestsAuthority: "responsavel_terceiro",
  /** Pai, mãe ou responsável legal, quando o cadastro inclui um menor. */
  guardian: "responsavel_legal",
} as const;

export type LegalDeclaration = (typeof LEGAL_DECLARATIONS)[keyof typeof LEGAL_DECLARATIONS];

export interface LegalAcceptance {
  /** Versão do Aviso de Privacidade exibida ao usuário no momento do aceite. */
  aviso_privacidade: { versao: string };
  /** Versão dos Termos de Uso exibida ao usuário no momento do aceite. */
  termos_uso: { versao: string };
  declaracoes: LegalDeclaration[];
}

/* ------------------------------------------------------------------ */
/* GET /convite                                                        */
/* ------------------------------------------------------------------ */

/**
 * Resposta de consultar_convite_ativo. RES = true libera o formulário. RES = false com MSG:
 *   "Convite expirado"           → /convite-expirado
 *   "Nenhum convite encontrado"  → /convite-invalido (qualquer outra mensagem também)
 */
export type CheckInvitationResponse = ApiResponse;

/* ------------------------------------------------------------------ */
/* POST /foto                                                          */
/* ------------------------------------------------------------------ */

export interface PhotoUploadRequest {
  request: typeof API_REQUESTS.uploadPhoto;
  /** Data URL completa da imagem: "data:image/jpeg;base64,AAAA...". */
  base64: string;
  repositorio_arquivo: { id: string };
  convite: { id: string };
}

export interface PhotoUploadResponse extends ApiResponse {
  /** Identificador da foto, usado nas referências { id } do /autocadastro. Obrigatório quando RES = true. */
  KEY_FOTO: string;
}

/* ------------------------------------------------------------------ */
/* POST /autocadastro                                                  */
/* ------------------------------------------------------------------ */

export interface PhotoRef {
  id: string;
}

export interface PersonDocument {
  /** CPF só com dígitos (quando documentType = CPF). */
  cpf?: string;
  /** Passaporte sem pontos/hífens (quando documentType = Passaporte). */
  passaporte?: string;
  /** true quando o documento é passaporte. */
  estrangeiro: boolean;
  /** Só Corretor. */
  creci?: { numero: string; foto: PhotoRef };
  /** Foto do documento. */
  foto: PhotoRef;
}

export interface VehiclePayload {
  placa: string;
  modelo: string;
  fabricante: string;
  /** Sempre "Automóvel" por enquanto. */
  veiculo: string;
  cor: string;
}

export interface GuestPayload {
  nome: string;
  sobrenome: string;
  email: string;
  telefone: { codigo_pais: string; ddd: string; numero: string };
  /** Documento sem pontuação (CPF ou passaporte), ou null para menor sem documento. */
  documento: string | null;
  /** AAAA-MM-DD, só para menor sem documento; senão null. */
  data_nascimento: string | null;
  menor_sem_documento: boolean;
  /** null quando o convidado não tem foto. */
  foto: PhotoRef | null;
}

/**
 * Corpo do POST /autocadastro. Campos por categoria:
 *   Hospede    → todos (profissao, estado_civil, nacionalidade, endereco, veiculos?, convidados, quantidade_autocadastros)
 *   Fornecedor → pessoa.profissao, contato.{email,telefone}
 *   Corretor   → pessoa.documento.creci, pessoa.corretor, contato.{email,telefone}
 */
export interface SelfRegistrationRequest {
  request: typeof API_REQUESTS.selfRegistration;
  /** Só Hospede (texto livre, já sem espaços nas pontas). Vazio nas outras categorias. */
  observacoes: string;
  pessoa: {
    documento: PersonDocument;
    nome: string;
    foto: PhotoRef;
    profissao?: { descricao: string };
    estado_civil?: { descricao: string };
    nacionalidade?: { descricao: string };
    corretor?: { autonomo: boolean | null; cnpj_imobiliaria?: string };
  };
  /** O token do link (mesmo valor do ?convite= do passo 1). */
  convite: { id: string };
  categoria_autocadastro: { id: string };
  /** Só Hospede, e só quando informou veículo. */
  veiculos?: VehiclePayload[];
  contato: {
    endereco?: {
      rua: string;
      numero: string;
      bairro: string;
      cidade: string;
      uf: string;
      /** Só letras e números. */
      cep: string;
      pais: string;
    };
    email: { email: string };
    /** "<código do país com +> <DDD> <número>", ex.: "+55 11 912345678" (o front acrescenta o "+" se faltar). */
    telefone: { numero: string };
  };
  /** Só Hospede: hóspedes já cadastrados pelo responsável (vazio se não houver). */
  convidados?: GuestPayload[];
  /** Só Hospede: quantos convidados poderão usar o link de autocadastro (0 a 10; convidados + isto ≤ 10). */
  quantidade_autocadastros?: number;
  /** Aceite dos documentos legais (opcional por enquanto; ver "Aceite do Aviso de Privacidade" no topo). */
  aceite?: LegalAcceptance;
}

export interface SelfRegistrationResponse extends ApiResponse {
  /** Link de autocadastro dos convidados. Obrigatório quando quantidade_autocadastros > 0. Ver getGuestSelfRegistryLink. */
  GUEST_SELF_REGISTRY?: string;
}

/* ------------------------------------------------------------------ */
/* GET/POST /convidado (autocadastro do convidado)                     */
/* ------------------------------------------------------------------ */

export interface GuestInvitationResponse extends ApiResponse {
  /** Token do link, como está no banco. */
  TOKEN?: string;
  /** Quantos convidados ainda podem usar o link. 0 = link esgotado (tratado como expirado). */
  USOS_DISPONIVEIS?: number;
}

export interface GuestRegistrationRequest {
  request: typeof API_REQUESTS.guestRegistration;
  /** O token do link do convidado (mesmo valor do ?convite= do GET). */
  convite: { id: string };
  /** Foto obrigatória (KEY_FOTO do POST /foto); demais regras iguais às do convidado cadastrado à mão. */
  convidado: GuestPayload;
  /** Aceite do próprio convidado (opcional por enquanto; ver "Aceite do Aviso de Privacidade" no topo). */
  aceite?: LegalAcceptance;
}

export type GuestRegistrationResponse = ApiResponse;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Normaliza GUEST_SELF_REGISTRY para uma URL absoluta, ou null se não veio (ou veio algo inseguro).
 * Aceita URL http(s) completa, caminho começando com "/" ou só o token (vira /convidado/<token>).
 * `origin` é o endereço do front (window.location.origin), usado para completar caminhos e tokens.
 */
export function getGuestSelfRegistryLink(payload: unknown, origin?: string): string | null {
  const raw = (payload as { GUEST_SELF_REGISTRY?: unknown } | null | undefined)?.GUEST_SELF_REGISTRY;

  if (typeof raw !== "string" || !raw.trim()) return null;

  const value = raw.trim();

  // Só http(s): nunca devolve esquemas como javascript:.
  if (/^https?:\/\//i.test(value)) return value;

  if (!origin) return null;

  const path = value.startsWith("/") ? value : `${GUEST_SELF_REGISTRY_PATH}${encodeURIComponent(value)}`;

  return new URL(path, origin).toString();
}
