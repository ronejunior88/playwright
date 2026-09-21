import { expect, test } from '@playwright/test';
import { fazerLogin } from '../helpers/autenticacao';
import {
  bearer,
  criarProdutoTeste,
  criarUsuarioProdutoTeste,
  excluirProduto,
  MENSAGEM_ROTA_ADMIN,
  MENSAGEM_TOKEN_INVALIDO,
  type MensagemResposta,
  type ProdutoApi,
} from '../helpers/produtos';
import {
  excluirUsuario,
  gerarIdUnico,
  type UsuarioCriado,
} from '../helpers/usuarios';

test.describe('Exclusão de produtos - DELETE /produtos/{_id}', () => {
  let usuarioAdmin: UsuarioCriado;
  let usuarioComum: UsuarioCriado;
  let tokenAdmin: string;
  let tokenComum: string;
  const idsCriados: string[] = [];

  test.beforeAll(async ({ request }) => {
    usuarioAdmin = await criarUsuarioProdutoTeste(request, 'true');
    usuarioComum = await criarUsuarioProdutoTeste(request, 'false');
    tokenAdmin = await fazerLogin(
      request,
      usuarioAdmin.email,
      usuarioAdmin.password,
    );
    tokenComum = await fazerLogin(
      request,
      usuarioComum.email,
      usuarioComum.password,
    );
  });

  test.afterEach(async ({ request }) => {
    for (const id of idsCriados.splice(0)) {
      await excluirProduto(request, tokenAdmin, id);
    }
  });

  test.afterAll(async ({ request }) => {
    await excluirUsuario(request, usuarioAdmin.id);
    await excluirUsuario(request, usuarioComum.id);
  });

  test('deve excluir um produto existente e remover o registro', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);

    const response = await request.delete(`/produtos/${produto.id}`, {
      headers: { Authorization: bearer(tokenAdmin) },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Registro excluído com sucesso');

    const consulta = await request.get(`/produtos/${produto.id}`);
    expect(consulta.status()).toBe(400);

    const corpo = (await consulta.json()) as MensagemResposta;
    expect(corpo.message).toBe('Produto não encontrado');
  });

  test('deve retornar sucesso sem excluir registros ao excluir produto inexistente', async ({
    request,
  }) => {
    const id = gerarIdUnico();

    const consultaPrevia = await request.get(`/produtos/${id}`);
    expect(consultaPrevia.status()).toBe(400);

    const response = await request.delete(`/produtos/${id}`, {
      headers: { Authorization: bearer(tokenAdmin) },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Nenhum registro excluído');
  });

  test('deve rejeitar a exclusão sem token de autorização', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const response = await request.delete(`/produtos/${produto.id}`);

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe(MENSAGEM_TOKEN_INVALIDO);

    const consulta = await request.get(`/produtos/${produto.id}`);
    expect(consulta.status()).toBe(200);
    const corpo = (await consulta.json()) as ProdutoApi;
    expect(corpo._id).toBe(produto.id);
    expect(corpo.nome).toBe(produto.nome);
  });

  test('deve rejeitar a exclusão com token inválido', async ({ request }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const response = await request.delete(`/produtos/${produto.id}`, {
      headers: { Authorization: bearer('token-invalido') },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe(MENSAGEM_TOKEN_INVALIDO);

    const consulta = await request.get(`/produtos/${produto.id}`);
    expect(consulta.status()).toBe(200);
    const corpo = (await consulta.json()) as ProdutoApi;
    expect(corpo._id).toBe(produto.id);
    expect(corpo.nome).toBe(produto.nome);
  });

  test('deve rejeitar a exclusão com usuário comum (não administrador)', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const response = await request.delete(`/produtos/${produto.id}`, {
      headers: { Authorization: bearer(tokenComum) },
    });

    expect(response.status()).toBe(403);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe(MENSAGEM_ROTA_ADMIN);

    const consulta = await request.get(`/produtos/${produto.id}`);
    expect(consulta.status()).toBe(200);
    const corpo = (await consulta.json()) as ProdutoApi;
    expect(corpo._id).toBe(produto.id);
    expect(corpo.nome).toBe(produto.nome);
  });

  test.skip(
    'não executado nesta etapa: exclusão de produto vinculado a carrinho (requer dados de carrinho, fora do escopo da ETAPA 4)',
    async () => {},
  );
});