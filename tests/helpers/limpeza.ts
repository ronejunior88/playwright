import { test, type APIResponse } from '@playwright/test';
import { sanitizarTexto } from './diagnostico';

const TENTATIVAS = 2;

function registrarFalha(mensagem: string): void {
  console.warn(mensagem);

  try {
    test.info().annotations.push({ type: 'cleanup', description: mensagem });
  } catch {
    return;
  }
}

export async function executarLimpeza(
  descricao: string,
  operacao: () => Promise<APIResponse>,
): Promise<void> {
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa += 1) {
    try {
      const resposta = await operacao();
      const status = resposta.status();

      if (status === 200) {
        return;
      }

      if (status === 429 && tentativa < TENTATIVAS) {
        continue;
      }

      registrarFalha(`Cleanup ${descricao} falhou (status ${status}).`);
      return;
    } catch (erro) {
      if (tentativa < TENTATIVAS) {
        continue;
      }

      registrarFalha(
        `Cleanup ${descricao} falhou: ${sanitizarTexto((erro as Error).message)}`,
      );
      return;
    }
  }
}
