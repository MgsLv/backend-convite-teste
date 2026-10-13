import { API_REQUESTS, CATEGORY_IDS, type ApiCategory, type PhotoRef, type SelfRegistrationRequest } from "../contract/api-contract.js";
import { collectPhoto, isObject, text } from "./common.js";
import { validateGuestPayload } from "./guests.js";

const categoryById = (id: string) =>
  (Object.keys(CATEGORY_IDS) as ApiCategory[]).find((category) => CATEGORY_IDS[category] === id);

export type SelfRegistrationValidation =
  | { error: string }
  | { category: ApiCategory; photoIds: string[]; request: SelfRegistrationRequest };

/** Primeira inconsistência encontrada no payload (mensagem em português). Também devolve as fotos referenciadas. */
export function validateSelfRegistration(raw: unknown, invitation: string): SelfRegistrationValidation {
  if (!isObject(raw)) return { error: "Corpo inválido." };

  const body = raw as unknown as SelfRegistrationRequest;
  const photoIds: string[] = [];

  const needPhoto = (ref: PhotoRef | null | undefined, label: string) => collectPhoto(ref, label, photoIds);

  if (body.request !== API_REQUESTS.selfRegistration) return { error: "Requisição inválida." };
  if (text(body.convite?.id) !== invitation) return { error: "Convite não informado." };

  const category = categoryById(text(body.categoria_autocadastro?.id));
  if (!category) return { error: "Categoria inválida." };

  const pessoa = body.pessoa;
  if (!text(pessoa?.nome)) return { error: "Nome não informado." };

  const documento = pessoa?.documento;
  if (documento?.estrangeiro === false) {
    if (!/^\d{11}$/.test(text(documento.cpf))) return { error: "CPF inválido." };
  } else if (documento?.estrangeiro === true) {
    if (!text(documento.passaporte)) return { error: "Passaporte não informado." };
  } else {
    return { error: "Documento inválido." };
  }

  const photoError = needPhoto(pessoa?.foto, "foto do rosto") ?? needPhoto(documento?.foto, "foto do documento");
  if (photoError) return { error: photoError };

  const contato = body.contato;
  if (!text(contato?.email?.email).includes("@")) return { error: "E-mail inválido." };
  if (!text(contato?.telefone?.numero)) return { error: "Telefone não informado." };

  if (category === "Fornecedor" && !text(pessoa.profissao?.descricao)) return { error: "Profissão não informada." };

  if (category === "Corretor") {
    if (!text(documento.creci?.numero)) return { error: "Número do CRECI não informado." };

    const creciError = needPhoto(documento.creci?.foto, "foto do CRECI");
    if (creciError) return { error: creciError };

    if (typeof pessoa.corretor?.autonomo !== "boolean") return { error: "Tipo de atuação do corretor não informado." };
    if (pessoa.corretor.autonomo === false && !/^\d{14}$/.test(text(pessoa.corretor.cnpj_imobiliaria))) {
      return { error: "CNPJ da imobiliária inválido." };
    }
  }

  if (category === "Hospede") {
    const endereco = contato.endereco;
    const missingAddress = endereco
      ? (["rua", "numero", "bairro", "cidade", "uf", "cep", "pais"] as const).find((field) => !text(endereco[field]))
      : "endereço";
    if (missingAddress) return { error: `Endereço incompleto (${missingAddress}).` };

    if (!text(pessoa.profissao?.descricao)) return { error: "Profissão não informada." };
    if (!text(pessoa.estado_civil?.descricao)) return { error: "Estado civil não informado." };
    if (!text(pessoa.nacionalidade?.descricao)) return { error: "Nacionalidade não informada." };

    for (const [index, vehicle] of (body.veiculos ?? []).entries()) {
      if (!text(vehicle.placa) || !text(vehicle.modelo) || !text(vehicle.fabricante) || !text(vehicle.cor)) {
        return { error: `Veículo ${index + 1} incompleto.` };
      }
    }

    const guests = body.convidados ?? [];
    const selfRegistrations = body.quantidade_autocadastros ?? 0;

    if (!Number.isInteger(selfRegistrations) || selfRegistrations < 0) return { error: "Quantidade de autocadastros inválida." };
    if (guests.length + selfRegistrations > 10) return { error: "No máximo 10 convidados." };

    for (const [index, guest] of guests.entries()) {
      // A foto do convidado é opcional no contrato, mas se vier tem que existir.
      const guestError = validateGuestPayload(guest, `Convidado ${index + 1}`, false, photoIds);
      if (guestError) return { error: guestError };
    }
  }

  return { category, photoIds, request: body };
}
