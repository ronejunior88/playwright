/**
 * Motor de validação de contratos (sem dependências externas).
 *
 * Objetivo: descrever a forma esperada de uma resposta JSON e comparar a
 * resposta real com essa descrição, relatando **todas** as divergências
 * encontradas (não apenas a primeira) e classificando cada uma como
 * incompatível ou compatível.
 *
 * Decisões de projeto:
 * - Sem dependência externa: a suíte é 100% API e já não usa bibliotecas de
 *   validação; um motor pequeno e tipado atende ao caso sem aumentar a
 *   superfície do projeto.
 * - Mensagens **não ecoam o conteúdo de strings** (apenas tipo e tamanho),
 *   para que uma resposta com `password` em texto claro nunca apareça em um
 *   log ou relatório de falha.
 * - Campos adicionais são registrados como divergência **compatível**: a API
 *   pode ganhar campos opcionais sem quebrar quem consome o contrato.
 */

export type CategoriaDivergencia =
  | 'campo-obrigatorio-ausente'
  | 'tipo-incompativel'
  | 'estrutura-incompativel'
  | 'valor-incompativel'
  | 'status-incompativel'
  | 'content-type-incompativel'
  | 'campo-proibido-presente'
  | 'campo-adicional';

export type Compatibilidade = 'incompativel' | 'compativel';

export interface Divergencia {
  /** Caminho do campo no corpo, ex.: `produtos[0].preco`. */
  caminho: string;
  /** O que o contrato exige. */
  esperado: string;
  /** O que foi observado (sem expor conteúdo de strings). */
  recebido: string;
  categoria: CategoriaDivergencia;
  compatibilidade: Compatibilidade;
  mensagem: string;
}

export interface Schema {
  /** Descrição curta usada nas mensagens de falha. */
  readonly descricao: string;
  /** `true` quando o campo pode faltar. */
  readonly opcional: boolean;
  validar(valor: unknown, caminho: string): Divergencia[];
}

/** Categorias que indicam quebra real de contrato. */
const CATEGORIAS_INCOMPATIVEIS: CategoriaDivergencia[] = [
  'campo-obrigatorio-ausente',
  'tipo-incompativel',
  'estrutura-incompativel',
  'valor-incompativel',
  'status-incompativel',
  'content-type-incompativel',
  'campo-proibido-presente',
];

export function classificar(categoria: CategoriaDivergencia): Compatibilidade {
  return CATEGORIAS_INCOMPATIVEIS.includes(categoria)
    ? 'incompativel'
    : 'compativel';
}

function descreverValor(valor: unknown): string {
  if (valor === undefined) return 'ausente';
  if (valor === null) return 'null';
  if (Array.isArray(valor)) return `array (${valor.length} itens)`;
  if (typeof valor === 'object') {
    const chaves = Object.keys(valor as Record<string, unknown>);
    return `objeto (${chaves.length} chaves: ${chaves.join(', ')})`;
  }
  if (typeof valor === 'string') return `texto (${valor.length} caracteres)`;
  return `${typeof valor} (${String(valor)})`;
}

function divergencia(
  caminho: string,
  esperado: string,
  valor: unknown,
  categoria: CategoriaDivergencia,
): Divergencia {
  const compatibilidade = classificar(categoria);
  return {
    caminho,
    esperado,
    recebido: descreverValor(valor),
    categoria,
    compatibilidade,
    mensagem: `${caminho || '(corpo)'}: esperado ${esperado}, recebido ${descreverValor(valor)}`,
  };
}

/**
 * Cria uma divergência manualmente (usada por invariantes semânticas que não
 * são descritas por um schema de campos).
 */
export function criarDivergencia(
  caminho: string,
  esperado: string,
  valor: unknown,
  categoria: CategoriaDivergencia,
): Divergencia {
  return divergencia(caminho, esperado, valor, categoria);
}

export interface OpcoesTexto {
  min?: number;
  max?: number;
  padrao?: RegExp;
  valores?: readonly string[];
}

