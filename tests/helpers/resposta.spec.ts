import { expect, test, type APIResponse } from '@playwright/test';
import {
  lerJson,
  MENSAGEM_ALTERADO_SUCESSO,
  MENSAGEM_CADASTRO_SUCESSO,
  MENSAGEM_EXCLUIDO_SUCESSO,
  MENSAGEM_ID_INVALIDO,
  MENSAGEM_NENHUM_EXCLUIDO,
  type ErroValidacao,
  type MensagemResposta,
} from './resposta';

/**
 * Resposta falsa com o mínimo necessário para exercitar `lerJson`.
 *
 * O objetivo é caracterizar o comportamento do helper sem depender da API
 * pública: status, `content-type` e corpo são os três pontos em que a leitura
 * pode falhar.
 */
function respostaFalsa(
  status: number,
  corpo: unknown,
  contentType = 'application/json; charset=utf-8',
): APIResponse {
  return {
    status: () => status,
    headers: () => ({ 'content-type': contentType }),
    json: async () => corpo,
  } as unknown as APIResponse;
}

test.describe('Leitura de respostas JSON', () => {
  test('devolve o corpo quando o status e o content-type conferem', async () => {
    const corpo = { message: MENSAGEM_CADASTRO_SUCESSO, _id: 'abc' };

    const resultado = await lerJson<MensagemResposta>(
      respostaFalsa(201, corpo),
      201,
    );

    expect(resultado).toEqual(corpo);
  });

  test('reprova quando o status HTTP difere do esperado', async () => {
    await expect(
      lerJson<MensagemResposta>(respostaFalsa(400, { message: 'erro' }), 200),
    ).rejects.toThrow(/status HTTP inesperado/);
  });

  test('reprova quando o content-type não é JSON', async () => {
    await expect(
      lerJson<MensagemResposta>(
        respostaFalsa(200, {}, 'text/html; charset=utf-8'),
        200,
      ),
    ).rejects.toThrow(/content-type inesperado/);
  });

  test('reprova quando o content-type está ausente', async () => {
    const semContentType = {
      status: () => 200,
      headers: () => ({}),
      json: async () => ({}),
    } as unknown as APIResponse;

    await expect(lerJson(semContentType, 200)).rejects.toThrow(
      /content-type inesperado/,
    );
  });

  test('usa o contexto padrão quando nenhum é informado', async () => {
    await expect(lerJson(respostaFalsa(500, {}), 200)).rejects.toThrow(
      /resposta da API: status HTTP inesperado/,
    );
  });

  test('usa o contexto informado na mensagem de falha', async () => {
    await expect(
      lerJson(respostaFalsa(500, {}), 200, 'criação de usuário'),
    ).rejects.toThrow(/criação de usuário: status HTTP inesperado/);
  });

  test('preserva erros por campo vindos da API', async () => {
    const corpo = { nome: 'nome é obrigatório' };

    const resultado = await lerJson<ErroValidacao>(respostaFalsa(400, corpo), 400);

    expect(resultado.nome).toBe('nome é obrigatório');
    expect(resultado.message).toBeUndefined();
  });
});

test.describe('Mensagens padrão da API', () => {
  test('mantem os textos esperados pelos contratos', () => {
    expect(MENSAGEM_CADASTRO_SUCESSO).toBe('Cadastro realizado com sucesso');
    expect(MENSAGEM_ALTERADO_SUCESSO).toBe('Registro alterado com sucesso');
    expect(MENSAGEM_EXCLUIDO_SUCESSO).toBe('Registro excluído com sucesso');
    expect(MENSAGEM_NENHUM_EXCLUIDO).toBe('Nenhum registro excluído');
    expect(MENSAGEM_ID_INVALIDO).toBe(
      'id deve ter exatamente 16 caracteres alfanuméricos',
    );
  });
});
