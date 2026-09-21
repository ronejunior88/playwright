import { expect, test, type APIRequestContext } from '@playwright/test';

interface RespostaLogin {
  message?: string;
  authorization?: string;
  email?: string;
  password?: string;
}

interface UsuarioCriado {
  id: string;
  email: string;
  password: string;
}

const SENHA_USUARIO_TESTE = 'SenhaTeste@123';

function gerarEmailUnico(prefixo: string): string {
  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefixo}-${sufixo}@example.com`;
}

async function criarUsuarioTeste(
  request: APIRequestContext,
  email: string,
): Promise<UsuarioCriado> {
  const response = await request.post('/usuarios', {
    data: {
      nome: 'Usuário de Teste do Login',
      email,
      password: SENHA_USUARIO_TESTE,
      administrador: 'true',
    },
  });

  expect(response.status()).toBe(201);

  const body = (await response.json()) as { message: string; _id: string };
  expect(body).toHaveProperty('_id');

  return { id: body._id, email, password: SENHA_USUARIO_TESTE };
}

test.describe('Login da API ServeRest', () => {
  let usuarioTeste: UsuarioCriado;

  test.beforeAll(async ({ request }) => {
    usuarioTeste = await criarUsuarioTeste(request, gerarEmailUnico('login-test'));
  });

  test.afterAll(async ({ request }) => {
    if (!usuarioTeste) {
      return;
    }

    try {
      const response = await request.delete(`/usuarios/${usuarioTeste.id}`);
      if (response.status() !== 200) {
        console.warn(
          `Cleanup do usuário de teste do login falhou (status ${response.status()}).`,
        );
      }
    } catch {
      console.warn('Cleanup do usuário de teste do login falhou.');
    }
  });

  test('deve realizar login com sucesso e retornar um token Bearer', async ({
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
  });

  test('deve rejeitar login com senha incorreta', async ({ request }) => {
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
  });

  test('deve rejeitar login com email inexistente', async ({ request }) => {
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
  });
});