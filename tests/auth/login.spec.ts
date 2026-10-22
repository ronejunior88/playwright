import { expect, test } from '../fixtures';
import { validarContrato } from '../helpers/contratos';
import {
  criarUsuarioTeste,
  excluirUsuario,
  gerarEmailUnico,
  type UsuarioCriado,
} from '../helpers/usuarios';

interface RespostaLogin {
  message?: string;
  authorization?: string;
  email?: string;
  password?: string;
}

test.describe('Login da API ServeRest', () => {
  let usuarioTeste: UsuarioCriado;

  test.beforeAll(async ({ request }) => {
    usuarioTeste = await criarUsuarioTeste(request, { administrador: 'true' });
  });

  test.afterAll(async ({ request }) => {
    if (!usuarioTeste) {
      return;
    }

    await excluirUsuario(request, usuarioTeste.id);
  });

  test('deve realizar login com sucesso e retornar um token Bearer @smoke @critico', async ({
    request,
  }) => {
    const response = await request.post('/login', {
      data: {
        email: usuarioTeste.email,
        password: usuarioTeste.password,
      },
    });

    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');

    const body = (await response.json()) as RespostaLogin;

    expect(body).toHaveProperty('message');
    expect(typeof body.message).toBe('string');
    expect(body.message).toBe('Login realizado com sucesso');

    expect(body).toHaveProperty('authorization');
    expect(typeof body.authorization).toBe('string');
    expect(body.authorization!.length).toBeGreaterThan(0);

    expect(body.authorization!.startsWith('Bearer ')).toBe(true);

    const token = body.authorization!.slice('Bearer '.length);
    expect(token.length).toBeGreaterThan(0);
    expect(token.split('.').length).toBe(3);

    await validarContrato('login.sucesso', response);
  });

  test('deve rejeitar login com senha incorreta @smoke @critico', async ({ request }) => {
    const response = await request.post('/login', {
      data: {
        email: usuarioTeste.email,
        password: 'senha-incorreta-123',
      },
    });

    expect(response.status()).toBe(401);

    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');

    const body = (await response.json()) as RespostaLogin;

    expect(body).toHaveProperty('message');
    expect(typeof body.message).toBe('string');
    expect(body.message).toBe('Email e/ou senha inválidos');
    expect(body).not.toHaveProperty('authorization');

    await validarContrato('login.credenciais-invalidas', response);
  });

  test('deve rejeitar login com email inexistente @critico', async ({ request }) => {
    const response = await request.post('/login', {
      data: {
        email: gerarEmailUnico('login-inexistente'),
        password: 'senha-qualquer-123',
      },
    });

    expect(response.status()).toBe(401);

    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');

    const body = (await response.json()) as RespostaLogin;

    expect(body).toHaveProperty('message');
    expect(typeof body.message).toBe('string');
    expect(body.message).toBe('Email e/ou senha inválidos');
    expect(body).not.toHaveProperty('authorization');

    await validarContrato('login.credenciais-invalidas', response);
  });

  test('deve retornar erro ao enviar payload vazio', async ({ request }) => {
    const response = await request.post('/login', { data: {} });

    expect(response.status()).toBe(400);

    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');

    const body = (await response.json()) as RespostaLogin;

    expect(body).toHaveProperty('email');
    expect(body.email).toBe('email é obrigatório');
    expect(body).toHaveProperty('password');
    expect(body.password).toBe('password é obrigatório');
    expect(body).not.toHaveProperty('authorization');

    await validarContrato('login.payload-invalido', response);
  });

  test('deve retornar erro ao enviar login sem email', async ({ request }) => {
    const response = await request.post('/login', {
      data: {
        password: 'senha-qualquer-123',
      },
    });

    expect(response.status()).toBe(400);

    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');

    const body = (await response.json()) as RespostaLogin;

    expect(body).toHaveProperty('email');
    expect(body.email).toBe('email é obrigatório');
    expect(body).not.toHaveProperty('authorization');

    await validarContrato('login.payload-invalido', response);
  });

  test('deve retornar erro ao enviar login sem password', async ({
    request,
  }) => {
    const response = await request.post('/login', {
      data: {
        email: usuarioTeste.email,
      },
    });

    expect(response.status()).toBe(400);

    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');

    const body = (await response.json()) as RespostaLogin;

    expect(body).toHaveProperty('password');
    expect(body.password).toBe('password é obrigatório');
    expect(body).not.toHaveProperty('authorization');

    await validarContrato('login.payload-invalido', response);
  });

  test('deve retornar erro ao enviar email com formato inválido', async ({
    request,
  }) => {
    const response = await request.post('/login', {
      data: {
        email: 'email-invalido',
        password: 'senha-qualquer-123',
      },
    });

    expect(response.status()).toBe(400);

    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');

    const body = (await response.json()) as RespostaLogin;

    expect(body).toHaveProperty('email');
    expect(body.email).toBe('email deve ser um email válido');
    expect(body).not.toHaveProperty('authorization');

    await validarContrato('login.payload-invalido', response);
  });

  test('deve retornar erro ao enviar email e senha vazios', async ({
    request,
  }) => {
    const response = await request.post('/login', {
      data: {
        email: '',
        password: '',
      },
    });

    expect(response.status()).toBe(400);

    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');

    const body = (await response.json()) as RespostaLogin;

    expect(body).toHaveProperty('email');
    expect(body.email).toBe('email não pode ficar em branco');
    expect(body).toHaveProperty('password');
    expect(body.password).toBe('password não pode ficar em branco');
    expect(body).not.toHaveProperty('authorization');

    await validarContrato('login.payload-invalido', response);
  });

  test('deve retornar erro ao enviar email vazio com senha válida', async ({
    request,
  }) => {
    const response = await request.post('/login', {
      data: {
        email: '',
        password: 'senha-qualquer-123',
      },
    });

    expect(response.status()).toBe(400);

    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');

    const body = (await response.json()) as RespostaLogin;
    expect(body).toHaveProperty('email');
    expect(body.email).toBe('email não pode ficar em branco');
    expect(body).not.toHaveProperty('authorization');

    await validarContrato('login.payload-invalido', response);
  });

  test('deve rejeitar login com campos de tipo incorreto (não texto)', async ({
    request,
  }) => {
    const response = await request.post('/login', {
      data: {
        email: 12345,
        password: 999999,
      },
    });

    expect(response.status()).toBe(400);

    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');

    const body = (await response.json()) as RespostaLogin & {
      email?: string;
      password?: string;
    };
    expect(body).not.toHaveProperty('authorization');

    // Comportamento observado: rejeição por campo (`email deve ser uma string`).
    // A mensagem exata pode variar entre rejeição por campo e genérica; o
    // invariante verificado é: 400, sem token e com indicação de erro de campo.
    const indicouCampo =
      body.email === 'email deve ser uma string' ||
      typeof body.message === 'string';
    expect(
      indicouCampo,
      'login com tipos incorretos deve ser rejeitado',
    ).toBe(true);

    await validarContrato('login.payload-invalido', response);
  });
});
