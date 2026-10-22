import { expect, type APIRequestContext } from '@playwright/test';
import { lerJson } from './resposta';

/**
 * Corpo devolvido pelo login: a mensagem de sucesso, o token de autorização e,
 * nos casos de erro por campo, os campos recusados.
 */
export interface RespostaLogin {
  message?: string;
  authorization?: string;
  email?: string;
  password?: string;
}

/** Mensagem devolvida quando o login é concluído com sucesso. */
export const MENSAGEM_LOGIN_SUCESSO = 'Login realizado com sucesso';

/** Mensagem devolvida quando as credenciais informadas não conferem. */
export const MENSAGEM_CREDENCIAIS_INVALIDAS = 'Email e/ou senha inválidos';

/** Mensagem devolvida quando o token está ausente, inválido ou expirado. */
export const MENSAGEM_TOKEN_INVALIDO =
  'Token de acesso ausente, inválido, expirado ou usuário do token não existe mais';

/** Mensagem devolvida quando a rota exige credencial de administrador. */
export const MENSAGEM_ROTA_ADMIN = 'Rota exclusiva para administradores';

/** Monta o header `Authorization` a partir do token puro devolvido no login. */
export function bearer(token: string): string {
  return `Bearer ${token}`;
}

export async function fazerLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const response = await request.post('/login', {
    data: { email, password },
  });

  const body = await lerJson<RespostaLogin>(response, 200, 'login');
  expect(body.message).toBe(MENSAGEM_LOGIN_SUCESSO);

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
