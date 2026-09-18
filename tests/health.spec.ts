import { expect, test } from '@playwright/test';

interface Usuario {
  _id: string;
  nome: string;
  email: string;
  administrador: string;
}

interface ListaUsuarios {
  quantidade: number;
  usuarios: Usuario[];
}

test.describe('Health check da API ServeRest', () => {
  test('deve retornar a lista de usuários com estrutura válida', async ({
    request,
  }) => {
    const response = await request.get('/usuarios');

    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');

    const body = (await response.json()) as ListaUsuarios;

    expect(body).toHaveProperty('quantidade');
    expect(typeof body.quantidade).toBe('number');

    expect(body).toHaveProperty('usuarios');
    expect(Array.isArray(body.usuarios)).toBe(true);

    if (body.usuarios.length > 0) {
      const primeiroUsuario = body.usuarios[0];
      expect(typeof primeiroUsuario._id).toBe('string');
      expect(typeof primeiroUsuario.nome).toBe('string');
      expect(typeof primeiroUsuario.email).toBe('string');
    }
  });
});