import { expect, test } from '../fixtures';
import {
  bearer,
  fazerLogin,
  MENSAGEM_ROTA_ADMIN,
  MENSAGEM_TOKEN_INVALIDO,
} from '../helpers/autenticacao';
import { criarCarrinhoTeste, cancelarCompraSeguro } from '../helpers/carrinhos';
import { validarContrato } from '../helpers/contratos';
import {
  criarProdutoTeste,
  criarUsuarioProdutoTeste,
  excluirProduto,
  MENSAGEM_PRODUTO_NAO_ENCONTRADO,
  type ProdutoApi,
} from '../helpers/produtos';
import {
  lerJson,
  MENSAGEM_EXCLUIDO_SUCESSO,
  MENSAGEM_NENHUM_EXCLUIDO,
  type MensagemResposta,
} from '../helpers/resposta';
import {
  excluirUsuario,
  gerarIdUnico,
  type UsuarioCriado,
} from '../helpers/usuarios';

interface ErroProdutoComCarrinho {
  message?: string;
  idCarrinhos?: string[];
}

test.describe('Exclusão de produtos - DELETE /produtos/{_id}', () => {
  let usuarioAdmin: UsuarioCriado;
  let usuarioComum: UsuarioCriado;
  let tokenAdmin: string;
  let tokenComum: string;
  const idsCriados: string[] = [];

  test.beforeAll(async ({ request }) => {
    usuarioAdmin = await criarUsuarioProdutoTeste(request, 'true');
    usuarioComum = await criarUsuarioProdutoTeste(request, 'false');
    tokenAdmin = await fazerLogin(
      request,
      usuarioAdmin.email,
      usuarioAdmin.password,
    );
    tokenComum = await fazerLogin(
      request,
      usuarioComum.email,
      usuarioComum.password,
    );
  });

  test.afterEach(async ({ request }) => {
    for (const id of idsCriados.splice(0)) {
      await excluirProduto(request, tokenAdmin, id);
    }
  });

  test.afterAll(async ({ request }) => {
    await excluirUsuario(request, usuarioAdmin.id);
    await excluirUsuario(request, usuarioComum.id);
  });

  test('deve excluir um produto existente e remover o registro @critico', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const response = await request.delete(`/produtos/${produto.id}`, {
      headers: { Authorization: bearer(tokenAdmin) },
    });

    const body = await lerJson<MensagemResposta>(response, 200);
    expect(body.message).toBe(MENSAGEM_EXCLUIDO_SUCESSO);

    await validarContrato('produtos.exclusao', response);

    const consulta = await request.get(`/produtos/${produto.id}`);
    const corpo = await lerJson<MensagemResposta>(consulta, 400);
    expect(corpo.message).toBe(MENSAGEM_PRODUTO_NAO_ENCONTRADO);

    await validarContrato('erros.mensagem', consulta);
  });

  test('deve retornar sucesso sem excluir registros ao excluir produto inexistente', async ({
    request,
  }) => {
    const id = gerarIdUnico();

    const consultaPrevia = await request.get(`/produtos/${id}`);
    expect(consultaPrevia.status()).toBe(400);

    const response = await request.delete(`/produtos/${id}`, {
      headers: { Authorization: bearer(tokenAdmin) },
    });

    const body = await lerJson<MensagemResposta>(response, 200);
    expect(body.message).toBe(MENSAGEM_NENHUM_EXCLUIDO);

    await validarContrato('produtos.exclusao', response);
  });

  test('deve rejeitar a exclusão sem token de autorização', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const response = await request.delete(`/produtos/${produto.id}`);

    const body = await lerJson<MensagemResposta>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_INVALIDO);

    await validarContrato('auth.sem-token', response);

    const consulta = await request.get(`/produtos/${produto.id}`);
    const corpo = await lerJson<ProdutoApi>(consulta, 200);
    expect(corpo._id).toBe(produto.id);
    expect(corpo.nome).toBe(produto.nome);
  });

  test('deve rejeitar a exclusão com token inválido', async ({ request }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const response = await request.delete(`/produtos/${produto.id}`, {
      headers: { Authorization: bearer('token-invalido') },
    });

    const body = await lerJson<MensagemResposta>(response, 401);
    expect(body.message).toBe(MENSAGEM_TOKEN_INVALIDO);

    await validarContrato('auth.sem-token', response);

    const consulta = await request.get(`/produtos/${produto.id}`);
    const corpo = await lerJson<ProdutoApi>(consulta, 200);
    expect(corpo._id).toBe(produto.id);
    expect(corpo.nome).toBe(produto.nome);
  });

  test('deve rejeitar a exclusão com usuário comum (não administrador) @critico', async ({
    request,
  }) => {
    const produto = await criarProdutoTeste(request, tokenAdmin);
    idsCriados.push(produto.id);

    const response = await request.delete(`/produtos/${produto.id}`, {
      headers: { Authorization: bearer(tokenComum) },
    });

    const body = await lerJson<MensagemResposta>(response, 403);
    expect(body.message).toBe(MENSAGEM_ROTA_ADMIN);

    await validarContrato('auth.nao-admin', response);

    const consulta = await request.get(`/produtos/${produto.id}`);
    const corpo = await lerJson<ProdutoApi>(consulta, 200);
    expect(corpo._id).toBe(produto.id);
    expect(corpo.nome).toBe(produto.nome);
  });

  test('deve rejeitar a exclusão de produto vinculado a carrinho @critico', async ({
    request,
  }) => {
    const usuario = await criarUsuarioProdutoTeste(request, 'false');
    const tokenUsuario = await fazerLogin(
      request,
      usuario.email,
      usuario.password,
    );
    const produto = await criarProdutoTeste(request, tokenAdmin);

    try {
      const carrinhoId = await criarCarrinhoTeste(request, tokenUsuario, [
        { idProduto: produto.id, quantidade: 1 },
      ]);

      const response = await request.delete(`/produtos/${produto.id}`, {
        headers: { Authorization: bearer(tokenAdmin) },
      });

      const body = await lerJson<ErroProdutoComCarrinho>(response, 400);
      expect(body.message).toBe(
        'Não é permitido excluir produto que faz parte de carrinho',
      );
      expect(body.idCarrinhos).toContain(carrinhoId);

      await validarContrato('erros.mensagem', response);

      const consulta = await request.get(`/produtos/${produto.id}`);
      const corpo = await lerJson<ProdutoApi>(consulta, 200);
      expect(corpo._id).toBe(produto.id);
    } finally {
      await cancelarCompraSeguro(request, tokenUsuario);
      await excluirProduto(request, tokenAdmin, produto.id);
      await excluirUsuario(request, usuario.id);
    }
  });
});