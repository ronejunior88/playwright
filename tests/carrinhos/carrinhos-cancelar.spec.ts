import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  cancelarCompra,
  cancelarCompraSeguro,
  criarCarrinhoTeste,
  criarUsuarioAutenticado,
  listarCarrinhos,
  MENSAGEM_CANCELAMENTO_SUCESSO,
  MENSAGEM_CARRINHO_NAO_ENCONTRADO,
  MENSAGEM_TOKEN_CARRINHO,
  MENSAGEM_USUARIO_SEM_CARRINHO,
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
  type UsuarioCriado,
} from '../helpers/usuarios';

interface ContaAutenticada {
  usuario: UsuarioCriado;
  token: string;
}

test.describe('Cancelamento de compra - DELETE /carrinhos/cancelar-compra', () => {
  // Serial: a API permite apenas 1 carrinho ativo por usuário e o afterEach
  // cancela os carrinhos de todas as contas do bloco; em paralelo, um teste
  // cancelaria o carrinho de outro. A serialização é o que garante o isolamento.
  test.describe.configure({ mode: 'serial' });

  let admin: UsuarioCriado;
  let tokenAdmin: string;
  const contas: ContaAutenticada[] = [];
  const produtosCriados: ProdutoCriado[] = [];

  test.beforeAll(async ({ request }) => {
    const conta = await criarUsuarioAutenticado(request, 'true');
    admin = conta.usuario;
    tokenAdmin = conta.token;
  });

  test.afterEach(async ({ request }) => {
    for (const conta of contas) {
      await cancelarCompraSeguro(request, conta.token);
    }
  });

  test.afterAll(async ({ request }) => {
    for (const conta of contas) {
      await cancelarCompraSeguro(request, conta.token);
    }
    for (const produto of produtosCriados) {
      await excluirProduto(request, tokenAdmin, produto.id);
    }
    for (const conta of contas) {
      await excluirUsuario(request, conta.usuario.id);
    }
    await excluirUsuario(request, admin.id);
  });

  async function novaConta(
    request: APIRequestContext,
  ): Promise<ContaAutenticada> {
    const conta = await criarUsuarioAutenticado(request, 'false');
    contas.push(conta);
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

  test('deve cancelar a compra, remover o carrinho e repor o estoque', async ({
    request,
  }) => {
    const conta = await novaConta(request);
    const produto = await novoProduto(request, { preco: 111, estoque: 10 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const carrinhoId = await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 3 },
    ]);
    const estoqueAposCriar = await obterEstoque(request, produto.id);
    expect(estoqueAposCriar).toBe(estoqueInicial - 3);

    const response = await cancelarCompra(request, conta.token);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as MensagemCarrinho;
    expect(body.message).toBe(MENSAGEM_CANCELAMENTO_SUCESSO);

    const consulta = await request.get(`/carrinhos/${carrinhoId}`);
    expect(consulta.status()).toBe(400);
    const corpoConsulta = (await consulta.json()) as ErroCarrinho;
    expect(corpoConsulta.message).toBe(MENSAGEM_CARRINHO_NAO_ENCONTRADO);

    const lista = await listarCarrinhos(request, {
      idUsuario: conta.usuario.id,
    });
    expect(lista.quantidade).toBe(0);

    const estoqueFinal = await obterEstoque(request, produto.id);
    expect(estoqueFinal).toBe(estoqueInicial);
  });

  test('deve retornar mensagem quando não existe carrinho para o usuário', async ({
    request,
  }) => {
    const conta = await novaConta(request);

    const response = await cancelarCompra(request, conta.token);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as MensagemCarrinho;
    expect(body.message).toBe(MENSAGEM_USUARIO_SEM_CARRINHO);
  });

  test('deve rejeitar o cancelamento sem token de autorização', async ({
    request,
  }) => {
    const response = await request.delete('/carrinhos/cancelar-compra');

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as ErroCarrinho;
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);
  });

  test('deve rejeitar o cancelamento com token inválido', async ({
    request,
  }) => {
    const response = await request.delete('/carrinhos/cancelar-compra', {
      headers: { Authorization: bearer('token-invalido') },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as ErroCarrinho;
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);
  });

  test('não deve repor o estoque duas vezes ao cancelar novamente', async ({
    request,
  }) => {
    const conta = await novaConta(request);
    const produto = await novoProduto(request, { preco: 112, estoque: 10 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 4 },
    ]);
    const estoqueAposCriar = await obterEstoque(request, produto.id);
    expect(estoqueAposCriar).toBe(estoqueInicial - 4);

    const primeiro = await cancelarCompra(request, conta.token);
    expect(primeiro.status()).toBe(200);
    expect(((await primeiro.json()) as MensagemCarrinho).message).toBe(
      MENSAGEM_CANCELAMENTO_SUCESSO,
    );
    expect(await obterEstoque(request, produto.id)).toBe(estoqueInicial);

    const segundo = await cancelarCompra(request, conta.token);
    expect(segundo.status()).toBe(200);
    expect(((await segundo.json()) as MensagemCarrinho).message).toBe(
      MENSAGEM_USUARIO_SEM_CARRINHO,
    );

    expect(await obterEstoque(request, produto.id)).toBe(estoqueInicial);
  });
});
