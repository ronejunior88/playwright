export interface Projeto {
  raiz: string;
  specs: string[];
  specsPerformance: string[];
  specsSelecao: string[];
  dependentes: Record<string, string[]>;
}

export function carregarProjeto(raiz?: string): Projeto;

export function construirDependentes(
  raiz: string,
  specsPrincipais: string[],
): Record<string, string[]>;

export function listarSpecs(raiz: string): {
  principais: string[];
  performance: string[];
};

export function resolverImportacao(
  arquivoAbsoluto: string,
  especificador: string,
): string | null;

export function extrairImportacoes(conteudo: string): string[];
