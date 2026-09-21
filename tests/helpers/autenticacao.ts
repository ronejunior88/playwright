import { expect, type APIRequestContext } from '@playwright/test';

export interface RespostaLogin {
  message?: string;
  authorization?: string;
}

export async function fazerLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const response = await request.post('/login', {
    data: { email, password },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type'] ?? '').toContain('application/json');

  const body = (await response.json()) as RespostaLogin;
  expect(body.message).toBe('Login realizado com sucesso');

  expect(
    body.authorization,
    'login deve retornar um token de autorização',
  ).toBeTruthy();
  expect(body.authorization!.startsWith('Bearer ')).toBe(true);

  const token = body.authorization!.slice('Bearer '.length);
  expect(token.length).toBeGreaterThan(0);
  expect(token.split('.').length).toBe(3);

  return token;
}