import { expect, test } from '../fixtures';
import { bearer } from '../helpers/autenticacao';
import {
  cancelarCompra,
  criarCarrinhoTeste,
  listarCarrinhos,
  MENSAGEM_CANCELAMENTO_SUCESSO,
  MENSAGEM_CARRINHO_NAO_ENCONTRADO,
  MENSAGEM_TOKEN_CARRINHO,
  MENSAGEM_USUARIO_SEM_CARRINHO,
  obterEstoque,
  type ErroCarrinho,
} from '../helpers/carrinhos';
import {
  type ContextoCarrinhos,
  criarContextoCarrinhos,
} from '../helpers/cenario-carrinhos';
import { validarContrato } from '../helpers/contratos';
import { lerJson, type MensagemResposta } from '../helpers/resposta';

test.describe('Cancelamento de compra - DELETE /carrinhos/cancelar-compra', () => {
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

  test('deve cancelar a compra, remover o carrinho e repor o estoque @critico', async ({
    request,
  }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 111, quantidade: 10 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    const carrinhoId = await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 3 },
    ]);
    const estoqueAposCriar = await obterEstoque(request, produto.id);
    expect(estoqueAposCriar).toBe(estoqueInicial - 3);

    const response = await cancelarCompra(request, conta.token);

    const body = await lerJson<MensagemResposta>(response, 200);
    expect(body.message).toBe(MENSAGEM_CANCELAMENTO_SUCESSO);

    await validarContrato('carrinhos.cancelamento', response);

    const consulta = await request.get(`/carrinhos/${carrinhoId}`);
    const corpoConsulta = await lerJson<ErroCarrinho>(consulta, 400);
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
    const conta = await contexto.novaConta(request);

    const response = await cancelarCompra(request, conta.token);

    const body = await lerJson<MensagemResposta>(response, 200);
    expect(body.message).toBe(MENSAGEM_USUARIO_SEM_CARRINHO);

    await validarContrato('carrinhos.cancelamento', response);
  });

  test('deve rejeitar o cancelamento sem token de autorização', async ({
    request,
  }) => {
    const response = await request.delete('/carrinhos/cancelar-compra');

    const body = await lerJson<ErroCarrinho>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);

    await validarContrato('auth.sem-token', response);
  });

  test('deve rejeitar o cancelamento com token inválido', async ({
    request,
  }) => {
    const response = await request.delete('/carrinhos/cancelar-compra', {
      headers: { Authorization: bearer('token-invalido') },
    });

    const body = await lerJson<ErroCarrinho>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);

    await validarContrato('auth.sem-token', response);
  });

  test('não deve repor o estoque duas vezes ao cancelar novamente @critico', async ({
    request,
  }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 112, quantidade: 10 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 4 },
    ]);
    const estoqueAposCriar = await obterEstoque(request, produto.id);
    expect(estoqueAposCriar).toBe(estoqueInicial - 4);

    const primeiro = await cancelarCompra(request, conta.token);
    const corpoPrimeiro = await lerJson<MensagemResposta>(primeiro, 200);
    expect(corpoPrimeiro.message).toBe(MENSAGEM_CANCELAMENTO_SUCESSO);
    await validarContrato('carrinhos.cancelamento', primeiro);
    expect(await obterEstoque(request, produto.id)).toBe(estoqueInicial);

    const segundo = await cancelarCompra(request, conta.token);
    const corpoSegundo = await lerJson<MensagemResposta>(segundo, 200);
    expect(corpoSegundo.message).toBe(MENSAGEM_USUARIO_SEM_CARRINHO);
    await validarContrato('carrinhos.cancelamento', segundo);

    expect(await obterEstoque(request, produto.id)).toBe(estoqueInicial);
  });
});
