import { expect, test } from '@playwright/test';
import { fazerLogin } from '../helpers/autenticacao';
import {
  criarProdutoTeste,
  criarUsuarioProdutoTeste,
  excluirProduto,
  type ErroValidacaoProduto,
  type ListaProdutos,
  type MensagemResposta,
  type ProdutoApi,
} from '../helpers/produtos';
import {
  excluirUsuario,
  gerarIdUnico,
  type UsuarioCriado,
} from '../helpers/usuarios';

test.describe('Consulta de produtos - GET /produtos', () => {
  let usuarioAdmin: UsuarioCriado;
  let token: string;
  const idsCriados: string[] = [];

  test.beforeAll(async ({ request }) => {
    usuarioAdmin = await criarUsuarioProdutoTeste(request, 'true');
    token = await fazerLogin(request, usuarioAdmin.email, usuarioAdmin.password);
  });

  test.afterEach(async ({ request }) => {
    for (const id of idsCriados.splice(0)) {
      await excluirProduto(request, token, id);
    }
  });

  test.afterAll(async ({ request }) => {
    await excluirUsuario(request, usuarioAdmin.id);
  });

  test('deve listar produtos com estrutura válida', async ({ request }) => {
    const response = await request.get('/produtos');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaProdutos;

    expect(body).toHaveProperty('quantidade');
    expect(typeof body.quantidade).toBe('number');

    expect(body).toHaveProperty('produtos');
    expect(Array.isArray(body.produtos)).toBe(true);

    for (const produto of body.produtos) {
      expect(typeof produto._id).toBe('string');
      expect(typeof produto.nome).toBe('string');
      expect(typeof produto.preco).toBe('number');
      expect(typeof produto.descricao).toBe('string');
      expect(typeof produto.quantidade).toBe('number');
    }
  });

  test('deve retornar somente o produto esperado ao filtrar por id', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, token);
    idsCriados.push(produto.id);

    const response = await request.get('/produtos', {
      params: { _id: produto.id },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaProdutos;
    expect(body.quantidade).toBe(1);
    expect(body.produtos).toHaveLength(1);
    expect(body.produtos[0]._id).toBe(produto.id);
  });

  test('deve filtrar produtos por nome', async ({ request }) => {
    const produto = await criarProdutoTeste(request, token);
    idsCriados.push(produto.id);

    const response = await request.get('/produtos', {
      params: { nome: produto.nome },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaProdutos;
    expect(body.quantidade).toBeGreaterThanOrEqual(1);

    for (const produtoEncontrado of body.produtos) {
      expect(produtoEncontrado.nome).toBe(produto.nome);
    }

    const produtosCriados = body.produtos.filter(
      (p) => p._id === produto.id,
    );
    expect(produtosCriados).toHaveLength(1);
  });

  test('deve filtrar produtos por descricao', async ({ request }) => {
    const produto = await criarProdutoTeste(request, token);
    idsCriados.push(produto.id);

    const response = await request.get('/produtos', {
      params: { descricao: produto.descricao },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaProdutos;
    expect(body.quantidade).toBeGreaterThanOrEqual(1);

    const produtosCriados = body.produtos.filter(
      (p) => p._id === produto.id,
    );
    expect(produtosCriados).toHaveLength(1);
  });

  test('deve filtrar produtos por preco e quantidade', async ({ request }) => {
    const produto = await criarProdutoTeste(request, token);
    idsCriados.push(produto.id);

    const response = await request.get('/produtos', {
      params: {
        preco: String(produto.preco),
        quantidade: String(produto.quantidade),
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaProdutos;
    expect(body.quantidade).toBeGreaterThanOrEqual(1);

    for (const produtoEncontrado of body.produtos) {
      expect(produtoEncontrado.preco).toBe(produto.preco);
      expect(produtoEncontrado.quantidade).toBe(produto.quantidade);
    }

    const produtosCriados = body.produtos.filter(
      (p) => p._id === produto.id,
    );
    expect(produtosCriados).toHaveLength(1);
  });

  test('deve retornar lista vazia ao filtrar por nome inexistente', async ({
    request,
  }) => {
    const response = await request.get('/produtos', {
      params: { nome: 'Produto Nome Inexistente XYZ 999' },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaProdutos;
    expect(body.quantidade).toBe(0);
    expect(body.produtos).toHaveLength(0);
  });

  test('deve consultar um produto por id válido', async ({ request }) => {
    const produto = await criarProdutoTeste(request, token);
    idsCriados.push(produto.id);

    const response = await request.get(`/produtos/${produto.id}`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ProdutoApi;
    expect(body._id).toBe(produto.id);
    expect(body.nome).toBe(produto.nome);
    expect(body.preco).toBe(produto.preco);
    expect(body.descricao).toBe(produto.descricao);
    expect(body.quantidade).toBe(produto.quantidade);
  });

  test('deve retornar erro ao consultar produto inexistente', async ({
    request,
  }) => {
    const id = gerarIdUnico();

    const consultaPrevia = await request.get(`/produtos/${id}`);
    expect(consultaPrevia.status()).toBe(400);

    const response = await request.get(`/produtos/${id}`);

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Produto não encontrado');
    expect(body).not.toHaveProperty('nome');
  });

  test('deve retornar erro ao consultar produto com id de formato inválido', async ({
    request,
  }) => {
    const response = await request.get('/produtos/id-invalido');

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacaoProduto;
    expect(body.id).toBe('id deve ter exatamente 16 caracteres alfanuméricos');
  });
});