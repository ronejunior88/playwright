import { type APIRequestContext } from '@playwright/test';
import { expect, test } from '../fixtures';
import {
  cancelarCompraSeguro,
  concluirCompra,
  criarCarrinhoTeste,
  criarUsuarioAutenticado,
  listarCarrinhos,
  MENSAGEM_CARRINHO_NAO_ENCONTRADO,
  MENSAGEM_CONCLUSAO_SUCESSO,
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

test.describe('Conclusão de compra - DELETE /carrinhos/concluir-compra', () => {
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

  test('deve concluir a compra, remover o carrinho e manter o estoque reduzido', async ({
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

    const response = await concluirCompra(request, conta.token);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as MensagemCarrinho;
    expect(body.message).toBe(MENSAGEM_CONCLUSAO_SUCESSO);

    const consulta = await request.get(`/carrinhos/${carrinhoId}`);
    expect(consulta.status()).toBe(400);
    const corpoConsulta = (await consulta.json()) as ErroCarrinho;
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
    const conta = await novaConta(request);

    const response = await concluirCompra(request, conta.token);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as MensagemCarrinho;
    expect(body.message).toBe(MENSAGEM_USUARIO_SEM_CARRINHO);
  });

  test('deve rejeitar a conclusão sem token de autorização', async ({
    request,
  }) => {
    const response = await request.delete('/carrinhos/concluir-compra');

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as ErroCarrinho;
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);
  });

  test('deve rejeitar a conclusão com token inválido', async ({ request }) => {
    const response = await request.delete('/carrinhos/concluir-compra', {
      headers: { Authorization: bearer('token-invalido') },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type'] ?? '').toContain(
      'application/json',
    );

    const body = (await response.json()) as ErroCarrinho;
    expect(body.message).toBe(MENSAGEM_TOKEN_CARRINHO);
  });

  test('não deve concluir a mesma compra duas vezes', async ({ request }) => {
    const conta = await novaConta(request);
    const produto = await novoProduto(request, { preco: 112, estoque: 10 });
    const estoqueInicial = await obterEstoque(request, produto.id);

    await criarCarrinhoTeste(request, conta.token, [
      { idProduto: produto.id, quantidade: 2 },
    ]);
    const estoqueAposCriar = await obterEstoque(request, produto.id);

    const primeira = await concluirCompra(request, conta.token);
    expect(primeira.status()).toBe(200);
    expect(((await primeira.json()) as MensagemCarrinho).message).toBe(
      MENSAGEM_CONCLUSAO_SUCESSO,
    );

    const segunda = await concluirCompra(request, conta.token);
    expect(segunda.status()).toBe(200);
    expect(((await segunda.json()) as MensagemCarrinho).message).toBe(
      MENSAGEM_USUARIO_SEM_CARRINHO,
    );

    const estoqueFinal = await obterEstoque(request, produto.id);
    expect(estoqueFinal).toBe(estoqueAposCriar);
    expect(estoqueFinal).toBe(estoqueInicial - 2);
  });
});
