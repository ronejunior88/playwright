import { expect, test } from '../fixtures';
import { fazerLogin } from '../helpers/autenticacao';
import {
  validarErroDeCampos,
  validarListaProdutos,
  validarProduto,
} from '../helpers/contrato';
import { validarContrato } from '../helpers/contratos';
import {
  criarProdutoTeste,
  criarUsuarioProdutoTeste,
  excluirProduto,
  MENSAGEM_PRODUTO_NAO_ENCONTRADO,
  type ListaProdutos,
  type ProdutoApi,
} from '../helpers/produtos';
import {
  lerJson,
  MENSAGEM_ID_INVALIDO,
  type ErroValidacao,
  type MensagemResposta,
} from '../helpers/resposta';
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

  test('deve listar produtos com estrutura válida @smoke @critico', async ({ request }) => {
    const response = await request.get('/produtos');

    const body = await lerJson<ListaProdutos>(response, 200);

    expect(body).toHaveProperty('quantidade');
    expect(typeof body.quantidade).toBe('number');

    expect(body).toHaveProperty('produtos');
    expect(Array.isArray(body.produtos)).toBe(true);

    validarListaProdutos(body);
    expect(body.quantidade).toBe(body.produtos.length);

    await validarContrato('produtos.lista', response);
  });

  test('deve retornar somente o produto esperado ao filtrar por id', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, token);
    idsCriados.push(produto.id);

    const response = await request.get('/produtos', {
      params: { _id: produto.id },
    });

    const body = await lerJson<ListaProdutos>(response, 200);
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

    const body = await lerJson<ListaProdutos>(response, 200);
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

    const body = await lerJson<ListaProdutos>(response, 200);
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

    const body = await lerJson<ListaProdutos>(response, 200);
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

    const body = await lerJson<ListaProdutos>(response, 200);
    expect(body.quantidade).toBe(0);
    expect(body.produtos).toHaveLength(0);
  });

  test('deve consultar um produto por id válido', async ({ request }) => {
    const produto = await criarProdutoTeste(request, token);
    idsCriados.push(produto.id);

    const response = await request.get(`/produtos/${produto.id}`);

    const body = await lerJson<ProdutoApi>(response, 200);
    validarProduto(body);
    expect(body._id).toBe(produto.id);
    expect(body.nome).toBe(produto.nome);
    expect(body.preco).toBe(produto.preco);
    expect(body.descricao).toBe(produto.descricao);
    expect(body.quantidade).toBe(produto.quantidade);

    await validarContrato('produtos.item', response);
  });

  test('deve rejeitar filtro de query com chave não permitida', async ({
    request,
  }) => {
    const response = await request.get('/produtos', {
      params: { chave_nao_documentada: '1' },
    });

    const body = await lerJson<Record<string, string>>(response, 400);
    validarErroDeCampos(body);
    expect(body.chave_nao_documentada).toBe(
      'chave_nao_documentada não é permitido',
    );
    expect(body).not.toHaveProperty('produtos');
    expect(body).not.toHaveProperty('quantidade');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve retornar erro ao consultar produto inexistente', async ({
    request,
  }) => {
    const id = gerarIdUnico();

    const response = await request.get(`/produtos/${id}`);

    const body = await lerJson<MensagemResposta>(response, 400);
    expect(body.message).toBe(MENSAGEM_PRODUTO_NAO_ENCONTRADO);
    expect(body).not.toHaveProperty('nome');

    await validarContrato('erros.mensagem', response);
  });

  test('deve retornar erro ao consultar produto com id de formato inválido', async ({
    request,
  }) => {
    const response = await request.get('/produtos/id-invalido');

    const body = await lerJson<ErroValidacao>(response, 400);
    expect(body.id).toBe(MENSAGEM_ID_INVALIDO);

    await validarContrato('erros.id-invalido', response);
  });
});