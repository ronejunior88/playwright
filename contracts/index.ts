import {
  CONTRATOS,
  CONTRATOS_POR_ID,
  type Contrato,
  type ExigenciaAuth,
  type FonteContrato,
  type MetodoHttp,
  type SituacaoContrato,
} from './contratos';
import {
  criarDivergencia,
  validarSchema,
  type Compatibilidade,
  type Divergencia,
} from './schema';

export * from './contratos';
export * from './schema';

/** Resposta HTTP mínima necessária para conferir um contrato. */
export interface RespostaContrato {
  status: number;
  /** Cabeçalho `content-type` recebido (pode incluir `; charset=utf-8`). */
  contentType: string | null;
  /** Corpo já convertido (JSON). */
  corpo?: unknown;
  /** Corpo bruto, usado quando `corpo` não foi informado. */
  corpoTexto?: string;
}

export interface VerificacaoContrato {
  contrato: Contrato;
  /** `true` quando não há nenhuma divergência incompatível. */
  valido: boolean;
  divergencias: Divergencia[];
  incompativeis: Divergencia[];
  compativeis: Divergencia[];
}

export class ContratoDesconhecidoError extends Error {
  constructor(id: string) {
    super(`Contrato desconhecido: "${id}"`);
    this.name = 'ContratoDesconhecidoError';
  }
}

/** Lista todos os contratos registrados. */
export function listarContratos(): Contrato[] {
  return [...CONTRATOS];
}

/** Recupera um contrato pelo identificador. */
export function buscarContrato(id: string): Contrato {
  const contrato = CONTRATOS_POR_ID.get(id);
  if (!contrato) {
    throw new ContratoDesconhecidoError(id);
  }
  return contrato;
}

/** Extrai o tipo MIME de um cabeçalho `content-type`. */
export function tipoMime(contentType: string | null): string | null {
  if (!contentType) {
    return null;
  }
  return contentType.split(';')[0].trim().toLowerCase();
}

/**
 * Confere uma resposta real contra o contrato registrado.
 *
 * A verificação cobre quatro aspectos:
 * 1. status HTTP esperado;
 * 2. tipo MIME da resposta;
 * 3. estrutura e tipos dos campos do corpo;
 * 4. invariantes semânticas do contrato (quando declaradas).
 *
 * Campos adicionais são aceitos e reportados como divergências **compatíveis**,
 * de modo que a API possa evoluir sem quebrar a suíte.
 */
export function verificarContrato(
  id: string,
  resposta: RespostaContrato,
): VerificacaoContrato {
  const contrato = buscarContrato(id);
  const divergencias: Divergencia[] = [];

  if (resposta.status !== contrato.status) {
    divergencias.push(
      criarDivergencia(
        '(status)',
        `status ${contrato.status}`,
        resposta.status,
        'status-incompativel',
      ),
    );
  }

  const mimeEsperado = tipoMime(contrato.contentType);
  const mimeRecebido = tipoMime(resposta.contentType);
  if (mimeRecebido !== mimeEsperado) {
    divergencias.push(
      criarDivergencia(
        '(content-type)',
        `content-type ${mimeEsperado}`,
        resposta.contentType === null ? undefined : resposta.contentType,
        'content-type-incompativel',
      ),
    );
  }

  let corpo = resposta.corpo;
  if (corpo === undefined && resposta.corpoTexto !== undefined) {
    try {
      corpo = JSON.parse(resposta.corpoTexto) as unknown;
    } catch {
      corpo = undefined;
      divergencias.push(
        criarDivergencia(
          '(corpo)',
          'JSON válido',
          resposta.corpoTexto,
          'estrutura-incompativel',
        ),
      );
    }
  }

  if (corpo !== undefined) {
    divergencias.push(...validarSchema(contrato.corpo, corpo));

    if (contrato.invariantes) {
      for (const invariante of contrato.invariantes) {
        divergencias.push(...invariante(corpo));
      }
    }
  }

  const incompativeis = divergencias.filter(
    (divergencia) => divergencia.compatibilidade === 'incompativel',
  );
  const compativeis = divergencias.filter(
    (divergencia) => divergencia.compatibilidade === 'compativel',
  );

  return {
    contrato,
    valido: incompativeis.length === 0,
    divergencias,
    incompativeis,
    compativeis,
  };
}

/** Filtra contratos por método, endpoint ou situação. */
export function filtrarContratos(filtro: {
  metodo?: MetodoHttp;
  endpoint?: string;
  autenticacao?: ExigenciaAuth;
  situacao?: SituacaoContrato;
  fonte?: FonteContrato;
}): Contrato[] {
  return listarContratos().filter((contrato) => {
    if (filtro.metodo && contrato.metodo !== filtro.metodo) return false;
    if (filtro.endpoint && contrato.endpoint !== filtro.endpoint) return false;
    if (filtro.autenticacao && contrato.autenticacao !== filtro.autenticacao)
      return false;
    if (filtro.situacao && contrato.situacao !== filtro.situacao) return false;
    if (filtro.fonte && contrato.fonte !== filtro.fonte) return false;
    return true;
  });
}

export type { Compatibilidade };
