import { expect, test } from '@playwright/test';
import {
  criarUsuarioTeste,
  excluirUsuario,
  gerarIdUnico,
  type MensagemResposta,
} from '../helpers/usuarios';

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

  test.skip(
    'não executado nesta etapa: exclusão de usuário com carrinho cadastrado (requer dados de carrinho, fora do escopo da ETAPA 3)',
    async () => {},
  );
});