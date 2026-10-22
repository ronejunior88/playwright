import { expect, type APIResponse } from '@playwright/test';

/**
 * Formato de resposta da API no padrão `{ "message": "..." }`.
 *
 * O mesmo formato é usado para mensagens de negócio (`Cadastro realizado com
 * sucesso`), para erros de autorização e para mensagens de erro por recurso
 * (`Produto não encontrado`). A criação devolve ainda o `_id` do registro.
 */
export interface MensagemResposta {
  message?: string;
  _id?: string;
}

/**
 * Formato de erro por campo da API: `{ "nome": "nome é obrigatório" }`.
 *
 * Os campos varyem conforme o recurso e o payload enviado, por isso todos são
 * opcionais. O formato está descrito em `docs/api-contracts.md`.
 */
export interface ErroValidacao {
  nome?: string;
  email?: string;
  password?: string;
  administrador?: string;
  preco?: string;
  descricao?: string;
  quantidade?: string;
  id?: string;
  message?: string;
}

/** Mensagem devolvida na criação de um registro. */
export const MENSAGEM_CADASTRO_SUCESSO = 'Cadastro realizado com sucesso';

/** Mensagem devolvida na alteração de um registro. */
export const MENSAGEM_ALTERADO_SUCESSO = 'Registro alterado com sucesso';

/** Mensagem devolvida na exclusão de um registro existente. */
export const MENSAGEM_EXCLUIDO_SUCESSO = 'Registro excluído com sucesso';

/** Mensagem devolvida na exclusão de um registro que não existe. */
export const MENSAGEM_NENHUM_EXCLUIDO = 'Nenhum registro excluído';

/** Mensagem devolvida quando o identificador não tem o formato aceito. */
export const MENSAGEM_ID_INVALIDO =
  'id deve ter exatamente 16 caracteres alfanuméricos';

/**
 * Lê o corpo JSON de uma resposta da API.
 *
 * Concentra em um único ponto as três verificações aplicadas a toda resposta
 * lida pela suíte: status HTTP esperado, `content-type` JSON e leitura do
 * corpo. Sem isso, cada teste repetia o mesmo trio de linhas e uma resposta
 * com `content-type` incorreto passava despercebida.
 */
export async function lerJson<T>(
  response: APIResponse,
  status: number,
  contexto = 'resposta da API',
): Promise<T> {
  expect(response.status(), `${contexto}: status HTTP inesperado`).toBe(status);
  expect(
    response.headers()['content-type'] ?? '',
    `${contexto}: content-type inesperado`,
  ).toContain('application/json');

  return (await response.json()) as T;
}
