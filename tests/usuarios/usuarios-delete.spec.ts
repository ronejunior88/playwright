import { expect, test } from '../fixtures';
import {
  lerJson,
  MENSAGEM_EXCLUIDO_SUCESSO,
  MENSAGEM_NENHUM_EXCLUIDO,
  type MensagemResposta,
} from '../helpers/resposta';
import { validarContrato } from '../helpers/contratos';
import { fazerLogin } from '../helpers/autenticacao';
import { criarCarrinhoTeste, cancelarCompraSeguro } from '../helpers/carrinhos';
import { criarProdutoTeste, excluirProduto } from '../helpers/produtos';
import {
  criarUsuarioTeste,
  excluirUsuario,
  gerarIdUnico,
  MENSAGEM_USUARIO_NAO_ENCONTRADO,
} from '../helpers/usuarios';

interface ErroUsuarioComCarrinho {
  message?: string;
  idCarrinho?: string;
}

test.describe('Exclusão de usuários - DELETE /usuarios/{_id}', () => {
  const idsCriados: string[] = [];

  test.afterEach(async ({ request }) => {
    for (const id of idsCriados.splice(0)) {
      await excluirUsuario(request, id);
    }
  });

  test('deve excluir um usuário existente e remover o registro @critico', async ({
    request,
  }) => {
    const usuario = await criarUsuarioTeste(request);
    idsCriados.push(usuario.id);

    const response = await request.delete(`/usuarios/${usuario.id}`);

    const body = await lerJson<MensagemResposta>(response, 200);
    expect(body.message).toBe(MENSAGEM_EXCLUIDO_SUCESSO);

    await validarContrato('usuarios.exclusao', response);

    const consulta = await request.get(`/usuarios/${usuario.id}`);
    const corpo = await lerJson<MensagemResposta>(consulta, 400);
    expect(corpo.message).toBe(MENSAGEM_USUARIO_NAO_ENCONTRADO);

    await validarContrato('erros.mensagem', consulta);
  });

  test('deve retornar sucesso sem excluir registros ao excluir usuário inexistente', async ({
    request,
  }) => {
    const id = gerarIdUnico();

    const response = await request.delete(`/usuarios/${id}`);

    const body = await lerJson<MensagemResposta>(response, 200);
    expect(body.message).toBe(MENSAGEM_NENHUM_EXCLUIDO);

    await validarContrato('usuarios.exclusao', response);
  });

  test('deve rejeitar a exclusão de usuário com carrinho cadastrado @critico', async ({
    request,
  }) => {
    const admin = await criarUsuarioTeste(request, { administrador: 'true' });
    const tokenAdmin = await fazerLogin(request, admin.email, admin.password);

    const usuario = await criarUsuarioTeste(request);
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

      const response = await request.delete(`/usuarios/${usuario.id}`);

      const body = await lerJson<ErroUsuarioComCarrinho>(response, 400);
      expect(body.message).toBe(
        'Não é permitido excluir usuário com carrinho cadastrado',
      );
      expect(body.idCarrinho).toBe(carrinhoId);

      await validarContrato('erros.mensagem', response);

      const consulta = await request.get(`/usuarios/${usuario.id}`);
      expect(consulta.status()).toBe(200);
    } finally {
      await cancelarCompraSeguro(request, tokenUsuario);
      await excluirProduto(request, tokenAdmin, produto.id);
      await excluirUsuario(request, usuario.id);
      await excluirUsuario(request, admin.id);
    }
  });
});