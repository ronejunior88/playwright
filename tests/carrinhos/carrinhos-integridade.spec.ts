import { expect, test } from '../fixtures';
import {
  cancelarCompra,
  concluirCompra,
  criarCarrinhoTeste,
  listarCarrinhos,
  MENSAGEM_CANCELAMENTO_SUCESSO,
  MENSAGEM_CARRINHO_NAO_ENCONTRADO,
  MENSAGEM_USUARIO_SEM_CARRINHO,
  obterCarrinho,
  obterEstoque,
  type ErroCarrinho,
} from '../helpers/carrinhos';
import {
  type ContextoCarrinhos,
  criarContextoCarrinhos,
} from '../helpers/cenario-carrinhos';
import { validarContrato } from '../helpers/contratos';
import {
  lerJson,
  MENSAGEM_EXCLUIDO_SUCESSO,
  type MensagemResposta,
} from '../helpers/resposta';

test.describe('Integridade e regras de negócio - carrinhos', () => {
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

  test('deve executar o fluxo completo de compra concluída @critico', async ({
    request,
  }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 137, quantidade: 8 });
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
    const corpoConclusao = await lerJson<MensagemResposta>(conclusao, 200);
    expect(corpoConclusao.message).toBe(MENSAGEM_EXCLUIDO_SUCESSO);
    await validarContrato('carrinhos.conclusao', conclusao);

    const consulta = await request.get(`/carrinhos/${carrinhoId}`);
    const corpoConsulta = await lerJson<ErroCarrinho>(consulta, 400);
    expect(corpoConsulta.message).toBe(MENSAGEM_CARRINHO_NAO_ENCONTRADO);

    const estoqueFinal = await obterEstoque(request, produto.id);
    expect(estoqueFinal).toBe(estoqueAposCriar);
    expect(estoqueFinal).toBe(estoqueInicial - 3);
  });

  test('deve executar o fluxo completo de compra cancelada', async ({
    request,
  }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 148, quantidade: 9 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const carrinhoId = await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 4 },
    ]);

    const estoqueAposCriar = await obterEstoque(request, produto.id);
    expect(estoqueAposCriar).toBe(estoqueInicial - 4);

    const cancelamento = await cancelarCompra(request, conta.token);
    const corpoCancelamento = await lerJson<MensagemResposta>(cancelamento, 200);
    expect(corpoCancelamento.message).toBe(MENSAGEM_CANCELAMENTO_SUCESSO);
    await validarContrato('carrinhos.cancelamento', cancelamento);

    const consulta = await request.get(`/carrinhos/${carrinhoId}`);
    await lerJson<ErroCarrinho>(consulta, 400);

    const estoqueFinal = await obterEstoque(request, produto.id);
    expect(estoqueFinal).toBe(estoqueInicial);
  });

  test('deve associar o carrinho ao usuário do token e isolar operações', async ({
    request,
  }) => {
    const contaA = await contexto.novaConta(request);
    const contaB = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 159, quantidade: 10 });

    const carrinhoIdA = await criarCarrinhoTeste(request, contaA.token, [
      { idProduto: produto.id, quantidade: 2 },
    ]);

    const carrinhoA = await obterCarrinho(request, carrinhoIdA);
    expect(carrinhoA.idUsuario).toBe(contaA.usuario.id);

    const conclusaoB = await concluirCompra(request, contaB.token);
    const corpoConclusaoB = await lerJson<MensagemResposta>(conclusaoB, 200);
    expect(corpoConclusaoB.message).toBe(MENSAGEM_USUARIO_SEM_CARRINHO);

    const carrinhoAposConclusaoB = await obterCarrinho(request, carrinhoIdA);
    expect(carrinhoAposConclusaoB._id).toBe(carrinhoIdA);
    expect(carrinhoAposConclusaoB.idUsuario).toBe(contaA.usuario.id);

    const cancelamentoB = await cancelarCompra(request, contaB.token);
    const corpoCancelamentoB = await lerJson<MensagemResposta>(cancelamentoB, 200);
    expect(corpoCancelamentoB.message).toBe(MENSAGEM_USUARIO_SEM_CARRINHO);

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
    const conta = await contexto.novaConta(request);
    const produtoA = await contexto.novoProduto(request, { preco: 100, quantidade: 10 });
    const produtoB = await contexto.novoProduto(request, { preco: 250, quantidade: 8 });
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
    const corpoCancelamento = await lerJson<MensagemResposta>(cancelamento, 200);
    expect(corpoCancelamento.message).toBe(MENSAGEM_CANCELAMENTO_SUCESSO);
    await validarContrato('carrinhos.cancelamento', cancelamento);

    expect(await obterEstoque(request, produtoA.id)).toBe(estoqueInicialA);
    expect(await obterEstoque(request, produtoB.id)).toBe(estoqueInicialB);
  });
});
