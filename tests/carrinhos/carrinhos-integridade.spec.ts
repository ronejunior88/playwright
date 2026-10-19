import { type APIRequestContext } from '@playwright/test';
import { expect, test } from '../fixtures';
import {
  cancelarCompra,
  cancelarCompraSeguro,
  concluirCompra,
  criarCarrinhoTeste,
  criarUsuarioAutenticado,
  listarCarrinhos,
  MENSAGEM_CANCELAMENTO_SUCESSO,
  MENSAGEM_CARRINHO_NAO_ENCONTRADO,
  MENSAGEM_CONCLUSAO_SUCESSO,
  MENSAGEM_USUARIO_SEM_CARRINHO,
  obterCarrinho,
  obterEstoque,
  type ErroCarrinho,
  type MensagemCarrinho,
} from '../helpers/carrinhos';
import {
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

test.describe('Integridade e regras de negócio - carrinhos', () => {
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

  test('deve executar o fluxo completo de compra concluída', async ({
    request,
  }) => {
    const conta = await novaConta(request);
    const produto = await novoProduto(request, { preco: 137, estoque: 8 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const carrinhoId = await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 3 },
    ]);

    const estoqueAposCriar = await obterEstoque(request, produto.id);
    expect(estoqueAposCriar).toBe(estoqueInicial - 3);

    const carrinho = await obterCarrinho(request, carrinhoId);
    expect(carrinho.idUsuario).toBe(conta.usuario.id);
    expect(carrinho.quantidadeTotal).toBe(3);

    const conclusao = await concluirCompra(request, conta.token);
    expect(conclusao.status()).toBe(200);
    expect(((await conclusao.json()) as MensagemCarrinho).message).toBe(
      MENSAGEM_CONCLUSAO_SUCESSO,
    );

    const consulta = await request.get(`/carrinhos/${carrinhoId}`);
    expect(consulta.status()).toBe(400);
    expect(((await consulta.json()) as ErroCarrinho).message).toBe(
      MENSAGEM_CARRINHO_NAO_ENCONTRADO,
    );

    const estoqueFinal = await obterEstoque(request, produto.id);
    expect(estoqueFinal).toBe(estoqueAposCriar);
    expect(estoqueFinal).toBe(estoqueInicial - 3);
  });

  test('deve executar o fluxo completo de compra cancelada', async ({
    request,
  }) => {
    const conta = await novaConta(request);
    const produto = await novoProduto(request, { preco: 148, estoque: 9 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const carrinhoId = await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 4 },
    ]);

    const estoqueAposCriar = await obterEstoque(request, produto.id);
    expect(estoqueAposCriar).toBe(estoqueInicial - 4);

    const cancelamento = await cancelarCompra(request, conta.token);
    expect(cancelamento.status()).toBe(200);
    expect(((await cancelamento.json()) as MensagemCarrinho).message).toBe(
      MENSAGEM_CANCELAMENTO_SUCESSO,
    );

    const consulta = await request.get(`/carrinhos/${carrinhoId}`);
    expect(consulta.status()).toBe(400);

    const estoqueFinal = await obterEstoque(request, produto.id);
    expect(estoqueFinal).toBe(estoqueInicial);
  });

  test('deve associar o carrinho ao usuário do token e isolar operações', async ({
    request,
  }) => {
    const contaA = await novaConta(request);
    const contaB = await novaConta(request);
    const produto = await novoProduto(request, { preco: 159, estoque: 10 });

    const carrinhoIdA = await criarCarrinhoTeste(request, contaA.token, [
      { idProduto: produto.id, quantidade: 2 },
    ]);

    const carrinhoA = await obterCarrinho(request, carrinhoIdA);
    expect(carrinhoA.idUsuario).toBe(contaA.usuario.id);

    const conclusaoB = await concluirCompra(request, contaB.token);
    expect(conclusaoB.status()).toBe(200);
    expect(((await conclusaoB.json()) as MensagemCarrinho).message).toBe(
      MENSAGEM_USUARIO_SEM_CARRINHO,
    );

    const carrinhoAposConclusaoB = await obterCarrinho(request, carrinhoIdA);
    expect(carrinhoAposConclusaoB._id).toBe(carrinhoIdA);
    expect(carrinhoAposConclusaoB.idUsuario).toBe(contaA.usuario.id);

    const cancelamentoB = await cancelarCompra(request, contaB.token);
    expect(cancelamentoB.status()).toBe(200);
    expect(((await cancelamentoB.json()) as MensagemCarrinho).message).toBe(
      MENSAGEM_USUARIO_SEM_CARRINHO,
    );

    const carrinhoAposCancelamentoB = await obterCarrinho(request, carrinhoIdA);
    expect(carrinhoAposCancelamentoB._id).toBe(carrinhoIdA);

    const listaA = await listarCarrinhos(request, {
      idUsuario: contaA.usuario.id,
    });
    expect(listaA.quantidade).toBe(1);
  });

  test('deve validar quantidade, preço e reposição individual com múltiplos produtos', async ({
    request,
  }) => {
    const conta = await novaConta(request);
    const produtoA = await novoProduto(request, { preco: 100, estoque: 10 });
    const produtoB = await novoProduto(request, { preco: 250, estoque: 8 });
    const estoqueInicialA = await obterEstoque(request, produtoA.id);
    const estoqueInicialB = await obterEstoque(request, produtoB.id);

    const carrinhoId = await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produtoA.id, quantidade: 3 },
      { idProduto: produtoB.id, quantidade: 2 },
    ]);

    const carrinho = await obterCarrinho(request, carrinhoId);
    expect(carrinho.produtos).toHaveLength(2);

    const itemA = carrinho.produtos.find((i) => i.idProduto === produtoA.id);
    const itemB = carrinho.produtos.find((i) => i.idProduto === produtoB.id);
    expect(itemA).toBeDefined();
    expect(itemB).toBeDefined();
    expect(itemA!.quantidade).toBe(3);
    expect(itemA!.precoUnitario).toBe(produtoA.preco);
    expect(itemB!.quantidade).toBe(2);
    expect(itemB!.precoUnitario).toBe(produtoB.preco);

    expect(carrinho.quantidadeTotal).toBe(5);
    expect(carrinho.precoTotal).toBe(
      produtoA.preco * 3 + produtoB.preco * 2,
    );

    expect(await obterEstoque(request, produtoA.id)).toBe(estoqueInicialA - 3);
    expect(await obterEstoque(request, produtoB.id)).toBe(estoqueInicialB - 2);

    const cancelamento = await cancelarCompra(request, conta.token);
    expect(cancelamento.status()).toBe(200);
    expect(((await cancelamento.json()) as MensagemCarrinho).message).toBe(
      MENSAGEM_CANCELAMENTO_SUCESSO,
    );

    expect(await obterEstoque(request, produtoA.id)).toBe(estoqueInicialA);
    expect(await obterEstoque(request, produtoB.id)).toBe(estoqueInicialB);
  });
});