export function texto(opcoes: OpcoesTexto = {}): Schema {
  const descricao = 'texto';
  return {
    descricao,
    opcional: false,
    validar(valor: unknown, caminho: string): Divergencia[] {
      if (typeof valor !== 'string') {
        return [divergencia(caminho, descricao, valor, 'tipo-incompativel')];
      }
      const encontrados: Divergencia[] = [];
      if (opcoes.min !== undefined && valor.length < opcoes.min) {
        encontrados.push(
          divergencia(
            caminho,
            `texto com pelo menos ${opcoes.min} caractere(s)`,
            valor,
            'valor-incompativel',
          ),
        );
      }
      if (opcoes.max !== undefined && valor.length > opcoes.max) {
        encontrados.push(
          divergencia(
            caminho,
            `texto com no máximo ${opcoes.max} caractere(s)`,
            valor,
            'valor-incompativel',
          ),
        );
      }
      if (opcoes.valores && !opcoes.valores.includes(valor)) {
        encontrados.push(
          divergencia(
            caminho,
            `um dos valores: ${opcoes.valores.join(' | ')}`,
            valor,
            'valor-incompativel',
          ),
        );
      }
      if (opcoes.padrao && !opcoes.padrao.test(valor)) {
        encontrados.push(
          divergencia(
            caminho,
            `texto no formato ${opcoes.padrao.source}`,
            valor,
            'valor-incompativel',
          ),
        );
      }
      return encontrados;
    },
  };
}

export interface OpcoesNumero {
  inteiro?: boolean;
  min?: number;
  max?: number;
  exclusivoMin?: number;
}

export function numero(opcoes: OpcoesNumero = {}): Schema {
  const descricao = opcoes.inteiro ? 'número inteiro' : 'número';
  return {
    descricao,
    opcional: false,
    validar(valor: unknown, caminho: string): Divergencia[] {
      if (typeof valor !== 'number' || !Number.isFinite(valor)) {
        return [divergencia(caminho, descricao, valor, 'tipo-incompativel')];
      }
      const encontrados: Divergencia[] = [];
      if (opcoes.inteiro && !Number.isInteger(valor)) {
        encontrados.push(
          divergencia(caminho, descricao, valor, 'valor-incompativel'),
        );
      }
      if (opcoes.min !== undefined && valor < opcoes.min) {
        encontrados.push(
          divergencia(
            caminho,
            `número maior ou igual a ${opcoes.min}`,
            valor,
            'valor-incompativel',
          ),
        );
      }
      if (opcoes.max !== undefined && valor > opcoes.max) {
        encontrados.push(
          divergencia(
            caminho,
            `número menor ou igual a ${opcoes.max}`,
            valor,
            'valor-incompativel',
          ),
        );
      }
      if (opcoes.exclusivoMin !== undefined && valor <= opcoes.exclusivoMin) {
        encontrados.push(
          divergencia(
            caminho,
            `número maior que ${opcoes.exclusivoMin}`,
            valor,
            'valor-incompativel',
          ),
        );
      }
      return encontrados;
    },
  };
}

export function booleano(): Schema {
  return {
    descricao: 'booleano',
    opcional: false,
    validar(valor: unknown, caminho: string): Divergencia[] {
      if (typeof valor !== 'boolean') {
        return [divergencia(caminho, 'booleano', valor, 'tipo-incompativel')];
      }
      return [];
    },
  };
}

export function nulo(): Schema {
  return {
    descricao: 'null',
    opcional: false,
    validar(valor: unknown, caminho: string): Divergencia[] {
      if (valor !== null) {
        return [divergencia(caminho, 'null', valor, 'tipo-incompativel')];
      }
      return [];
    },
  };
}

export function qualquer(): Schema {
  return {
    descricao: 'qualquer valor',
    opcional: false,
    validar(): Divergencia[] {
      return [];
    },
  };
}

export interface OpcoesObjeto {
  /** Reportar chaves não documentadas como divergência compatível. */
  camposConhecidos?: boolean;
  /** Chaves que não podem aparecer no corpo. */
  proibidos?: readonly string[];
}

