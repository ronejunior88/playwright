import type { APIResponse } from '@playwright/test';

const TENTATIVAS = 2;

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

      console.warn(`Cleanup ${descricao} falhou (status ${status}).`);
      return;
    } catch (erro) {
      if (tentativa < TENTATIVAS) {
        continue;
      }

      console.warn(`Cleanup ${descricao} falhou: ${(erro as Error).message}`);
      return;
    }
  }
}
