export type StatusGit = 'A' | 'M' | 'D' | 'R' | 'C' | string;

export interface AlteracaoArquivo {
  caminho: string;
  status?: StatusGit;
  caminhoAnterior?: string | null;
}

export interface OpcoesSelecao {
  arquivos: Array<string | AlteracaoArquivo> | null | undefined;
  dependentes?: Record<string, string[]>;
  specs?: string[];
  limiarCompleta?: number;
}

export interface ResultadoSelecao {
  modo: 'nenhum' | 'direcionada' | 'completa';
  nivel: 'A' | 'B' | 'C';
  testes: string[];
  latencia: boolean;
  motivos: string[];
  avisos: string[];
  arquivosIgnorados: string[];
  completaPor: string | null;
}

export const LIMIAR_COMPLETA: number;

export function normalizarCaminho(caminho: string): string;

export function categoria(caminho: string): string;

export function selecionar(opcoes: OpcoesSelecao): ResultadoSelecao;
