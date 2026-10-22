import { expect, test } from './fixtures';
import { validarContrato } from './helpers/contratos';
import { lerJson } from './helpers/resposta';
import { type ListaUsuarios } from './helpers/usuarios';

test.describe('Health check da API ServeRest', () => {
  test('deve retornar a lista de usuários com estrutura válida @smoke @critico', async ({
    request,
  }) => {
    const response = await request.get('/usuarios');

    const body = await lerJson<ListaUsuarios>(response, 200);

    expect(body).toHaveProperty('quantidade');
    expect(typeof body.quantidade).toBe('number');

    expect(body).toHaveProperty('usuarios');
    expect(Array.isArray(body.usuarios)).toBe(true);

    for (const usuario of body.usuarios) {
      expect(typeof usuario._id).toBe('string');
      expect(typeof usuario.nome).toBe('string');
      expect(typeof usuario.email).toBe('string');
    }

    await validarContrato('usuarios.lista', response);
  });
});