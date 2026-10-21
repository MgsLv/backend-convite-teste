# Backend de teste — Convite Kimovil

Servidor de simulação (Express + MySQL) do fluxo de convite do Kimovil. Segue o contrato usado pelo front
(`kimovil-form`) e serve para testar o cadastro de ponta a ponta antes da integração com o backend de produção.

O contrato fica em [src/contract/api-contract.ts](src/contract/api-contract.ts) e é **idêntico** ao
`src/lib/api-contract.ts` do front. Ao alterar um, copie para o outro.

## Como rodar

```bash
pnpm install
pnpm db:migrate              # aplica as migrações de src/db/migrations em ordem
pnpm dev                     # sobe em http://127.0.0.1:4000 (com recarga)
pnpm invite:expire <token>   # expira um convite principal
```

Variáveis do `.env`:

| Variável | Uso |
|---|---|
| `PORT`, `HOST` | Endereço do servidor. Mantenha `127.0.0.1`: o backend só fica acessível pela própria máquina (ou pelo túnel). |
| `NODE_ENV` | `development`, `test` ou `production`. Em `production` os hooks de teste nunca ligam. |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | Banco MySQL. |
| `DB_USER`, `DB_PASSWORD` | Usuário da aplicação (só dados). |
| `DB_MIGRATE_USER`, `DB_MIGRATE_PASSWORD` | Usuário das migrações (altera estrutura). |
| `ALLOWED_ORIGINS` | Origens liberadas no CORS, separadas por vírgula. |
| `FRONT_ORIGIN` | Endereço do front, usado para montar o link de autocadastro dos convidados. |
| `STORAGE_DIR` | Pasta onde as fotos são gravadas (fora de qualquer pasta pública). |
| `TEST_HOOKS` | `true` liga os comportamentos de teste e a rota `/state`. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM_NAME` | Conta de e-mail própria usada no envio do e-mail de boas práticas. Opcional: sem ela o e-mail é ignorado e o cadastro segue normal. |

## Convenções de resposta

- Toda resposta é JSON com `RES` (boolean). Em recusa vem também `MSG`, texto em português exibido ao usuário.
- **Recusa de negócio responde HTTP 200 com `RES: false`.** O front decide pelo `RES` e pela `MSG`, não pelo status.
- Status diferentes de 200:
  - `400`: corpo inválido, sem token ou com JSON quebrado ou grande demais;
  - `404`: rota inexistente, ou foto enviada para um token desconhecido;
  - `429`: limite de requisições;
  - `500`: erro interno. Nunca devolve nem registra corpo, foto ou documento.
- Cabeçalhos aceitos do front: `Content-Type: application/json` e `Ambiente`.
- Limites:
  - corpo de até 10 MB;
  - 120 requisições por minuto por IP;
  - 30 por minuto nas consultas por token (`GET /convite` e `GET /convidado`), contra enumeração de tokens.

## Rotas

### `GET /convite?convite=<token>&request=consultar_convite_ativo`

Valida o link do convite principal antes de abrir o formulário.

| Situação | Resposta |
|---|---|
| Convite ativo | `{ RES: true }` |
| Convite expirado | `{ RES: false, MSG: "Convite expirado" }` → front vai para `/convite-expirado` |
| Token inexistente | `{ RES: false, MSG: "Nenhum convite encontrado" }` → front vai para `/convite-invalido` |
| `request` errado | `{ RES: false, MSG: "Requisição inválida." }` |

### `POST /foto`

Cada imagem sobe **antes** do cadastro, uma requisição por foto.

```jsonc
{
  "request": "cadastrar_foto_convite",
  "base64": "data:image/jpeg;base64,...",                // data URL completa
  "repositorio_arquivo": { "id": "<PHOTO_REPOSITORY_IDS.user | .document>" },
  "convite": { "id": "<token do convite principal ou do link do convidado>" }
}
```

- Resposta: `{ RES: true, KEY_FOTO: "<uuid>" }`. O `KEY_FOTO` é o id usado nas referências `{ id }` do cadastro.
- O tipo é conferido pelos primeiros bytes do arquivo, nunca pelo que o cliente declarou. São aceitos JPEG, PNG e WebP, com até 7 MB.
- Repositórios:
  - `user`: rosto do responsável e fotos dos convidados;
  - `document`: documento e CRECI.

### `POST /autocadastro`

Cadastro do responsável (Hóspede, Corretor ou Fornecedor). O corpo completo está em `SelfRegistrationRequest` no
contrato. Campos por categoria:

| Categoria | Campos além dos comuns |
|---|---|
| Comuns | `pessoa.nome`, `pessoa.documento` (CPF ou passaporte + foto), `pessoa.foto` (rosto), `contato.email`, `contato.telefone` |
| Hóspede | `profissao`, `estado_civil`, `nacionalidade`, `contato.endereco` completo, `veiculos?`, `convidados`, `quantidade_autocadastros`, `observacoes` |
| Corretor | `documento.creci` (número + foto), `pessoa.corretor.autonomo`; se não for autônomo, `cnpj_imobiliaria` |
| Fornecedor | `pessoa.profissao` |

Respostas:
- `{ RES: true, MSG: "Cadastro realizado com sucesso." }`
- Com `quantidade_autocadastros > 0`, vem também `GUEST_SELF_REGISTRY: "<FRONT_ORIGIN>/convidado/<token do link>"`.
- Recusas: `RES: false` com a `MSG` da primeira inconsistência encontrada (veja [Validações](#validações)).

### `GET /convidado?convite=<token>&request=consultar_convite_convidado`

Valida o link de autocadastro do convidado.

| Situação | Resposta |
|---|---|
| Link existente | `{ RES: true, TOKEN: "<token>", USOS_DISPONIVEIS: n }`. Com `0`, o front trata como expirado. |
| Token inexistente | `{ RES: false, MSG: "Nenhum convite encontrado" }` |
| `request` errado | `{ RES: false, MSG: "Requisição inválida." }` |

### `POST /convidado`

Cadastro do convidado pelo link.

```jsonc
{
  "request": "cadastrar_convidado_convite",
  "convite": { "id": "<token do link do convidado>" },
  "convidado": { /* GuestPayload; foto obrigatória */ }
}
```

- Resposta: `{ RES: true, MSG: "Cadastro realizado com sucesso." }`.
- Sem usos restantes: `{ RES: false, MSG: "Convite expirado" }`.

### Rotas auxiliares

- `GET /health`: confere a conexão com o banco.
- `GET /state` e `DELETE /state` (**só com `TEST_HOOKS=true`**): o GET lista fotos, órfãs, cadastros e links; o DELETE zera o banco de teste e apaga os arquivos.

## Regras de negócio

1. **O convite principal é de uso contínuo.** Várias pessoas se cadastram pelo mesmo token. Ele continua válido depois dos cadastros até ser expirado com `pnpm invite:expire <token>`. Não há expiração por tempo.
2. **Documento já cadastrado atualiza o cadastro existente.** Se o CPF ou passaporte do responsável já existe, em qualquer convite, o novo envio substitui o cadastro mais recente com esse documento. Nesse caso:
   - o documento gravado na primeira vez é mantido;
   - convidados cadastrados à mão e fotos antigas são apagados (arquivos só depois do commit);
   - convidados que entraram pelo link continuam, com as próprias fotos;
   - o link de autocadastro antigo para de aceitar novos usos;
   - `last_invitation_id` registra qual convite fez a atualização.
3. **Convidados e link existem só para o Hóspede.** Para Corretor e Fornecedor, `convidados` e `quantidade_autocadastros` são ignorados.
4. **Limite de 10 por cadastro:** convidados à mão + `quantidade_autocadastros` ≤ 10.
5. **O link do convidado tem N usos** (`quantidade_autocadastros`). Cada cadastro pelo link gasta um uso. O link é travado durante a transação, então dois convidados disputando o último uso são atendidos um de cada vez.
6. **Documento repetido é recusado dentro do mesmo cadastro.** Vale entre o responsável e os convidados, e entre os convidados (à mão ou pelo link): `"Este documento já está cadastrado neste convite."`.
7. **Fotos:** só valem para o token com que foram enviadas e só podem ser usadas uma vez. Os erros são `"Foto desconhecida."`, `"Foto de outro convite."` e `"Foto já utilizada."`. Foto que nunca é usada fica órfã; ainda não existe limpeza automática.
8. **Tudo ou nada.** Cada `POST /autocadastro` e `POST /convidado` roda numa transação única: cadastro, convidados, link e fotos. Qualquer recusa desfaz tudo.
9. **E-mail de boas práticas.** Depois de um cadastro de Hóspede que gerou link de autocadastro, o backend envia ao e-mail do responsável o guia de boas práticas ([src/services/mailer.ts](src/services/mailer.ts)). O envio roda em segundo plano: não atrasa a resposta e uma falha só vai para o log.

## Validações

O backend confere tudo de novo e não depende do front ([src/validation](src/validation)).

**Responsável (`POST /autocadastro`)**
- O token do corpo é igual ao do convite, o `request` está correto e a categoria é válida.
- Nome informado.
- Documento: CPF com 11 dígitos e dígitos verificadores corretos (repetições como `111.111.111-11` são recusadas), ou passaporte com 5 a 20 letras e números.
- Fotos de rosto e documento informadas, com id em formato UUID.
- E-mail no formato `usuario@dominio.ext`, com até 160 caracteres. Telefone informado.
- Por categoria:
  - Fornecedor: profissão;
  - Corretor: número e foto do CRECI, `autonomo` boolean e, se não for autônomo, CNPJ com 14 dígitos;
  - Hóspede: endereço completo (rua, número, bairro, cidade, UF, CEP, país), profissão, estado civil, nacionalidade, veículos completos, `quantidade_autocadastros` inteiro ≥ 0 e a regra do limite de 10.

**Convidado (à mão ou pelo link)**
- Nome e sobrenome, com até 80 caracteres cada. E-mail válido. Telefone informado, com até 40 caracteres formatado.
- **Documento ou data de nascimento, nunca os dois:**
  - Com documento: só números é tratado como CPF (validado pelo dígito verificador); o resto é tratado como passaporte. Não pode vir marcado como menor sem documento.
  - Sem documento: data `AAAA-MM-DD` real e não futura, confirmação `menor_sem_documento` e idade menor que 18.
- Foto: opcional no convidado cadastrado à mão (se vier, é conferida) e obrigatória no autocadastro pelo link.

## Vínculo dos dados no backend

O dono dos dados é o **cadastro do responsável** (`registrations`), não o convite. Como o convite é de uso contínuo,
um mesmo token tem vários cadastros, e cada cadastro tem os próprios convidados, fotos e link.

```text
invitations (convite principal: token_hash, status ativo|usado|expirado)
 └─ registrations (cadastro do responsável: categoria, document_hash, payload_json, last_invitation_id)
     ├─ guests (convidados: source = 'manual' | 'autocadastro', document_hash, birth_date, is_minor, photo_id)
     ├─ guest_invites (link de autocadastro: token_hash, total_uses, used_uses)
     │    └─ o convidado que usa o link vira uma linha em guests (source = 'autocadastro')
     └─ photos (used_by → registrations.id; invite_hash = token com que a foto foi enviada)
