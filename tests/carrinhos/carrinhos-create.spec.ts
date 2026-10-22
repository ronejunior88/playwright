import { expect, test } from '../fixtures';
import { bearer } from '../helpers/autenticacao';
import {
  CASOS_PAYLOAD_CARRINHO_INVALIDO,
  criarCarrinhoTeste,
  listarCarrinhos,
  MENSAGEM_ESTOQUE_INSUFICIENTE,
  MENSAGEM_PRODUTO_DUPLICADO,
  MENSAGEM_SEGUNDO_CARRINHO,
  MENSAGEM_TOKEN_CARRINHO,
  obterCarrinho,
  obterEstoque,
  type ErroCarrinho,
  type UsuarioAutenticado,
} from '../helpers/carrinhos';
import {
  type ContextoCarrinhos,
  criarContextoCarrinhos,
} from '../helpers/cenario-carrinhos';
import { validarContrato } from '../helpers/contratos';
import {
  MENSAGEM_PRODUTO_NAO_ENCONTRADO,
  type ProdutoCriado,
} from '../helpers/produtos';
import {
  lerJson,
  MENSAGEM_CADASTRO_SUCESSO,
  type MensagemResposta,
} from '../helpers/resposta';
import { gerarIdUnico } from '../helpers/usuarios';

