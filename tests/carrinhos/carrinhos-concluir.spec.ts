import { expect, test } from '../fixtures';
import { bearer } from '../helpers/autenticacao';
import {
  concluirCompra,
  criarCarrinhoTeste,
  listarCarrinhos,
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
import {
  lerJson,
  MENSAGEM_EXCLUIDO_SUCESSO,
  type MensagemResposta,
} from '../helpers/resposta';

test.describe('Conclusão de compra - DELETE /carrinhos/concluir-compra', () => {
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

  test('deve concluir a compra, remover o carrinho e manter o estoque reduzido @critico', async ({
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

    const response = await concluirCompra(request, conta.token);

    const body = await lerJson<MensagemResposta>(response, 200);
    expect(body.message).toBe(MENSAGEM_EXCLUIDO_SUCESSO);

    await validarContrato('carrinhos.conclusao', response);

    const consulta = await request.get(`/carrinhos/${carrinhoId}`);
    const corpoConsulta = await lerJson<ErroCarrinho>(consulta, 400);
    expect(corpoConsulta.message).toBe(MENSAGEM_CARRINHO_NAO_ENCONTRADO);

    const lista = await listarCarrinhos(request, {
      idUsuario: conta.usuario.id,
    });
    expect(lista.quantidade).toBe(0);

    const estoqueFinal = await obterEstoque(request, produto.id);
    expect(estoqueFinal).toBe(estoqueAposCriar);
  });

  test('deve retornar mensagem quando não existe carrinho para o usuário', async ({
    request,
  }) => {
    const conta = await contexto.novaConta(request);

    const response = await concluirCompra(request, conta.token);

    const body = await lerJson<MensagemResposta>(response, 200);
    expect(body.message).toBe(MENSAGEM_USUARIO_SEM_CARRINHO);

    await validarContrato('carrinhos.conclusao', response);
  });

  test('deve rejeitar a conclusão sem token de autorização', async ({
    request,
  }) => {
    const response = await request.delete('/carrinhos/concluir-compra');

    const body = await lerJson<ErroCarrinho>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);

    await validarContrato('auth.sem-token', response);
  });

  test('deve rejeitar a conclusão com token inválido', async ({ request }) => {
    const response = await request.delete('/carrinhos/concluir-compra', {
      headers: { Authorization: bearer('token-invalido') },
    });

    const body = await lerJson<ErroCarrinho>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);

    await validarContrato('auth.sem-token', response);
  });

  test('deve rejeitar a conclusão com Authorization malformado (token sem prefixo Bearer)', async ({
    request,
  }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 113, quantidade: 5 });

    await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 1 },
    ]);
    const estoqueAposCriar = await obterEstoque(request, produto.id);

    const response = await request.delete('/carrinhos/concluir-compra', {
      headers: { Authorization: conta.token },
    });

    const body = await lerJson<ErroCarrinho>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);

    await validarContrato('auth.sem-token', response);

    const lista = await listarCarrinhos(request, {
      idUsuario: conta.usuario.id,
    });
    expect(lista.quantidade).toBe(1);
    expect(await obterEstoque(request, produto.id)).toBe(estoqueAposCriar);
  });

  test('não deve concluir a mesma compra duas vezes', async ({ request }) => {
    const conta = await contexto.novaConta(request);
    const produto = await contexto.novoProduto(request, { preco: 112, quantidade: 10 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 2 },
    ]);
    const estoqueAposCriar = await obterEstoque(request, produto.id);

    const primeira = await concluirCompra(request, conta.token);
    const corpoPrimeira = await lerJson<MensagemResposta>(primeira, 200);
    expect(corpoPrimeira.message).toBe(MENSAGEM_EXCLUIDO_SUCESSO);
    await validarContrato('carrinhos.conclusao', primeira);

    const segunda = await concluirCompra(request, conta.token);
    const corpoSegunda = await lerJson<MensagemResposta>(segunda, 200);
    expect(corpoSegunda.message).toBe(MENSAGEM_USUARIO_SEM_CARRINHO);
    await validarContrato('carrinhos.conclusao', segunda);

    const estoqueFinal = await obterEstoque(request, produto.id);
    expect(estoqueFinal).toBe(estoqueAposCriar);
    expect(estoqueFinal).toBe(estoqueInicial - 2);
  });
});
