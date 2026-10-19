import { test as base, expect } from '@playwright/test';
import {
  classificarStatus,
  sanitizar,
  sanitizarTexto,
} from './helpers/diagnostico';

export interface InteracaoApi {
  metodo: string;
  endpoint: string;
  status: number;
  duracaoMs: number;
  dica?: string;
  erro?: string;
}

const METODOS_HTTP = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'fetch',
]);

function obterStatus(resposta: unknown): number {
  if (
    resposta &&
    typeof (resposta as { status?: unknown }).status === 'function'
  ) {
    return (resposta as { status: () => number }).status();
  }
  return 0;
}

export const test = base.extend({
  request: async ({ request }, use, testInfo) => {
    const interacoes: InteracaoApi[] = [];

    const instrumentado = new Proxy(request, {
      get(alvo, propriedade) {
        const original = Reflect.get(alvo, propriedade);

        if (
          typeof propriedade === 'string' &&
          METODOS_HTTP.has(propriedade) &&
          typeof original === 'function'
        ) {
          return async (...argumentos: unknown[]) => {
            const inicio = Date.now();
            try {
              const resposta = await (
                original as (...args: unknown[]) => Promise<unknown>
              ).apply(alvo, argumentos);
              const status = obterStatus(resposta);

              interacoes.push({
                metodo: propriedade.toUpperCase(),
                endpoint: sanitizarTexto(String(argumentos[0] ?? '')),
                status,
                duracaoMs: Date.now() - inicio,
                dica: classificarStatus(status),
              });

              return resposta;
            } catch (erro) {
              interacoes.push({
                metodo: propriedade.toUpperCase(),
                endpoint: sanitizarTexto(String(argumentos[0] ?? '')),
                status: 0,
                duracaoMs: Date.now() - inicio,
                dica: classificarStatus(0),
                erro: (erro as Error).message,
              });

              throw erro;
            }
          };
        }

        return typeof original === 'function'
          ? (original as (...args: unknown[]) => unknown).bind(alvo)
          : original;
      },
    });

    await use(instrumentado as typeof request);

    if (testInfo.status !== testInfo.expectedStatus && interacoes.length > 0) {
      await testInfo.attach('requisicoes-api', {
        contentType: 'application/json',
        body: JSON.stringify(sanitizar(interacoes), null, 2),
      });
    }
  },
});

export { expect };
