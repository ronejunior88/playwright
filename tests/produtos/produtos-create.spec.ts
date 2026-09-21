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
  type ListaProdutos,
  type MensagemResposta,
} from '../helpers/produtos';
import {
  excluirUsuario,
  type UsuarioCriado,
} from '../helpers/usuarios';

test.describe('Criação de produtos - POST /produtos', () => {
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

  test('deve criar um produto com sucesso e persistir os dados', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const consulta = await request.get(`/produtos/${produto.id}`);
    expect(consulta.status()).toBe(200);

    const corpo = (await consulta.json()) as {
      _id: string;
      nome: string;
      preco: number;
      descricao: string;
      quantidade: number;
    };
    expect(corpo._id).toBe(produto.id);
    expect(corpo.nome).toBe(produto.nome);
    expect(corpo.preco).toBe(produto.preco);
    expect(corpo.descricao).toBe(produto.descricao);
    expect(corpo.quantidade).toBe(produto.quantidade);
  });

  test('deve rejeitar a criação sem token de autorização', async ({
    request,
  }) => {
    const payload = {
      nome: 'Produto Sem Token 777',
      preco: 100,
      descricao: 'Descrição sem token',
      quantidade: 1,
    };

    const response = await request.post('/produtos', { data: payload });

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe(MENSAGEM_TOKEN_INVALIDO);
    expect(body).not.toHaveProperty('_id');

    const consulta = await request.get('/produtos', {
      params: { nome: payload.nome },
    });
    expect(consulta.status()).toBe(200);
    const lista = (await consulta.json()) as ListaProdutos;
    expect(lista.quantidade).toBe(0);
  });

  test('deve rejeitar a criação com token inválido', async ({ request }) => {
    const payload = {
      nome: 'Produto Token Invalido 777',
      preco: 100,
      descricao: 'Descrição token inválido',
      quantidade: 1,
    };

    const response = await request.post('/produtos', {
      data: payload,
      headers: { Authorization: bearer('token-invalido') },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe(MENSAGEM_TOKEN_INVALIDO);
    expect(body).not.toHaveProperty('_id');

    const consulta = await request.get('/produtos', {
      params: { nome: payload.nome },
    });
    expect(consulta.status()).toBe(200);
    const lista = (await consulta.json()) as ListaProdutos;
    expect(lista.quantidade).toBe(0);
  });

  test('deve rejeitar a criação com usuário comum (não administrador)', async ({
    request,
  }) => {
    const payload = {
      nome: 'Produto Usuario Comum 777',
      preco: 100,
      descricao: 'Descrição usuário comum',
      quantidade: 1,
    };

    const response = await request.post('/produtos', {
      data: payload,
      headers: { Authorization: bearer(tokenComum) },
    });

    expect(response.status()).toBe(403);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe(MENSAGEM_ROTA_ADMIN);
    expect(body).not.toHaveProperty('_id');

    const consulta = await request.get('/produtos', {
      params: { nome: payload.nome },
    });
    expect(consulta.status()).toBe(200);
    const lista = (await consulta.json()) as ListaProdutos;
    expect(lista.quantidade).toBe(0);
  });

  test('deve rejeitar a criação com nome duplicado', async ({ request }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const segundo = await request.post('/produtos', {
      data: {
        nome: produto.nome,
        preco: 300,
        descricao: 'Tentativa de nome duplicado',
        quantidade: 5,
      },
      headers: { Authorization: bearer(tokenAdmin) },
    });

    expect(segundo.status()).toBe(400);
    expect(segundo.headers()['content-type'] ?? '').toContain('application/json');

    const segundoBody = (await segundo.json()) as MensagemResposta;
    expect(segundoBody.message).toBe('Já existe produto com esse nome');
    expect(segundoBody).not.toHaveProperty('_id');

    const consulta = await request.get('/produtos', {
      params: { nome: produto.nome },
    });
    expect(consulta.status()).toBe(200);

    const lista = (await consulta.json()) as ListaProdutos;
    expect(lista.quantidade).toBe(1);
    expect(lista.produtos).toHaveLength(1);
    expect(lista.produtos[0]._id).toBe(produto.id);
  });

  for (const caso of CASOS_PAYLOAD_INVALIDO) {
    test(`deve retornar erro ao criar produto com ${caso.rotulo}`, async ({
      request,
    }) => {
      const response = await request.post('/produtos', {
        data: caso.montar(),
        headers: { Authorization: bearer(tokenAdmin) },
      });

      expect(response.status()).toBe(400);
      expect(response.headers()['content-type'] ?? '').toContain('application/json');

      const body = (await response.json()) as ErroValidacaoProduto;
      expect(body).toMatchObject(caso.corpoEsperado);
      expect(body).not.toHaveProperty('_id');
    });
  }
});