```

| Tabela | Ligação | Observação |
|---|---|---|
| `invitations` | — | Só o hash SHA-256 do token é gravado. Neste backend, convites nascem pelos hooks de teste; em produção quem cria é o ERP. |
| `registrations` | `invitation_id` (convite do primeiro cadastro) e `last_invitation_id` (convite da última atualização) | `document_hash` identifica o responsável entre convites. `payload_json` guarda o corpo enviado. **Em teste o documento fica em claro neste JSON; em produção deve virar colunas com o documento cifrado.** |
| `guests` | `registration_id` + `invitation_id` | O documento só é gravado como hash. Único por `(registration_id, document_hash)`. |
| `guest_invites` | `registration_id` + `invitation_id` | O token do link aparece só uma vez, na resposta do `/autocadastro`; no banco fica o hash. |
| `photos` | `used_by` → `registrations.id` | `NULL` até ser usada num cadastro. O arquivo fica em `STORAGE_DIR` com o nome `<uuid>.<ext>`. |

Duas regras sustentam esse vínculo:
- A foto é conferida pelo `invite_hash` do token com que foi enviada, mas, depois de usada, pertence ao cadastro.
- A foto de um convidado que entrou pelo link fica com o cadastro do responsável, não com o convidado.

## Comportamentos de teste (`TEST_HOOKS=true`)

O token controla a resposta, como no mock do front. A lista completa está em [src/test-hooks.ts](src/test-hooks.ts).

| Token contém | Convite principal | Link do convidado |
|---|---|---|
| (qualquer outro) | É criado ativo no primeiro acesso | Abre com 3 usos |
| `expirado` | Nasce expirado | 0 usos |
| `esgotado` | (sem efeito) | 0 usos |
| `invalido` | "Nenhum convite encontrado" | "Nenhum convite encontrado" |
| `-falha` | O `/autocadastro` recusa sempre | O `/convidado` recusa sempre |
| `-falha-foto` | O 1º envio de cada tipo de foto falha (HTTP 500) | O 1º envio de foto falha |
| `-lento` | Toda resposta demora 1,5 s | Toda resposta demora 1,5 s |

## Segurança

- `helmet`, CORS restrito a `ALLOWED_ORIGINS` e o cabeçalho `x-powered-by` desligado.
- `trust proxy` vale `loopback`. O `X-Forwarded-For` do túnel (devtunnels) só é aceito quando a conexão vem da própria máquina, para o limite de requisições enxergar o IP real. Em produção, ajuste conforme os proxies que ficam na frente do backend.
- Os tokens de convite e de link são gravados só como hash, e os tokens novos têm 256 bits aleatórios.
- Usuários de banco separados para a aplicação e para as migrações.
- Logs de erro registram só método, caminho e mensagem: nunca corpo, foto ou documento.

## Pendências conhecidas para produção

- Cifrar o documento do responsável (hoje está em claro no `payload_json`) e trocar o hash simples dos documentos por um hash com segredo (HMAC), porque um SHA-256 de CPF é revertível por força bruta.
- Limpeza das fotos órfãs e prazos de retenção. As colunas `retain_until` existem, mas ainda não são usadas.
- Rever a regra de recadastro pelo documento, que hoje atualiza o cadastro mesmo vindo de outro convite.
- Com o recadastro, os convidados que entraram pelo link são mantidos e o novo envio aceita mais 10, então o total vinculado ao responsável pode passar de 10.
