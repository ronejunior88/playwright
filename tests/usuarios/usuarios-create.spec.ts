import { expect, test } from '@playwright/test';
import {
  excluirUsuario,
  gerarEmailUnico,
  gerarNomeUnico,
  type DadosUsuario,
  type ErroValidacao,
  type ListaUsuarios,
  type MensagemResposta,
  type UsuarioApi,
} from '../helpers/usuarios';

test.describe('Criação de usuários - POST /usuarios', () => {
  const idsCriados: string[] = [];

  test.afterEach(async ({ request }) => {
    for (const id of idsCriados.splice(0)) {
      await excluirUsuario(request, id);
    }
  });

  test('deve criar um usuário com sucesso e persistir os dados', async ({
    request,
  }) => {
    const dados: DadosUsuario = {
      nome: gerarNomeUnico('Usuário Criado'),
      email: gerarEmailUnico('usuario-create'),
      password: 'SenhaCriada@123',
      administrador: 'true',
    };

    const response = await request.post('/usuarios', { data: dados });

    expect(response.status()).toBe(201);

    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');

    const body = (await response.json()) as MensagemResposta;
    expect(body.message).toBe('Cadastro realizado com sucesso');
    expect(body).toHaveProperty('_id');
    expect(typeof body._id).toBe('string');
    expect(body._id!.length).toBeGreaterThan(0);

    idsCriados.push(body._id!);

    const consulta = await request.get(`/usuarios/${body._id}`);
    expect(consulta.status()).toBe(200);

    const corpo = (await consulta.json()) as UsuarioApi;
    expect(corpo._id).toBe(body._id);
    expect(corpo.nome).toBe(dados.nome);
    expect(corpo.email).toBe(dados.email);
    expect(corpo.administrador).toBe(dados.administrador);
    expect(typeof corpo.password).toBe('string');
    expect(corpo.password.length).toBeGreaterThan(0);
  });

  test('deve rejeitar a criação com email duplicado', async ({ request }) => {
    const dados: DadosUsuario = {
      nome: gerarNomeUnico('Usuário Duplicado'),
      email: gerarEmailUnico('usuario-duplicado'),
      password: 'SenhaDuplicada@123',
      administrador: 'false',
    };

    const primeiro = await request.post('/usuarios', { data: dados });
    expect(primeiro.status()).toBe(201);

    const primeiroBody = (await primeiro.json()) as MensagemResposta;
    idsCriados.push(primeiroBody._id!);

    const segundo = await request.post('/usuarios', { data: dados });

    expect(segundo.status()).toBe(400);

    const contentType = segundo.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');

    const segundoBody = (await segundo.json()) as MensagemResposta;
    expect(segundoBody.message).toBe('Este email já está sendo usado');
    expect(segundoBody).not.toHaveProperty('_id');

    const consulta = await request.get('/usuarios', {
      params: { email: dados.email },
    });
    expect(consulta.status()).toBe(200);

    const lista = (await consulta.json()) as ListaUsuarios;
    expect(lista.quantidade).toBe(1);
    expect(lista.usuarios).toHaveLength(1);
    expect(lista.usuarios[0]._id).toBe(primeiroBody._id);
  });

  test('deve retornar erro ao criar usuário sem nome', async ({ request }) => {
    const response = await request.post('/usuarios', {
      data: {
        email: gerarEmailUnico('usuario-sem-nome'),
        password: 'Senha123',
        administrador: 'false',
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.nome).toBe('nome é obrigatório');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao criar usuário sem email', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Sem Email'),
        password: 'Senha123',
        administrador: 'false',
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.email).toBe('email é obrigatório');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao criar usuário sem password', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Sem Senha'),
        email: gerarEmailUnico('usuario-sem-password'),
        administrador: 'false',
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.password).toBe('password é obrigatório');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao criar usuário sem administrador', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Sem Admin'),
        email: gerarEmailUnico('usuario-sem-admin'),
        password: 'Senha123',
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.administrador).toBe('administrador é obrigatório');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao enviar payload vazio', async ({ request }) => {
    const response = await request.post('/usuarios', { data: {} });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.nome).toBe('nome é obrigatório');
    expect(body.email).toBe('email é obrigatório');
    expect(body.password).toBe('password é obrigatório');
    expect(body.administrador).toBe('administrador é obrigatório');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao criar usuário com email inválido', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Email Inválido'),
        email: 'email-invalido',
        password: 'Senha123',
        administrador: 'false',
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.email).toBe('email deve ser um email válido');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao criar usuário com nome vazio', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: '',
        email: gerarEmailUnico('usuario-nome-vazio'),
        password: 'Senha123',
        administrador: 'false',
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.nome).toBe('nome não pode ficar em branco');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao criar usuário com email vazio', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Email Vazio'),
        email: '',
        password: 'Senha123',
        administrador: 'false',
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.email).toBe('email não pode ficar em branco');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao criar usuário com password vazio', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Sem Senha'),
        email: gerarEmailUnico('usuario-password-vazio'),
        password: '',
        administrador: 'false',
      },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');

    const body = (await response.json()) as ErroValidacao;
    expect(body.password).toBe('password não pode ficar em branco');
    expect(body).not.toHaveProperty('_id');
  });

  test('deve retornar erro ao criar usuário com administrador de tipo incorreto', async ({
    request,
  }) => {
    const response = await request.post('/usuarios', {
      data: {
        nome: gerarNomeUnico('Usuário Admin Booleano'),
        email: gerarEmailUnico('usuario-admin-booleano'),
        password: 'Senha123',
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