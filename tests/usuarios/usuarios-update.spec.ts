import { expect, test } from '@playwright/test';
import {
  criarUsuarioTeste,
  excluirUsuario,
  gerarEmailUnico,
  gerarIdUnico,
  gerarNomeUnico,
  type DadosUsuario,
  type ErroValidacao,
  type MensagemResposta,
  type UsuarioApi,
  type UsuarioCriado,
} from '../helpers/usuarios';

test.describe('Atualização de usuários - PUT /usuarios/{_id}', () => {
  let usuarioBase: UsuarioCriado;
  const idsCriados: string[] = [];

  test.beforeAll(async ({ request }) => {
    usuarioBase = await criarUsuarioTeste(request);
  });

  test.afterEach(async ({ request }) => {
    for (const id of idsCriados.splice(0)) {
      await excluirUsuario(request, id);
    }
  });

  test.afterAll(async ({ request }) => {
    await excluirUsuario(request, usuarioBase.id);
  });

  test('deve atualizar um usuário existente e persistir as alterações', async ({
    request,
  }) => {
    const dadosAtualizados: DadosUsuario = {
      nome: `${usuarioBase.nome} Atualizado`,
      email: gerarEmailUnico('usuario-atualizado'),
      password: 'SenhaAtualizada@123',
      administrador: 'true',
    };

    const response = await request.put(`/usuarios/${usuarioBase.id}`, {
      data: dadosAtualizados,
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Registro alterado com sucesso');

    const consulta = await request.get(`/usuarios/${usuarioBase.id}`);
    expect(consulta.status()).toBe(200);

    const corpo = (await consulta.json()) as UsuarioApi;
    expect(corpo.nome).toBe(dadosAtualizados.nome);
    expect(corpo.email).toBe(dadosAtualizados.email);
    expect(corpo.administrador).toBe(dadosAtualizados.administrador);
    expect(typeof corpo.password).toBe('string');
    expect(corpo.password.length).toBeGreaterThan(0);
  });

  test('deve rejeitar atualização utilizando email de outro usuário', async ({
    request,
  }) => {
    const usuarioA = await criarUsuarioTeste(request);
    const usuarioB = await criarUsuarioTeste(request);
    idsCriados.push(usuarioA.id, usuarioB.id);

    const response = await request.put(`/usuarios/${usuarioA.id}`, {
      data: {
        nome: usuarioA.nome,
        email: usuarioB.email,
        password: usuarioA.password,
        administrador: usuarioA.administrador,
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Este email já está sendo usado');

    const consultaA = await request.get(`/usuarios/${usuarioA.id}`);
    expect(consultaA.status()).toBe(200);
    const corpoA = (await consultaA.json()) as UsuarioApi;
    expect(corpoA.email).toBe(usuarioA.email);

    const consultaB = await request.get(`/usuarios/${usuarioB.id}`);
    expect(consultaB.status()).toBe(200);
    const corpoB = (await consultaB.json()) as UsuarioApi;
    expect(corpoB.email).toBe(usuarioB.email);
  });

  test('deve criar um novo usuário ao atualizar com id inexistente', async ({
    request,
  }) => {
    const id = gerarIdUnico();

    const consultaPrevia = await request.get(`/usuarios/${id}`);
    expect(consultaPrevia.status()).toBe(400);

    const dados: DadosUsuario = {
      nome: gerarNomeUnico('Usuário Via Put'),
      email: gerarEmailUnico('usuario-via-put'),
      password: 'SenhaPut@123',
      administrador: 'false',
    };

    const response = await request.put(`/usuarios/${id}`, { data: dados });

    expect(response.status()).toBe(201);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Cadastro realizado com sucesso');
    expect(typeof body._id).toBe('string');
    expect(body._id!.length).toBeGreaterThan(0);

    idsCriados.push(body._id!);

    const consulta = await request.get(`/usuarios/${body._id}`);
    expect(consulta.status()).toBe(200);

    const corpo = (await consulta.json()) as UsuarioApi;
    expect(corpo.nome).toBe(dados.nome);
    expect(corpo.email).toBe(dados.email);
    expect(corpo.administrador).toBe(dados.administrador);
  });

  test('deve retornar erro ao atualizar sem nome', async ({ request }) => {
    const response = await request.put(`/usuarios/${usuarioBase.id}`, {
      data: {
        email: usuarioBase.email,
        password: usuarioBase.password,
        administrador: usuarioBase.administrador,
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.nome).toBe('nome é obrigatório');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao atualizar sem email', async ({ request }) => {
    const response = await request.put(`/usuarios/${usuarioBase.id}`, {
      data: {
        nome: usuarioBase.nome,
        password: usuarioBase.password,
        administrador: usuarioBase.administrador,
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.email).toBe('email é obrigatório');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao atualizar sem password', async ({ request }) => {
    const response = await request.put(`/usuarios/${usuarioBase.id}`, {
      data: {
        nome: usuarioBase.nome,
        email: usuarioBase.email,
        administrador: usuarioBase.administrador,
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.password).toBe('password é obrigatório');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao atualizar sem administrador', async ({
    request,
  }) => {
    const response = await request.put(`/usuarios/${usuarioBase.id}`, {
      data: {
        nome: usuarioBase.nome,
        email: usuarioBase.email,
        password: usuarioBase.password,
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.administrador).toBe('administrador é obrigatório');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao atualizar com payload vazio', async ({
    request,
  }) => {
    const response = await request.put(`/usuarios/${usuarioBase.id}`, {
      data: {},
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.nome).toBe('nome é obrigatório');
    expect(body.email).toBe('email é obrigatório');
    expect(body.password).toBe('password é obrigatório');
    expect(body.administrador).toBe('administrador é obrigatório');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao atualizar com dados de tipos incompatíveis', async ({
    request,
  }) => {
    const response = await request.put(`/usuarios/${usuarioBase.id}`, {
      data: {
        nome: usuarioBase.nome,
        email: usuarioBase.email,
        password: usuarioBase.password,
        administrador: true,
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.administrador).toBe("administrador deve ser 'true' ou 'false'");
    expect(body).not.toHaveProperty('_id');
  });
});