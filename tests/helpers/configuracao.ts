import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const URL_BASE_PADRAO = 'https://serverest.dev';
export const URL_BASE_ENV = 'SERVE_REST_BASE_URL';
export const TIMEOUT_ENV = 'API_TIMEOUT_MS';
export const TIMEOUT_PADRAO_MS = 30_000;
export const TIMEOUT_MAXIMO_MS = 120_000;
export const WORKERS_PADRAO = 1;
export const RETRIES_CI = 2;

export interface ConfiguracaoSuite {
  baseURL: string;
  timeout: number;
  workers: number;
  retries: number;
  ci: boolean;
}

export class ErroConfiguracao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroConfiguracao';
  }
}

type Ambiente = Readonly<Record<string, string | undefined>>;

function validarBaseURL(valor: string): string {
  const texto = valor.trim();

  if (!texto) {
    throw new ErroConfiguracao(`${URL_BASE_ENV} não pode ser vazio.`);
  }

  let url: URL;

  try {
    url = new URL(texto);
  } catch {
    throw new ErroConfiguracao(`${URL_BASE_ENV} deve ser uma URL absoluta válida.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ErroConfiguracao(`${URL_BASE_ENV} deve usar http ou https.`);
  }

  if (url.username || url.password) {
    throw new ErroConfiguracao(`${URL_BASE_ENV} não deve conter credenciais.`);
  }

  if (url.search || url.hash) {
    throw new ErroConfiguracao(
      `${URL_BASE_ENV} não deve conter query string ou fragmento.`,
    );
  }

  const caminho = url.pathname.replace(/\/+$/, '');

  return `${url.origin}${caminho}`;
}

function validarTimeout(valor: string | undefined): number {
  if (valor === undefined || valor.trim() === '') {
    return TIMEOUT_PADRAO_MS;
  }

  const texto = valor.trim();

  if (!/^\d+$/.test(texto)) {
    throw new ErroConfiguracao(
      `${TIMEOUT_ENV} deve ser um número inteiro em milissegundos.`,
    );
  }

  const timeout = Number(texto);

  if (
    !Number.isSafeInteger(timeout) ||
    timeout <= 0 ||
    timeout > TIMEOUT_MAXIMO_MS
  ) {
    throw new ErroConfiguracao(
      `${TIMEOUT_ENV} deve estar entre 1 e ${TIMEOUT_MAXIMO_MS} ms.`,
    );
  }

  return timeout;
}

export function carregarConfiguracao(
  env: Ambiente = process.env,
): ConfiguracaoSuite {
  const baseURL = validarBaseURL(env[URL_BASE_ENV] ?? URL_BASE_PADRAO);
  const timeout = validarTimeout(env[TIMEOUT_ENV]);
  const ci = (env.CI ?? '').toLowerCase() === 'true';

  return {
    baseURL,
    timeout,
    workers: WORKERS_PADRAO,
    retries: ci ? RETRIES_CI : 0,
    ci,
  };
}

export function carregarArquivoEnv(
  caminho = resolve(process.cwd(), '.env'),
): boolean {
  if (!existsSync(caminho)) {
    return false;
  }

  try {
    process.loadEnvFile(caminho);
  } catch (erro) {
    throw new ErroConfiguracao(
      `não foi possível carregar ${caminho}: ${(erro as Error).message}`,
    );
  }

  return true;
}
