import { type APIRequestContext } from '@playwright/test';
import { expect, test } from '../fixtures';
import {
  validarCarrinho,
  validarErroDeCampos,
  validarListaCarrinhos,
} from '../helpers/contrato';
import { validarContrato } from '../helpers/contratos';
import {
  criarCarrinhoTeste,
  listarCarrinhos,
  MENSAGEM_CARRINHO_NAO_ENCONTRADO,
  obterCarrinho,
  obterEstoque,
  type CarrinhoApi,
  type ErroCarrinho,
  type ItemCarrinho,
  type ListaCarrinhos,
  type UsuarioAutenticado,
} from '../helpers/carrinhos';
import {
  type ContextoCarrinhos,
  criarContextoCarrinhos,
} from '../helpers/cenario-carrinhos';
import { type ProdutoCriado } from '../helpers/produtos';
import { lerJson, MENSAGEM_ID_INVALIDO } from '../helpers/resposta';
import { gerarIdUnico } from '../helpers/usuarios';

test.describe('Consulta de carrinhos - GET /carrinhos', () => {
  // Serial: a API permite apenas 1 carrinho ativo por usuário e o afterEach
  // cancela os carrinhos de todas as contas do bloco; em paralelo, um teste
  // cancelaria o carrinho de outro. A serialização é o que garante o isolamento.
  test.describe.configure({ mode: 'serial' });

  interface CenarioCarrinho extends UsuarioAutenticado {
    produto: ProdutoCriado;
    item: ItemCarrinho;
    carrinhoId: string;
  }

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

  async function prepararCarrinho(
    request: APIRequestContext,
    opcoes: { preco: number; quantidade: number; compra: number },
  ): Promise<CenarioCarrinho> {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, {
      preco: opcoes.preco,
      quantidade: opcoes.quantidade,
    });

    const item: ItemCarrinho = {
      idProduto: produto.id,
      quantidade: opcoes.compra,
    };
    const carrinhoId = await criarCarrinhoTeste(request, conta.token, [item]);

    return { ...conta, produto, item, carrinhoId };
  }

  test('deve listar carrinhos com estrutura válida', async ({ request }) => {
    const response = await request.get('/carrinhos');

    const lista = await lerJson<ListaCarrinhos>(response, 200);

    expect(typeof lista.quantidade).toBe('number');
    expect(Array.isArray(lista.carrinhos)).toBe(true);
    expect(lista.quantidade).toBe(lista.carrinhos.length);

    validarListaCarrinhos(lista);

    await validarContrato('carrinhos.lista', response);
  });

  test('deve filtrar carrinhos por _id', async ({ request }) => {
    const cenario = await prepararCarrinho(request, {
      preco: 123,
      quantidade: 10,
      compra: 2,
    });

    const lista = await listarCarrinhos(request, { _id: cenario.carrinhoId });

    expect(lista.quantidade).toBe(1);
    expect(lista.carrinhos).toHaveLength(1);
    expect(lista.carrinhos[0]._id).toBe(cenario.carrinhoId);
  });

  test('deve filtrar carrinhos por idUsuario', async ({ request }) => {
    const cenario = await prepararCarrinho(request, {
      preco: 456,
      quantidade: 10,
      compra: 1,
    });

    const lista = await listarCarrinhos(request, {
      idUsuario: cenario.usuario.id,
    });

    expect(lista.quantidade).toBe(1);
    expect(lista.carrinhos).toHaveLength(1);
    expect(lista.carrinhos[0]._id).toBe(cenario.carrinhoId);
    expect(lista.carrinhos[0].idUsuario).toBe(cenario.usuario.id);
  });

  test('deve filtrar carrinhos por precoTotal', async ({ request }) => {
    const preco = 99991;
    const compra = 3;
    const cenario = await prepararCarrinho(request, {
      preco,
      quantidade: 10,
      compra,
    });

    const precoTotalEsperado = preco * compra;
    const lista = await listarCarrinhos(request, {
      precoTotal: String(precoTotalEsperado),
    });

    expect(lista.quantidade).toBeGreaterThanOrEqual(1);
    for (const carrinho of lista.carrinhos) {
      expect(carrinho.precoTotal).toBe(precoTotalEsperado);
    }
    expect(
      lista.carrinhos.some((carrinho) => carrinho._id === cenario.carrinhoId),
    ).toBe(true);
  });

  test('deve filtrar carrinhos por quantidadeTotal', async ({ request }) => {
    const quantidadeTotal = 7;
    const cenario = await prepararCarrinho(request, {
      preco: 31,
      quantidade: 20,
      compra: quantidadeTotal,
    });

    const lista = await listarCarrinhos(request, {
      quantidadeTotal: String(quantidadeTotal),
    });

    expect(lista.quantidade).toBeGreaterThanOrEqual(1);
    for (const carrinho of lista.carrinhos) {
      expect(carrinho.quantidadeTotal).toBe(quantidadeTotal);
    }
    expect(
      lista.carrinhos.some((carrinho) => carrinho._id === cenario.carrinhoId),
    ).toBe(true);
  });

  test('deve filtrar carrinhos por precoTotal e quantidadeTotal combinados', async ({
    request,
  }) => {
    const preco = 137;
    const compra = 4;
    const cenario = await prepararCarrinho(request, {
      preco,
      quantidade: 10,
      compra,
    });

    const precoTotalEsperado = preco * compra;
    const lista = await listarCarrinhos(request, {
      precoTotal: String(precoTotalEsperado),
      quantidadeTotal: String(compra),
    });

    expect(lista.quantidade).toBeGreaterThanOrEqual(1);
    for (const carrinho of lista.carrinhos) {
      expect(carrinho.precoTotal).toBe(precoTotalEsperado);
      expect(carrinho.quantidadeTotal).toBe(compra);
    }
    expect(
      lista.carrinhos.some((carrinho) => carrinho._id === cenario.carrinhoId),
    ).toBe(true);
  });

  test('deve retornar lista vazia ao filtrar por _id inexistente', async ({
    request,
  }) => {
    const lista = await listarCarrinhos(request, { _id: gerarIdUnico() });

    expect(lista.quantidade).toBe(0);
    expect(lista.carrinhos).toHaveLength(0);
  });

  test('deve rejeitar filtro de query com chave não permitida', async ({
    request,
  }) => {
    const response = await request.get('/carrinhos', {
      params: { chave_nao_documentada: '1' },
    });

    const body = await lerJson<Record<string, string>>(response, 400);
    validarErroDeCampos(body);
    expect(body.chave_nao_documentada).toBe(
      'chave_nao_documentada não é permitido',
    );
    expect(body).not.toHaveProperty('carrinhos');
    expect(body).not.toHaveProperty('quantidade');

    await validarContrato('erros.validacao-campos', response);
  });

  test('deve consultar um carrinho por id válido com cálculos corretos', async ({
    request,
  }) => {
    const cenario = await prepararCarrinho(request, {
      preco: 250,
      quantidade: 10,
      compra: 4,
    });

    const response = await request.get(`/carrinhos/${cenario.carrinhoId}`);
    const carrinho = await lerJson<CarrinhoApi>(response, 200);

    validarCarrinho(carrinho);
    expect(carrinho._id).toBe(cenario.carrinhoId);
    expect(carrinho.idUsuario).toBe(cenario.usuario.id);
    expect(carrinho.produtos).toHaveLength(1);

    const item = carrinho.produtos[0];
    expect(item.idProduto).toBe(cenario.produto.id);
    expect(item.quantidade).toBe(cenario.item.quantidade);
    expect(item.precoUnitario).toBe(cenario.produto.preco);
    expect(carrinho.precoTotal).toBe(item.precoUnitario * item.quantidade);
    expect(carrinho.quantidadeTotal).toBe(item.quantidade);

    await validarContrato('carrinhos.item', response);
  });

  test('deve retornar erro ao consultar carrinho inexistente', async ({
    request,
  }) => {
    const response = await request.get(`/carrinhos/${gerarIdUnico()}`);

    const body = await lerJson<ErroCarrinho>(response, 400);
    expect(body.message).toBe(MENSAGEM_CARRINHO_NAO_ENCONTRADO);
    expect(body).not.toHaveProperty('carrinhos');

    await validarContrato('erros.mensagem', response);
  });

  test('deve retornar erro ao consultar carrinho com id de formato inválido', async ({
    request,
  }) => {
    const response = await request.get('/carrinhos/id-invalido');

    const body = await lerJson<ErroCarrinho>(response, 400);
    expect(body.id).toBe(MENSAGEM_ID_INVALIDO);

    await validarContrato('erros.id-invalido', response);
  });

  test('deve reduzir o estoque ao criar o carrinho consultado', async ({
    request,
  }) => {
    const estoqueInicial = 12;
    const compra = 5;
    const cenario = await prepararCarrinho(request, {
      preco: 77,
      quantidade: estoqueInicial,
      compra,
    });

    const carrinho = await obterCarrinho(request, cenario.carrinhoId);
    expect(carrinho.quantidadeTotal).toBe(compra);

    const estoqueAtual = await obterEstoque(request, cenario.produto.id);
    expect(estoqueAtual).toBe(estoqueInicial - compra);
  });
});
