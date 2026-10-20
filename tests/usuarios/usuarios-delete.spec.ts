import { expect, test } from '../fixtures';
import { fazerLogin } from '../helpers/autenticacao';
import { criarCarrinhoTeste, cancelarCompraSeguro } from '../helpers/carrinhos';
import { criarProdutoTeste, excluirProduto } from '../helpers/produtos';
import {
  criarUsuarioTeste,
  excluirUsuario,
  gerarIdUnico,
  type MensagemResposta,
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

  test('deve excluir um usuário existente e remover o registro', async ({
    request,
  }) => {
    const usuario = await criarUsuarioTeste(request);
    idsCriados.push(usuario.id);

    const response = await request.delete(`/usuarios/${usuario.id}`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Registro excluído com sucesso');

    const consulta = await request.get(`/usuarios/${usuario.id}`);
    expect(consulta.status()).toBe(400);

    const corpo = (await consulta.json()) as MensagemResposta;
    expect(corpo.message).toBe('Usuário não encontrado');
  });

  test('deve retornar sucesso sem excluir registros ao excluir usuário inexistente', async ({
    request,
  }) => {
    const id = gerarIdUnico();

    const response = await request.delete(`/usuarios/${id}`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Nenhum registro excluído');
  });

  test('deve rejeitar a exclusão de usuário com carrinho cadastrado', async ({
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

      expect(response.status()).toBe(400);
      expect(response.headers()['content-type'] ?? '').toContain(
        'application/json',
      );

      const body = (await response.json()) as ErroUsuarioComCarrinho;
      expect(body.message).toBe(
        'Não é permitido excluir usuário com carrinho cadastrado',
      );
      expect(body.idCarrinho).toBe(carrinhoId);

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