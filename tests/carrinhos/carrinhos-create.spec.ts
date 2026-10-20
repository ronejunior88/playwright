import { type APIRequestContext } from '@playwright/test';
import { expect, test } from '../fixtures';
import {
  cancelarCompraSeguro,
  CASOS_PAYLOAD_CARRINHO_INVALIDO,
  criarCarrinhoTeste,
  criarUsuarioAutenticado,
  listarCarrinhos,
  MENSAGEM_ESTOQUE_INSUFICIENTE,
  MENSAGEM_PRODUTO_DUPLICADO,
  MENSAGEM_PRODUTO_INEXISTENTE,
  MENSAGEM_SEGUNDO_CARRINHO,
  MENSAGEM_TOKEN_CARRINHO,
  obterCarrinho,
  obterEstoque,
  type ErroCarrinho,
  type MensagemCarrinho,
} from '../helpers/carrinhos';
import {
  bearer,
  criarProdutoTeste,
  excluirProduto,
  type ProdutoCriado,
} from '../helpers/produtos';
import {
  excluirUsuario,
  gerarIdUnico,
  type UsuarioCriado,
} from '../helpers/usuarios';

interface ContaAutenticada {
  usuario: UsuarioCriado;
  token: string;
}

test.describe('Criação de carrinhos - POST /carrinhos', () => {
  // Serial: a API permite apenas 1 carrinho ativo por usuário e o afterEach
  // cancela os carrinhos de todas as contas do bloco; em paralelo, um teste
  // cancelaria o carrinho de outro. A serialização é o que garante o isolamento.
  test.describe.configure({ mode: 'serial' });

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

  async function novaConta(
    request: APIRequestContext,
  ): Promise<ContaAutenticada> {
    const conta = await criarUsuarioAutenticado(request, 'false');
    contasCriadas.push(conta);
    contasDoTeste.push(conta);
    return conta;
  }

  async function novoProduto(
    request: APIRequestContext,
    opcoes: { preco: number; estoque: number },
  ): Promise<ProdutoCriado> {
    const produto = await criarProdutoTeste(request, tokenAdmin, {
      preco: opcoes.preco,
      quantidade: opcoes.estoque,
    });
    produtosCriados.push(produto);
    return produto;
  }

  test('deve criar um carrinho e reduzir o estoque exatamente pela quantidade', async ({
    request,
  }) => {
    const conta = await novaConta(request);
    const produto = await novoProduto(request, { preco: 111, estoque: 10 });
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
    const conta = await novaConta(request);
    const produto = await novoProduto(request, { preco: 120, estoque: 5 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const response = await request.post('/carrinhos', {
      data: { produtos: [{ idProduto: produto.id, quantidade: 1 }] },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as ErroCarrinho;
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);

    const lista = await listarCarrinhos(request, { idUsuario: conta.usuario.id });
    expect(lista.quantidade).toBe(0);
    expect(await obterEstoque(request, produto.id)).toBe(estoqueInicial);
  });

  test('deve rejeitar a criação com token inválido', async ({ request }) => {
    const conta = await novaConta(request);
    const produto = await novoProduto(request, { preco: 130, estoque: 5 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const response = await request.post('/carrinhos', {
      data: { produtos: [{ idProduto: produto.id, quantidade: 1 }] },
      headers: { Authorization: bearer('token-invalido') },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as ErroCarrinho;
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);

    const lista = await listarCarrinhos(request, { idUsuario: conta.usuario.id });
    expect(lista.quantidade).toBe(0);
    expect(await obterEstoque(request, produto.id)).toBe(estoqueInicial);
  });

  test('deve rejeitar a criação de um segundo carrinho para o mesmo usuário', async ({
    request,
  }) => {
    const conta = await novaConta(request);
    const produto = await novoProduto(request, { preco: 140, estoque: 10 });
    const produto2 = await novoProduto(request, { preco: 150, estoque: 10 });

    const carrinhoId = await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 1 },
    ]);
    const estoque2Inicial = await obterEstoque(request, produto2.id);

    const response = await request.post('/carrinhos', {
      data: { produtos: [{ idProduto: produto2.id, quantidade: 1 }] },
      headers: { Authorization: bearer(conta.token) },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as ErroCarrinho;
    expect(body.message).toBe(MENSAGEM_SEGUNDO_CARRINHO);

    const carrinhoOriginal = await obterCarrinho(request, carrinhoId);
    expect(carrinhoOriginal.produtos[0].idProduto).toBe(produto.id);

    const lista = await listarCarrinhos(request, { idUsuario: conta.usuario.id });
    expect(lista.quantidade).toBe(1);
    expect(await obterEstoque(request, produto2.id)).toBe(estoque2Inicial);
  });

  test('deve rejeitar produto duplicado no mesmo carrinho', async ({
    request,
  }) => {
    const conta = await novaConta(request);
    const produto = await novoProduto(request, { preco: 160, estoque: 10 });
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

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as ErroCarrinho;
    expect(body.message).toBe(MENSAGEM_PRODUTO_DUPLICADO);
    expect(body.idProdutosDuplicados).toContain(produto.id);

    const lista = await listarCarrinhos(request, { idUsuario: conta.usuario.id });
    expect(lista.quantidade).toBe(0);
    expect(await obterEstoque(request, produto.id)).toBe(estoqueInicial);
  });

  test('deve rejeitar produto inexistente', async ({ request }) => {
    const conta = await novaConta(request);
    const idInexistente = gerarIdUnico();

    const response = await request.post('/carrinhos', {
      data: { produtos: [{ idProduto: idInexistente, quantidade: 1 }] },
      headers: { Authorization: bearer(conta.token) },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as ErroCarrinho;
    expect(body.message).toBe(MENSAGEM_PRODUTO_INEXISTENTE);
    expect(body.item?.idProduto).toBe(idInexistente);
    expect(body.item?.quantidade).toBe(1);
    expect(body.item?.index).toBe(0);

    const lista = await listarCarrinhos(request, { idUsuario: conta.usuario.id });
    expect(lista.quantidade).toBe(0);
  });

  test('deve rejeitar quantidade superior ao estoque disponível', async ({
    request,
  }) => {
    const conta = await novaConta(request);
    const produto = await novoProduto(request, { preco: 170, estoque: 3 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const response = await request.post('/carrinhos', {
      data: {
        produtos: [{ idProduto: produto.id, quantidade: estoqueInicial + 5 }],
      },
      headers: { Authorization: bearer(conta.token) },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as ErroCarrinho;
    expect(body.message).toBe(MENSAGEM_ESTOQUE_INSUFICIENTE);
    expect(body.item?.idProduto).toBe(produto.id);
    expect(body.item?.quantidadeEstoque).toBe(estoqueInicial);

    const lista = await listarCarrinhos(request, { idUsuario: conta.usuario.id });
    expect(lista.quantidade).toBe(0);
    expect(await obterEstoque(request, produto.id)).toBe(estoqueInicial);
  });
});

test.describe('Criação de carrinhos - payloads inválidos - POST /carrinhos', () => {
  let admin: UsuarioCriado;
  let tokenAdmin: string;
  let conta: ContaAutenticada;
  let produto: ProdutoCriado;

  test.beforeAll(async ({ request }) => {
    const adminConta = await criarUsuarioAutenticado(request, 'true');
    admin = adminConta.usuario;
    tokenAdmin = adminConta.token;
    conta = await criarUsuarioAutenticado(request, 'false');
    produto = await criarProdutoTeste(request, tokenAdmin, {
      preco: 200,
      quantidade: 20,
    });
  });

  test.afterAll(async ({ request }) => {
    await cancelarCompraSeguro(request, conta.token);
    await excluirProduto(request, tokenAdmin, produto.id);
    await excluirUsuario(request, conta.usuario.id);
    await excluirUsuario(request, admin.id);
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

      expect(response.status()).toBe(400);
      expect(response.headers()['content-type'] ?? '').toContain(
        'application/json',
      );

      const body = (await response.json()) as ErroCarrinho;
      expect(body).toMatchObject(caso.corpoEsperado);
      expect(body).not.toHaveProperty('_id');

      const lista = await listarCarrinhos(request, {
        idUsuario: conta.usuario.id,
      });
      expect(lista.quantidade).toBe(0);
      expect(await obterEstoque(request, produto.id)).toBe(estoqueAntes);
    });
  }
});

test.describe('Criação de carrinhos - corpo de sucesso - POST /carrinhos', () => {
  test('deve retornar mensagem e _id no cadastro', async ({ request }) => {
    const adminConta = await criarUsuarioAutenticado(request, 'true');
    const conta = await criarUsuarioAutenticado(request, 'false');
    const produto = await criarProdutoTeste(request, adminConta.token, {
      preco: 210,
      quantidade: 4,
    });

    try {
      const response = await request.post('/carrinhos', {
        data: { produtos: [{ idProduto: produto.id, quantidade: 1 }] },
        headers: { Authorization: bearer(conta.token) },
      });

      expect(response.status()).toBe(201);
      expect(response.headers()['content-type'] ?? '').toContain(
        'application/json',
      );

      const body = (await response.json()) as MensagemCarrinho;
      expect(body.message).toBe('Cadastro realizado com sucesso');
      expect(typeof body._id).toBe('string');
      expect(body._id!.length).toBeGreaterThan(0);
    } finally {
      await cancelarCompraSeguro(request, conta.token);
      await excluirProduto(request, adminConta.token, produto.id);
      await excluirUsuario(request, conta.usuario.id);
      await excluirUsuario(request, adminConta.usuario.id);
    }
  });
});
