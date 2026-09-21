import { expect, test } from '@playwright/test';
import {
  criarUsuarioTeste,
  excluirUsuario,
  gerarIdUnico,
  type ErroValidacao,
  type ListaUsuarios,
  type MensagemResposta,
  type UsuarioApi,
} from '../helpers/usuarios';

test.describe('Consulta de usuários - GET /usuarios', () => {
  const idsCriados: string[] = [];

  test.afterEach(async ({ request }) => {
    for (const id of idsCriados.splice(0)) {
      await excluirUsuario(request, id);
    }
  });

  test('deve listar usuários com estrutura válida', async ({ request }) => {
    const response = await request.get('/usuarios');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaUsuarios;

    expect(body).toHaveProperty('quantidade');
    expect(typeof body.quantidade).toBe('number');

    expect(body).toHaveProperty('usuarios');
    expect(Array.isArray(body.usuarios)).toBe(true);

    for (const usuario of body.usuarios) {
      expect(typeof usuario._id).toBe('string');
      expect(typeof usuario.nome).toBe('string');
      expect(typeof usuario.email).toBe('string');
      expect(typeof usuario.administrador).toBe('string');
    }
  });

  test('deve retornar somente o usuário esperado ao filtrar por id', async ({
    request,
  }) => {
    const usuario = await criarUsuarioTeste(request);
    idsCriados.push(usuario.id);

    const response = await request.get('/usuarios', {
      params: { _id: usuario.id },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaUsuarios;
    expect(body.quantidade).toBe(1);
    expect(body.usuarios).toHaveLength(1);
    expect(body.usuarios[0]._id).toBe(usuario.id);
  });

  test('deve filtrar usuários por nome', async ({ request }) => {
    const usuario = await criarUsuarioTeste(request);
    idsCriados.push(usuario.id);

    const response = await request.get('/usuarios', {
      params: { nome: usuario.nome },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaUsuarios;
    expect(body.quantidade).toBeGreaterThanOrEqual(1);

    for (const usuarioEncontrado of body.usuarios) {
      expect(usuarioEncontrado.nome).toBe(usuario.nome);
    }

    const usuariosCriados = body.usuarios.filter(
      (u) => u._id === usuario.id,
    );
    expect(usuariosCriados).toHaveLength(1);
  });

  test('deve filtrar usuários por email', async ({ request }) => {
    const usuario = await criarUsuarioTeste(request);
    idsCriados.push(usuario.id);

    const response = await request.get('/usuarios', {
      params: { email: usuario.email },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaUsuarios;
    expect(body.quantidade).toBe(1);
    expect(body.usuarios).toHaveLength(1);
    expect(body.usuarios[0]._id).toBe(usuario.id);
    expect(body.usuarios[0].email).toBe(usuario.email);
  });

  test('deve filtrar usuários por administrador', async ({ request }) => {
    const usuario = await criarUsuarioTeste(request, { administrador: 'true' });
    idsCriados.push(usuario.id);

    const response = await request.get('/usuarios', {
      params: { administrador: 'true' },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ListaUsuarios;
    expect(body.quantidade).toBeGreaterThanOrEqual(1);

    for (const usuarioEncontrado of body.usuarios) {
      expect(usuarioEncontrado.administrador).toBe('true');
    }

    const usuariosCriados = body.usuarios.filter(
      (u) => u._id === usuario.id,
    );
    expect(usuariosCriados).toHaveLength(1);
  });

  test('deve consultar um usuário por id válido', async ({ request }) => {
    const usuario = await criarUsuarioTeste(request);
    idsCriados.push(usuario.id);

    const response = await request.get(`/usuarios/${usuario.id}`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as UsuarioApi;
    expect(body._id).toBe(usuario.id);
    expect(body.nome).toBe(usuario.nome);
    expect(body.email).toBe(usuario.email);
    expect(body.administrador).toBe(usuario.administrador);
    expect(typeof body.password).toBe('string');
    expect(body.password.length).toBeGreaterThan(0);
  });

  test('deve retornar erro ao consultar usuário inexistente', async ({
    request,
  }) => {
    const id = gerarIdUnico();

    const consultaPrevia = await request.get(`/usuarios/${id}`);
    expect(consultaPrevia.status()).toBe(400);

    const response = await request.get(`/usuarios/${id}`);

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Usuário não encontrado');
    expect(body).not.toHaveProperty('nome');
  });

  test('deve retornar erro ao consultar usuário com id de formato inválido', async ({
    request,
  }) => {
    const response = await request.get('/usuarios/id-invalido');

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.id).toBe('id deve ter exatamente 16 caracteres alfanuméricos');
  });
});