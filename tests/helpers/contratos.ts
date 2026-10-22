import { expect, type APIResponse } from '@playwright/test';
import {
  verificarContrato,
  type Divergencia,
  type VerificacaoContrato,
} from '../../contracts';

/**
 * Adaptador entre o motor de contratos (`contracts/`) e o Playwright.
 *
 * Responsabilidades:
 * - ler a resposta HTTP (status, content-type e corpo) de uma `APIResponse`;
 * - delegar a verificação ao motor, que devolve **todas** as divergências;
 * - falhar o teste apenas quando há divergência **incompatível**, listando
 *   endpoint, campo, expectativa e tipo recebido.
 *
 * As mensagens nunca reproduzem o conteúdo de strings do corpo (apenas tipo e
 * tamanho), para que respostas com dados sensíveis não virem relatório.
 */

export function formatarDivergencias(divergencias: Divergencia[]): string {
  return divergencias
    .map(
      (divergencia) =>
        `  - [${divergencia.categoria}] ${divergencia.caminho || '(corpo)'}: ` +
        `esperado ${divergencia.esperado}, recebido ${divergencia.recebido}`,
    )
    .join('\n');
}

export function descreverVerificacao(verificacao: VerificacaoContrato): string {
  const { contrato } = verificacao;
  const linhas = [
    `Contrato: ${contrato.id}`,
    `Endpoint: ${contrato.metodo} ${contrato.endpoint}`,
    `Fonte: ${contrato.fonte} | Situação: ${contrato.situacao}`,
    `Incompatíveis: ${verificacao.incompativeis.length}`,
    `Compatíveis: ${verificacao.compativeis.length}`,
  ];
  if (verificacao.incompativeis.length > 0) {
    linhas.push('Divergências incompatíveis:', formatarDivergencias(verificacao.incompativeis));
  }
  if (verificacao.compativeis.length > 0) {
    linhas.push('Divergências compatíveis:', formatarDivergencias(verificacao.compativeis));
  }
  return linhas.join('\n');
}

/**
 * Confere uma resposta real contra o contrato registrado e falha o teste
 * quando houver divergência incompatível.
 */
export async function validarContrato(
  id: string,
  resposta: APIResponse,
): Promise<VerificacaoContrato> {
  const texto = await resposta.text();
  const verificacao = verificarContrato(id, {
    status: resposta.status(),
    contentType: resposta.headers()['content-type'] ?? null,
    corpoTexto: texto,
  });

  expect(
    verificacao.incompativeis,
    `Resposta incompatível com o contrato "${id}"\n${descreverVerificacao(verificacao)}`,
  ).toEqual([]);

  return verificacao;
}

/**
 * Igual a {@link validarContrato}, mas sem falhar: devolve a verificação para
 * que o teste possa decidir o que fazer (útil em cenários de divergência
 * conhecida entre documentação e ambiente).
 */
export async function inspecionarContrato(
  id: string,
  resposta: APIResponse,
): Promise<VerificacaoContrato> {
  const texto = await resposta.text();
  return verificarContrato(id, {
    status: resposta.status(),
    contentType: resposta.headers()['content-type'] ?? null,
    corpoTexto: texto,
  });
}
