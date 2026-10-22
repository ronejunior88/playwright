import { type APIRequestContext } from '@playwright/test';
import { expect, test } from '../fixtures';
import {
  validarCarrinho,
  validarErroDeCampos,
  validarListaCarrinhos,
} from '../helpers/contrato';
import { validarContrato } from '../helpers/contratos';
import {
  cancelarCompraSeguro,
  criarCarrinhoTeste,
  criarUsuarioAutenticado,
  listarCarrinhos,
  MENSAGEM_CARRINHO_NAO_ENCONTRADO,
  MENSAGEM_ID_INVALIDO_CARRINHO,
  obterCarrinho,
  obterEstoque,
  type CarrinhoApi,
  type ErroCarrinho,
  type ItemCarrinho,
  type ListaCarrinhos,
} from '../helpers/carrinhos';
import {
  criarProdutoTeste,
  excluirProduto,
  type ProdutoCriado,
} from '../helpers/produtos';
import {
  excluirUsuario,
  gerarIdUnico,
  type UsuarioCriado,
} from '../helpers/usuarios';

test.describe('Consulta de carrinhos - GET /carrinhos', () => {
  // Serial: a API permite apenas 1 carrinho ativo por usuário e o afterEach
  // cancela os carrinhos de todas as contas do bloco; em paralelo, um teste
  // cancelaria o carrinho de outro. A serialização é o que garante o isolamento.
  test.describe.configure({ mode: 'serial' });

  interface ContaAutenticada {
    usuario: UsuarioCriado;
    token: string;
  }

  interface CenarioCarrinho extends ContaAutenticada {
    produto: ProdutoCriado;
    item: ItemCarrinho;
    carrinhoId: string;
  }

  let admin: UsuarioCriado;
  let tokenAdmin: string;
  const contasCriadas: ContaAutenticada[] = [];
  let contasDoTeste: ContaAutenticada[] = [];
  const produtosCriados: ProdutoCriado[] = [];

  test.beforeAll(async ({ request }) => {
    const conta = await criarUsuarioAutenticado(request, 'true');
    admin = conta.usuario;
    tokenAdmin = conta.token;
  });

  test.beforeEach(() => {
    contasDoTeste = [];
  });

  test.afterEach(async ({ request }) => {
    for (const conta of contasDoTeste) {
      await cancelarCompraSeguro(request, conta.token);
    }
  });

  test.afterAll(async ({ request }) => {
    for (const conta of contasCriadas) {
      await cancelarCompraSeguro(request, conta.token);
    }
    for (const produto of produtosCriados) {
      await excluirProduto(request, tokenAdmin, produto.id);
    }
    for (const conta of contasCriadas) {
      await excluirUsuario(request, conta.usuario.id);
    }
    await excluirUsuario(request, admin.id);
  });

  async function prepararCarrinho(
    request: APIRequestContext,
    opcoes: { preco: number; estoque: number; compra: number },
  ): Promise<CenarioCarrinho> {
    const conta = await criarUsuarioAutenticado(request, 'false');
    const produto = await criarProdutoTeste(request, tokenAdmin, {
      preco: opcoes.preco,
      quantidade: opcoes.estoque,
    });

    contasCriadas.push(conta);
    contasDoTeste.push(conta);
    produtosCriados.push(produto);

    const item: ItemCarrinho = {
      idProduto: produto.id,
      quantidade: opcoes.compra,
    };
    const carrinhoId = await criarCarrinhoTeste(request, conta.token, [item]);

    return { ...conta, produto, item, carrinhoId };
  }

  test('deve listar carrinhos com estrutura válida', async ({ request }) => {
    const response = await request.get('/carrinhos');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const lista = (await response.json()) as ListaCarrinhos;

    expect(typeof lista.quantidade).toBe('number');
    expect(Array.isArray(lista.carrinhos)).toBe(true);
    expect(lista.quantidade).toBe(lista.carrinhos.length);

    validarListaCarrinhos(lista);

    await validarContrato('carrinhos.lista', response);
  });

  test('deve filtrar carrinhos por _id', async ({ request }) => {
    const cenario = await prepararCarrinho(request, {
      preco: 123,
      estoque: 10,
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
      estoque: 10,
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
      estoque: 10,
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
      estoque: 20,
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
      estoque: 10,
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

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as Record<string, string>;
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
      estoque: 10,
      compra: 4,
    });

    const response = await request.get(`/carrinhos/${cenario.carrinhoId}`);
    expect(response.status()).toBe(200);

    const carrinho = (await response.json()) as CarrinhoApi;

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

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as ErroCarrinho;
    expect(body.message).toBe(MENSAGEM_CARRINHO_NAO_ENCONTRADO);
    expect(body).not.toHaveProperty('carrinhos');

    await validarContrato('erros.mensagem', response);
  });

  test('deve retornar erro ao consultar carrinho com id de formato inválido', async ({
    request,
  }) => {
    const response = await request.get('/carrinhos/id-invalido');

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as ErroCarrinho;
    expect(body.id).toBe(MENSAGEM_ID_INVALIDO_CARRINHO);

    await validarContrato('erros.id-invalido', response);
  });

  test('deve reduzir o estoque ao criar o carrinho consultado', async ({
    request,
  }) => {
    const estoqueInicial = 12;
    const compra = 5;
    const cenario = await prepararCarrinho(request, {
      preco: 77,
      estoque: estoqueInicial,
      compra,
    });

    const carrinho = await obterCarrinho(request, cenario.carrinhoId);
    expect(carrinho.quantidadeTotal).toBe(compra);

    const estoqueAtual = await obterEstoque(request, cenario.produto.id);
    expect(estoqueAtual).toBe(estoqueInicial - compra);
  });
});