test.describe('Criação de carrinhos - POST /carrinhos', () => {
  // Serial: a API permite apenas 1 carrinho ativo por usuário e o afterEach
  // cancela os carrinhos de todas as contas do bloco; em paralelo, um teste
  // cancelaria o carrinho de outro. A serialização é o que garante o isolamento.
  test.describe.configure({ mode: 'serial' });

  let contexto: ContextoCarrinhos;

  test.beforeAll(async ({ request }) => {
    contexto = await criarContextoCarrinhos(request);
  });

  test.beforeEach(() => {
    contexto.iniciarTeste();
  });

  test.afterEach(async ({ request }) => {
    await contexto.cancelarContasDoTeste(request);
  });

  test.afterAll(async ({ request }) => {
    await contexto.limpar(request);
  });

  test('deve criar um carrinho e reduzir o estoque exatamente pela quantidade @critico', async ({
    request,
  }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 111, quantidade: 10 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const carrinhoId = await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 2 },
    ]);

    const carrinho = await obterCarrinho(request, carrinhoId);
    expect(carrinho.idUsuario).toBe(conta.usuario.id);
    expect(carrinho.produtos).toHaveLength(1);
    expect(carrinho.produtos[0].idProduto).toBe(produto.id);
    expect(carrinho.produtos[0].quantidade).toBe(2);
    expect(carrinho.produtos[0].precoUnitario).toBe(produto.preco);
    expect(carrinho.precoTotal).toBe(produto.preco * 2);
    expect(carrinho.quantidadeTotal).toBe(2);

    const estoqueDepois = await obterEstoque(request, produto.id);
    expect(estoqueDepois).toBe(estoqueInicial - 2);
  });

  test('deve rejeitar a criação sem token de autorização', async ({
    request,
  }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 120, quantidade: 5 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const response = await request.post('/carrinhos', {
      data: { produtos: [{ idProduto: produto.id, quantidade: 1 }] },
    });

    const body = await lerJson<ErroCarrinho>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);

    await validarContrato('auth.sem-token', response);

    const lista = await listarCarrinhos(request, { idUsuario: conta.usuario.id });
    expect(lista.quantidade).toBe(0);
    expect(await obterEstoque(request, produto.id)).toBe(estoqueInicial);
  });

  test('deve rejeitar a criação com token inválido', async ({ request }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 130, quantidade: 5 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const response = await request.post('/carrinhos', {
      data: { produtos: [{ idProduto: produto.id, quantidade: 1 }] },
      headers: { Authorization: bearer('token-invalido') },
    });

    const body = await lerJson<ErroCarrinho>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);

    await validarContrato('auth.sem-token', response);

    const lista = await listarCarrinhos(request, { idUsuario: conta.usuario.id });
    expect(lista.quantidade).toBe(0);
    expect(await obterEstoque(request, produto.id)).toBe(estoqueInicial);
  });

  test('deve rejeitar a criação com Authorization malformado (token sem prefixo Bearer)', async ({
    request,
  }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 131, quantidade: 5 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const response = await request.post('/carrinhos', {
      data: { produtos: [{ idProduto: produto.id, quantidade: 1 }] },
      headers: { Authorization: conta.token },
    });

    const body = await lerJson<ErroCarrinho>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);

    await validarContrato('auth.sem-token', response);

    const lista = await listarCarrinhos(request, { idUsuario: conta.usuario.id });
    expect(lista.quantidade).toBe(0);
    expect(await obterEstoque(request, produto.id)).toBe(estoqueInicial);
  });

  test('deve permitir a criação de carrinho para administrador (rota não exige admin)', async ({
    request,
  }) => {
    const conta = await contexto.novaConta(request, 'true');
    const produto = await contexto.novoProduto(request, { preco: 135, quantidade: 5 });

    const carrinhoId = await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 1 },
    ]);

    const carrinho = await obterCarrinho(request, carrinhoId);
    expect(carrinho.idUsuario).toBe(conta.usuario.id);
    expect(carrinho.produtos[0].idProduto).toBe(produto.id);
  });

  test('deve rejeitar a criação de um segundo carrinho para o mesmo usuário @critico', async ({
    request,
  }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 140, quantidade: 10 });
    const produto2 = await contexto.novoProduto(request, { preco: 150, quantidade: 10 });

    const carrinhoId = await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 1 },
    ]);
    const estoque2Inicial = await obterEstoque(request, produto2.id);

    const response = await request.post('/carrinhos', {
      data: { produtos: [{ idProduto: produto2.id, quantidade: 1 }] },
      headers: { Authorization: bearer(conta.token) },
    });

    const body = await lerJson<ErroCarrinho>(response, 400);
    expect(body.message).toBe(MENSAGEM_SEGUNDO_CARRINHO);

    await validarContrato('erros.mensagem', response);

    const carrinhoOriginal = await obterCarrinho(request, carrinhoId);
    expect(carrinhoOriginal.produtos[0].idProduto).toBe(produto.id);

    const lista = await listarCarrinhos(request, { idUsuario: conta.usuario.id });
    expect(lista.quantidade).toBe(1);
    expect(await obterEstoque(request, produto2.id)).toBe(estoque2Inicial);
  });

  test('deve rejeitar produto duplicado no mesmo carrinho', async ({
    request,
  }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 160, quantidade: 10 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const response = await request.post('/carrinhos', {
      data: {
        produtos: [
          { idProduto: produto.id, quantidade: 1 },
          { idProduto: produto.id, quantidade: 2 },
        ],
      },
      headers: { Authorization: bearer(conta.token) },
    });

    const body = await lerJson<ErroCarrinho>(response, 400);
    expect(body.message).toBe(MENSAGEM_PRODUTO_DUPLICADO);
    expect(body.idProdutosDuplicados).toContain(produto.id);

    await validarContrato('erros.mensagem', response);

    const lista = await listarCarrinhos(request, { idUsuario: conta.usuario.id });
    expect(lista.quantidade).toBe(0);
    expect(await obterEstoque(request, produto.id)).toBe(estoqueInicial);
  });

  test('deve rejeitar produto inexistente', async ({ request }) => {
    const conta = await contexto.novaConta(request);
    const idInexistente = gerarIdUnico();

    const response = await request.post('/carrinhos', {
      data: { produtos: [{ idProduto: idInexistente, quantidade: 1 }] },
      headers: { Authorization: bearer(conta.token) },
    });

    const body = await lerJson<ErroCarrinho>(response, 400);
    expect(body.message).toBe(MENSAGEM_PRODUTO_NAO_ENCONTRADO);
    expect(body.item?.idProduto).toBe(idInexistente);
    expect(body.item?.quantidade).toBe(1);
    expect(body.item?.index).toBe(0);

    await validarContrato('erros.mensagem', response);

    const lista = await listarCarrinhos(request, { idUsuario: conta.usuario.id });
    expect(lista.quantidade).toBe(0);
  });

  test('deve rejeitar quantidade superior ao estoque disponível @critico', async ({
    request,
  }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 170, quantidade: 3 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const response = await request.post('/carrinhos', {
      data: {
        produtos: [{ idProduto: produto.id, quantidade: estoqueInicial + 5 }],
      },
      headers: { Authorization: bearer(conta.token) },
    });

    const body = await lerJson<ErroCarrinho>(response, 400);
    expect(body.message).toBe(MENSAGEM_ESTOQUE_INSUFICIENTE);
    expect(body.item?.idProduto).toBe(produto.id);
    expect(body.item?.quantidadeEstoque).toBe(estoqueInicial);

    await validarContrato('erros.mensagem', response);

    const lista = await listarCarrinhos(request, { idUsuario: conta.usuario.id });
    expect(lista.quantidade).toBe(0);
    expect(await obterEstoque(request, produto.id)).toBe(estoqueInicial);
  });
});

