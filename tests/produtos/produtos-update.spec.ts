import { expect, test } from '@playwright/test';
import { fazerLogin } from '../helpers/autenticacao';
import {
  bearer,
  CASOS_PAYLOAD_INVALIDO,
  criarProdutoTeste,
  criarUsuarioProdutoTeste,
  excluirProduto,
  MENSAGEM_ROTA_ADMIN,
  MENSAGEM_TOKEN_INVALIDO,
  type ErroValidacaoProduto,
  type MensagemResposta,
  type ProdutoApi,
  type ProdutoCriado,
} from '../helpers/produtos';
import {
  excluirUsuario,
  gerarIdUnico,
  type UsuarioCriado,
} from '../helpers/usuarios';

test.describe('Atualização de produtos - PUT /produtos/{_id}', () => {
  let usuarioAdmin: UsuarioCriado;
  let usuarioComum: UsuarioCriado;
  let tokenAdmin: string;
  let tokenComum: string;
  let produtoBase: ProdutoCriado;
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
    produtoBase = await criarProdutoTeste(request, tokenAdmin);
  });

  test.afterEach(async ({ request }) => {
    for (const id of idsCriados.splice(0)) {
      await excluirProduto(request, tokenAdmin, id);
    }
  });

  test.afterAll(async ({ request }) => {
    await excluirProduto(request, tokenAdmin, produtoBase.id);
    await excluirUsuario(request, usuarioAdmin.id);
    await excluirUsuario(request, usuarioComum.id);
  });

  test('deve atualizar um produto existente e persistir as alterações', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const dadosAtualizados = {
      nome: `${produto.nome} Atualizado`,
      preco: 8888,
      descricao: `${produto.descricao} - Atualizada`,
      quantidade: 9,
    };

    const response = await request.put(`/produtos/${produto.id}`, {
      data: dadosAtualizados,
      headers: { Authorization: bearer(tokenAdmin) },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Registro alterado com sucesso');

    const consulta = await request.get(`/produtos/${produto.id}`);
    expect(consulta.status()).toBe(200);

    const corpo = (await consulta.json()) as ProdutoApi;
    expect(corpo._id).toBe(produto.id);
    expect(corpo.nome).toBe(dadosAtualizados.nome);
    expect(corpo.preco).toBe(dadosAtualizados.preco);
    expect(corpo.descricao).toBe(dadosAtualizados.descricao);
    expect(corpo.quantidade).toBe(dadosAtualizados.quantidade);
  });

  test('deve rejeitar atualização utilizando o nome de outro produto', async ({
    request,
  }) => {
    const produtoA = await criarProdutoTeste(request, tokenAdmin);
    const produtoB = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produtoA.id, produtoB.id);

    const response = await request.put(`/produtos/${produtoB.id}`, {
      data: {
        nome: produtoA.nome,
        preco: produtoB.preco,
        descricao: produtoB.descricao,
        quantidade: produtoB.quantidade,
      },
      headers: { Authorization: bearer(tokenAdmin) },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Já existe produto com esse nome');

    const consultaB = await request.get(`/produtos/${produtoB.id}`);
    expect(consultaB.status()).toBe(200);
    const corpoB = (await consultaB.json()) as ProdutoApi;
    expect(corpoB.nome).toBe(produtoB.nome);
    expect(corpoB.preco).toBe(produtoB.preco);
    expect(corpoB.descricao).toBe(produtoB.descricao);
    expect(corpoB.quantidade).toBe(produtoB.quantidade);
  });

  test('deve rejeitar a atualização sem token de autorização', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const response = await request.put(`/produtos/${produto.id}`, {
      data: {
        nome: `${produto.nome} Sem Token`,
        preco: 111,
        descricao: produto.descricao,
        quantidade: 1,
      },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe(MENSAGEM_TOKEN_INVALIDO);

    const consulta = await request.get(`/produtos/${produto.id}`);
    expect(consulta.status()).toBe(200);
    const corpo = (await consulta.json()) as ProdutoApi;
    expect(corpo.nome).toBe(produto.nome);
    expect(corpo.preco).toBe(produto.preco);
  });

  test('deve rejeitar a atualização com token inválido', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const response = await request.put(`/produtos/${produto.id}`, {
      data: {
        nome: `${produto.nome} Token Invalido`,
        preco: 222,
        descricao: produto.descricao,
        quantidade: 2,
      },
      headers: { Authorization: bearer('token-invalido') },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe(MENSAGEM_TOKEN_INVALIDO);

    const consulta = await request.get(`/produtos/${produto.id}`);
    expect(consulta.status()).toBe(200);
    const corpo = (await consulta.json()) as ProdutoApi;
    expect(corpo.nome).toBe(produto.nome);
    expect(corpo.preco).toBe(produto.preco);
  });

  test('deve rejeitar a atualização com usuário comum (não administrador)', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const response = await request.put(`/produtos/${produto.id}`, {
      data: {
        nome: `${produto.nome} Usuario Comum`,
        preco: 333,
        descricao: produto.descricao,
        quantidade: 3,
      },
      headers: { Authorization: bearer(tokenComum) },
    });

    expect(response.status()).toBe(403);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe(MENSAGEM_ROTA_ADMIN);

    const consulta = await request.get(`/produtos/${produto.id}`);
    expect(consulta.status()).toBe(200);
    const corpo = (await consulta.json()) as ProdutoApi;
    expect(corpo.nome).toBe(produto.nome);
    expect(corpo.preco).toBe(produto.preco);
  });

  test('deve criar um novo produto ao atualizar com id inexistente', async ({
    request,
  }) => {
    const id = gerarIdUnico();

    const consultaPrevia = await request.get(`/produtos/${id}`);
    expect(consultaPrevia.status()).toBe(400);

    const dados = {
      nome: 'Produto Criado Via Put 888',
      preco: 444,
      descricao: 'Produto criado por PUT com id inexistente',
      quantidade: 4,
    };

    const response = await request.put(`/produtos/${id}`, {
      data: dados,
      headers: { Authorization: bearer(tokenAdmin) },
    });

    expect(response.status()).toBe(201);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Cadastro realizado com sucesso');
    expect(typeof body._id).toBe('string');
    expect(body._id!.length).toBeGreaterThan(0);

    idsCriados.push(body._id!);

    const consulta = await request.get(`/produtos/${body._id}`);
    expect(consulta.status()).toBe(200);

    const corpo = (await consulta.json()) as ProdutoApi;
    expect(corpo._id).toBe(body._id);
    expect(corpo.nome).toBe(dados.nome);
    expect(corpo.preco).toBe(dados.preco);
    expect(corpo.descricao).toBe(dados.descricao);
    expect(corpo.quantidade).toBe(dados.quantidade);

    const consultaIdUrl = await request.get(`/produtos/${id}`);
    expect(consultaIdUrl.status()).toBe(400);
    const corpoIdUrl = (await consultaIdUrl.json()) as MensagemResposta;
    expect(corpoIdUrl.message).toBe('Produto não encontrado');
  });

  for (const caso of CASOS_PAYLOAD_INVALIDO) {
    test(`deve retornar erro ao atualizar produto com ${caso.rotulo}`, async ({
      request,
    }) => {
      const dadosBase = {
        nome: produtoBase.nome,
        preco: produtoBase.preco,
        descricao: produtoBase.descricao,
        quantidade: produtoBase.quantidade,
      };

      const response = await request.put(`/produtos/${produtoBase.id}`, {
        data: caso.montar(),
        headers: { Authorization: bearer(tokenAdmin) },
      });

      expect(response.status()).toBe(400);
      expect(response.headers()['content-type'] ?? '').toContain('application/json');

      const body = (await response.json()) as ErroValidacaoProduto;
      expect(body).toMatchObject(caso.corpoEsperado);
      expect(body).not.toHaveProperty('_id');

      const consulta = await request.get(`/produtos/${produtoBase.id}`);
      expect(consulta.status()).toBe(200);
      const corpo = (await consulta.json()) as ProdutoApi;
      expect(corpo.nome).toBe(dadosBase.nome);
      expect(corpo.preco).toBe(dadosBase.preco);
      expect(corpo.descricao).toBe(dadosBase.descricao);
      expect(corpo.quantidade).toBe(dadosBase.quantidade);
    });
  }
});