export function objeto(
  campos: Record<string, Schema>,
  opcoes: OpcoesObjeto = {},
): Schema {
  const reportarAdicionais = opcoes.camposConhecidos !== false;
  const proibidos = new Set(opcoes.proibidos ?? []);

  return {
    descricao: 'objeto',
    opcional: false,
    validar(valor: unknown, caminho: string): Divergencia[] {
      if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
        return [
          divergencia(caminho, 'objeto', valor, 'estrutura-incompativel'),
        ];
      }

      const registro = valor as Record<string, unknown>;
      const encontrados: Divergencia[] = [];

      for (const [chave, schema] of Object.entries(campos)) {
        const caminhoCampo = caminho ? `${caminho}.${chave}` : chave;
        const presente = Object.prototype.hasOwnProperty.call(registro, chave);

        if (!presente) {
          if (schema.opcional) {
            continue;
          }
          encontrados.push(
            divergencia(
              caminhoCampo,
              schema.descricao,
              undefined,
              'campo-obrigatorio-ausente',
            ),
          );
          continue;
        }

        encontrados.push(...schema.validar(registro[chave], caminhoCampo));
      }

      for (const chave of proibidos) {
        if (Object.prototype.hasOwnProperty.call(registro, chave)) {
          encontrados.push(
            divergencia(
              caminho ? `${caminho}.${chave}` : chave,
              'campo ausente',
              registro[chave],
              'campo-proibido-presente',
            ),
          );
        }
      }

      if (reportarAdicionais) {
        for (const chave of Object.keys(registro)) {
          if (
            Object.prototype.hasOwnProperty.call(campos, chave) ||
            proibidos.has(chave)
          ) {
            continue;
          }
          encontrados.push(
            divergencia(
              caminho ? `${caminho}.${chave}` : chave,
              'campo não documentado no contrato',
              registro[chave],
              'campo-adicional',
            ),
          );
        }
      }

      return encontrados;
    },
  };
}

export interface OpcoesArray {
  minItens?: number;
}

export function array(itens: Schema, opcoes: OpcoesArray = {}): Schema {
  return {
    descricao: 'array',
    opcional: false,
    validar(valor: unknown, caminho: string): Divergencia[] {
      if (!Array.isArray(valor)) {
        return [
          divergencia(caminho, 'array', valor, 'estrutura-incompativel'),
        ];
      }
      const encontrados: Divergencia[] = [];
      if (opcoes.minItens !== undefined && valor.length < opcoes.minItens) {
        encontrados.push(
          divergencia(
            caminho,
            `array com pelo menos ${opcoes.minItens} item(ns)`,
            valor,
            'estrutura-incompativel',
          ),
        );
      }
      valor.forEach((item, indice) => {
        encontrados.push(...itens.validar(item, `${caminho}[${indice}]`));
      });
      return encontrados;
    },
  };
}

export interface OpcoesMapa {
  minChaves?: number;
  proibidas?: readonly string[];
}

/**
 * Objeto cujas chaves são livres e cujos valores são textos. Usado no formato
 * de erro por campo da API (`{ "nome": "nome é obrigatório" }`).
 */
export function mapaDeTextos(opcoes: OpcoesMapa = {}): Schema {
  const proibidas = new Set(opcoes.proibidas ?? []);
  return {
    descricao: 'objeto de mensagens por campo',
    opcional: false,
    validar(valor: unknown, caminho: string): Divergencia[] {
      if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
        return [
          divergencia(caminho, 'objeto de mensagens', valor, 'estrutura-incompativel'),
        ];
      }
      const registro = valor as Record<string, unknown>;
      const encontrados: Divergencia[] = [];
      const chaves = Object.keys(registro);

      if (opcoes.minChaves !== undefined && chaves.length < opcoes.minChaves) {
        encontrados.push(
          divergencia(
            caminho,
            `objeto com pelo menos ${opcoes.minChaves} chave(s)`,
            valor,
            'estrutura-incompativel',
          ),
        );
      }

      for (const chave of chaves) {
        const caminhoCampo = caminho ? `${caminho}.${chave}` : chave;
        if (proibidas.has(chave)) {
          encontrados.push(
            divergencia(
              caminhoCampo,
              'chave não permitida neste formato de erro',
              registro[chave],
              'campo-proibido-presente',
            ),
          );
          continue;
        }
        if (typeof registro[chave] !== 'string') {
          encontrados.push(
            divergencia(caminhoCampo, 'texto', registro[chave], 'tipo-incompativel'),
          );
        }
      }

      return encontrados;
    },
  };
}

/** Marca um schema como opcional (o campo pode não existir no corpo). */
export function opcionado(schema: Schema): Schema {
  return { ...schema, opcional: true };
}

/** Executa a validação de um schema contra um valor. */
export function validarSchema(
  schema: Schema,
  valor: unknown,
  caminho = '',
): Divergencia[] {
  return schema.validar(valor, caminho);
}