test.describe('Criação de carrinhos - payloads inválidos - POST /carrinhos', () => {
  let contexto: ContextoCarrinhos;
  let conta: UsuarioAutenticado;
  let produto: ProdutoCriado;

  test.beforeAll(async ({ request }) => {
    contexto = await criarContextoCarrinhos(request);
    conta = await contexto.novaConta(request);
    produto = await contexto.novoProduto(request, {
      preco: 200,
      quantidade: 20,
    });
  });

  test.beforeEach(() => {
    // A conta e o produto são compartilhados por todos os casos: não há
    // carrinho ativo para cancelar entre um caso e outro.
    contexto.iniciarTeste();
  });

  test.afterAll(async ({ request }) => {
    await contexto.limpar(request);
  });

  for (const caso of CASOS_PAYLOAD_CARRINHO_INVALIDO) {
    test(`deve retornar erro ao criar carrinho com ${caso.rotulo}`, async ({
      request,
    }) => {
      const estoqueAntes = await obterEstoque(request, produto.id);

      const response = await request.post('/carrinhos', {
        data: caso.montar(),
        headers: { Authorization: bearer(conta.token) },
      });

      const body = await lerJson<ErroCarrinho>(response, 400);
      expect(body).toMatchObject(caso.corpoEsperado);
      expect(body).not.toHaveProperty('_id');

      // O formato depende do erro: campo inválido gera mapa por campo, erro
      // de negócio gera `{ message }`.
      await validarContrato(
        'message' in caso.corpoEsperado
          ? 'erros.mensagem'
          : 'erros.validacao-campos',
        response,
      );

      const lista = await listarCarrinhos(request, {
        idUsuario: conta.usuario.id,
      });
      expect(lista.quantidade).toBe(0);
      expect(await obterEstoque(request, produto.id)).toBe(estoqueAntes);
    });
  }
});

test.describe('Criação de carrinhos - corpo de sucesso - POST /carrinhos', () => {
  let contexto: ContextoCarrinhos;

  test.beforeAll(async ({ request }) => {
    contexto = await criarContextoCarrinhos(request);
  });

  test.afterAll(async ({ request }) => {
    await contexto.limpar(request);
  });

  test('deve retornar mensagem e _id no cadastro', async ({ request }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, {
      preco: 210,
      quantidade: 4,
    });

    const response = await request.post('/carrinhos', {
      data: { produtos: [{ idProduto: produto.id, quantidade: 1 }] },
      headers: { Authorization: bearer(conta.token) },
    });

    const body = await lerJson<MensagemResposta>(response, 201);
    expect(body.message).toBe(MENSAGEM_CADASTRO_SUCESSO);
    expect(typeof body._id).toBe('string');
    expect(body._id!.length).toBeGreaterThan(0);

    await validarContrato('carrinhos.criacao', response);
  });
});
